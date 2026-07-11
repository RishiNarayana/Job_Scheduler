"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronScheduler = void 0;
const cron_parser_1 = __importDefault(require("cron-parser"));
const ScheduledJob_js_1 = require("../../api/src/models/ScheduledJob.js");
const Job_js_1 = require("../../api/src/models/Job.js");
const RetryPolicy_js_1 = require("../../api/src/models/RetryPolicy.js");
class CronScheduler {
    intervalId;
    start() {
        console.log('Cron Scheduler service started.');
        this.intervalId = setInterval(async () => {
            try {
                await this.pollScheduledJobs();
            }
            catch (err) {
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
    async pollScheduledJobs() {
        const now = new Date();
        // Find active scheduled jobs that are due
        const dueJobs = await ScheduledJob_js_1.ScheduledJob.find({
            isActive: true,
            nextRunAt: { $lte: now }
        });
        if (dueJobs.length === 0)
            return;
        console.log(`Found ${dueJobs.length} due cron scheduled jobs. Enqueueing...`);
        for (const sJob of dueJobs) {
            try {
                // Find retry policy limit
                let maxAttempts = 3;
                if (sJob.retryPolicyId) {
                    const policy = await RetryPolicy_js_1.RetryPolicy.findById(sJob.retryPolicyId);
                    if (policy) {
                        maxAttempts = policy.maxAttempts;
                    }
                }
                // 1. Create a queued job record
                await Job_js_1.Job.create({
                    queueId: sJob.queueId,
                    status: 'queued',
                    payload: sJob.payload,
                    retryPolicyId: sJob.retryPolicyId,
                    scheduledAt: new Date(),
                    maxAttempts,
                });
                // 2. Compute next execution time
                const interval = cron_parser_1.default.parseExpression(sJob.cronExpression);
                sJob.lastRunAt = now;
                sJob.nextRunAt = interval.next().toDate();
                await sJob.save();
                console.log(`Enqueued job from scheduled template: "${sJob.name}", next run at: ${sJob.nextRunAt}`);
            }
            catch (err) {
                console.error(`Failed to process scheduled job "${sJob.name}":`, err);
            }
        }
    }
}
exports.CronScheduler = CronScheduler;
