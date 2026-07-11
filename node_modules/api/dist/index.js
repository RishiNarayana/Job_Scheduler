"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
const cron_parser_1 = __importDefault(require("cron-parser"));
const connection_js_1 = require("./db/connection.js");
const User_js_1 = require("./models/User.js");
const Organization_js_1 = require("./models/Organization.js");
const OrganizationMember_js_1 = require("./models/OrganizationMember.js");
const Project_js_1 = require("./models/Project.js");
const RetryPolicy_js_1 = require("./models/RetryPolicy.js");
const Queue_js_1 = require("./models/Queue.js");
const Job_js_1 = require("./models/Job.js");
const ScheduledJob_js_1 = require("./models/ScheduledJob.js");
const Worker_js_1 = require("./models/Worker.js");
const JobExecution_js_1 = require("./models/JobExecution.js");
const JobLog_js_1 = require("./models/JobLog.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'some-ultra-secure-long-jwt-secret-phrase';
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
// Auth Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}
// Helper: Check org membership
async function checkOrgMembership(userId, organizationId) {
    const membership = await OrganizationMember_js_1.OrganizationMember.findOne({ userId, organizationId });
    return membership !== null;
}
// ---------------- AUTH ROUTES ----------------
app.post('/api/v1/auth/register', async (req, res) => {
    try {
        const { email, password, fullName } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const existingUser = await User_js_1.User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email is already registered' });
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        const user = await User_js_1.User.create({
            email,
            passwordHash,
            fullName,
        });
        // Automatically create a default organization for them
        const org = await Organization_js_1.Organization.create({
            name: `${fullName || 'My'} Org`,
            slug: `org-${Date.now()}`,
        });
        await OrganizationMember_js_1.OrganizationMember.create({
            organizationId: org._id,
            userId: user._id,
            role: 'owner',
        });
        const token = jsonwebtoken_1.default.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({
            token,
            user: { id: user._id, email: user.email, fullName: user.fullName },
            organization: org
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/v1/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const user = await User_js_1.User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: { id: user._id, email: user.email, fullName: user.fullName }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/v1/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await User_js_1.User.findById(req.user.userId).select('-passwordHash');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ---------------- ORGANIZATION ROUTES ----------------
app.get('/api/v1/organizations', authenticateToken, async (req, res) => {
    try {
        const memberships = await OrganizationMember_js_1.OrganizationMember.find({ userId: req.user.userId }).populate('organizationId');
        const orgs = memberships.map(m => m.organizationId);
        res.json(orgs);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/v1/organizations', authenticateToken, async (req, res) => {
    try {
        const { name, slug } = req.body;
        if (!name || !slug) {
            return res.status(400).json({ error: 'Name and slug are required' });
        }
        const existingOrg = await Organization_js_1.Organization.findOne({ slug });
        if (existingOrg) {
            return res.status(400).json({ error: 'Organization slug is already in use' });
        }
        const org = await Organization_js_1.Organization.create({ name, slug });
        await OrganizationMember_js_1.OrganizationMember.create({
            organizationId: org._id,
            userId: req.user.userId,
            role: 'owner',
        });
        res.status(201).json(org);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ---------------- PROJECT ROUTES ----------------
app.get('/api/v1/projects', authenticateToken, async (req, res) => {
    try {
        const { organizationId } = req.query;
        if (!organizationId) {
            return res.status(400).json({ error: 'organizationId query parameter is required' });
        }
        const hasAccess = await checkOrgMembership(req.user.userId, organizationId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this organization' });
        }
        const projects = await Project_js_1.Project.find({ organizationId });
        res.json(projects);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/v1/projects', authenticateToken, async (req, res) => {
    try {
        const { organizationId, name, slug } = req.body;
        if (!organizationId || !name || !slug) {
            return res.status(400).json({ error: 'organizationId, name, and slug are required' });
        }
        const hasAccess = await checkOrgMembership(req.user.userId, organizationId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const project = await Project_js_1.Project.create({ organizationId, name, slug });
        res.status(201).json(project);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ---------------- RETRY POLICY ROUTES ----------------
app.get('/api/v1/retry-policies', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId query parameter is required' });
        }
        const policies = await RetryPolicy_js_1.RetryPolicy.find({ projectId });
        res.json(policies);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/v1/retry-policies', authenticateToken, async (req, res) => {
    try {
        const { projectId, name, type, baseDelayMs, maxDelayMs, maxAttempts } = req.body;
        if (!projectId || !name || !type) {
            return res.status(400).json({ error: 'projectId, name, and type are required' });
        }
        const policy = await RetryPolicy_js_1.RetryPolicy.create({
            projectId, name, type, baseDelayMs, maxDelayMs, maxAttempts
        });
        res.status(201).json(policy);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ---------------- QUEUE ROUTES ----------------
app.get('/api/v1/queues', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId query parameter is required' });
        }
        const queues = await Queue_js_1.Queue.find({ projectId }).populate('retryPolicyId');
        res.json(queues);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/v1/queues', authenticateToken, async (req, res) => {
    try {
        const { projectId, name, priority, concurrencyLimit, retryPolicyId } = req.body;
        if (!projectId || !name) {
            return res.status(400).json({ error: 'projectId and name are required' });
        }
        const queue = await Queue_js_1.Queue.create({
            projectId, name, priority, concurrencyLimit, retryPolicyId
        });
        res.status(201).json(queue);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.patch('/api/v1/queues/:id/pause', authenticateToken, async (req, res) => {
    try {
        const queue = await Queue_js_1.Queue.findByIdAndUpdate(req.params.id, { isPaused: true }, { new: true });
        if (!queue)
            return res.status(404).json({ error: 'Queue not found' });
        res.json(queue);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.patch('/api/v1/queues/:id/resume', authenticateToken, async (req, res) => {
    try {
        const queue = await Queue_js_1.Queue.findByIdAndUpdate(req.params.id, { isPaused: false }, { new: true });
        if (!queue)
            return res.status(404).json({ error: 'Queue not found' });
        res.json(queue);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ---------------- JOB ROUTES ----------------
// Create a job (unauthenticated is common for systems to ingest jobs, or authenticated)
app.post('/api/v1/jobs', async (req, res) => {
    try {
        const { queueId, payload, scheduledAt, idempotencyKey, retryPolicyId } = req.body;
        if (!queueId || !payload) {
            return res.status(400).json({ error: 'queueId and payload are required' });
        }
        const queue = await Queue_js_1.Queue.findById(queueId);
        if (!queue) {
            return res.status(404).json({ error: 'Queue not found' });
        }
        // Handle idempotency check
        if (idempotencyKey) {
            const existingJob = await Job_js_1.Job.findOne({ queueId, idempotencyKey });
            if (existingJob) {
                return res.status(200).json({ job: existingJob, duplicated: true });
            }
        }
        // Resolve maxAttempts
        let finalMaxAttempts = 3;
        let finalRetryPolicyId = retryPolicyId || queue.retryPolicyId;
        if (finalRetryPolicyId) {
            const policy = await RetryPolicy_js_1.RetryPolicy.findById(finalRetryPolicyId);
            if (policy) {
                finalMaxAttempts = policy.maxAttempts;
            }
        }
        const parsedScheduledAt = scheduledAt ? new Date(scheduledAt) : new Date();
        const status = parsedScheduledAt > new Date() ? 'scheduled' : 'queued';
        const job = await Job_js_1.Job.create({
            queueId,
            status,
            payload,
            idempotencyKey,
            retryPolicyId: finalRetryPolicyId,
            scheduledAt: parsedScheduledAt,
            maxAttempts: finalMaxAttempts,
        });
        res.status(201).json({ job, duplicated: false });
    }
    catch (error) {
        // Graceful check for MongoDB duplicate key index error (in case of parallel requests)
        if (error.code === 11000) {
            try {
                const { queueId, idempotencyKey } = req.body;
                const existingJob = await Job_js_1.Job.findOne({ queueId, idempotencyKey });
                return res.status(200).json({ job: existingJob, duplicated: true });
            }
            catch (err) { }
        }
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/v1/jobs', authenticateToken, async (req, res) => {
    try {
        const { queueId, status, page = 1, limit = 20 } = req.query;
        if (!queueId) {
            return res.status(400).json({ error: 'queueId parameter is required' });
        }
        const query = { queueId };
        if (status) {
            query.status = status;
        }
        const parsedPage = parseInt(page);
        const parsedLimit = parseInt(limit);
        const [jobs, total] = await Promise.all([
            Job_js_1.Job.find(query)
                .sort({ createdAt: -1 })
                .skip((parsedPage - 1) * parsedLimit)
                .limit(parsedLimit)
                .populate('claimedBy', 'name'),
            Job_js_1.Job.countDocuments(query),
        ]);
        res.json({
            jobs,
            total,
            page: parsedPage,
            pages: Math.ceil(total / parsedLimit),
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/v1/jobs/:id', authenticateToken, async (req, res) => {
    try {
        const job = await Job_js_1.Job.findById(req.params.id)
            .populate('queueId')
            .populate('claimedBy', 'name');
        if (!job)
            return res.status(404).json({ error: 'Job not found' });
        // Fetch executions and logs
        const executions = await JobExecution_js_1.JobExecution.find({ jobId: job._id }).sort({ attempt: -1 }).lean();
        const executionsWithLogs = await Promise.all(executions.map(async (exec) => {
            const logs = await JobLog_js_1.JobLog.find({ jobExecutionId: exec._id }).sort({ timestamp: 1 });
            return { ...exec, logs };
        }));
        res.json({ job, executions: executionsWithLogs });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/v1/jobs/:id/retry', authenticateToken, async (req, res) => {
    try {
        const job = await Job_js_1.Job.findById(req.params.id);
        if (!job)
            return res.status(404).json({ error: 'Job not found' });
        if (job.status !== 'failed' && job.status !== 'dead_letter' && job.status !== 'cancelled') {
            return res.status(400).json({ error: 'Only failed, dead letter, or cancelled jobs can be retried' });
        }
        job.status = 'queued';
        job.attemptsMade = 0;
        job.scheduledAt = new Date();
        job.lastError = undefined;
        job.claimedBy = undefined;
        await job.save();
        res.json(job);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/v1/jobs/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const job = await Job_js_1.Job.findById(req.params.id);
        if (!job)
            return res.status(404).json({ error: 'Job not found' });
        const cancelableStatuses = ['queued', 'scheduled', 'retrying'];
        if (!cancelableStatuses.includes(job.status)) {
            return res.status(400).json({ error: `Cannot cancel job in ${job.status} status` });
        }
        job.status = 'cancelled';
        await job.save();
        res.json(job);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ---------------- SCHEDULED JOB (CRON) ROUTES ----------------
app.get('/api/v1/scheduled-jobs', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId parameter is required' });
        }
        const scheduled = await ScheduledJob_js_1.ScheduledJob.find({ projectId }).populate('queueId').populate('retryPolicyId');
        res.json(scheduled);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/v1/scheduled-jobs', authenticateToken, async (req, res) => {
    try {
        const { projectId, queueId, name, cronExpression, payload, retryPolicyId } = req.body;
        if (!projectId || !queueId || !name || !cronExpression || !payload) {
            return res.status(400).json({ error: 'projectId, queueId, name, cronExpression, and payload are required' });
        }
        // Validate Cron Expression
        let nextRunAt;
        try {
            const interval = cron_parser_1.default.parseExpression(cronExpression);
            nextRunAt = interval.next().toDate();
        }
        catch (err) {
            return res.status(400).json({ error: 'Invalid cron expression structure' });
        }
        const scheduled = await ScheduledJob_js_1.ScheduledJob.create({
            projectId,
            queueId,
            name,
            cronExpression,
            payload,
            retryPolicyId,
            nextRunAt,
            isActive: true,
        });
        res.status(201).json(scheduled);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.patch('/api/v1/scheduled-jobs/:id/toggle', authenticateToken, async (req, res) => {
    try {
        const scheduled = await ScheduledJob_js_1.ScheduledJob.findById(req.params.id);
        if (!scheduled)
            return res.status(404).json({ error: 'Scheduled job not found' });
        scheduled.isActive = !scheduled.isActive;
        if (scheduled.isActive) {
            const interval = cron_parser_1.default.parseExpression(scheduled.cronExpression);
            scheduled.nextRunAt = interval.next().toDate();
        }
        await scheduled.save();
        res.json(scheduled);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/api/v1/scheduled-jobs/:id', authenticateToken, async (req, res) => {
    try {
        const result = await ScheduledJob_js_1.ScheduledJob.findByIdAndDelete(req.params.id);
        if (!result)
            return res.status(404).json({ error: 'Scheduled job not found' });
        res.json({ message: 'Scheduled job deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ---------------- WORKER & DASHBOARD ROUTES ----------------
app.get('/api/v1/workers', authenticateToken, async (req, res) => {
    try {
        const workers = await Worker_js_1.Worker.find().sort({ lastHeartbeatAt: -1 });
        res.json(workers);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/v1/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }
        // 1. Get all queues for this project
        const queues = await Queue_js_1.Queue.find({ projectId });
        const queueIds = queues.map(q => q._id);
        // 2. Job status counts for these queues
        const jobStatusAggregate = await Job_js_1.Job.aggregate([
            { $match: { queueId: { $in: queueIds } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const jobStatuses = {
            queued: 0,
            scheduled: 0,
            claimed: 0,
            running: 0,
            retrying: 0,
            completed: 0,
            failed: 0,
            dead_letter: 0,
            cancelled: 0
        };
        jobStatusAggregate.forEach((item) => {
            if (item._id in jobStatuses) {
                jobStatuses[item._id] = item.count;
            }
        });
        // 3. Active Workers (heartbeat within last 15 seconds)
        const activeWorkersLimit = new Date(Date.now() - 15000);
        const activeWorkers = await Worker_js_1.Worker.countDocuments({
            status: 'active',
            lastHeartbeatAt: { $gte: activeWorkersLimit }
        });
        // 4. Avg execution duration (from successful/completed JobExecutions in these queues)
        const jobIds = await Job_js_1.Job.find({ queueId: { $in: queueIds } }).select('_id');
        const jobIdList = jobIds.map(j => j._id);
        const durationAggregate = await JobExecution_js_1.JobExecution.aggregate([
            { $match: { jobId: { $in: jobIdList }, status: 'completed', durationMs: { $exists: true } } },
            { $group: { _id: null, avgDuration: { $avg: '$durationMs' } } }
        ]);
        const avgDurationMs = durationAggregate.length > 0 ? Math.round(durationAggregate[0].avgDuration) : 0;
        // 5. Per-queue breakdown statistics
        const queueStats = await Promise.all(queues.map(async (q) => {
            const stats = await Job_js_1.Job.aggregate([
                { $match: { queueId: q._id } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);
            const counts = {
                queued: 0,
                running: 0,
                completed: 0,
                failed: 0,
            };
            stats.forEach((item) => {
                if (item._id === 'queued' || item._id === 'retrying') {
                    counts.queued += item.count;
                }
                else if (item._id === 'running' || item._id === 'claimed') {
                    counts.running += item.count;
                }
                else if (item._id === 'completed') {
                    counts.completed += item.count;
                }
                else if (item._id === 'failed' || item._id === 'dead_letter') {
                    counts.failed += item.count;
                }
            });
            return {
                queueId: q._id,
                name: q.name,
                priority: q.priority,
                isPaused: q.isPaused,
                concurrencyLimit: q.concurrencyLimit,
                ...counts
            };
        }));
        res.json({
            jobStatuses,
            activeWorkers,
            avgDurationMs,
            queueStats
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Start Server
(0, connection_js_1.connectDB)().then(() => {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
});
