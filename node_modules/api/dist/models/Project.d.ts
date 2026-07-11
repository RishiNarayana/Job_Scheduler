import mongoose, { Document } from 'mongoose';
export interface IProject extends Document {
    organizationId: mongoose.Types.ObjectId;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Project: mongoose.Model<any, {}, {}, {}, any, any>;
