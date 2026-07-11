import mongoose, { Document } from 'mongoose';
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
export declare const RetryPolicy: mongoose.Model<any, {}, {}, {}, any, any>;
