import mongoose, { Document, Schema } from 'mongoose';

export interface IReferral extends Document {
  fromDoctorId: mongoose.Types.ObjectId;
  toDoctorId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  reason: string;
  notes?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    fromDoctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    toDoctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    reason: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'completed'], default: 'pending', index: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Referral = mongoose.model<IReferral>('Referral', ReferralSchema);