import mongoose, { Schema, Document } from 'mongoose';

export interface IDeadLetterQueue extends Document {
  jobId: string; // Keep as string (can be original job's ObjectId/UUID)
  queueId: mongoose.Types.ObjectId;
  payload: Record<string, any>;
  attemptsMade: number;
  lastError?: string;
  failedAt: Date;
  createdAt: Date;
}

const DeadLetterQueueSchema = new Schema<IDeadLetterQueue>({
  jobId: { type: String, required: true },
  queueId: { type: Schema.Types.ObjectId, ref: 'Queue', required: true, index: true },
  payload: { type: Schema.Types.Mixed, required: true },
  attemptsMade: { type: Number, required: true },
  lastError: { type: String },
  failedAt: { type: Date, required: true, default: Date.now }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const DeadLetterQueue = mongoose.models.DeadLetterQueue || mongoose.model<IDeadLetterQueue>('DeadLetterQueue', DeadLetterQueueSchema);
