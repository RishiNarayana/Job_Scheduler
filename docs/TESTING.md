# Automated Testing Guide

This document describes the automated testing suite for the distributed job scheduler platform.

## Test Scope & Coverage

We use **Vitest** for running unit and integration tests. The tests reside in `api/src/__tests__/`.

### 1. Unit Tests
*   **Retry Delay Math** ([retry.test.ts](file:///c:/Users/Rishi%20Narayana/Desktop/Codity/api/src/__tests__/retry.test.ts)):
    *   Verifies correct base delay calculation for `fixed`, `linear`, and `exponential` backoff algorithms.
    *   Verifies that delay values are capped at the policy's configured `maxDelayMs`.
*   **Cron Expansion Logic** ([cron.test.ts](file:///c:/Users/Rishi%20Narayana/Desktop/Codity/api/src/__tests__/cron.test.ts)):
    *   Verifies that cron expressions (e.g. `*/5 * * * *`) successfully expand to the next $N$ future execution timestamps.
    *   Asserts that no duplicate execution times are generated.
*   **Task Payload Validation** ([payload.test.ts](file:///c:/Users/Rishi%20Narayana/Desktop/Codity/api/src/__tests__/payload.test.ts)):
    *   Asserts that default/empty task configurations are accepted.
    *   Asserts that `process_images` requires a non-empty `images` array of strings.
    *   Asserts that `send_email` requires a valid email recipient (`to`).
    *   Asserts that `process_transaction` requires a non-negative amount.
    *   Asserts that unknown task types are rejected with a clear error message: `"Unknown task type: XYZ"`.

### 2. Integration & Concurrency Tests
*   **Job Lifecycle** ([integration.test.ts](file:///c:/Users/Rishi%20Narayana/Desktop/Codity/api/src/__tests__/integration.test.ts)):
    *   Simulates the worker processor claiming and running a job.
    *   Verifies that the job transitions to `completed` and that a corresponding `JobExecution` attempt record is logged.
*   **Failure and DLQ Path** ([integration.test.ts](file:///c:/Users/Rishi%20Narayana/Desktop/Codity/api/src/__tests__/integration.test.ts)):
    *   Mocks `Math.random` to trigger a processing failure.
    *   Verifies that a failed execution shifts the job status to `retrying` and sets a future retry timestamp.
    *   Verifies that once max attempts are exhausted, the job status is set to `dead_letter` and the job details are archived in the `deadletterqueues` collection.
*   **Idempotency Unique Key** ([integration.test.ts](file:///c:/Users/Rishi%20Narayana/Desktop/Codity/api/src/__tests__/integration.test.ts)):
    *   Asserts that trying to create two jobs inside the same queue with the same `idempotencyKey` triggers a unique index database error.
*   **High Concurrency Claiming** ([integration.test.ts](file:///c:/Users/Rishi%20Narayana/Desktop/Codity/api/src/__tests__/integration.test.ts)):
    *   Inserts 20 queued jobs into MongoDB.
    *   Spins up 5 concurrent virtual worker processes.
    *   Triggers 20 claim executions concurrently using `Promise.all`.
    *   Asserts that exactly 20 jobs are processed and that no job is claimed twice or left unprocessed.

---

## Running the Tests

Make sure you have MongoDB running locally before executing the tests.

### Run All Tests
To run all tests inside the `api` service:
```bash
# Navigate to api folder
cd api

# Run tests
npm test
```

Or from the workspace root:
```bash
npm run test:all
```

### Run the Concurrency Test Specifically
To isolate and run only the integration and concurrency tests:
```bash
npx vitest run src/__tests__/integration.test.ts
```
