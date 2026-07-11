import mongoose, { Schema, Document } from 'mongoose';
import { JobStatus } from './Job.js';

export interface IJobExecution extends Document {
  jobId?: mongoose.Types.ObjectId;
  workerId?: mongoose.Types.ObjectId;
  attempt: number;
  status: JobStatus;
  startedAt: Date;
  finishedAt?: Date;
  error?: string;
  durationMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

const JobExecutionSchema = new Schema<IJobExecution>({
  jobId: { type: Schema.Types.ObjectId, ref: 'Job' },
  workerId: { type: Schema.Types.ObjectId, ref: 'Worker' },
  attempt: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['queued', 'scheduled', 'claimed', 'running', 'retrying', 'completed', 'failed', 'dead_letter', 'cancelled'], 
    required: true 
  },
  startedAt: { type: Date, required: true, default: Date.now },
  finishedAt: { type: Date },
  error: { type: String },
  durationMs: { type: Number }
}, {
  timestamps: true
});

JobExecutionSchema.index({ jobId: 1, startedAt: -1 });

export const JobExecution = mongoose.models.JobExecution || mongoose.model<IJobExecution>('JobExecution', JobExecutionSchema);
