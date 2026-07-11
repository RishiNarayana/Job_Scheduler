import cronParser from 'cron-parser';
import { ScheduledJob } from '../../api/src/models/ScheduledJob.js';
import { Job } from '../../api/src/models/Job.js';
import { RetryPolicy } from '../../api/src/models/RetryPolicy.js';

export class CronScheduler {
  private intervalId?: NodeJS.Timeout;

  start() {
    console.log('Cron Scheduler service started.');
    this.intervalId = setInterval(async () => {
      try {
        await this.pollScheduledJobs();
      } catch (err) {
        console.error('Error polling scheduled jobs:', err);
      }
    }, 5000); // Poll every 5 seconds
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log('Cron Scheduler service stopped.');
  }

  private async pollScheduledJobs() {
    const now = new Date();
    
    // Find active scheduled jobs that are due
    const dueJobs = await ScheduledJob.find({
      isActive: true,
      nextRunAt: { $lte: now }
    });

    if (dueJobs.length === 0) return;

    console.log(`Found ${dueJobs.length} due cron scheduled jobs. Enqueueing...`);

    for (const sJob of dueJobs) {
      try {
        // Find retry policy limit
        let maxAttempts = 3;
        if (sJob.retryPolicyId) {
          const policy = await RetryPolicy.findById(sJob.retryPolicyId);
          if (policy) {
            maxAttempts = policy.maxAttempts;
          }
        }

        // 1. Create a queued job record
        await Job.create({
          queueId: sJob.queueId,
          status: 'queued',
          payload: sJob.payload,
          retryPolicyId: sJob.retryPolicyId,
          scheduledAt: new Date(),
          maxAttempts,
        });

        // 2. Compute next execution time
        const interval = cronParser.parseExpression(sJob.cronExpression);
        sJob.lastRunAt = now;
        sJob.nextRunAt = interval.next().toDate();
        await sJob.save();
        
        console.log(`Enqueued job from scheduled template: "${sJob.name}", next run at: ${sJob.nextRunAt}`);
      } catch (err) {
        console.error(`Failed to process scheduled job "${sJob.name}":`, err);
      }
    }
  }
}
