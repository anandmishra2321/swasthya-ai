import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole =
  | 'patient'
  | 'hospital_doctor'
  | 'hospital_admin'
  | 'hospital_receptionist'
  | 'hospital_staff'
  | 'private_doctor'
  | 'private_clinic_admin'
  | 'clinic_receptionist'
  | 'homeopathy_doctor'
  | 'homeopathy_clinic_admin'
  | 'medical_store_owner'
  | 'pharmacist'
  | 'platform_super_admin'
  | 'verification_admin'
  | 'ambulance_provider'
  | 'lab_admin'
  | 'lab_tech'
  | 'nurse'
  | 'bed_manager'
  | 'doctor_assistant'
  | 'support_agent'
  | 'public_health_admin';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
  role: UserRole;
  isEmailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpiresAt?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  activeWorkspaceId?: mongoose.Types.ObjectId;
  preferredLanguage: 'en' | 'hi';
  isDemoAccount: boolean;
  comparePassword(candidatePassword: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
    },
    verificationTokenExpiresAt: {
      type: Date,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    activeWorkspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
    },
    preferredLanguage: {
      type: String,
      enum: ['en', 'hi'],
      default: 'en',
    },
    isDemoAccount: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User = mongoose.model<IUser>('User', UserSchema);
