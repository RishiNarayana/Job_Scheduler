"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const connection_js_1 = require("./connection.js");
const User_js_1 = require("../models/User.js");
const Organization_js_1 = require("../models/Organization.js");
const OrganizationMember_js_1 = require("../models/OrganizationMember.js");
const Project_js_1 = require("../models/Project.js");
const RetryPolicy_js_1 = require("../models/RetryPolicy.js");
const Queue_js_1 = require("../models/Queue.js");
const Job_js_1 = require("../models/Job.js");
const ScheduledJob_js_1 = require("../models/ScheduledJob.js");
const Worker_js_1 = require("../models/Worker.js");
const JobExecution_js_1 = require("../models/JobExecution.js");
const JobLog_js_1 = require("../models/JobLog.js");
const DeadLetterQueue_js_1 = require("../models/DeadLetterQueue.js");
const WorkerHeartbeat_js_1 = require("../models/WorkerHeartbeat.js");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function seed() {
    console.log('Starting database seeding...');
    await (0, connection_js_1.connectDB)();
    // 1. Clear Collections
    console.log('Clearing existing database collections...');
    await Promise.all([
        User_js_1.User.deleteMany({}),
        Organization_js_1.Organization.deleteMany({}),
        OrganizationMember_js_1.OrganizationMember.deleteMany({}),
        Project_js_1.Project.deleteMany({}),
        RetryPolicy_js_1.RetryPolicy.deleteMany({}),
        Queue_js_1.Queue.deleteMany({}),
        Job_js_1.Job.deleteMany({}),
        ScheduledJob_js_1.ScheduledJob.deleteMany({}),
        Worker_js_1.Worker.deleteMany({}),
        JobExecution_js_1.JobExecution.deleteMany({}),
        JobLog_js_1.JobLog.deleteMany({}),
        DeadLetterQueue_js_1.DeadLetterQueue.deleteMany({}),
        WorkerHeartbeat_js_1.WorkerHeartbeat.deleteMany({}),
    ]);
    // 2. Create User
    console.log('Seeding default user...');
    const salt = await bcryptjs_1.default.genSalt(10);
    const passwordHash = await bcryptjs_1.default.hash('adminpassword', salt);
    const adminUser = await User_js_1.User.create({
        email: 'admin@codity.com',
        passwordHash,
        fullName: 'Admin User',
    });
    // 3. Create Organization
    console.log('Seeding default organization...');
    const org = await Organization_js_1.Organization.create({
        name: 'Codity Corp',
        slug: 'codity',
    });
    // 4. Create Organization Member
    console.log('Adding user to organization...');
    await OrganizationMember_js_1.OrganizationMember.create({
        organizationId: org._id,
        userId: adminUser._id,
        role: 'owner',
    });
    // 5. Create Project
    console.log('Seeding default project...');
    const project = await Project_js_1.Project.create({
        organizationId: org._id,
        name: 'Main Scheduler',
        slug: 'main-scheduler',
    });
    // 6. Create Retry Policies
    console.log('Seeding retry policies...');
    const exponentialPolicy = await RetryPolicy_js_1.RetryPolicy.create({
        projectId: project._id,
        name: 'Default Exponential',
        type: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 60000,
        maxAttempts: 5,
    });
    const fixedPolicy = await RetryPolicy_js_1.RetryPolicy.create({
        projectId: project._id,
        name: 'Quick Fixed',
        type: 'fixed',
        baseDelayMs: 2000,
        maxDelayMs: 10000,
        maxAttempts: 3,
    });
    // 7. Create Queues
    console.log('Seeding queues...');
    const highPriorityQueue = await Queue_js_1.Queue.create({
        projectId: project._id,
        name: 'high-priority',
        priority: 10,
        concurrencyLimit: 3,
        retryPolicyId: exponentialPolicy._id,
    });
    const defaultQueue = await Queue_js_1.Queue.create({
        projectId: project._id,
        name: 'default',
        priority: 1,
        concurrencyLimit: 5,
        retryPolicyId: exponentialPolicy._id,
    });
    const notificationQueue = await Queue_js_1.Queue.create({
        projectId: project._id,
        name: 'notifications',
        priority: 2,
        concurrencyLimit: 10,
        retryPolicyId: fixedPolicy._id,
    });
    // 8. Create some initial Jobs
    console.log('Seeding initial jobs...');
    await Job_js_1.Job.create([
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
    await ScheduledJob_js_1.ScheduledJob.create({
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
    await (0, connection_js_1.disconnectDB)();
}
seed().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
