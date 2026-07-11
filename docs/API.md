# REST API Quick Reference & curl Examples

This reference document provides copy-pasteable `curl` examples for interacting with the Codity distributed job scheduler service.

> [!NOTE]
> All paths require a valid Bearer Token in the `Authorization` header, except for registration (`POST /api/v1/auth/register`), login (`POST /api/v1/auth/login`), health checks (`GET /health`), and direct job creation ingestion (`POST /api/v1/jobs`).

---

## 1. Authentication

### User Registration
Registers a new user, creates a default organization, and returns a JWT access token.
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@codity.com",
    "password": "password123",
    "fullName": "Jane Developer"
  }'
```

### User Login
Retrieves a JWT access token.
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@codity.com",
    "password": "password123"
  }'
```

---

## 2. Queue Operations

### Pause a Queue
Halts execution processing of jobs in a specific queue.
```bash
curl -X PATCH http://localhost:4000/api/v1/queues/QUEUE_ID_HERE/pause \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Resume a Queue
Resumes execution processing of jobs in a paused queue.
```bash
curl -X PATCH http://localhost:4000/api/v1/queues/QUEUE_ID_HERE/resume \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 3. Job Submission (Ingest)

### Submit an Immediate Job
Ingests a job into the queue for immediate processing.
```bash
curl -X POST http://localhost:4000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "queueId": "QUEUE_ID_HERE",
    "payload": {
      "task": "send_email",
      "to": "user@example.com"
    },
    "idempotencyKey": "email_txn_99212"
  }'
```

### Submit a Delayed / Scheduled Job
Ingests a job with a `scheduledAt` date to delay processing.
```bash
curl -X POST http://localhost:4000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "queueId": "QUEUE_ID_HERE",
    "payload": {
      "task": "process_images",
      "images": ["banner.png", "avatar.jpg"]
    },
    "scheduledAt": "2026-07-15T12:00:00.000Z"
  }'
```

### Create a Recurring Scheduled Job (Cron Rule)
Schedules a cron template rule to automatically enqueue jobs periodically.
```bash
curl -X POST http://localhost:4000/api/v1/scheduled-jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "projectId": "PROJECT_ID_HERE",
    "queueId": "QUEUE_ID_HERE",
    "name": "Hourly Email Notification Reports",
    "cronExpression": "0 * * * *",
    "payload": {
      "task": "generate_report",
      "format": "pdf"
    }
  }'
```

### Note on Batch Jobs
> [!NOTE]
> **Batch job submission is not yet implemented** in the Codity API. Jobs must be submitted individually via single POST requests.

---

## 4. Querying & Inspector

### List Jobs with Filters
Query jobs by queue, status, and pagination parameters.
```bash
curl -X GET "http://localhost:4000/api/v1/jobs?queueId=QUEUE_ID_HERE&status=failed&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Fetch Worker Status & Health Clusters
Gets the status of registered active background worker nodes.
```bash
curl -X GET http://localhost:4000/api/v1/workers \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 5. Fault Tolerance & Dead Letter Recovery

### Retry a Dead-Lettered or Failed Job
Resets attempts made and returns the job to `queued` status to retry execution.
```bash
curl -X POST http://localhost:4000/api/v1/jobs/JOB_ID_HERE/retry \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Cancel a Pending / Retrying Job
Cancels a job currently pending queue processing.
```bash
curl -X POST http://localhost:4000/api/v1/jobs/JOB_ID_HERE/cancel \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
