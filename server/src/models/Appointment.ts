import mongoose, { Document, Schema } from 'mongoose';

export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface IAppointmentStatusHistory {
  status: AppointmentStatus;
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  notes?: string;
}

export interface IAppointment extends Document {
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  appointmentDate: string; // YYYY-MM-DD
  timeSlot: string; // e.g., '10:30 AM'
  status: AppointmentStatus;
  reason: string;
  tokenNumber: number;
  notes?: string;
  statusHistory: IAppointmentStatusHistory[];
  isDemo: boolean;
  // Payment fields
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'waived';
  paymentId?: string;
  paymentOrderId?: string;
  paidAt?: Date;
  consultationFee: number;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'DoctorProfile',
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    appointmentDate: {
      type: String,
      required: true,
      index: true,
    },
    timeSlot: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['requested', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'],
      default: 'confirmed',
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
    tokenNumber: {
      type: Number,
      default: 1,
    },
    notes: String,
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        notes: String,
      },
    ],
    isDemo: {
      type: Boolean,
      default: false,
    },
    // Payment fields
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'waived'],
      default: 'pending',
    },
    paymentId: String,
    paymentOrderId: String,
    paidAt: Date,
    consultationFee: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Compound index for slot checking
AppointmentSchema.index(
  { doctorId: 1, appointmentDate: 1, timeSlot: 1 },
  { name: 'doctor_slot_idx' }
);

export const Appointment = mongoose.model<IAppointment>('Appointment', AppointmentSchema);
