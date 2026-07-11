┌──────────────┐        ┌──────────────────┐        ┌─────────────────┐
│    users     │        │  organizations   │        │   projects      │
│──────────────│        │──────────────────│        │─────────────────│
│ id (PK)      │◄───────│ id (PK)          │────────│ id (PK)         │
│ name         │        │ name             │ 1:N    │ org_id (FK)     │
│ email        │        │ created_at       │        │ name            │
│ password     │        └──────────────────┘        │ description     │
│ created_at   │                                     │ created_at      │
└──────────────┘                                     └──────┬──────────┘
                                                             │ 1:N
                                                             ▼
                                                   ┌────────────────────┐
                                                   │      queues        │
                                                   │────────────────────│
                                                   │ id (PK)            │
                                                   │ project_id (FK)    │
                                                   │ name               │
                                                   │ concurrency_limit  │
                                                   │ paused             │
                                                   │ created_at         │
                                                   └────────┬───────────┘
                                                            │ 1:N
                                                            ▼
┌──────────────────────┐                        ┌──────────────────────────────┐
│   retry_policies     │                        │            jobs              │
│──────────────────────│                        │──────────────────────────────│
│ id (PK)              │◄───────────────────────│ id (PK)                     │
│ strategy             │                        │ queue_id (FK)               │
│ base_delay_ms        │                        │ retry_policy_id (FK)        │
│ max_attempts         │                        │ task_type                   │
│ max_delay_ms         │                        │ payload (JSON)              │
└──────────────────────┘                        │ status                      │
                                                │ attempts_made               │
                                                │ scheduled_at                │
                                                │ claimed_by (FK)             │
                                                │ idempotency_key             │
                                                │ created_at                  │
                                                └───────┬───────────────┬─────┘
                                                        │               │
                                                     1:N│               │0..1
                                                        ▼               ▼
                                          ┌──────────────────┐   ┌────────────────────┐
                                          │ job_executions   │   │ dead_letter_queue  │
                                          │──────────────────│   │────────────────────│
                                          │ id (PK)          │   │ id (PK)            │
                                          │ job_id (FK)      │   │ job_id (FK)        │
                                          │ worker_id (FK)   │   │ queue_id (FK)      │
                                          │ attempt          │   │ reason             │
                                          │ status           │   │ created_at         │
                                          │ duration_ms      │   └────────────────────┘
                                          │ error            │
                                          │ executed_at      │
                                          └────────┬─────────┘
                                                   │
                                                   │ N:1
                                                   ▼
                                         ┌────────────────────┐
                                         │      workers       │
                                         │────────────────────│
                                         │ id (PK)            │
                                         │ name               │
                                         │ hostname           │
                                         │ status             │
                                         │ last_heartbeat_at  │
                                         └────────┬───────────┘
                                                  │1:N
                                                  ▼
                                      ┌────────────────────────┐
                                      │ worker_heartbeats      │
                                      │────────────────────────│
                                      │ id (PK)                │
                                      │ worker_id (FK)         │
                                      │ timestamp              │
                                      │ current_jobs           │
                                      └────────────────────────┘


                      ┌─────────────────────────────┐
                      │      scheduled_jobs         │
                      │─────────────────────────────│
                      │ id (PK)                     │
                      │ queue_id (FK)               │
                      │ cron_expression             │
                      │ payload (JSON)              │
                      │ next_run_at                 │
                      │ enabled                     │
                      └─────────────────────────────┘
