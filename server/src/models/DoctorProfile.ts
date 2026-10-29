import mongoose, { Document, Schema } from 'mongoose';

export interface IDoctorProfile extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  specialty: string;
  qualifications: string[];
  registrationNumber: string;
  experienceYears: number;
  consultationFee: number;
  isHomeopathy: boolean;
  isVerified: boolean;
  about?: string;
  consultationHours: string;
  availableDays: string[];
  slotDurationMinutes: number;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DoctorProfileSchema = new Schema<IDoctorProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    specialty: {
      type: String,
      required: true,
      index: true,
    },
    qualifications: {
      type: [String],
      default: [],
    },
    registrationNumber: {
      // Intentionally not required: a self-registered clinician has no
      // registration number until they submit verifiable credentials.
      type: String,
      default: '',
      trim: true,
    },
    experienceYears: {
      type: Number,
      default: 0,
    },
    consultationFee: {
      type: Number,
      default: 0,
    },
    isHomeopathy: {
      type: Boolean,
      default: false,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    about: String,
    consultationHours: {
      type: String,
      default: '10:00 AM - 2:00 PM, 5:00 PM - 8:00 PM',
    },
    availableDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    slotDurationMinutes: {
      type: Number,
      default: 15,
    },
    isDemo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

DoctorProfileSchema.index({ specialty: 1, isVerified: 1 });

export const DoctorProfile = mongoose.model<IDoctorProfile>('DoctorProfile', DoctorProfileSchema);
