import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'appointment_reminder'
  | 'lab_result_ready'
  | 'prescription_issued'
  | 'prescription_dispensed'
  | 'bed_assigned'
  | 'queue_update'
  | 'payment_success'
  | 'payment_failed'
  | 'system_alert'
  | 'message'
  | 'support_update';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'appointment_confirmed', 'appointment_cancelled', 'appointment_reminder',
        'lab_result_ready', 'prescription_issued', 'prescription_dispensed',
        'bed_assigned', 'queue_update', 'payment_success', 'payment_failed',
        'system_alert', 'message', 'support_update',
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 1000 },
    icon: { type: String },
    data: { type: Schema.Types.Mixed },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  { timestamps: true }
);

// TTL: auto-delete notifications older than 90 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
