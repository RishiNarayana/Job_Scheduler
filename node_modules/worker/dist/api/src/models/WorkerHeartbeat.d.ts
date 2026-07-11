import mongoose, { Document } from 'mongoose';
export interface IWorkerHeartbeat extends Document {
    workerId: mongoose.Types.ObjectId;
    metrics: Record<string, any>;
    createdAt: Date;
}
export declare const WorkerHeartbeat: mongoose.Model<any, {}, {}, {}, any, any>;
