import mongoose, { Document, Schema } from 'mongoose';

export type WearablePlatform = 'fitbit' | 'web_bluetooth_ble' | 'health_connect' | 'apple_health';
export type ConnectionStatus = 'connected' | 'disconnected' | 'revoked' | 'error';
export type SyncStatusType = 'idle' | 'syncing' | 'failed' | 'success';

export interface IWearableConnection extends Document {
  userId: mongoose.Types.ObjectId;
  platform: WearablePlatform;
  status: ConnectionStatus;
  deviceId?: string;
  deviceName?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes: string[];
  lastSyncAt?: Date;
  syncStatus: SyncStatusType;
  syncError?: string;
  companionPairingToken?: string;
  deviceMetadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const wearableConnectionSchema = new Schema<IWearableConnection>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    platform: {
      type: String,
      required: true,
      enum: ['fitbit', 'web_bluetooth_ble', 'health_connect', 'apple_health'],
    },
    status: {
      type: String,
      required: true,
      enum: ['connected', 'disconnected', 'revoked', 'error'],
      default: 'disconnected',
    },
    deviceId: { type: String },
    deviceName: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    tokenExpiresAt: { type: Date },
    scopes: { type: [String], default: [] },
    lastSyncAt: { type: Date },
    syncStatus: {
      type: String,
      enum: ['idle', 'syncing', 'failed', 'success'],
      default: 'idle',
    },
    syncError: { type: String },
    companionPairingToken: { type: String, index: true, sparse: true },
    deviceMetadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

wearableConnectionSchema.index({ userId: 1, platform: 1 });

export const WearableConnection = mongoose.model<IWearableConnection>(
  'WearableConnection',
  wearableConnectionSchema
);
