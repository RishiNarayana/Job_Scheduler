import mongoose, { Schema, Document } from 'mongoose';

export interface IJobLog extends Document {
  jobExecutionId: mongoose.Types.ObjectId;
  level: string;
  message: string;
  timestamp: Date;
  createdAt: Date;
}

const JobLogSchema = new Schema<IJobLog>({
  jobExecutionId: { type: Schema.Types.ObjectId, ref: 'JobExecution', required: true, index: true },
  level: { type: String, required: true, default: 'info' },
  message: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const JobLog = mongoose.models.JobLog || mongoose.model<IJobLog>('JobLog', JobLogSchema);
