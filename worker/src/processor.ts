import { Queue } from '../../api/src/models/Queue.js';
import { Job, IJob } from '../../api/src/models/Job.js';
import { JobExecution } from '../../api/src/models/JobExecution.js';
import { JobLog } from '../../api/src/models/JobLog.js';
import { DeadLetterQueue } from '../../api/src/models/DeadLetterQueue.js';
import { RetryPolicy } from '../../api/src/models/RetryPolicy.js';
import { calculateRetryDelay } from '../../api/src/utils/retry.js';

export class JobProcessor {
  private workerId: string;
  private running: boolean = false;

  constructor(workerId: string) {
    this.workerId = workerId;
  }

  async start() {
    this.running = true;
    console.log(`Job Processor started for worker: ${this.workerId}`);
    
    while (this.running) {
      try {
        const processed = await this.processNextJob();
        if (!processed) {
          // Idle delay if no job was found
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (err) {
        console.error('Error in processor loop:', err);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  stop() {
    this.running = false;
    console.log('Job Processor stopping...');
  }

  private async processNextJob(): Promise<boolean> {
    // 1. Get all non-paused queues
    const queues = await Queue.find({ isPaused: false }).populate('retryPolicyId');
    if (queues.length === 0) return false;

    // 2. Sort queues by priority (higher priority first)
    queues.sort((a, b) => b.priority - a.priority);

    // 3. Scan queues to find one with capacity and an available job
    for (const queue of queues) {
      // Check concurrency limit if defined
      if (queue.concurrencyLimit !== undefined && queue.concurrencyLimit !== null) {
        const activeJobsCount = await Job.countDocuments({
          queueId: queue._id,
          status: { $in: ['claimed', 'running'] }
        });

        if (activeJobsCount >= queue.concurrencyLimit) {
          // This queue is currently full, skip to next queue
          continue;
        }
      }

      // Try to atomically claim a job from this queue
      const now = new Date();
      const job = await Job.findOneAndUpdate(
        {
          queueId: queue._id,
          status: { $in: ['queued', 'retrying'] },
          scheduledAt: { $lte: now }
        },
        {
          $set: {
            status: 'claimed',
            claimedBy: this.workerId
          },
          $inc: { attemptsMade: 1 }
        },
        {
          sort: { scheduledAt: 1, createdAt: 1 }, // FIFO for the same queue
          new: true
        }
      );

      if (job) {
        // We successfully claimed a job! Run it.
        await this.runJob(job, queue);
        return true;
      }
    }

    return false;
  }

  private async runJob(job: IJob, queue: any) {
    console.log(`Worker claiming and starting job: ${job._id} (Queue: ${queue.name}, Attempt: ${job.attemptsMade})`);
    
    // 1. Update job to running
    job.status = 'running';
    await job.save();

    // 2. Create Job Execution history record
    const execution = await JobExecution.create({
      jobId: job._id,
      workerId: this.workerId,
      attempt: job.attemptsMade,
      status: 'running',
      startedAt: new Date()
    });

    const execId = execution._id;

    // Helpers to log to JobLogs
    const logInfo = async (msg: string) => {
      console.log(`[Job ${job._id}] INFO: ${msg}`);
      await JobLog.create({ jobExecutionId: execId, level: 'info', message: msg, timestamp: new Date() });
    };

    const logWarn = async (msg: string) => {
      console.warn(`[Job ${job._id}] WARN: ${msg}`);
      await JobLog.create({ jobExecutionId: execId, level: 'warn', message: msg, timestamp: new Date() });
    };

    const logError = async (msg: string) => {
      console.error(`[Job ${job._id}] ERROR: ${msg}`);
      await JobLog.create({ jobExecutionId: execId, level: 'error', message: msg, timestamp: new Date() });
    };

    const startTime = Date.now();
    await logInfo(`Job claimed by worker node. Starting execution.`);
    await logInfo(`Payload: ${JSON.stringify(job.payload)}`);

    try {
      // Simulate task based on payload configuration
      const task = job.payload.task || 'default';
      await logInfo(`Executing task type: "${task}"`);

      switch (task) {
        case 'process_images':
          const images = job.payload.images || [];
          await logInfo(`Processing ${images.length} images...`);
          for (let i = 0; i < images.length; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            await logInfo(`Successfully processed image: ${images[i]}`);
          }
          break;

        case 'generate_report':
          const format = job.payload.format || 'csv';
          await logInfo(`Generating ${format.toUpperCase()} report...`);
          await new Promise((r) => setTimeout(r, 2000));
          await logInfo(`Report data compiled and saved.`);
          break;

        case 'process_transaction':
          const amount = job.payload.amount || 0;
          await logInfo(`Initiating bank transaction for amount: $${amount}`);
          await new Promise((r) => setTimeout(r, 1000));
          // Simulate intermittent network/processor errors (25% chance of failing)
          if (Math.random() < 0.25) {
            throw new Error('Merchant gateway timeout. Transaction could not be verified.');
          }
          await logInfo(`Transaction approved. Reference code: TXN-${Math.floor(Math.random() * 1000000)}`);
          break;

        case 'send_email':
          const recipient = job.payload.to || 'user@example.com';
          await logInfo(`Connecting to SMTP relay server...`);
          await new Promise((r) => setTimeout(r, 500));
          await logInfo(`Email dispatched to ${recipient}`);
          break;

        default:
          await logInfo(`Running standard background process...`);
          await new Promise((r) => setTimeout(r, 1500));
          await logInfo(`Process finished successfully.`);
          break;
      }

      const durationMs = Date.now() - startTime;
      await logInfo(`Job completed successfully in ${durationMs}ms`);

      // Mark execution completed
      execution.status = 'completed';
      execution.finishedAt = new Date();
      execution.durationMs = durationMs;
      await execution.save();

      // Mark job completed
      job.status = 'completed';
      job.claimedBy = undefined;
      await job.save();

    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errMsg = err.message || 'Unknown error occurred during processing';
      await logError(`Job execution failed: ${errMsg}`);

      // Mark execution failed
      execution.status = 'failed';
      execution.finishedAt = new Date();
      execution.durationMs = durationMs;
      execution.error = errMsg;
      await execution.save();

      // Handle Retries
      if (job.attemptsMade < job.maxAttempts) {
        // Schedule next retry
        let delayMs = 5000; // default delay
        const policyId = job.retryPolicyId || queue.retryPolicyId;

        if (policyId) {
          const policy = await RetryPolicy.findById(policyId);
          if (policy) {
            delayMs = calculateRetryDelay(
              {
                type: policy.type as 'fixed' | 'linear' | 'exponential',
                baseDelayMs: policy.baseDelayMs,
                maxDelayMs: policy.maxDelayMs,
                maxAttempts: policy.maxAttempts,
              },
              job.attemptsMade
            );
          }
        }

        const nextScheduled = new Date(Date.now() + delayMs);
        await logWarn(`Scheduling retry attempt #${job.attemptsMade + 1} in ${delayMs}ms (at ${nextScheduled.toISOString()})`);

        job.status = 'retrying';
        job.scheduledAt = nextScheduled;
        job.lastError = errMsg;
        job.claimedBy = undefined;
        await job.save();

      } else {
        // Max attempts reached, push to Dead Letter Queue
        await logError(`Max retry attempts (${job.maxAttempts}) reached. Moving to Dead Letter Queue.`);
        
        job.status = 'dead_letter';
        job.lastError = errMsg;
        job.claimedBy = undefined;
        await job.save();

        // Save to DLQ collection
        await DeadLetterQueue.create({
          jobId: job._id.toString(),
          queueId: job.queueId,
          payload: job.payload,
          attemptsMade: job.attemptsMade,
          lastError: errMsg,
          failedAt: new Date()
        });
      }
    }
  }
}
