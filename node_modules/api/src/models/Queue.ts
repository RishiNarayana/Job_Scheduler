import mongoose, { Schema, Document } from 'mongoose';

export interface IQueue extends Document {
  projectId: mongoose.Types.ObjectId;
  name: string;
  priority: number;
  concurrencyLimit?: number;
  retryPolicyId?: mongoose.Types.ObjectId;
  isPaused: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QueueSchema = new Schema<IQueue>({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  priority: { type: Number, required: true, default: 1 },
  concurrencyLimit: { type: Number },
  retryPolicyId: { type: Schema.Types.ObjectId, ref: 'RetryPolicy' },
  isPaused: { type: Boolean, required: true, default: false },
}, {
  timestamps: true
});

// Unique constraint per project
QueueSchema.index({ projectId: 1, name: 1 }, { unique: true });

export const Queue = mongoose.models.Queue || mongoose.model<IQueue>('Queue', QueueSchema);
