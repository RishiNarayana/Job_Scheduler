import mongoose, { Document } from 'mongoose';
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
export declare const Queue: mongoose.Model<any, {}, {}, {}, any, any>;
