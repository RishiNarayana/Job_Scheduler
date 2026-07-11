import mongoose, { Document } from 'mongoose';
export interface IOrganization extends Document {
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Organization: mongoose.Model<any, {}, {}, {}, any, any>;
