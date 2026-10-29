import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment';

/**
 * Real provider availability.
 *
 * Consultation windows are stored as free text (for example
 * `"10:00 AM - 02:00 PM, 05:00 PM - 08:00 PM"`). This module is the single
 * place that turns that text into an actual slot grid and reconciles it against
 * booked appointments, so availability is *derived* rather than invented.
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Statuses that hold a slot. */
const BLOCKING_STATUSES = ['requested', 'confirmed', 'checked_in'];

export type SlotStatus = 'available' | 'booked' | 'past';

export interface SlotAvailability {
  time: string;
  status: SlotStatus;
}

export interface DayAvailability {
  date: string;
  dayOfWeek: string;
  /** False when the clinician's declared working days exclude this weekday. */
  worksThisDay: boolean;
  consultationHours: string;
  slotDurationMinutes: number;
  slots: SlotAvailability[];
  availableCount: number;
  bookedCount: number;
}

export const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** `"10:30 AM"` -> minutes past midnight, or null when unparseable. */
export function parseTimeToMinutes(value: string): number | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i.exec(value || '');
  if (!match) return null;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();

  if (hours < 1 || hours > 12 || minutes > 59) return null;
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/** Minutes past midnight -> canonical `"10:30 AM"` slot label. */
export function formatMinutesToSlot(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  let hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;

  const meridiem = hours >= 12 ? 'PM' : 'AM';
  hours %= 12;
  if (hours === 0) hours = 12;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

/** Expands the consultation-hours text into the real bookable slot grid. */
export function buildSlotGrid(consultationHours: string, slotDurationMinutes: number): number[] {
  const duration = slotDurationMinutes > 0 ? slotDurationMinutes : 15;
  const grid: number[] = [];

  for (const range of (consultationHours || '').split(',')) {
    const match = /(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i.exec(range);
    if (!match) continue;

    const start = parseTimeToMinutes(match[1]);
    const end = parseTimeToMinutes(match[2]);
    if (start === null || end === null || end <= start) continue;

    for (let cursor = start; cursor + duration <= end; cursor += duration) {
      if (!grid.includes(cursor)) grid.push(cursor);
    }
  }

  return grid.sort((a, b) => a - b);
}

/** Weekday name for an ISO date, evaluated in the caller's local timezone. */
export function dayOfWeekFor(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return DAY_NAMES[parsed.getDay()];
}

export interface AvailabilitySubject {
  _id: mongoose.Types.ObjectId | string;
  consultationHours: string;
  slotDurationMinutes: number;
  availableDays: string[];
}

/**
 * Derives the availability of one clinician on one day.
 *
 * A slot is `booked` when a live appointment already holds it, and `past` when
 * the day is today and the slot start time has already gone by.
 */
export async function getDoctorDayAvailability(
  doctor: AvailabilitySubject,
  date: string
): Promise<DayAvailability> {
  const dayOfWeek = dayOfWeekFor(date);
  const worksThisDay = (doctor.availableDays || []).includes(dayOfWeek);
  const grid = buildSlotGrid(doctor.consultationHours, doctor.slotDurationMinutes);

  const bookedDocs = await Appointment.find(
    {
      doctorId: new mongoose.Types.ObjectId(doctor._id.toString()),
      appointmentDate: date,
      status: { $in: BLOCKING_STATUSES },
    },
    { timeSlot: 1 }
  ).lean();

  // Compare on normalised minutes so `"10:00 AM"` matches `"10:00 am"`.
  const bookedMinutes = new Set(
    bookedDocs
      .map((doc) => parseTimeToMinutes(String((doc as { timeSlot?: string }).timeSlot || '')))
      .filter((value): value is number => value !== null)
  );

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const isToday = date === todayIso;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const slots: SlotAvailability[] = grid.map((minutes) => {
    let status: SlotStatus = 'available';
    if (bookedMinutes.has(minutes)) status = 'booked';
    else if (isToday && minutes <= nowMinutes) status = 'past';
    return { time: formatMinutesToSlot(minutes), status };
  });

  return {
    date,
    dayOfWeek,
    worksThisDay,
    consultationHours: doctor.consultationHours,
    slotDurationMinutes: doctor.slotDurationMinutes,
    slots,
    availableCount: slots.filter((s) => s.status === 'available').length,
    bookedCount: slots.filter((s) => s.status === 'booked').length,
  };
}

export interface SlotCheck {
  ok: boolean;
  reason?: 'invalid_format' | 'outside_consultation_hours' | 'already_booked';
  message?: string;
  canonicalSlot?: string;
}

/**
 * Validates a requested slot against the clinician's real grid.
 *
 * Note this deliberately enforces the daily consultation window rather than the
 * weekly `availableDays` roster: front desks legitimately schedule outside the
 * published roster, so the roster is surfaced as information
 * (`worksThisDay`) rather than used to hard-reject a request.
 */
export async function checkRequestedSlot(
  doctor: AvailabilitySubject,
  date: string,
  requestedSlot: string
): Promise<SlotCheck> {
  const requestedMinutes = parseTimeToMinutes(requestedSlot);
  if (requestedMinutes === null) {
    return {
      ok: false,
      reason: 'invalid_format',
      message: `Time slot '${requestedSlot}' is not a recognised time (expected e.g. '10:30 AM').`,
    };
  }

  const grid = buildSlotGrid(doctor.consultationHours, doctor.slotDurationMinutes);
  if (!grid.includes(requestedMinutes)) {
    return {
      ok: false,
      reason: 'outside_consultation_hours',
      message: `The clinician does not consult at ${formatMinutesToSlot(
        requestedMinutes
      )}. Published hours: ${doctor.consultationHours}.`,
      canonicalSlot: formatMinutesToSlot(requestedMinutes),
    };
  }

  const existing = await Appointment.findOne({
    doctorId: new mongoose.Types.ObjectId(doctor._id.toString()),
    appointmentDate: date,
    status: { $in: BLOCKING_STATUSES },
  }).select('timeSlot');

  if (
    existing &&
    parseTimeToMinutes(String(existing.timeSlot || '')) === requestedMinutes
  ) {
    return {
      ok: false,
      reason: 'already_booked',
      message: `Slot Conflict: the clinician is already booked for ${formatMinutesToSlot(
        requestedMinutes
      )} on ${date}.`,
      canonicalSlot: formatMinutesToSlot(requestedMinutes),
    };
  }

  return { ok: true, canonicalSlot: formatMinutesToSlot(requestedMinutes) };
}
