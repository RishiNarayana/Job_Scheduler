import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkerHeartbeat extends Document {
  workerId: mongoose.Types.ObjectId;
  metrics: Record<string, any>;
  createdAt: Date;
}

const WorkerHeartbeatSchema = new Schema<IWorkerHeartbeat>({
  workerId: { type: Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },
  metrics: { type: Schema.Types.Mixed, required: true }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const WorkerHeartbeat = mongoose.models.WorkerHeartbeat || mongoose.model<IWorkerHeartbeat>('WorkerHeartbeat', WorkerHeartbeatSchema);
