import mongoose, { Document, Schema } from 'mongoose';

export interface IHealthDailySummary extends Document {
  userId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  platform: string;
  avgHeartRate?: number;
  minHeartRate?: number;
  maxHeartRate?: number;
  restingHeartRate?: number;
  totalSteps?: number;
  sleepMinutes?: number;
  deepSleepMinutes?: number;
  remSleepMinutes?: number;
  lightSleepMinutes?: number;
  avgSpo2?: number;
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const healthDailySummarySchema = new Schema<IHealthDailySummary>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true, index: true },
    platform: { type: String, default: 'aggregated' },
    avgHeartRate: { type: Number },
    minHeartRate: { type: Number },
    maxHeartRate: { type: Number },
    restingHeartRate: { type: Number },
    totalSteps: { type: Number, default: 0 },
    sleepMinutes: { type: Number, default: 0 },
    deepSleepMinutes: { type: Number },
    remSleepMinutes: { type: Number },
    lightSleepMinutes: { type: Number },
    avgSpo2: { type: Number },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

healthDailySummarySchema.index({ userId: 1, date: -1 }, { unique: true });

export const HealthDailySummary = mongoose.model<IHealthDailySummary>(
  'HealthDailySummary',
  healthDailySummarySchema
);
