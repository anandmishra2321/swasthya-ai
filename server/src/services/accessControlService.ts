import mongoose from 'mongoose';
import { UserRole } from '../models/User';
import { Membership } from '../models/Membership';
import { Organization } from '../models/Organization';
import { Appointment } from '../models/Appointment';
import { DoctorProfile } from '../models/DoctorProfile';
import { ClinicianPatientRelationship } from '../models/ClinicianPatientRelationship';
import { HealthDataConsent } from '../models/HealthDataConsent';

/**
 * Object-level authorisation.
 *
 * A role on its own is never sufficient to reach a specific patient's data.
 * Every accessor must additionally hold a *relationship* to that patient:
 * a care relationship, a booked appointment, an active consent grant, or
 * membership of the organisation that is treating them.
 *
 * This module is the single place where that decision is made so the rule
 * cannot drift between routes.
 */

/** Roles that may ever hold a clinician–patient relationship. */
const CLINICAL_ROLES: UserRole[] = [
  'hospital_doctor',
  'private_doctor',
  'homeopathy_doctor',
  'nurse',
];

/** Roles that may author clinical documentation. */
const AUTHORING_ROLES: UserRole[] = [
  'hospital_doctor',
  'private_doctor',
  'homeopathy_doctor',
];

export function isClinicalRole(role?: string | null): boolean {
  return !!role && CLINICAL_ROLES.includes(role as UserRole);
}

export function canAuthorClinicalNotes(role?: string | null): boolean {
  return !!role && AUTHORING_ROLES.includes(role as UserRole);
}

export interface AccessDecision {
  allowed: boolean;
  /** Machine-readable reason, safe to return to the caller. */
  reason:
    | 'self'
    | 'care_relationship'
    | 'appointment'
    | 'consent_grant'
    | 'organisation_member'
    | 'not_a_clinician'
    | 'no_relationship'
    | 'not_authenticated';
  /** Short human explanation used in audit records and error messages. */
  detail: string;
}

const DENY = (reason: AccessDecision['reason'], detail: string): AccessDecision => ({
  allowed: false,
  reason,
  detail,
});

const ALLOW = (reason: AccessDecision['reason'], detail: string): AccessDecision => ({
  allowed: true,
  reason,
  detail,
});

/** Roles that operate inside a laboratory and may see that lab's orders. */
const LAB_ROLES: UserRole[] = ['lab_admin', 'lab_tech'];

export function isLabRole(role?: string | null): boolean {
  return !!role && LAB_ROLES.includes(role as UserRole);
}

/** Active membership check, shared by the relationship and organisation paths. */
async function isActiveMemberOf(
  userId: mongoose.Types.ObjectId,
  organizationId: mongoose.Types.ObjectId
): Promise<boolean> {
  const membership = await Membership.findOne({
    userId,
    organizationId,
    status: 'active',
  }).select('_id');
  return !!membership;
}

/**
 * Whether `viewerId` may read clinical records belonging to `patientId`.
 *
 * `requireRelationship: false` is used for a patient reading their own chart.
 */
export async function canAccessPatientClinicalData(
  viewerId: string | mongoose.Types.ObjectId,
  viewerRole: UserRole | string | undefined,
  patientId: string | mongoose.Types.ObjectId,
  options: { organizationId?: string | mongoose.Types.ObjectId | null } = {}
): Promise<AccessDecision> {
  if (!viewerId) return DENY('not_authenticated', 'No authenticated viewer.');

  const viewer = new mongoose.Types.ObjectId(viewerId.toString());
  const patient = new mongoose.Types.ObjectId(patientId.toString());

  // A patient may always read their own chart.
  if (viewer.equals(patient)) {
    return ALLOW('self', 'The viewer is the patient.');
  }

  // Administrators and support staff have operational access, not clinical
  // access. They must never read PHI.
  if (!isClinicalRole(viewerRole)) {
    return DENY(
      'not_a_clinician',
      `Role '${viewerRole}' has no clinical relationship model and cannot access patient records.`
    );
  }

  // 1. An explicit care relationship.
  const relationship = await ClinicianPatientRelationship.findOne({
    patientId: patient,
    clinicianId: viewer,
    status: 'active',
  }).select('_id');
  if (relationship) {
    return ALLOW('care_relationship', 'An active care relationship exists.');
  }

  // 2. Any appointment between this clinician and the patient.
  const doctorProfile = await DoctorProfile.findOne({ userId: viewer }).select('_id');
  if (doctorProfile) {
    const appointment = await Appointment.findOne({
      doctorId: doctorProfile._id,
      patientId: patient,
    }).select('_id');
    if (appointment) {
      return ALLOW('appointment', 'The clinician has an appointment history with the patient.');
    }
  }

  // 3. An active consent grant for the 'records' category, to this clinician
  //    or to the organisation the clinician is currently working in.
  const consentScopes: Record<string, unknown>[] = [{ clinicianId: viewer }];
  if (options.organizationId) {
    consentScopes.push({ organizationId: new mongoose.Types.ObjectId(options.organizationId.toString()) });
  }
  const consent = await HealthDataConsent.findOne({
    patientId: patient,
    status: 'active',
    categories: 'records',
    $or: consentScopes,
  }).select('_id');
  if (consent) {
    return ALLOW('consent_grant', 'The patient granted active record-sharing consent.');
  }

  // 4. Shared organisation: a clinician working inside the same organisation
  //    the patient has been seen at.
  if (options.organizationId) {
    const orgId = new mongoose.Types.ObjectId(options.organizationId.toString());
    const [isMember, patientSeenHere] = await Promise.all([
      isActiveMemberOf(viewer, orgId),
      Appointment.exists({ patientId: patient, organizationId: orgId }),
    ]);
    if (isMember && patientSeenHere) {
      return ALLOW('organisation_member', 'The clinician and patient share a treating organisation.');
    }
  }

  return DENY(
    'no_relationship',
    'No care relationship, appointment, consent grant or shared treating organisation was found.'
  );
}

