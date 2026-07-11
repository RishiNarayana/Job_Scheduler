import { connectDB, disconnectDB } from './connection.js';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { Project } from '../models/Project.js';
import { RetryPolicy } from '../models/RetryPolicy.js';
import { Queue } from '../models/Queue.js';
import { Job } from '../models/Job.js';
import { ScheduledJob } from '../models/ScheduledJob.js';
import { Worker } from '../models/Worker.js';
import { JobExecution } from '../models/JobExecution.js';
import { JobLog } from '../models/JobLog.js';
import { DeadLetterQueue } from '../models/DeadLetterQueue.js';
import { WorkerHeartbeat } from '../models/WorkerHeartbeat.js';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Starting database seeding...');
  await connectDB();

  // 1. Clear Collections
  console.log('Clearing existing database collections...');
  await Promise.all([
    User.deleteMany({}),
    Organization.deleteMany({}),
    OrganizationMember.deleteMany({}),
    Project.deleteMany({}),
    RetryPolicy.deleteMany({}),
    Queue.deleteMany({}),
    Job.deleteMany({}),
    ScheduledJob.deleteMany({}),
    Worker.deleteMany({}),
    JobExecution.deleteMany({}),
    JobLog.deleteMany({}),
    DeadLetterQueue.deleteMany({}),
    WorkerHeartbeat.deleteMany({}),
  ]);

  // 2. Create User
  console.log('Seeding default user...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);
  const adminUser = await User.create({
    email: 'admin@codity.com',
    passwordHash,
    fullName: 'Admin User',
  });

  // 3. Create Organization
  console.log('Seeding default organization...');
  const org = await Organization.create({
    name: 'Codity Corp',
    slug: 'codity',
  });

  // 4. Create Organization Member
  console.log('Adding user to organization...');
  await OrganizationMember.create({
    organizationId: org._id,
    userId: adminUser._id,
    role: 'owner',
  });

  // 5. Create Project
  console.log('Seeding default project...');
  const project = await Project.create({
    organizationId: org._id,
    name: 'Main Scheduler',
    slug: 'main-scheduler',
  });

  // 6. Create Retry Policies
  console.log('Seeding retry policies...');
  const exponentialPolicy = await RetryPolicy.create({
    projectId: project._id,
    name: 'Default Exponential',
    type: 'exponential',
    baseDelayMs: 1000,
    maxDelayMs: 60000,
    maxAttempts: 5,
  });

  const fixedPolicy = await RetryPolicy.create({
    projectId: project._id,
    name: 'Quick Fixed',
    type: 'fixed',
    baseDelayMs: 2000,
    maxDelayMs: 10000,
    maxAttempts: 3,
  });

  // 7. Create Queues
  console.log('Seeding queues...');
  const highPriorityQueue = await Queue.create({
    projectId: project._id,
    name: 'high-priority',
    priority: 10,
    concurrencyLimit: 3,
    retryPolicyId: exponentialPolicy._id,
  });

  const defaultQueue = await Queue.create({
    projectId: project._id,
    name: 'default',
    priority: 1,
    concurrencyLimit: 5,
    retryPolicyId: exponentialPolicy._id,
  });

  const notificationQueue = await Queue.create({
    projectId: project._id,
    name: 'notifications',
    priority: 2,
    concurrencyLimit: 10,
    retryPolicyId: fixedPolicy._id,
  });

  // 8. Create some initial Jobs
  console.log('Seeding initial jobs...');
  await Job.create([
    {
      queueId: defaultQueue._id,
      status: 'queued',
      payload: { task: 'process_images', images: ['img1.jpg', 'img2.jpg'] },
      maxAttempts: 5,
      retryPolicyId: exponentialPolicy._id,
      scheduledAt: new Date(),
    },
    {
      queueId: defaultQueue._id,
      status: 'queued',
      payload: { task: 'generate_report', format: 'pdf', month: 'July' },
      maxAttempts: 5,
      retryPolicyId: exponentialPolicy._id,
      scheduledAt: new Date(Date.now() + 60000), // scheduled in 1 minute
      idempotencyKey: 'report_july_2026',
    },
    {
      queueId: highPriorityQueue._id,
      status: 'queued',
      payload: { task: 'process_transaction', amount: 99.99, currency: 'USD' },
      maxAttempts: 5,
      retryPolicyId: exponentialPolicy._id,
      scheduledAt: new Date(),
    },
  ]);

  // 9. Create a Scheduled Job (Cron)
  console.log('Seeding scheduled job...');
  await ScheduledJob.create({
    projectId: project._id,
    queueId: notificationQueue._id,
    name: 'Hourly Database Cleanup',
    cronExpression: '0 * * * *',
    payload: { action: 'cleanup_stale_data' },
    isActive: true,
    retryPolicyId: fixedPolicy._id,
    nextRunAt: new Date(Date.now() + 3600000), // 1 hour from now approx
  });

  console.log('Database seeding complete!');
  await disconnectDB();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
