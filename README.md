# Codity — Distributed Job Scheduler

> A production-grade, MongoDB-backed distributed job scheduling platform with an Express REST API, background worker cluster, React dashboard, and full automated test coverage.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Setup (Native)](#local-setup-native)
  - [Local Setup (Docker)](#local-setup-docker)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Testing](#testing)
  - [Test Coverage Summary](#test-coverage-summary)
  - [Unit Tests](#unit-tests)
  - [Integration & Concurrency Tests](#integration--concurrency-tests)
  - [Running the Tests](#running-the-tests)
- [Design Decisions & Trade-offs](#design-decisions--trade-offs)
- [Known Limitations](#known-limitations)
- [Docs](#docs)

---

## Overview

**Codity** is a self-hosted distributed job scheduler monorepo. It lets you enqueue background tasks (emails, image processing, financial transactions, reports), manage retry policies with configurable backoff strategies, set cron-based recurring schedules, and monitor job health across a horizontally-scalable worker cluster — all backed by MongoDB as the coordination engine.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Client / React Dashboard               │
│             (Vite + React SPA — port 5173)               │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / REST (JWT Auth)
┌────────────────────────▼────────────────────────────────┐
│                   API Service (Express)                  │
│              Auth · Queues · Jobs · Stats                │
│                       port 4000                          │
└────────────────────────┬────────────────────────────────┘
                         │ Mongoose (TCP)
                ┌────────▼────────┐
                │    MongoDB       │  ← Single coordination engine
                │  (port 27017)    │     for claiming, retries & DLQ
                └────────┬────────┘
         ┌───────────────┼───────────────┐
         │               │               │
┌────────▼──────┐ ┌──────▼──────┐ ┌─────▼───────┐
│  Worker Node  │ │ Worker Node │ │ Worker Node │
│  (pid A)      │ │  (pid B)    │ │  (pid N)    │
│  Processor    │ │  Processor  │ │  Processor  │
│  + Scheduler  │ └─────────────┘ └─────────────┘
└───────────────┘
```

**Workers claim jobs using an atomic `findOneAndUpdate`** — only one worker wins the lock on any given document. No Redis locking is required for the core claim loop.

The full sequence diagram is documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Project Structure

```
Codity/
├── api/                    # Express REST API + Mongoose models
│   ├── src/
│   │   ├── index.ts        # All routes and controllers
│   │   ├── models/         # Mongoose schemas (Job, Queue, Worker, …)
│   │   ├── db/             # Migration & seed scripts
│   │   ├── utils/          # Retry math, cron helpers, payload validators
│   │   └── __tests__/      # Vitest unit + integration test suite
│   ├── tsconfig.json
│   └── package.json
├── worker/                 # Background worker node
│   ├── src/
│   │   ├── index.ts        # Worker bootstrap
│   │   ├── processor.ts    # Job claim & execution loop
│   │   ├── scheduler.ts    # Cron scheduler service
│   │   └── worker.ts       # Heartbeat & registration
│   ├── tsconfig.json
│   └── package.json
├── frontend/               # React + Vite dashboard
├── docs/                   # Full design, API, schema, and testing docs
├── docker-compose.yml      # Full-stack Docker Compose config
├── .env.example            # Environment variable template
└── package.json            # Monorepo root (npm workspaces)
```

---

## Features

| Feature | Status |
|---|---|
| JWT authentication (register / login) | ✅ |
| Organizations, projects, queue management | ✅ |
| Job enqueueing — immediate & delayed (`scheduledAt`) | ✅ |
| Idempotency keys with unique index enforcement | ✅ |
| Configurable retry policies — fixed / linear / exponential backoff | ✅ |
| Dead-letter queue (DLQ) with automatic routing | ✅ |
| Recurring cron-based scheduled jobs | ✅ |
| Pause / resume queues | ✅ |
| Queue concurrency limits | ✅ (with known TOCTOU note) |
| Worker registration & heartbeat (every 5s) | ✅ |
| Worker metrics & execution history | ✅ |
| Retry / cancel / requeue dead-lettered jobs | ✅ |
| React dashboard UI | ✅ |
| Docker Compose full-stack deployment | ✅ |
| Automated test suite (Vitest) | ✅ |
| Batch job submission | 🚧 Not yet implemented |
| Distributed leader election for cron scheduler | 🚧 Not yet implemented |
| Crash-recovery reaper service | 🚧 Not yet implemented |

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | Node.js 20, Express, TypeScript |
| Worker | Node.js 20, TypeScript, `tsx` |
| Frontend | Vite, React, TypeScript |
| Database | MongoDB 6 (via Mongoose 8) |
| Cache / Broker | Redis 7 (provisioned, not yet wired) |
| Auth | JWT (access + refresh tokens, bcryptjs) |
| Validation | Zod |
| Cron | `cron-parser` |
| Testing | Vitest |
| Container | Docker Compose |

---

## Getting Started

### Prerequisites

- **Node.js** 20 or newer
- **MongoDB** running on port `27017`
- **Redis** running on port `6379`
- **npm** 10+

---

### Local Setup (Native)

**1. Clone and install dependencies**

```bash
git clone <your-repo-url>
cd Codity
npm install
```

**2. Configure environment**

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL, REDIS_URL, and JWT_SECRET
```

**3. Start MongoDB and Redis**

On Windows (adjust paths to your install location):

```powershell
New-Item -ItemType Directory -Force -Path C:\data\db | Out-Null
& 'C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe' --dbpath C:\data\db
& 'C:\Program Files\Redis\redis-server.exe'
```

On macOS/Linux:

```bash
mongod --dbpath /data/db &
redis-server &
```

**4. Run migrations & seed demo data**

```bash
npm run --prefix api db:migrate
npm run --prefix api db:seed
```

This creates a demo admin account:
- **Email:** `admin@codity.com`
- **Password:** `password123`

**5. Start all services**

```bash
# All at once (Windows PowerShell):
.\start-all.ps1

# Or individually:
npm run start:api       # API  →  http://localhost:4000
npm run start:worker    # Background worker
npm run start:frontend  # Dashboard  →  http://localhost:5173
```

**6. Verify**

```bash
curl http://localhost:4000/health
```

---

### Local Setup (Docker)

Start MongoDB, Redis, API, Worker, and Frontend with a single command:

```bash
docker-compose up
```

| Service | URL |
|---|---|
| API | `http://localhost:4000` |
| Frontend | `http://localhost:5173` |
| MongoDB | `localhost:27017` |
| Redis | `localhost:6379` |

To stop:

```bash
docker-compose down
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | API server port |
| `NODE_ENV` | `development` | Runtime environment |
| `DATABASE_URL` | `mongodb://localhost:27017/job_scheduler` | MongoDB connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | — | **Required.** Secret for signing JWT tokens |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token TTL |

Copy `.env.example` to `.env` and fill in `JWT_SECRET` before running.

---

## API Reference

Full `curl` examples are in [`docs/API.md`](docs/API.md). Key endpoints:

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | No | Register user & org, returns JWT |
| `POST` | `/api/v1/auth/login` | No | Login, returns JWT |
| `GET` | `/health` | No | Health check |
| `POST` | `/api/v1/jobs` | No | Enqueue a job (supports `scheduledAt`, `idempotencyKey`) |
| `GET` | `/api/v1/jobs` | Yes | List jobs with filters (`queueId`, `status`, pagination) |
| `POST` | `/api/v1/jobs/:id/retry` | Yes | Retry a failed or dead-lettered job |
| `POST` | `/api/v1/jobs/:id/cancel` | Yes | Cancel a pending job |
| `PATCH` | `/api/v1/queues/:id/pause` | Yes | Pause a queue |
| `PATCH` | `/api/v1/queues/:id/resume` | Yes | Resume a queue |
| `POST` | `/api/v1/scheduled-jobs` | Yes | Create a recurring cron job template |
| `GET` | `/api/v1/workers` | Yes | List registered worker nodes & health |

> **Auth** — Authenticated endpoints require `Authorization: Bearer <token>`.

---

## Testing

The test suite uses **Vitest** and lives in `api/src/__tests__/`. Integration tests run against a live MongoDB instance and a real `JobProcessor` instance imported from the worker package.

### Test Coverage Summary

| Suite | File | What's Tested | Result |
|---|---|---|---|
| Retry delay math | `retry.test.ts` | Fixed / linear / exponential backoff, `maxDelayMs` cap | ✅ Pass |
| Cron expansion | `cron.test.ts` | Next-N timestamps from cron expression, no duplicates | ✅ Pass |
| Payload validation | `payload.test.ts` | Type guards for all 4 task types + unknown type rejection | ✅ Pass |
| Job lifecycle | `integration.test.ts` | Create → claim → execute → complete, execution record written | ✅ Pass |
| Failure & DLQ path | `integration.test.ts` | Handler throws → retrying → dead_letter → DLQ record | ✅ Pass |
| Idempotency key | `integration.test.ts` | Duplicate key + queueId triggers unique index error | ✅ Pass |
| **High concurrency** | `integration.test.ts` | **5 workers × 20 jobs — 0 double-claims, 0 orphans** | ✅ Pass |

---

### Unit Tests

**`retry.test.ts`** — Retry backoff algorithm correctness
- Verifies `fixed`, `linear`, and `exponential` delay formulas.
- Asserts all values are capped at the policy's `maxDelayMs`.

**`cron.test.ts`** — Cron expression expansion
- Verifies `*/5 * * * *` and similar expressions produce the correct next-N future timestamps.
- Asserts no duplicate timestamps are generated.

**`payload.test.ts`** — Task payload validation
- `process_images` — requires a non-empty `images` string array.
- `send_email` — requires a valid `to` email address.
- `process_transaction` — requires a non-negative `amount`.
- Unknown task types are rejected with: `"Unknown task type: XYZ"`.

---

### Integration & Concurrency Tests

**Job Lifecycle Test**

Verifies the full happy path end-to-end:
1. A job is created with `status: 'queued'` and a past `scheduledAt`.
2. `processor.processNextJob()` claims and runs it atomically.
3. Job status becomes `'completed'`, `attemptsMade` is `1`, and `claimedBy` is cleared.
4. A `JobExecution` record is written with the correct `workerId`, `attempt`, and `durationMs`.

**Failure & Dead-Letter Queue Test**

Verifies the full failure path:
1. `Math.random` is mocked to always trigger a `process_transaction` failure (mocked value `0.01` < failure threshold `0.25`).
2. **Attempt 1**: Job transitions `'queued'` → `'retrying'`. `lastError` contains `"Merchant gateway timeout"`. `scheduledAt` is set to a future retry time.
3. `scheduledAt` is manually reset to force immediate retry.
4. **Attempt 2**: `maxAttempts` (2) exhausted → job status becomes `'dead_letter'`.
5. A `DeadLetterQueue` document is persisted with `queueId` and the original error message.

**Idempotency Key Test**

Verifies the database-level safety net:
1. A job is created with `idempotencyKey: 'idemp-123'`.
2. A second `Job.create` with the same key and `queueId` is rejected by MongoDB's unique partial index (error code `11000`).

**High Concurrency Claim Test ⚡**

The core correctness benchmark for distributed claim safety:

| Parameter | Value |
|---|---|
| Jobs inserted into queue | **20** |
| Concurrent worker processor instances | **5** |
| Concurrent `processNextJob()` calls | **20** (via `Promise.all`) |
| Successful claims | **20 / 20** |
| Double claims | **0** |
| Orphaned jobs | **0** |
| `attemptsMade` per job | **exactly 1** |

> **Result: Passed.** The `findOneAndUpdate` atomic claim is race-condition-safe under concurrent load. No job was processed more than once.

---

### Running the Tests

> **Prerequisite**: MongoDB must be running locally before running integration tests.

```bash
# Run all tests (from repo root)
npm run test:all

# Run tests for the API package only
cd api && npm test

# Run only integration & concurrency tests
cd api && npx vitest run src/__tests__/integration.test.ts

# Watch mode (re-runs on file changes)
cd api && npm run test:watch
```

---

## Design Decisions & Trade-offs

Full details are in [`docs/DESIGN.md`](docs/DESIGN.md). Highlights:

### Why MongoDB?

- **Flexible job payloads**: Tasks like `send_email`, `process_images`, and `process_transaction` have different field shapes. MongoDB's document model stores them naturally without JSONB workarounds or EAV tables.
- **Atomic single-document claiming**: `findOneAndUpdate` provides the core coordination primitive for distributed job claiming without an external lock manager.
- **Horizontal write scale**: Worker heartbeats and execution logs are isolated documents, making sharding straightforward.

**Trade-offs accepted:**
- No cascading deletes — manual cleanup required when deleting projects/queues.
- No strict foreign key integrity — orphaned documents are possible if partial deletes fail.
- Complex joins require Mongoose `$lookup` aggregates instead of native SQL JOINs.

### Atomic Job Claiming

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
  { sort: { scheduledAt: 1, createdAt: 1 }, new: true }
);
```

MongoDB guarantees only one concurrent writer wins the document-level lock. Other workers find the status is no longer `'queued'` and move to the next document.

### Retry Strategy

Three backoff algorithms, all capped at `maxDelayMs`:

| Strategy | Formula |
|---|---|
| Fixed | `baseDelayMs` (constant) |
| Linear | `baseDelayMs × attemptNumber` |
| Exponential | `baseDelayMs × 2^(attemptNumber − 1)` |

When `attemptsMade >= maxAttempts`, the job is routed to the Dead-Letter Queue collection for manual audit and recovery.

### Idempotency — Dual-Tier Enforcement

| Tier | Mechanism | Purpose |
|---|---|---|
| API layer | `findOne` check before insert → returns existing job (HTTP 200) | Fast-path deduplication |
| Database layer | Unique compound partial index on `{ queueId, idempotencyKey }` | Catches any concurrent race that bypasses the API check |

---

## Known Limitations

| Limitation | Impact | Planned Fix |
|---|---|---|
| Cron scheduler runs in every worker process | Duplicate jobs enqueued when scaling workers horizontally | Leader election via Redis Redlock or MongoDB document lock |
| Concurrency limit check is non-atomic (TOCTOU) | Limits can be briefly exceeded under high concurrency | Distributed counter or Redlock around the claim window |
| No crash-recovery reaper service | Jobs claimed by crashed workers are orphaned indefinitely | Cron reaper: scan `lastHeartbeatAt > 30s`, reset stalled jobs to `queued` |
| No TTL index on `worker_heartbeats` / `job_logs` | Unbounded storage growth over time | Add Mongoose TTL indexes to both collections |
| No compound sort index on `jobs` for claiming | In-memory sort under high job volume | Add `{ status, scheduledAt, createdAt }` compound index |
| Redis is provisioned but not integrated | `ioredis` dependency is unused | Integrate for rate limiting, pub-sub, or Redlock |

---

## Docs

| Document | Description |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, component responsibilities, sequence diagrams |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Design decisions, trade-offs, concurrency analysis, known limitations |
| [`docs/TESTING.md`](docs/TESTING.md) | Full test suite documentation and run instructions |
| [`docs/API.md`](docs/API.md) | REST API quick reference with `curl` examples |
| [`docs/CUSTOMER_GUIDE.md`](docs/CUSTOMER_GUIDE.md) | Step-by-step guide for new users |
| [`docs/schema.md`](docs/schema.md) | Full MongoDB collection schema documentation |
| [`docs/openapi.yaml`](docs/openapi.yaml) | OpenAPI 3.0 specification |

---

## License

Private repository. All rights reserved.
