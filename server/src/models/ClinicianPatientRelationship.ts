import mongoose, { Document, Schema } from 'mongoose';

export type RelationshipStatus = 'active' | 'archived';
export type CareRelationshipType = 'primary' | 'consulting' | 'referral';

export interface IClinicianPatientRelationship extends Document {
  patientId: mongoose.Types.ObjectId;
  clinicianId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  status: RelationshipStatus;
  type: CareRelationshipType;
  establishedAt: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const clinicianPatientRelationshipSchema = new Schema<IClinicianPatientRelationship>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clinicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    status: {
      type: String,
      required: true,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['primary', 'consulting', 'referral'],
      default: 'consulting',
    },
    establishedAt: { type: Date, default: Date.now },
    notes: { type: String },
  },
  { timestamps: true }
);

clinicianPatientRelationshipSchema.index({ patientId: 1, clinicianId: 1 }, { unique: true });

export const ClinicianPatientRelationship = mongoose.model<IClinicianPatientRelationship>(
  'ClinicianPatientRelationship',
  clinicianPatientRelationshipSchema
);
