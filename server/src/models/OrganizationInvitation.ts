import mongoose, { Document, Schema } from 'mongoose';
import { MembershipRole } from './Membership';

export interface IOrganizationInvitation extends Document {
  email: string;
  organizationId: mongoose.Types.ObjectId;
  role: MembershipRole;
  department?: string;
  tokenHash: string;
  invitedBy: mongoose.Types.ObjectId;
  status: 'pending' | 'processing' | 'accepted' | 'revoked';
  expiresAt: Date;
  processingUntil?: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationInvitationSchema = new Schema<IOrganizationInvitation>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    role: { type: String, required: true },
    department: { type: String, trim: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'accepted', 'revoked'],
      default: 'pending',
      index: true,
    },
    expiresAt: { type: Date, required: true },
    processingUntil: { type: Date },
    acceptedAt: { type: Date },
  },
  { timestamps: true }
);

OrganizationInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OrganizationInvitationSchema.index({ organizationId: 1, email: 1, status: 1 });

export const OrganizationInvitation = mongoose.model<IOrganizationInvitation>(
  'OrganizationInvitation',
  OrganizationInvitationSchema
);
