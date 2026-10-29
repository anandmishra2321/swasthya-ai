import type { UserRole } from '../types';

/**
 * Single source of truth for role routing.
 *
 * Every role maps to exactly one dashboard path. Several roles deliberately
 * share a dashboard when their job is the same workflow (for example every
 * doctor variant uses the clinical console), but each keeps its own label and
 * navigation so the UI never claims a capability the API does not grant.
 */

/** Panel ids the shared role workspace knows how to render. */
export type PanelId =
  | 'overview'
  | 'appointments'
  | 'beds'
  | 'records'
  | 'prescriptions'
  | 'patients'
  | 'inventory'
  | 'lab-orders'
  | 'verification'
  | 'tickets'
  | 'audit'
  | 'analytics'
  | 'discovery'
  | 'team'
  | 'organization'
  | 'wearables'
  | 'consent'
  | 'integrations'
  | 'profile';

export interface RoleNavItem {
  id: PanelId;
  label: string;
}

export interface RoleDefinition {
  role: UserRole;
  /** Short human label for the role itself. */
  label: string;
  /** Which console this role lands on. */
  dashboard: string;
  /** Route path for that console. */
  path: string;
  /** Which organisation types this role normally operates inside. */
  orgTypes: string[];
  /** One-line description shown in the workspace header. */
  summary: string;
  /** Whether the workspace is the shared generic console (vs a bespoke page). */
  generic: boolean;
  nav: RoleNavItem[];
}

const DOCTOR_NAV: RoleNavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'patients', label: 'Patients' },
  { id: 'records', label: 'Visit Notes' },
  { id: 'prescriptions', label: 'Prescriptions' },
  { id: 'lab-orders', label: 'Lab Orders' },
];

