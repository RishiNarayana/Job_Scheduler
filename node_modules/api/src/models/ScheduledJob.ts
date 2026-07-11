import mongoose, { Schema, Document } from 'mongoose';

export interface IScheduledJob extends Document {
  projectId: mongoose.Types.ObjectId;
  queueId: mongoose.Types.ObjectId;
  name: string;
  cronExpression: string;
  payload: Record<string, any>;
  isActive: boolean;
  retryPolicyId?: mongoose.Types.ObjectId;
  nextRunAt: Date;
  lastRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledJobSchema = new Schema<IScheduledJob>({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  queueId: { type: Schema.Types.ObjectId, ref: 'Queue', required: true },
  name: { type: String, required: true },
  cronExpression: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  isActive: { type: Boolean, required: true, default: true },
  retryPolicyId: { type: Schema.Types.ObjectId, ref: 'RetryPolicy' },
  nextRunAt: { type: Date, required: true },
  lastRunAt: { type: Date }
}, {
  timestamps: true
});

// Unique constraint per project
ScheduledJobSchema.index({ projectId: 1, name: 1 }, { unique: true });

export const ScheduledJob = mongoose.models.ScheduledJob || mongoose.model<IScheduledJob>('ScheduledJob', ScheduledJobSchema);
