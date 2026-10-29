import mongoose, { Document, Schema } from 'mongoose';

export type HealthMetricType =
  | 'heart_rate'
  | 'resting_heart_rate'
  | 'steps'
  | 'sleep_duration'
  | 'spo2'
  | 'respiratory_rate'
  | 'temperature';

export interface IHealthMetricSample extends Document {
  userId: mongoose.Types.ObjectId;
  connectionId?: mongoose.Types.ObjectId;
  platform: string;
  metric: HealthMetricType;
  value: number;
  unit: string;
  measuredAt: Date;
  receivedAt: Date;
  quality?: string;
  sourceDeviceId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const healthMetricSampleSchema = new Schema<IHealthMetricSample>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    connectionId: { type: Schema.Types.ObjectId, ref: 'WearableConnection' },
    platform: { type: String, required: true },
    metric: {
      type: String,
      required: true,
      enum: [
        'heart_rate',
        'resting_heart_rate',
        'steps',
        'sleep_duration',
        'spo2',
        'respiratory_rate',
        'temperature',
      ],
      index: true,
    },
    value: { type: Number, required: true },
    unit: { type: String, required: true },
    measuredAt: { type: Date, required: true, index: true },
    receivedAt: { type: Date, default: Date.now },
    quality: { type: String, default: 'valid' },
    sourceDeviceId: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

healthMetricSampleSchema.index({ userId: 1, metric: 1, measuredAt: -1 });
// Compound index to deduplicate identical samples from same device and timestamp
healthMetricSampleSchema.index(
  { userId: 1, platform: 1, metric: 1, measuredAt: 1 },
  { unique: true }
);

export const HealthMetricSample = mongoose.model<IHealthMetricSample>(
  'HealthMetricSample',
  healthMetricSampleSchema
);