const CLINIC_ADMIN_NAV: RoleNavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'team', label: 'Team' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'records', label: 'Clinical Records' },
  { id: 'organization', label: 'Organisation' },
  { id: 'profile', label: 'Profile' },
];

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  patient: {
    role: 'patient',
    label: 'Patient',
    dashboard: 'patient',
    path: '/dashboard/patient',
    orgTypes: [],
    summary: 'Your appointments, records, prescriptions, lab reports and connected devices.',
    generic: false,
    nav: [
      { id: 'overview', label: 'Overview' },
      { id: 'appointments', label: 'Appointments' },
      { id: 'records', label: 'Records' },
      { id: 'prescriptions', label: 'Prescriptions' },
      { id: 'lab-orders', label: 'Lab Reports' },
      { id: 'wearables', label: 'Devices' },
      { id: 'consent', label: 'Consent' },
      { id: 'discovery', label: 'Find Care' },
    ],
  },
  hospital_doctor: {
    role: 'hospital_doctor',
    label: 'Hospital Doctor',
    dashboard: 'doctor',
    path: '/dashboard/doctor',
    orgTypes: ['hospital'],
    summary: 'Outpatient queue, clinical documentation and prescribing inside a hospital.',
    generic: false,
    nav: DOCTOR_NAV,
  },
  hospital_admin: {
    role: 'hospital_admin',
    label: 'Hospital Administrator',
    dashboard: 'hospital',
    path: '/dashboard/hospital',
    orgTypes: ['hospital'],
    summary: 'Ward capacity, staff roster and operational oversight for your hospital.',
    generic: false,
    nav: [
      { id: 'overview', label: 'Overview' },
      { id: 'beds', label: 'Bed Capacity' },
      { id: 'team', label: 'Staff' },
      { id: 'audit', label: 'Audit Trail' },
      { id: 'organization', label: 'Hospital' },
    ],
  },
  hospital_receptionist: {
    role: 'hospital_receptionist',
    label: 'Hospital Receptionist',
    dashboard: 'receptionist',
    path: '/dashboard/receptionist',
    orgTypes: ['hospital'],
    summary: 'Front-desk registration, appointment booking and patient check-in.',
    generic: false,
    nav: [
      { id: 'overview', label: 'Today' },
      { id: 'appointments', label: 'Appointments' },
      { id: 'discovery', label: 'Find Care' },
    ],
  },
  hospital_staff: {
    role: 'hospital_staff',
    label: 'Hospital Staff',
    dashboard: 'hospital-staff',
    path: '/dashboard/hospital-staff',
    orgTypes: ['hospital'],
    summary: 'Ward support tasks, bed status and patient movement inside your hospital.',
    generic: true,
    nav: [
      { id: 'overview', label: 'Shift Overview' },
      { id: 'beds', label: 'Bed Status' },
      { id: 'appointments', label: 'Patient Flow' },
      { id: 'discovery', label: 'Find Care' },
      { id: 'profile', label: 'Profile' },
    ],
  },
  private_doctor: {
    role: 'private_doctor',
    label: 'Private Practitioner',
    dashboard: 'doctor',
    path: '/dashboard/doctor',
    orgTypes: ['private_clinic'],
    summary: 'Your consulting chamber queue, notes, prescriptions and lab requests.',
    generic: false,
    nav: DOCTOR_NAV,
  },
  private_clinic_admin: {
    role: 'private_clinic_admin',
    label: 'Clinic Administrator',
    dashboard: 'clinic-admin',
    path: '/dashboard/clinic-admin',
    orgTypes: ['private_clinic'],
    summary: 'Manage your clinic: staff, doctors, appointments and registrations.',
    generic: true,
    nav: CLINIC_ADMIN_NAV,
  },
  clinic_receptionist: {
    role: 'clinic_receptionist',
    label: 'Clinic Receptionist',
    dashboard: 'receptionist',
    path: '/dashboard/receptionist',
    orgTypes: ['private_clinic', 'homeopathy_clinic'],
    summary: 'Clinic front desk: booking, check-in and patient coordination.',
    generic: false,
    nav: [
      { id: 'overview', label: 'Today' },
      { id: 'appointments', label: 'Appointments' },
      { id: 'discovery', label: 'Find Care' },
    ],
  },
  homeopathy_doctor: {
    role: 'homeopathy_doctor',
    label: 'Homeopathy Doctor',
    dashboard: 'doctor',
    path: '/dashboard/doctor',
    orgTypes: ['homeopathy_clinic'],
    summary: 'Homeopathy consultation queue, case notes and prescriptions.',
    generic: false,
    nav: DOCTOR_NAV,
  },
  homeopathy_clinic_admin: {
    role: 'homeopathy_clinic_admin',
    label: 'Homeopathy Clinic Administrator',
    dashboard: 'clinic-admin',
    path: '/dashboard/clinic-admin',
    orgTypes: ['homeopathy_clinic'],
    summary: 'Manage your homeopathy practice: practitioners, team and appointments.',
    generic: true,
    nav: CLINIC_ADMIN_NAV,
  },
  medical_store_owner: {
    role: 'medical_store_owner',
    label: 'Medical Store Owner',
    dashboard: 'pharmacy',
    path: '/dashboard/pharmacy',
    orgTypes: ['medical_store'],
    summary: 'Stock levels, expiry monitoring and prescription dispensing.',
    generic: false,
    nav: [
      { id: 'overview', label: 'Overview' },
      { id: 'inventory', label: 'Inventory' },
      { id: 'prescriptions', label: 'Dispense Queue' },
      { id: 'team', label: 'Staff' },
    ],
  },
  pharmacist: {
    role: 'pharmacist',
    label: 'Pharmacist',
    dashboard: 'pharmacy',
    path: '/dashboard/pharmacy',
    orgTypes: ['medical_store'],
    summary: 'Dispense prescriptions and keep the store room accurate.',
    generic: false,
    nav: [
      { id: 'overview', label: 'Overview' },
      { id: 'prescriptions', label: 'Dispense Queue' },
      { id: 'inventory', label: 'Inventory' },
    ],
  },
  platform_super_admin: {
    role: 'platform_super_admin',
    label: 'Platform Administrator',
    dashboard: 'admin',
    path: '/dashboard/admin',
    orgTypes: [],
    summary: 'Provider verification, platform analytics and configuration status.',
    generic: false,
    nav: [
      { id: 'overview', label: 'Overview' },
      { id: 'verification', label: 'Verification Queue' },
      { id: 'analytics', label: 'Public Health' },
      { id: 'integrations', label: 'Integrations' },
      { id: 'audit', label: 'Audit Trail' },
    ],
  },
  verification_admin: {
    role: 'verification_admin',
    label: 'Verification Officer',
    dashboard: 'admin',
    path: '/dashboard/admin',
    orgTypes: [],
    summary: 'Review and decide on provider credential verification cases.',
    generic: false,
    nav: [
      { id: 'overview', label: 'Overview' },
      { id: 'verification', label: 'Verification Queue' },
    ],
  },
  ambulance_provider: {
    role: 'ambulance_provider',
    label: 'Ambulance Provider',
    dashboard: 'ambulance',
    path: '/dashboard/ambulance',
    orgTypes: ['emergency_provider'],
    summary: 'Your dispatch organisation profile and the emergency network around you.',
    generic: true,
    nav: [
      { id: 'overview', label: 'Overview' },
      { id: 'organization', label: 'Service Profile' },
      { id: 'discovery', label: 'Emergency Network' },
      { id: 'profile', label: 'Profile' },
    ],
  },
  lab_admin: {
    role: 'lab_admin',
    label: 'Laboratory Administrator',
    dashboard: 'lab',
    path: '/dashboard/lab',
    orgTypes: ['diagnostic_lab'],
    summary: 'Specimen workflow, result entry and report release governance.',
    generic: false,
    nav: [
      { id: 'overview', label: 'Overview' },
      { id: 'lab-orders', label: 'Work Queue' },
      { id: 'team', label: 'Staff' },
    ],
  },
  lab_tech: {
    role: 'lab_tech',
    label: 'Laboratory Technician',
    dashboard: 'lab',
    path: '/dashboard/lab',
    orgTypes: ['diagnostic_lab'],
    summary: 'Process collected specimens and record verified results.',
    generic: false,
    nav: [
      { id: 'overview', label: 'Overview' },
      { id: 'lab-orders', label: 'Work Queue' },
    ],
  },
  nurse: {
    role: 'nurse',
    label: 'Nurse',
    dashboard: 'nurse',
    path: '/dashboard/nurse',
    orgTypes: ['hospital'],
    summary: 'Ward rounds: bed status, patient flow and clinical records for your hospital.',
    generic: true,
    nav: [
      { id: 'overview', label: 'Ward Overview' },
      { id: 'beds', label: 'Bed Status' },
      { id: 'appointments', label: 'Patient Flow' },
      { id: 'records', label: 'Clinical Records' },
      { id: 'profile', label: 'Profile' },
    ],
  },
  bed_manager: {
    role: 'bed_manager',
    label: 'Bed Manager',
    dashboard: 'hospital',
    path: '/dashboard/hospital',
    orgTypes: ['hospital'],
    summary: 'Real-time ward capacity, admissions and discharge coordination.',
    generic: false,
    nav: [
      { id: 'overview', label: 'Overview' },
      { id: 'beds', label: 'Bed Capacity' },
      { id: 'organization', label: 'Hospital' },
    ],
  },
  doctor_assistant: {
    role: 'doctor_assistant',
    label: 'Doctor Assistant',
    dashboard: 'doctor-assistant',
    path: '/dashboard/doctor-assistant',
    orgTypes: ['hospital', 'private_clinic', 'homeopathy_clinic'],
    summary: 'Support a clinician: triage the queue, prepare notes and track lab orders.',
    generic: true,
    nav: [
      { id: 'overview', label: 'Queue Overview' },
      { id: 'appointments', label: 'Appointment Desk' },
      { id: 'lab-orders', label: 'Lab Tracking' },
      { id: 'records', label: 'Records' },
      { id: 'profile', label: 'Profile' },
    ],
  },
  support_agent: {
    role: 'support_agent',
    label: 'Support Agent',
    dashboard: 'support',
    path: '/dashboard/support',
    orgTypes: [],
    summary: 'Handle patient and provider support tickets raised on the platform.',
    generic: true,
    nav: [
      { id: 'overview', label: 'Queue Overview' },
      { id: 'tickets', label: 'Tickets' },
      { id: 'profile', label: 'Profile' },
    ],
  },
  public_health_admin: {
    role: 'public_health_admin',
    label: 'Public Health Administrator',
    dashboard: 'admin',
    path: '/dashboard/admin',
    orgTypes: [],
    summary: 'District-level aggregate healthcare analytics and bed-capacity posture.',
    generic: false,
    nav: [
      { id: 'overview', label: 'Overview' },
      { id: 'analytics', label: 'Public Health' },
    ],
  },
};

export const ALL_ROLES = Object.keys(ROLE_DEFINITIONS) as UserRole[];

/** Roles allowed to open a given dashboard path. */
export function rolesForPath(path: string): UserRole[] {
  return ALL_ROLES.filter((role) => ROLE_DEFINITIONS[role].path === path);
}

export function getRoleDefinition(role?: string | null): RoleDefinition | null {
  if (!role) return null;
  return (ROLE_DEFINITIONS as Record<string, RoleDefinition>)[role] || null;
}

/**
 * Landing path for a role. Unknown roles fall back to the patient console
 * rather than a dead end, but the guard will still reject unpermitted access.
 */
export function getDashboardPath(role?: string | null): string {
  return getRoleDefinition(role)?.path || '/dashboard/patient';
}

/** Human label for a role, used in headers and the workspace switcher. */
export function getRoleLabel(role?: string | null): string {
  if (!role) return 'Guest';
  return getRoleDefinition(role)?.label || role.replace(/_/g, ' ');
}
