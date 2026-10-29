import { Router, Response } from 'express';
import { DoctorProfile } from '../models/DoctorProfile';
import { User } from '../models/User';
import { Organization } from '../models/Organization';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import {
  getDoctorDayAvailability,
  isIsoDate,
  dayOfWeekFor,
} from '../services/availabilityService';
import { sendError, ErrorCode } from '../utils/response';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/v1/doctors - Search doctors
router.get('/', async (req: any, res: Response): Promise<void> => {
  try {
    const { specialty, homeopathy, search, organizationId } = req.query;
    const filter: any = {};

    if (specialty) {
      filter.specialty = new RegExp(specialty as string, 'i');
    }
    if (homeopathy === 'true') {
      filter.isHomeopathy = true;
    } else if (homeopathy === 'false') {
      filter.isHomeopathy = false;
    }
    if (organizationId) {
      filter.organizationId = organizationId;
    }

    const doctors = await DoctorProfile.find(filter)
      .populate('userId', 'name email phone preferredLanguage')
      .populate('organizationId', 'name type address phone operatingHours isVerified')
      .sort({ isVerified: -1, experienceYears: -1 });

    let filtered = doctors;
    if (search) {
      const q = (search as string).toLowerCase();
      filtered = doctors.filter((doc: any) => {
        const docName = doc.userId?.name?.toLowerCase() || '';
        const docSpec = doc.specialty?.toLowerCase() || '';
        const orgName = doc.organizationId?.name?.toLowerCase() || '';
        return docName.includes(q) || docSpec.includes(q) || orgName.includes(q);
      });
    }

    res.json({
      success: true,
      count: filtered.length,
      data: filtered,
    });
  } catch (err: any) {
    logger.error('Failed to search doctors', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// GET /api/v1/doctors/:id - Doctor detail
router.get('/:id', async (req: any, res: Response): Promise<void> => {
  try {
    const doctor = await DoctorProfile.findById(req.params.id)
      .populate('userId', 'name email phone preferredLanguage')
      .populate('organizationId', 'name type address phone operatingHours isVerified');

    if (!doctor) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Doctor profile not found.');
      return;
    }

    // Availability is derived from the clinician's own published consultation
    // hours and existing bookings — never a hardcoded list.
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
    const availability = await getDoctorDayAvailability(doctor, todayIso);

    res.json({
      success: true,
      data: {
        ...doctor.toObject(),
        availabilityToday: availability,
        availableSlots: availability.slots.filter((s) => s.status === 'available').map((s) => s.time),
      },
    });
  } catch (err: any) {
    logger.error('Failed to load doctor profile', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// GET /api/v1/doctors/:id/availability?date=YYYY-MM-DD - Real slot grid
router.get('/:id/availability', async (req: any, res: Response): Promise<void> => {
  try {
    const { date } = req.query;

    if (date !== undefined && !isIsoDate(date)) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Query parameter "date" must be formatted YYYY-MM-DD.');
      return;
    }

    const doctor = await DoctorProfile.findById(req.params.id);
    if (!doctor) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Doctor profile not found.');
      return;
    }

    const target = (date as string) || new Date().toISOString().slice(0, 10);
    const availability = await getDoctorDayAvailability(doctor, target);

    res.json({
      success: true,
      data: {
        doctorId: doctor._id,
        specialty: doctor.specialty,
        ...availability,
        note: availability.worksThisDay
          ? 'Derived from the clinician\'s published consultation hours minus existing bookings.'
          : `The clinician's published roster does not include ${dayOfWeekFor(target)}, so these slots are informational only.`,
      },
    });
  } catch (err: any) {
    logger.error('Failed to build doctor availability', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// PUT /api/v1/doctors/profile - Update own doctor profile
router.put(
  '/profile',
  authenticate,
  requireRole('hospital_doctor', 'private_doctor', 'homeopathy_doctor'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { specialty, qualifications, consultationFee, about, consultationHours, availableDays } = req.body;

      const profile = await DoctorProfile.findOneAndUpdate(
        { userId: req.user!._id },
        {
          $set: {
            specialty,
            qualifications,
            consultationFee,
            about,
            consultationHours,
            availableDays,
          },
        },
        { new: true, upsert: true }
      );

      res.json({
        success: true,
        message: 'Doctor profile updated successfully.',
        data: profile,
      });
    } catch (err: any) {
      logger.error('Failed to update doctor profile', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

export default router;