/**
 * Whether `viewerId` may change the status of a specific appointment.
 *
 * - the patient themself (cancel only — enforced by the caller)
 * - the treating doctor
 * - an owner or active member of the appointment's organisation
 */
export async function canManageAppointment(
  viewerId: string | mongoose.Types.ObjectId,
  viewerRole: UserRole | string | undefined,
  appointment: { patientId: any; doctorId: any; organizationId: any }
): Promise<AccessDecision> {
  if (!viewerId) return DENY('not_authenticated', 'No authenticated viewer.');

  const viewer = new mongoose.Types.ObjectId(viewerId.toString());
  const patientId = new mongoose.Types.ObjectId(appointment.patientId.toString());

  if (viewer.equals(patientId)) {
    return ALLOW('self', 'The viewer is the appointment patient.');
  }

  // Treating doctor.
  const doctorProfile = await DoctorProfile.findOne({ userId: viewer }).select('_id');
  if (doctorProfile && appointment.doctorId) {
    const treatingId =
      typeof appointment.doctorId === 'object' && appointment.doctorId._id
        ? appointment.doctorId._id.toString()
        : appointment.doctorId.toString();
    if (doctorProfile._id.toString() === treatingId) {
      return ALLOW('care_relationship', 'The viewer is the treating doctor.');
    }
  }

  // Organisation owner or active member.
  if (appointment.organizationId) {
    const orgId = new mongoose.Types.ObjectId(appointment.organizationId.toString());
    const org = await Organization.findById(orgId).select('ownerId');
    if (org?.ownerId && org.ownerId.toString() === viewer.toString()) {
      return ALLOW('organisation_member', 'The viewer owns the booking organisation.');
    }
    if (await isActiveMemberOf(viewer, orgId)) {
      return ALLOW('organisation_member', 'The viewer is staff at the booking organisation.');
    }
  }

  return DENY('no_relationship', 'The viewer is not the patient, the treating doctor, or staff at the booking organisation.');
}

/**
 * Whether `viewerId` may read a specific laboratory order.
 *
 * - the patient it belongs to
 * - laboratory staff holding an active membership of the performing laboratory
 * - a clinician with an independent relationship to the patient (see
 *   `canAccessPatientClinicalData`)
 */
export async function canAccessLabOrder(
  viewerId: string | mongoose.Types.ObjectId,
  viewerRole: UserRole | string | undefined,
  order: { patientId: any; organizationId?: any }
): Promise<AccessDecision> {
  if (!viewerId || !order?.patientId) {
    return DENY('not_authenticated', 'No authenticated viewer or order.');
  }

  const viewer = new mongoose.Types.ObjectId(viewerId.toString());
  const patientId = new mongoose.Types.ObjectId(order.patientId.toString());

  if (viewer.equals(patientId)) {
    return ALLOW('self', 'The viewer is the patient the order belongs to.');
  }

  const orgId = order.organizationId
    ? new mongoose.Types.ObjectId(order.organizationId.toString())
    : null;

  if (isLabRole(viewerRole)) {
    if (!orgId) {
      return DENY('no_relationship', 'The order is not attached to a laboratory the viewer belongs to.');
    }
    if (await isActiveMemberOf(viewer, orgId)) {
      return ALLOW('organisation_member', 'The viewer is active staff at the performing laboratory.');
    }
    return DENY('no_relationship', 'The viewer is not a member of the performing laboratory.');
  }

  return canAccessPatientClinicalData(viewer, viewerRole, patientId, {
    organizationId: orgId,
  });
}
