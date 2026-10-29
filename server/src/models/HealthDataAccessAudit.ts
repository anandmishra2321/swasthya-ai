import mongoose, { Document, Schema } from 'mongoose';

export type HealthAccessType = 'view_summary' | 'export_metrics' | 'view_stream' | 'consent_check';

export interface IHealthDataAccessAudit extends Document {
  patientId: mongoose.Types.ObjectId;
  accessedBy: mongoose.Types.ObjectId;
  accessType: HealthAccessType;
  metricsViewed: string[];
  accessedAt: Date;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const healthDataAccessAuditSchema = new Schema<IHealthDataAccessAudit>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accessedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accessType: {
      type: String,
      required: true,
      enum: ['view_summary', 'export_metrics', 'view_stream', 'consent_check'],
    },
    metricsViewed: { type: [String], default: [] },
    accessedAt: { type: Date, default: Date.now, index: true },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

export const HealthDataAccessAudit = mongoose.model<IHealthDataAccessAudit>(
  'HealthDataAccessAudit',
  healthDataAccessAuditSchema
);
