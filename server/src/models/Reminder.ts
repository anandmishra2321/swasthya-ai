import mongoose, { Document, Schema } from 'mongoose';

export interface IReminder extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  medicine?: string;
  time: string; // HH:mm
  frequency: 'daily' | 'weekly' | 'once';
  active: boolean;
  lastTriggeredAt?: Date;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    medicine: { type: String, trim: true },
    time: { type: String, required: true },
    frequency: { type: String, enum: ['daily', 'weekly', 'once'], default: 'daily' },
    active: { type: Boolean, default: true, index: true },
    lastTriggeredAt: { type: Date },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Reminder = mongoose.model<IReminder>('Reminder', ReminderSchema);