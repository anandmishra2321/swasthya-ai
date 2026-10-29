import mongoose, { Document, Schema } from 'mongoose';

/**
 * Server-side refresh-token session.
 *
 * The refresh token itself is never stored — only a SHA-256 hash — so a
 * database leak cannot be replayed against the API. Rotation revokes the
 * previous row and links the two via `rotatedFrom`.
 */
export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
  rotatedFrom?: mongoose.Types.ObjectId;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // `unique` already creates the index; declaring `index` too is a duplicate.
    refreshTokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    // TTL index declared once below.
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String },
    rotatedFrom: { type: Schema.Types.ObjectId, ref: 'Session' },
    lastUsedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// Auto-purge expired sessions.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model<ISession>('Session', SessionSchema);
