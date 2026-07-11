import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true },
  slug: { type: String, required: true },
}, {
  timestamps: true
});

// Unique constraint per organization
ProjectSchema.index({ organizationId: 1, slug: 1 }, { unique: true });

export const Project = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);
