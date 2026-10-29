import { Router, Response } from 'express';
import { z } from 'zod';
import { Appointment, AppointmentStatus } from '../models/Appointment';
import { DoctorProfile } from '../models/DoctorProfile';
import { Organization } from '../models/Organization';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { logAuditEvent } from '../services/auditService';
import { canManageAppointment } from '../services/accessControlService';
import { checkRequestedSlot } from '../services/availabilityService';
import { sendError, ErrorCode } from '../utils/response';
import { emitToUser } from '../services/socketService';
import { createPdfBuffer } from '../utils/pdf';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

const router = Router();

const createAppointmentSchema = z.object({
  doctorId: z.string(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  timeSlot: z.string().min(2),
  reason: z.string().min(3),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['requested', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show']),
  notes: z.string().optional(),
});

// GET /api/v1/appointments - List appointments based on role & permissions
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const filter: any = {};

    // Patient sees only their appointments
    if (user.role === 'patient') {
      filter.patientId = user._id;
    } else if (user.role.includes('doctor')) {
      const doctorProfile = await DoctorProfile.findOne({ userId: user._id });
      if (doctorProfile) {
        filter.doctorId = doctorProfile._id;
      } else {
        res.json({ success: true, count: 0, data: [] });
        return;
      }
    } else if (req.activeWorkspaceId) {
      // Organization staff (receptionist, admin, bed manager) see appointments for active organization
      filter.organizationId = req.activeWorkspaceId;
    }

    const { date, status } = req.query;
    if (date) {
      filter.appointmentDate = date;
    }
    if (status) {
      filter.status = status;
    }

    const appointments = await Appointment.find(filter)
      .populate('patientId', 'name email phone')
      .populate({
        path: 'doctorId',
        populate: [
          { path: 'userId', select: 'name email phone' },
          { path: 'organizationId', select: 'name type address phone' },
        ],
      })
      .populate('organizationId', 'name type address phone')
      .sort({ appointmentDate: 1, timeSlot: 1 });

    res.json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (err: any) {
    logger.error('Failed to list appointments', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/appointments - Book appointment with server-side double booking prevention
router.post('/', authenticate, validateBody(createAppointmentSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { doctorId, appointmentDate, timeSlot, reason, notes } = req.body;
    const patientId = req.user!._id;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Invalid Doctor ID.');
      return;
    }

    const doctor = await DoctorProfile.findById(doctorId);
    if (!doctor) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Doctor not found.');
      return;
    }

    const organizationId = doctor.organizationId;
    if (!organizationId) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Doctor has no affiliated organization/clinic.');
      return;
    }

    // Validate the requested slot against the clinician's real published hours
    // and existing bookings, rather than accepting an arbitrary time string.
    const slotCheck = await checkRequestedSlot(doctor, appointmentDate, timeSlot);

    if (!slotCheck.ok) {
      if (slotCheck.reason === 'already_booked') {
        sendError(res, 409, ErrorCode.CONFLICT, slotCheck.message!);
      } else {
        sendError(res, 400, ErrorCode.VALIDATION_FAILED, slotCheck.message!);
      }
      return;
    }

    const canonicalSlot = slotCheck.canonicalSlot!;

    // Generate token number for the day
    const countForDay = await Appointment.countDocuments({
      doctorId: doctor._id,
      appointmentDate,
    });
    const tokenNumber = countForDay + 1;

    const appointment = await Appointment.create({
      patientId,
      doctorId: doctor._id,
      organizationId,
      appointmentDate,
      timeSlot: canonicalSlot,
      status: 'confirmed',
      reason,
      tokenNumber,
      notes,
      consultationFee: doctor.consultationFee,
      statusHistory: [
        {
          status: 'confirmed',
          changedBy: req.user!._id,
          changedAt: new Date(),
          notes: 'Appointment initially confirmed',
        },
      ],
      isDemo: req.user!.isDemoAccount,
    });

    await logAuditEvent({
      actorId: req.user!._id as mongoose.Types.ObjectId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'APPOINTMENT_CREATE',
      targetType: 'Appointment',
      targetId: appointment._id.toString(),
      organizationId: organizationId as mongoose.Types.ObjectId,
      details: { doctorId, appointmentDate, timeSlot: canonicalSlot, tokenNumber },
    });

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully.',
      data: appointment,
    });
  } catch (err: any) {
    logger.error('Failed to book appointment', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// PATCH /api/v1/appointments/:id/status - Status transitions
router.patch('/:id/status', authenticate, validateBody(updateStatusSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Appointment not found.');
      return;
    }

    // Object-level check: only the patient themself, the treating doctor, or
    // staff of the booking organisation may touch this appointment.
    const decision = await canManageAppointment(req.user!._id, req.user!.role, {
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      organizationId: appointment.organizationId,
    });

    if (!decision.allowed) {
      await logAuditEvent({
        actorId: req.user!._id as mongoose.Types.ObjectId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'APPOINTMENT_ACCESS_DENIED',
        targetType: 'Appointment',
        targetId: appointment._id.toString(),
        organizationId: appointment.organizationId as mongoose.Types.ObjectId,
        details: { reason: decision.reason, detail: decision.detail, attemptedStatus: status },
      });
      sendError(
        res,
        403,
        ErrorCode.FORBIDDEN,
        'Access denied: you are not the patient, the treating doctor, or staff at the booking organisation.'
      );
      return;
    }

    // Patients are limited to cancelling their own appointment.
    if (decision.reason === 'self' && status !== 'cancelled') {
      sendError(res, 403, ErrorCode.FORBIDDEN, 'Patients can only cancel their appointments.');
      return;
    }

    appointment.status = status as AppointmentStatus;
    appointment.statusHistory.push({
      status: status as AppointmentStatus,
      changedBy: req.user!._id as mongoose.Types.ObjectId,
      changedAt: new Date(),
      notes: notes || `Status changed to ${status}`,
    });

    await appointment.save();

    emitToUser(String(appointment.patientId), 'appointment:updated', { appointment });
    if (appointment.doctorId) emitToUser(String(appointment.doctorId), 'appointment:updated', { appointment });

    await logAuditEvent({
      actorId: req.user!._id as mongoose.Types.ObjectId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'APPOINTMENT_STATUS_UPDATE',
      targetType: 'Appointment',
      targetId: appointment._id.toString(),
      organizationId: appointment.organizationId as mongoose.Types.ObjectId,
      details: { newStatus: status, notes },
    });

    res.json({
      success: true,
      message: `Appointment status updated to ${status}.`,
      data: appointment,
    });
  } catch (err: any) {
    logger.error('Failed to update appointment status', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// GET /api/v1/appointments/:id/slip - Download appointment slip as PDF
router.get('/:id/slip', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const appt = await Appointment.findById(req.params.id).populate('patientId','name email phone').populate('doctorId','name email role');
    if (!appt) { sendError(res, 404, ErrorCode.NOT_FOUND, 'Appointment not found.'); return; }
    const isPatient = req.user!.role === 'patient';
    if (isPatient && String(appt.patientId?._id || appt.patientId) !== String(req.user!._id)) { sendError(res, 403, ErrorCode.FORBIDDEN, 'Access denied.'); return; }
    const lines: string[] = []
    lines.push(`Doctor: ${(appt.doctorId as any)?.name || ''}`);
    lines.push(`Patient: ${(appt.patientId as any)?.name || ''}`);
    lines.push(`Date: ${appt.appointmentDate}`);
    lines.push(`Time Slot: ${appt.timeSlot}`);
    lines.push(`Status: ${appt.status}`);
    lines.push(`Reason: ${appt.reason || ''}`);
    if (appt.notes) lines.push(`Notes: ${appt.notes}`);
    const buffer = await createPdfBuffer('Appointment Slip', lines);
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="appointment-${appt._id}.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    logger.error('Appointment slip PDF export failed', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

export default router;
