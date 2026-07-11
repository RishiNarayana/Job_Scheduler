import mongoose, { Document } from 'mongoose';
export interface IWorker extends Document {
    name: string;
    status: 'active' | 'offline' | 'stalled';
    concurrencyLimit: number;
    lastHeartbeatAt: Date;
    startedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Worker: mongoose.Model<any, {}, {}, {}, any, any>;
