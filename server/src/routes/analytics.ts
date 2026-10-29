import { Router, Response } from 'express';
import { Organization } from '../models/Organization';
import { DoctorProfile } from '../models/DoctorProfile';
import { Appointment } from '../models/Appointment';
import { BedInventory } from '../models/BedInventory';
import { User } from '../models/User';
import { PharmacyInventoryItem } from '../models/PharmacyInventoryItem';
import { LabOrder } from '../models/LabOrder';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { sendError, ErrorCode } from '../utils/response';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/v1/analytics/public-health
router.get(
  '/public-health',
  authenticate,
  requireRole('public_health_admin', 'platform_super_admin', 'hospital_admin'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const [
        totalHospitals,
        totalClinics,
        totalPharmacies,
        totalLabs,
        totalDoctors,
        totalPatients,
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        beds,
        totalPrescriptionsDispensed,
      ] = await Promise.all([
        Organization.countDocuments({ type: 'hospital' }),
        Organization.countDocuments({ type: { $in: ['private_clinic', 'homeopathy_clinic'] } }),
        Organization.countDocuments({ type: 'medical_store' }),
        Organization.countDocuments({ type: 'diagnostic_lab' }),
        DoctorProfile.countDocuments(),
        User.countDocuments({ role: 'patient' }),
        Appointment.countDocuments(),
        Appointment.countDocuments({ status: 'completed' }),
        Appointment.countDocuments({ status: 'cancelled' }),
        BedInventory.find(),
        LabOrder.countDocuments({ isReleasedToPatient: true }),
      ]);

      let totalBedCapacity = 0;
      let totalBedAvailable = 0;
      let totalIcuCapacity = 0;
      let totalIcuAvailable = 0;

      beds.forEach((b) => {
        totalBedCapacity += b.totalCapacity;
        totalBedAvailable += b.available;
        if (b.category === 'icu') {
          totalIcuCapacity += b.totalCapacity;
          totalIcuAvailable += b.available;
        }
      });

      const bedOccupancyRate = totalBedCapacity > 0 ? Math.round(((totalBedCapacity - totalBedAvailable) / totalBedCapacity) * 100) : 0;
      const icuOccupancyRate = totalIcuCapacity > 0 ? Math.round(((totalIcuCapacity - totalIcuAvailable) / totalIcuCapacity) * 100) : 0;

      res.json({
        success: true,
        data: {
          facilities: {
            hospitals: totalHospitals,
            clinics: totalClinics,
            pharmacies: totalPharmacies,
            diagnosticLabs: totalLabs,
            registeredDoctors: totalDoctors,
            registeredPatients: totalPatients,
          },
          beds: {
            totalCapacity: totalBedCapacity,
            totalAvailable: totalBedAvailable,
            occupancyRatePercentage: bedOccupancyRate,
            icuCapacity: totalIcuCapacity,
            icuAvailable: totalIcuAvailable,
            icuOccupancyRatePercentage: icuOccupancyRate,
          },
          appointments: {
            totalBookings: totalAppointments,
            completed: completedAppointments,
            cancelled: cancelledAppointments,
            completionRate: totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
          },
          diagnosticTestsReleased: totalPrescriptionsDispensed,
          notice: 'De-identified aggregate public-health metric report. Individual patient health records are excluded in accordance with privacy policies.',
        },
      });
    } catch (err: any) {
      logger.error('Failed to compute public health analytics', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

export default router;
