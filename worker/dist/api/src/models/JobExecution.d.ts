import mongoose, { Document } from 'mongoose';
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
export declare const JobExecution: mongoose.Model<any, {}, {}, {}, any, any>;
