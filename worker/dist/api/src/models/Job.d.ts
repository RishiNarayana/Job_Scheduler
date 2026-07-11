import mongoose, { Document } from 'mongoose';
export type JobStatus = 'queued' | 'scheduled' | 'claimed' | 'running' | 'retrying' | 'completed' | 'failed' | 'dead_letter' | 'cancelled';
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
export declare const Job: mongoose.Model<any, {}, {}, {}, any, any>;
