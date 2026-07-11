import mongoose, { Document } from 'mongoose';
export interface IJobLog extends Document {
    jobExecutionId: mongoose.Types.ObjectId;
    level: string;
    message: string;
    timestamp: Date;
    createdAt: Date;
}
export declare const JobLog: mongoose.Model<any, {}, {}, {}, any, any>;
