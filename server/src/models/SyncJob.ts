import mongoose, { Document, Schema } from 'mongoose';

export type SyncJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface ISyncJob extends Document {
  connectionId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  platform: string;
  status: SyncJobStatus;
  metricsSynced: number;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const syncJobSchema = new Schema<ISyncJob>(
  {
    connectionId: { type: Schema.Types.ObjectId, ref: 'WearableConnection' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    platform: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['queued', 'running', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    metricsSynced: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

export const SyncJob = mongoose.model<ISyncJob>('SyncJob', syncJobSchema);
