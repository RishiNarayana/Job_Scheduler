import mongoose, { Document } from 'mongoose';
export interface IDeadLetterQueue extends Document {
    jobId: string;
    queueId: mongoose.Types.ObjectId;
    payload: Record<string, any>;
    attemptsMade: number;
    lastError?: string;
    failedAt: Date;
    createdAt: Date;
}
export declare const DeadLetterQueue: mongoose.Model<any, {}, {}, {}, any, any>;
