import mongoose, { Document } from 'mongoose';
export interface IOrganizationMember extends Document {
    organizationId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    createdAt: Date;
    updatedAt: Date;
}
export declare const OrganizationMember: mongoose.Model<any, {}, {}, {}, any, any>;
