// MongoDB schema plan for the job scheduling platform
// This repository uses MongoDB via Mongoose, so the data model is expressed as collections and indexes.

// Collection: users
// Fields:
// - _id: ObjectId
// - email: string (unique)
// - passwordHash: string
// - fullName: string
// - createdAt: Date
// - updatedAt: Date
// Indexes:
// db.users.createIndex({ email: 1 }, { unique: true });

// Collection: organizations
// Fields:
// - _id: ObjectId
// - name: string
// - slug: string (unique)
// - createdAt: Date
// - updatedAt: Date
// Indexes:
// db.organizations.createIndex({ slug: 1 }, { unique: true });

// Collection: organizationMembers
// Fields:
// - _id: ObjectId
// - organizationId: ObjectId
// - userId: ObjectId
// - role: string
// - createdAt: Date
// - updatedAt: Date
// Indexes:
// db.organizationMembers.createIndex({ organizationId: 1, userId: 1 }, { unique: true });

// Collection: projects
// Fields:
// - _id: ObjectId
// - organizationId: ObjectId
// - name: string
// - slug: string
// - createdAt: Date
// - updatedAt: Date
// Indexes:
// db.projects.createIndex({ organizationId: 1, slug: 1 }, { unique: true });

// Collection: retryPolicies
// Fields:
// - _id: ObjectId
// - projectId: ObjectId
// - name: string
// - type: string
// - baseDelayMs: number
// - maxDelayMs: number
// - maxAttempts: number
// - createdAt: Date
// - updatedAt: Date
// Indexes:
// db.retryPolicies.createIndex({ projectId: 1, name: 1 }, { unique: true });

// Collection: queues
// Fields:
// - _id: ObjectId
// - projectId: ObjectId
// - name: string
// - priority: number
// - concurrencyLimit: number | null
// - retryPolicyId: ObjectId | null
// - isPaused: boolean
// - createdAt: Date
// - updatedAt: Date
// Indexes:
// db.queues.createIndex({ projectId: 1, name: 1 }, { unique: true });

// Collection: workers
// Fields:
// - _id: ObjectId
// - name: string (unique)
// - status: string
// - concurrencyLimit: number
// - lastHeartbeatAt: Date
// - startedAt: Date
// - createdAt: Date
// - updatedAt: Date
// Indexes:
// db.workers.createIndex({ name: 1 }, { unique: true });

// Collection: jobs
// Fields:
// - _id: ObjectId
// - queueId: ObjectId
// - status: string
// - payload: object
// - idempotencyKey: string | null
// - retryPolicyId: ObjectId | null
// - scheduledAt: Date
// - claimedBy: ObjectId | null
// - attemptsMade: number
// - maxAttempts: number
// - lastError: string | null
// - createdAt: Date
// - updatedAt: Date
// Indexes:
// db.jobs.createIndex({ queueId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
// db.jobs.createIndex({ queueId: 1, status: 1, scheduledAt: 1 });

// Collection: scheduledJobs
// Fields:
// - _id: ObjectId
// - projectId: ObjectId
// - queueId: ObjectId
// - name: string
// - cronExpression: string
// - payload: object
// - isActive: boolean
// - retryPolicyId: ObjectId | null
// - nextRunAt: Date
// - lastRunAt: Date | null
// - createdAt: Date
// - updatedAt: Date
// Indexes:
// db.scheduledJobs.createIndex({ projectId: 1, name: 1 }, { unique: true });
// db.scheduledJobs.createIndex({ nextRunAt: 1, isActive: 1 });

// Collection: jobExecutions
// Fields:
// - _id: ObjectId
// - jobId: ObjectId
// - workerId: ObjectId | null
// - attempt: number
// - status: string
// - startedAt: Date
// - finishedAt: Date | null
// - error: string | null
// - durationMs: number | null
// - createdAt: Date
// - updatedAt: Date
// Indexes:
// db.jobExecutions.createIndex({ jobId: 1, startedAt: 1 });

// Collection: jobLogs
// Fields:
// - _id: ObjectId
// - jobExecutionId: ObjectId
// - level: string
// - message: string
// - timestamp: Date
// - createdAt: Date
// Indexes:
// db.jobLogs.createIndex({ jobExecutionId: 1, timestamp: 1 });

// Collection: deadLetterQueue
// Fields:
// - _id: ObjectId
// - jobId: ObjectId
// - queueId: ObjectId
// - payload: object
// - attemptsMade: number
// - lastError: string | null
// - failedAt: Date
// - createdAt: Date
// Indexes:
// db.deadLetterQueue.createIndex({ queueId: 1, failedAt: 1 });

// Collection: workerHeartbeats
// Fields:
// - _id: ObjectId
// - workerId: ObjectId
// - metrics: object
// - createdAt: Date
// Indexes:
// db.workerHeartbeats.createIndex({ workerId: 1, createdAt: -1 });
