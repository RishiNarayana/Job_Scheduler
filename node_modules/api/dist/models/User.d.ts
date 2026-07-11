import mongoose, { Document } from 'mongoose';
export interface IUser extends Document {
    email: string;
    passwordHash: string;
    fullName?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const User: mongoose.Model<any, {}, {}, {}, any, any>;
