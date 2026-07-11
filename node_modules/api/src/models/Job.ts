import mongoose, { Schema, Document } from 'mongoose';

export type JobStatus = 
  | 'queued'
  | 'scheduled'
  | 'claimed'
  | 'running'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'dead_letter'
  | 'cancelled';

export interface IJob extends Document {
  queueId: mongoose.Types.ObjectId;
  status: JobStatus;
  payload: Record<string, any>;
  idempotencyKey?: string;
  retryPolicyId?: mongoose.Types.ObjectId;
  scheduledAt: Date;
  claimedBy?: mongoose.Types.ObjectId;
  attemptsMade: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>({
  queueId: { type: Schema.Types.ObjectId, ref: 'Queue', required: true, index: true },
  status: { 
    type: String, 
    enum: ['queued', 'scheduled', 'claimed', 'running', 'retrying', 'completed', 'failed', 'dead_letter', 'cancelled'], 
    default: 'queued', 
    required: true,
    index: true
  },
  payload: { type: Schema.Types.Mixed, required: true },
  idempotencyKey: { type: String },
  retryPolicyId: { type: Schema.Types.ObjectId, ref: 'RetryPolicy' },
  scheduledAt: { type: Date, required: true, default: Date.now, index: true },
  claimedBy: { type: Schema.Types.ObjectId, ref: 'Worker' },
  attemptsMade: { type: Number, required: true, default: 0 },
  maxAttempts: { type: Number, required: true },
  lastError: { type: String }
}, {
  timestamps: true
});

// Unique index for idempotency keys within a queue, skipping nulls/undefined
JobSchema.index(
  { queueId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $exists: true, $type: 'string' } } }
);

// Claim lookup performance index
JobSchema.index({ queueId: 1, status: 1, scheduledAt: 1 });

export const Job = mongoose.models.Job || mongoose.model<IJob>('Job', JobSchema);
