import mongoose from 'mongoose';
export declare function connectDB(): Promise<typeof mongoose>;
export declare function disconnectDB(): Promise<void>;
