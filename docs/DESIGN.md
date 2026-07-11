# System Design Decisions & Trade-Offs

This document details the architectural decisions, trade-offs, retry algorithms, worker failure handling, database patterns, and concurrency behaviors of the Codity distributed job scheduler.

---

## 1. Database Choice: MongoDB vs. Relational Database

### Why MongoDB Was Chosen
1.  **Flexible Schema for Payloads**: Task payload shapes vary widely depending on the work being executed (e.g. `process_images` needs image paths, `send_email` needs email strings, etc.). Storing these unstructured parameters as embedded JSON documents in a `payload` field is a natural fit for MongoDB's document model. In a relational database, this would require using `JSONB` columns (essentially treating it like a document store anyway) or complex entity-attribute-value tables.
2.  **Atomic Single-Document Writes**: MongoDB provides native atomic search-and-update capabilities (`findOneAndUpdate`) on a single document, which serves as the core coordination primitive for claiming queued jobs.
3.  **Horizontal Scale**: Storing worker state, execution timelines, and logs as standalone documents makes partitioning and scaling the database tier simpler compared to a relational system under heavy write load.

### The Trade-offs (What We Lost)
1.  **Cascading Deletes**: Relational databases naturally handle cascading deletes. In our scheduler, deleting a `Project` requires manual cleanup of related `Queue`, `Job`, `ScheduledJob`, `JobExecution`, and `JobLog` records. In MongoDB, there is no foreign key integrity, meaning orphaned documents can occur if deletion logic fails mid-way.
2.  **Multi-Document Transactions**: While MongoDB supports ACID transactions, they carry significant overhead and performance costs compared to SQL databases. Enforcing properties across multiple collections (e.g., checking a user's membership, registering a queue, and creating a default retry policy) lacks native relational schema guarantees.
3.  **Strict Joins**: Querying job execution details alongside worker names and log tables requires manual `$lookup` aggregate queries or multi-step Mongoose queries. In a relational database, standard indexed joins would perform this work efficiently.

---

## 2. Atomic Job Claiming & Concurrency Test Results

### Implementation Details
Workers claim jobs from the shared `jobs` collection using Mongoose's `Job.findOneAndUpdate`:
```typescript
const job = await Job.findOneAndUpdate(
  {
    queueId: queue._id,
    status: { $in: ['queued', 'retrying'] },
    scheduledAt: { $lte: now }
  },
  {
    $set: { status: 'claimed', claimedBy: this.workerId },
    $inc: { attemptsMade: 1 }
  },
  {
    sort: { scheduledAt: 1, createdAt: 1 },
    new: true
  }
);
```
This is atomic at the single-document level. MongoDB guarantees that only a single concurrent write query will acquire a lock on a matched job document, update its status, and return it. Other concurrent workers attempting to claim the same document will fail to match the query (as `status` is no longer `'queued'` or `'retrying'`) and will proceed to the next available document.

### Concurrency Test Results
We verified this behavior by running a dedicated concurrency test suite (`api/src/__tests__/integration.test.ts`):
*   **Setup**: 20 queued jobs inserted into a test queue. 5 concurrent worker processor instances.
*   **Execution**: 20 simultaneous claim and process promises fired concurrently using `Promise.all`.
*   **Result**: **Passed**. Exactly 20 jobs were claimed and processed. Every single job had `attemptsMade` equal to exactly 1. There were 0 double claims and 0 orphaned jobs. This proves that the single-document claim operation is thread-safe and prevents race conditions under load.

### Concurrency Limit Race Condition (Known Limitation)
While claiming a single job is atomic, **enforcing the queue concurrency limit is NOT atomic**:
```typescript
// Non-atomic check
if (queue.concurrencyLimit !== undefined && queue.concurrencyLimit !== null) {
  const activeJobsCount = await Job.countDocuments({
    queueId: queue._id,
    status: { $in: ['claimed', 'running'] }
  });

  if (activeJobsCount >= queue.concurrencyLimit) {
    continue; // skip
  }
}
// Atomically claim job (happens AFTER countDocuments)
const job = await Job.findOneAndUpdate(...);
```
Because the `countDocuments` read happens before the `findOneAndUpdate` write, there is a classic time-of-check to time-of-use (TOCTOU) race condition. If multiple workers concurrently see `activeJobsCount < concurrencyLimit`, they will all proceed to claim jobs, temporarily exceeding the queue's concurrency limit under high concurrent loads. To fix this, a distributed lock (e.g. Redlock via Redis) or counter-based increments in the Queue document would be required.

---

## 3. Retry Strategy & Dead-Letter Queue (DLQ)

### Delay Math
The system supports three backoff algorithms computed in `api/src/utils/retry.ts`:
1.  **Fixed**: `baseDelayMs` remains constant for all attempts.
2.  **Linear**: `baseDelayMs * attemptNumber` grows linearly.
3.  **Exponential**: `baseDelayMs * Math.pow(2, attemptNumber - 1)` doubles the delay each attempt.

All strategies are capped at `maxDelayMs`.

### Enforcement and Transitions
1.  When a task execution throws an error:
    *   If `attemptsMade < maxAttempts`: The job's status is set to `'retrying'`, `claimedBy` is cleared, and `scheduledAt` is set to `Date.now() + calculatedDelayMs`.
    *   If `attemptsMade >= maxAttempts`: The job is marked as `'dead_letter'`, and its details are copied into the `deadletterqueues` collection for manual auditing and recovery.

---

## 4. Worker Failure Handling & Crash Recovery

### Heartbeats and Metrics
Registered worker nodes write to the `workers` collection and append historical metrics to the `workerheartbeats` collection every 5 seconds.
```typescript
await Worker.findByIdAndUpdate(this.id, {
  status: 'active',
  lastHeartbeatAt: new Date()
});
```

### Known Recovery Limitations
1.  **No Automatic Reaper Service**: There is no background "reaper" process or daemon in the worker nodes or API service to actively scan for crashed workers.
2.  **Orphaned Claimed/Running Jobs**: If a worker process crashes mid-execution:
    *   Its registered document remains in `status: 'active'` indefinitely.
    *   Any jobs it had claimed (status `'claimed'` or `'running'`) remain locked under that worker's ID and will never be processed or retried.
    *   *Correction Plan*: A cron-based reaper service should be added to identify workers whose `lastHeartbeatAt` is older than 30 seconds, mark them as `stalled`/`offline`, and automatically reset their claimed/running jobs back to `status: 'queued'` (or increment attempt count and retry/DLQ them).

---

## 5. Idempotency Key Handling

Idempotency is enforced at the API routing and database indexing tiers:
1.  **API Check**: In `POST /api/v1/jobs`, the controller checks for an existing job in the same queue with the same key:
    ```typescript
    if (idempotencyKey) {
      const existingJob = await Job.findOne({ queueId, idempotencyKey });
      if (existingJob) {
        return res.status(200).json({ job: existingJob, duplicated: true });
      }
    }
    ```
2.  **Database Index**: A unique compound index is defined on `{ queueId: 1, idempotencyKey: 1 }` with a `partialFilterExpression` on `idempotencyKey`:
    ```typescript
    JobSchema.index(
      { queueId: 1, idempotencyKey: 1 },
      { unique: true, partialFilterExpression: { idempotencyKey: { $exists: true, $type: 'string' } } }
    );
    ```
    This protects against concurrent race conditions where two identical requests bypass the `findOne` check simultaneously. The second write will fail with a MongoDB duplicate key error (code 11000), which the API controller catches gracefully to return the original job document (HTTP 200).

---

## 6. Embedding vs. Referencing Rationale

*   **RetryPolicy (Referenced)**: 
    *   *Reality vs. Baseline*: The original design notes stated that `retryPolicy` is embedded inside `queues`. In the actual implementation, `RetryPolicy` is its own collection, referenced via `retryPolicyId`. This allows central management of retry rules across multiple queues and schedules, preventing configuration duplication.
*   **JobExecutions and JobLogs (Referenced)**: 
    *   *Justification*: Stored in separate collections. If embedded directly in the `Job` document, aggressive retries with multi-line execution run logs would cause the job document to grow unbounded, potentially exceeding the 16MB document size limit and bloating memory usage during search scans.
*   **WorkerHeartbeats (Referenced)**:
    *   *Justification*: Stored in a dedicated collection with a high write frequency (every 5 seconds per worker). Referencing worker metrics avoids bloating the core `workers` cluster document.

---

## 7. Known Architectural Limitations

1.  **Cron Scheduler Concurrency**: The scheduler service runs inside every worker process without a leader lock. Scaling worker nodes horizontally will cause duplicate cron runs and double-enqueued jobs. The scheduler must be run as a singleton or refactored with distributed locks.
2.  **Missing Indexes**:
    *   No index on `ScheduledJob` for `{ isActive: 1, nextRunAt: 1 }`, leading to collection scans every 5 seconds.
    *   No compound sort index on `Job` for claiming, causing in-memory sorting.
3.  **Missing TTL Indexes**: Although specified in design specs, no TTL properties exist on `worker_heartbeats` or `job_logs` collections in the actual schemas, leading to unbounded storage growth.
4.  **Concurrencies Limit Time-of-Check-Time-of-Use**: The count check is not grouped atomically with job claiming.
