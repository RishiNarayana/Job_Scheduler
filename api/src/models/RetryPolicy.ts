import mongoose, { Schema, Document } from 'mongoose';

export interface IRetryPolicy extends Document {
  projectId: mongoose.Types.ObjectId;
  name: string;
  type: 'fixed' | 'linear' | 'exponential';
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const RetryPolicySchema = new Schema<IRetryPolicy>({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['fixed', 'linear', 'exponential'], required: true },
  baseDelayMs: { type: Number, required: true, default: 1000 },
  maxDelayMs: { type: Number, required: true, default: 60000 },
  maxAttempts: { type: Number, required: true, default: 3 },
}, {
  timestamps: true
});

// Unique constraint per project
RetryPolicySchema.index({ projectId: 1, name: 1 }, { unique: true });

export const RetryPolicy = mongoose.models.RetryPolicy || mongoose.model<IRetryPolicy>('RetryPolicy', RetryPolicySchema);
