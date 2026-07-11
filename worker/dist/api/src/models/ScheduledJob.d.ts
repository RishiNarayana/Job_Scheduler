import mongoose, { Document } from 'mongoose';
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
export declare const ScheduledJob: mongoose.Model<any, {}, {}, {}, any, any>;
