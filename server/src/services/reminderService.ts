import { Appointment } from '../models/Appointment';
import { logger } from '../utils/logger';

export function startAppointmentReminders(): void {
  const run = async () => {
    try {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const upcoming = await Appointment.find({
        status: 'confirmed',
        appointmentDate: { $gte: now, $lte: tomorrow },
      }).limit(100);
      if (upcoming.length) {
        logger.info('Appointment reminders due', { count: upcoming.length });
      }
    } catch (err: any) {
      logger.error('Reminder job failed', { error: err?.message });
    }
  };
  // Run once on boot, then hourly.
  run();
  setInterval(run, 60 * 60 * 1000);
}