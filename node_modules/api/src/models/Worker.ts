import mongoose, { Schema, Document } from 'mongoose';

export interface IWorker extends Document {
  name: string;
  status: 'active' | 'offline' | 'stalled';
  concurrencyLimit: number;
  lastHeartbeatAt: Date;
  startedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkerSchema = new Schema<IWorker>({
  name: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['active', 'offline', 'stalled'], default: 'active', required: true },
  concurrencyLimit: { type: Number, required: true, default: 10 },
  lastHeartbeatAt: { type: Date, required: true, default: Date.now },
  startedAt: { type: Date, required: true, default: Date.now },
}, {
  timestamps: true
});

export const Worker = mongoose.models.Worker || mongoose.model<IWorker>('Worker', WorkerSchema);
