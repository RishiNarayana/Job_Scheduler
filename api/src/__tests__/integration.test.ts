import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../db/connection.js';
import { Organization } from '../models/Organization.js';
import { Project } from '../models/Project.js';
import { RetryPolicy } from '../models/RetryPolicy.js';
import { Queue } from '../models/Queue.js';
import { Job } from '../models/Job.js';
import { JobExecution } from '../models/JobExecution.js';
import { DeadLetterQueue } from '../models/DeadLetterQueue.js';
import { JobProcessor } from '../../../worker/src/processor.js';

describe('Distributed Job Scheduler Integration & Concurrency Tests', () => {
  let orgId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;
  let retryPolicyId: mongoose.Types.ObjectId;
  let queueId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDB();
    await Job.init();

    // Clean any existing test databases
    await Organization.deleteMany({ name: /^Test Org/ });
    await Project.deleteMany({ name: /^Test Project/ });
    await RetryPolicy.deleteMany({ name: /^Test Policy/ });
    await Queue.deleteMany({ name: /^Test Queue/ });
    await Job.deleteMany({});
    await JobExecution.deleteMany({});
    await DeadLetterQueue.deleteMany({});

    // Setup basic organization, project, policy, and queue
    const org = await Organization.create({
      name: 'Test Org ' + Date.now(),
      slug: 'test-org-' + Date.now()
    });
    orgId = org._id as mongoose.Types.ObjectId;

    const project = await Project.create({
      organizationId: orgId,
      name: 'Test Project',
      slug: 'test-project'
    });
    projectId = project._id as mongoose.Types.ObjectId;

    const policy = await RetryPolicy.create({
      projectId,
      name: 'Test Policy',
      type: 'fixed',
      baseDelayMs: 100, // short delay for fast test runs
      maxDelayMs: 1000,
      maxAttempts: 3
    });
    retryPolicyId = policy._id as mongoose.Types.ObjectId;

    const queue = await Queue.create({
      projectId,
      name: 'Test Queue',
      priority: 10,
      concurrencyLimit: 50,
      retryPolicyId
    });
    queueId = queue._id as mongoose.Types.ObjectId;
  });

  afterAll(async () => {
    // Clean up database records
    await Job.deleteMany({});
    await JobExecution.deleteMany({});
    await DeadLetterQueue.deleteMany({});
    await Queue.deleteMany({ _id: queueId });
    await RetryPolicy.deleteMany({ _id: retryPolicyId });
    await Project.deleteMany({ _id: projectId });
    await Organization.deleteMany({ _id: orgId });
    await disconnectDB();
  });

  beforeEach(async () => {
    await Job.deleteMany({});
    await JobExecution.deleteMany({});
    await DeadLetterQueue.deleteMany({});
    vi.restoreAllMocks();
  });

  it('verifies full job lifecycle: create -> claim -> execute -> complete', async () => {
    const job = await Job.create({
      queueId,
      status: 'queued',
      payload: { task: 'send_email', to: 'user@example.com' },
      maxAttempts: 3,
      scheduledAt: new Date(Date.now() - 10000)
    });

    const workerId = new mongoose.Types.ObjectId().toString();
    const processor = new JobProcessor(workerId);

    // Run claim and process
    const processed = await processor.processNextJob();
    expect(processed).toBe(true);

    // Verify job in database is completed
    const updatedJob = await Job.findById(job._id);
    expect(updatedJob).not.toBeNull();
    expect(updatedJob!.status).toBe('completed');
    expect(updatedJob!.attemptsMade).toBe(1);
    expect(updatedJob!.claimedBy).toBeUndefined();

    // Verify execution history record is written
    const execution = await JobExecution.findOne({ jobId: job._id });
    expect(execution).not.toBeNull();
    expect(execution!.status).toBe('completed');
    expect(execution!.workerId!.toString()).toBe(workerId);
    expect(execution!.attempt).toBe(1);
    expect(execution!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('verifies failure path: handler throws -> retrying -> dead_letter', async () => {
    // We mock Math.random to always return 0.01, which triggers process_transaction throw (threshold is 0.25)
    vi.spyOn(Math, 'random').mockReturnValue(0.01);

    const job = await Job.create({
      queueId,
      status: 'queued',
      payload: { task: 'process_transaction', amount: 100 },
      maxAttempts: 2, // keep max attempts low for fast testing
      scheduledAt: new Date(Date.now() - 10000)
    });

    const workerId = new mongoose.Types.ObjectId().toString();
    const processor = new JobProcessor(workerId);

    // Attempt 1: Queue -> Retrying
    let processed = await processor.processNextJob();
    expect(processed).toBe(true);

    let updatedJob = await Job.findById(job._id);
    expect(updatedJob!.status).toBe('retrying');
    expect(updatedJob!.attemptsMade).toBe(1);
    expect(updatedJob!.lastError).toContain('Merchant gateway timeout');

    // Simulate scheduledAt reset to run immediately for attempt 2
    updatedJob!.scheduledAt = new Date();
    await updatedJob!.save();

    // Attempt 2: Retrying -> Dead Letter
    processed = await processor.processNextJob();
    expect(processed).toBe(true);

    updatedJob = await Job.findById(job._id);
    expect(updatedJob!.status).toBe('dead_letter');
    expect(updatedJob!.attemptsMade).toBe(2);

    // Verify written to Dead Letter Queue collection
    const dlqItem = await DeadLetterQueue.findOne({ jobId: job._id.toString() });
    expect(dlqItem).not.toBeNull();
    expect(dlqItem!.queueId.toString()).toBe(queueId.toString());
    expect(dlqItem!.lastError).toContain('Merchant gateway timeout');
  });

  it('verifies concurrency: 5 workers claiming 20 jobs simultaneously', async () => {
    const jobCount = 20;
    const workerCount = 5;

    // Create 20 queued jobs
    const jobs = [];
    for (let i = 0; i < jobCount; i++) {
      jobs.push({
        queueId,
        status: 'queued',
        payload: { task: 'send_email', to: `user${i}@example.com` },
        maxAttempts: 3,
        scheduledAt: new Date(Date.now() - 10000)
      });
    }
    await Job.insertMany(jobs);

    // Setup 5 processors
    const processors: JobProcessor[] = [];
    for (let i = 0; i < workerCount; i++) {
      processors.push(new JobProcessor(new mongoose.Types.ObjectId().toString()));
    }

    // Execute 20 claims concurrently
    // We launch 20 concurrent processNextJob calls
    const claimPromises = [];
    for (let i = 0; i < jobCount; i++) {
      // Pick worker round robin
      const processor = processors[i % workerCount];
      claimPromises.push(processor.processNextJob());
    }

    const results = await Promise.all(claimPromises);

    // How many claims returned true?
    const successfulClaims = results.filter(r => r === true).length;
    expect(successfulClaims).toBe(jobCount);

    // Verify all 20 jobs in database are marked as completed or running (and not claimed twice!)
    const allJobs = await Job.find({ queueId });
    expect(allJobs).toHaveLength(jobCount);

    for (const job of allJobs) {
      // Every single job should have been claimed exactly once, and have attemptsMade = 1
      expect(job.attemptsMade).toBe(1);
      expect(['completed', 'running']).toContain(job.status);
    }
  });

  it('verifies duplicate submission with the same idempotency key throws unique index violation', async () => {
    await Job.create({
      queueId,
      status: 'queued',
      payload: { task: 'send_email', to: 'user@example.com' },
      idempotencyKey: 'idemp-123',
      maxAttempts: 3,
      scheduledAt: new Date()
    });

    // Attempting to create another job in the same queue with the same idempotencyKey should fail due to unique index
    await expect(Job.create({
      queueId,
      status: 'queued',
      payload: { task: 'send_email', to: 'another@example.com' },
      idempotencyKey: 'idemp-123',
      maxAttempts: 3,
      scheduledAt: new Date()
    })).rejects.toThrow();
  });
});
