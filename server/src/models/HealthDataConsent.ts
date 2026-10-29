import mongoose, { Document, Schema } from 'mongoose';

export type ConsentCategory = 'vitals' | 'activity' | 'sleep' | 'prescriptions' | 'records';
export type ConsentStatus = 'active' | 'revoked' | 'expired';

export interface IHealthDataConsent extends Document {
  patientId: mongoose.Types.ObjectId;
  clinicianId?: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  categories: ConsentCategory[];
  status: ConsentStatus;
  grantedAt: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const healthDataConsentSchema = new Schema<IHealthDataConsent>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clinicianId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    categories: {
      type: [String],
      required: true,
      enum: ['vitals', 'activity', 'sleep', 'prescriptions', 'records'],
      default: ['vitals', 'activity'],
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'revoked', 'expired'],
      default: 'active',
      index: true,
    },
    grantedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    revokedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

healthDataConsentSchema.index({ patientId: 1, clinicianId: 1, status: 1 });
healthDataConsentSchema.index({ patientId: 1, organizationId: 1, status: 1 });

export const HealthDataConsent = mongoose.model<IHealthDataConsent>(
  'HealthDataConsent',
  healthDataConsentSchema
);
