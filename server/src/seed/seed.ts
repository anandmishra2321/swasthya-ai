import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db';
import { env } from '../config/env';
import {
  User,
  Organization,
  Membership,
  DoctorProfile,
  PatientProfile,
  BedInventory,
  Appointment,
  MedicalRecord,
  Prescription,
  PharmacyInventoryItem,
  LabOrder,
  VerificationCase,
  SupportTicket,
  AuditLog,
} from '../models';

export interface SeedOptions {
  /** Skip the internal connectDB() when the caller already holds a live connection. */
  connect?: boolean;
  /** Seed only when the database holds no users, so a populated database is never wiped. */
  onlyIfEmpty?: boolean;
  /** Explicitly clear local demo data before re-seeding. Never allowed in production. */
  forceReset?: boolean;
}

export async function runSeed(options: SeedOptions = {}): Promise<boolean> {
  const { connect = true, onlyIfEmpty = true, forceReset = false } = options;

  if (env.NODE_ENV === 'production') {
    throw new Error('Demo seeding and reset are disabled in production.');
  }

  console.log('[Seed] Starting database demo seeding...');
  if (connect) {
    await connectDB();
  }

  if (onlyIfEmpty && !forceReset && env.NODE_ENV !== 'test') {
    const existingUsers = await User.estimatedDocumentCount();
    if (existingUsers > 0) {
      console.log(`[Seed] Skipped: database already holds ${existingUsers} user(s).`);
      return false;
    }
  }

  // Clean collections
  await Promise.all([
    User.deleteMany({}),
    Organization.deleteMany({}),
    Membership.deleteMany({}),
    DoctorProfile.deleteMany({}),
    PatientProfile.deleteMany({}),
    BedInventory.deleteMany({}),
    Appointment.deleteMany({}),
    MedicalRecord.deleteMany({}),
    Prescription.deleteMany({}),
    PharmacyInventoryItem.deleteMany({}),
    LabOrder.deleteMany({}),
    VerificationCase.deleteMany({}),
    SupportTicket.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log('[Seed] Existing demo records cleared.');

  const salt = await bcrypt.genSalt(10);
  const commonPasswordHash = await bcrypt.hash('Password123!', salt);

  // 1. Create Core Users
  console.log('[Seed] Creating demo users...');
  const patientUser = await User.create({
    name: 'Rahul Verma (Patient Demo)',
    email: 'patient@swasthya.demo',
    passwordHash: commonPasswordHash,
    phone: '+91 98260 12345',
    role: 'patient',
    isEmailVerified: true,
    preferredLanguage: 'en',
    isDemoAccount: true,
  });

  const hospitalAdminUser = await User.create({
    name: 'Dr. R.K. Mishra (Hospital Admin Demo)',
    email: 'hospital.admin@swasthya.demo',
    passwordHash: commonPasswordHash,
    phone: '+91 94251 11222',
    role: 'hospital_admin',
    isEmailVerified: true,
    preferredLanguage: 'en',
    isDemoAccount: true,
  });

  const hospitalDoctorUser = await User.create({
    name: 'Dr. Sunita Sharma (Cardiologist Demo)',
    email: 'doctor.sharma@swasthya.demo',
    passwordHash: commonPasswordHash,
    phone: '+91 98261 22334',
    role: 'hospital_doctor',
    isEmailVerified: true,
    preferredLanguage: 'en',
    isDemoAccount: true,
  });

  const receptionistUser = await User.create({
    name: 'Pooja Tiwari (Receptionist Demo)',
    email: 'hospital.reception@swasthya.demo',
    passwordHash: commonPasswordHash,
    phone: '+91 98262 33445',
    role: 'hospital_receptionist',
    isEmailVerified: true,
    preferredLanguage: 'hi',
    isDemoAccount: true,
  });

  const bedManagerUser = await User.create({
    name: 'Amit Patel (Bed Manager Demo)',
    email: 'bed.manager@swasthya.demo',
    passwordHash: commonPasswordHash,
    phone: '+91 98263 44556',
    role: 'bed_manager',
    isEmailVerified: true,
    preferredLanguage: 'en',
    isDemoAccount: true,
  });

  const nurseUser = await User.create({
    name: 'Sister Anita Singh (Staff Nurse Demo)',
    email: 'nurse.anita@swasthya.demo',
    passwordHash: commonPasswordHash,
    phone: '+91 98264 55667',
    role: 'nurse',
    isEmailVerified: true,
    preferredLanguage: 'hi',
    isDemoAccount: true,
  });

  const privateDoctorUser = await User.create({
    name: 'Dr. Manoj Gupta (Private Physician Demo)',
    email: 'private.doctor@swasthya.demo',
    passwordHash: commonPasswordHash,
    phone: '+91 98265 66778',
    role: 'private_doctor',
    isEmailVerified: true,
    preferredLanguage: 'en',
    isDemoAccount: true,
  });

  const homeoDoctorUser = await User.create({
    name: 'Dr. Vivek Saxena (Homeopathy BHMS Demo)',
    email: 'homeo.doctor@swasthya.demo',
    passwordHash: commonPasswordHash,
    phone: '+91 98266 77889',
    role: 'homeopathy_doctor',
    isEmailVerified: true,
    preferredLanguage: 'hi',
    isDemoAccount: true,
  });

  const pharmacyOwnerUser = await User.create({
    name: 'Suresh Agrawal (Pharmacist & Owner Demo)',
    email: 'pharmacy.owner@swasthya.demo',
    passwordHash: commonPasswordHash,
    phone: '+91 98267 88990',
    role: 'medical_store_owner',
    isEmailVerified: true,
    preferredLanguage: 'en',
    isDemoAccount: true,
  });

  const labAdminUser = await User.create({
    name: 'Dr. Sandeep Pandey (Lab Pathologist Demo)',
    email: 'lab.admin@swasthya.demo',
    passwordHash: commonPasswordHash,
    phone: '+91 98268 99001',
    role: 'lab_admin',
    isEmailVerified: true,
    preferredLanguage: 'en',
    isDemoAccount: true,
  });

  const verificationAdminUser = await User.create({
    name: 'Neha Chaurasia (Verification Officer Demo)',
    email: 'verify.admin@swasthya.demo',
    passwordHash: commonPasswordHash,
    phone: '+91 98269 00112',
    role: 'verification_admin',
    isEmailVerified: true,
    preferredLanguage: 'en',
    isDemoAccount: true,
  });

  const publicHealthAdminUser = await User.create({
    name: 'Dr. K.P. Sen (Public Health Officer Demo)',
    email: 'publichealth.admin@swasthya.demo',
    passwordHash: commonPasswordHash,
    phone: '+91 98270 11223',
    role: 'public_health_admin',
    isEmailVerified: true,
    preferredLanguage: 'en',
    isDemoAccount: true,
  });

  const superAdminUser = await User.create({
    name: 'System Super Admin (Swasthya Platform)',
    email: 'superadmin@swasthya.demo',
    passwordHash: commonPasswordHash,
    phone: '+91 99999 88888',
    role: 'platform_super_admin',
    isEmailVerified: true,
    preferredLanguage: 'en',
    isDemoAccount: true,
  });

  // 2. Create Healthcare Organizations
  console.log('[Seed] Creating demo healthcare organizations...');
  const sgmHospital = await Organization.create({
    name: 'Sanjay Gandhi Memorial Hospital (Demo)',
    type: 'hospital',
    registrationNumber: 'HOSP-MP-REW-2024-001',
    ownerId: hospitalAdminUser._id,
    address: {
      street: 'Medical College Campus, Bodabag Road',
      area: 'Bodabag',
      city: 'Rewa',
      pincode: '486001',
      state: 'Madhya Pradesh',
      coordinates: { lat: 24.5362, lng: 81.3037 },
    },
    phone: '+91 7662 251101',
    email: 'contact@sgmh-rewa.demo',
    emergencyHelpline: '108 / +91 7662 251108',
    operatingHours: '24x7 Emergency Services | OPD: 08:30 AM - 02:00 PM',
    services: [
      '24x7 Trauma & Emergency',
      'Cardiology',
      'General Surgery',
      'Orthopedics',
      'Pediatrics',
      'Blood Bank',
      'ICU & Ventilators',
      'Dialysis Unit',
    ],
    departments: ['Cardiology', 'General Medicine', 'Orthopedics', 'Pediatrics', 'Emergency', 'Radiology'],
    totalBeds: 280,
    isVerified: true,
    verificationStatus: 'verified',
    isDemo: true,
  });

  const rewaClinic = await Organization.create({
    name: 'Rewa Care Multi-Specialty Clinic (Demo)',
    type: 'private_clinic',
    registrationNumber: 'CLN-MP-REW-2024-042',
    ownerId: privateDoctorUser._id,
    address: {
      street: 'Opposite Rajendra Complex, Civil Lines',
      area: 'Civil Lines',
      city: 'Rewa',
      pincode: '486001',
      state: 'Madhya Pradesh',
      coordinates: { lat: 24.5385, lng: 81.2989 },
    },
    phone: '+91 7662 242200',
    email: 'care@rewaclinic.demo',
    operatingHours: 'Monday - Saturday: 09:30 AM - 08:00 PM',
    services: ['General Consultation', 'Diabetes Care', 'ECG', 'Nebulization', 'Minor Wound Care'],
    departments: ['General Medicine', 'Diabetology'],
    isVerified: true,
    verificationStatus: 'verified',
    isDemo: true,
  });

  const arogyaHomeo = await Organization.create({
    name: 'Arogya Homeo Care Clinic (Demo)',
    type: 'homeopathy_clinic',
    registrationNumber: 'HOM-MP-REW-2023-108',
    ownerId: homeoDoctorUser._id,
    address: {
      street: 'Shop 4, Kothi Compound Market',
      area: 'Kothi Compound',
      city: 'Rewa',
      pincode: '486001',
      state: 'Madhya Pradesh',
      coordinates: { lat: 24.5412, lng: 81.3012 },
    },
    phone: '+91 7662 255440',
    email: 'ayush@arogyahomeo.demo',
    operatingHours: 'Monday - Saturday: 10:00 AM - 01:30 PM, 05:00 PM - 08:30 PM',
    services: ['Classical Homeopathy', 'Chronic Allergies', 'Skin Conditions', 'Digestive Health'],
    departments: ['Homeopathy Consultations'],
    isVerified: true,
    verificationStatus: 'verified',
    isDemo: true,
  });

  const cityPharmacy = await Organization.create({
    name: 'Rewa Jan Aushadhi & City Pharmacy (Demo)',
    type: 'medical_store',
    registrationNumber: 'DL-MP-REW-20-44910',
    ownerId: pharmacyOwnerUser._id,
    address: {
      street: 'Near Old Bus Stand, Venkat Road',
      area: 'Venkat Road',
      city: 'Rewa',
      pincode: '486001',
      state: 'Madhya Pradesh',
      coordinates: { lat: 24.534, lng: 81.3005 },
    },
    phone: '+91 7662 250320',
    email: 'orders@rewapharmacy.demo',
    operatingHours: '08:00 AM - 10:30 PM (All 7 Days)',
    services: ['Jan Aushadhi Generics', 'Prescription Dispensing', 'Surgical Supplies', 'Home Delivery in Rewa'],
    departments: ['Retail Pharmacy', 'Emergency Medicines'],
    isVerified: true,
    verificationStatus: 'verified',
    isDemo: true,
  });

  const diagnosticLab = await Organization.create({
    name: 'Shree Ram Diagnostic Center & Pathology (Demo)',
    type: 'diagnostic_lab',
    registrationNumber: 'LAB-MP-REW-2024-81',
    ownerId: labAdminUser._id,
    address: {
      street: 'College Road, Near Shilpi Plaza',
      area: 'Shilpi Plaza',
      city: 'Rewa',
      pincode: '486001',
      state: 'Madhya Pradesh',
      coordinates: { lat: 24.5375, lng: 81.3021 },
    },
    phone: '+91 7662 259881',
    email: 'reports@shreeramlab.demo',
    operatingHours: '07:00 AM - 09:00 PM (Sample collection till 07:30 PM)',
    services: ['Automated Biochemistry', 'Complete Blood Counts', 'Hormone Assays', 'Digital X-Ray', 'Home Sample Collection'],
    departments: ['Hematology', 'Biochemistry', 'Serology'],
    isVerified: true,
    verificationStatus: 'verified',
    isDemo: true,
  });

  // Assign Active Workspaces
  hospitalAdminUser.activeWorkspaceId = sgmHospital._id as any;
  await hospitalAdminUser.save();
  hospitalDoctorUser.activeWorkspaceId = sgmHospital._id as any;
  await hospitalDoctorUser.save();
  receptionistUser.activeWorkspaceId = sgmHospital._id as any;
  await receptionistUser.save();
  bedManagerUser.activeWorkspaceId = sgmHospital._id as any;
  await bedManagerUser.save();
  nurseUser.activeWorkspaceId = sgmHospital._id as any;
  await nurseUser.save();
  privateDoctorUser.activeWorkspaceId = rewaClinic._id as any;
  await privateDoctorUser.save();
  homeoDoctorUser.activeWorkspaceId = arogyaHomeo._id as any;
  await homeoDoctorUser.save();
  pharmacyOwnerUser.activeWorkspaceId = cityPharmacy._id as any;
  await pharmacyOwnerUser.save();
  labAdminUser.activeWorkspaceId = diagnosticLab._id as any;
  await labAdminUser.save();

  // 3. Create Memberships
  console.log('[Seed] Linking staff memberships...');
  await Membership.create([
    { userId: hospitalAdminUser._id, organizationId: sgmHospital._id, role: 'hospital_admin', status: 'active' },
    { userId: hospitalDoctorUser._id, organizationId: sgmHospital._id, role: 'hospital_doctor', department: 'Cardiology', status: 'active' },
    { userId: receptionistUser._id, organizationId: sgmHospital._id, role: 'hospital_receptionist', department: 'Front Desk OPD', status: 'active' },
    { userId: bedManagerUser._id, organizationId: sgmHospital._id, role: 'bed_manager', department: 'Inpatient Ward Operations', status: 'active' },
    { userId: nurseUser._id, organizationId: sgmHospital._id, role: 'nurse', department: 'ICU / General Ward', status: 'active' },
    { userId: privateDoctorUser._id, organizationId: rewaClinic._id, role: 'private_doctor', department: 'Consultation', status: 'active' },
    { userId: homeoDoctorUser._id, organizationId: arogyaHomeo._id, role: 'homeopathy_doctor', department: 'Homeopathy', status: 'active' },
    { userId: pharmacyOwnerUser._id, organizationId: cityPharmacy._id, role: 'store_owner', department: 'Dispensing & Inventory', status: 'active' },
    { userId: labAdminUser._id, organizationId: diagnosticLab._id, role: 'lab_admin', department: 'Pathology & Verification', status: 'active' },
  ]);

  // 4. Create Doctor Profiles
  console.log('[Seed] Creating doctor profiles & schedules...');
  const docProfile1 = await DoctorProfile.create({
    userId: hospitalDoctorUser._id,
    organizationId: sgmHospital._id,
    specialty: 'Cardiology',
    qualifications: ['MBBS', 'MD (Medicine)', 'DM (Cardiology)'],
    registrationNumber: 'MCI-MP-2015-8849',
    experienceYears: 12,
    consultationFee: 300,
    isHomeopathy: false,
    isVerified: true,
    about: 'Senior Consultant Cardiologist at Sanjay Gandhi Memorial Hospital with over a decade of experience in ischemic heart disease and preventive cardiovascular wellness.',
    consultationHours: '09:00 AM - 01:00 PM, 04:00 PM - 06:00 PM',
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    slotDurationMinutes: 15,
    isDemo: true,
  });

  const docProfile2 = await DoctorProfile.create({
    userId: privateDoctorUser._id,
    organizationId: rewaClinic._id,
    specialty: 'General Medicine & Diabetology',
    qualifications: ['MBBS', 'MD (Internal Medicine)'],
    registrationNumber: 'MCI-MP-2012-4412',
    experienceYears: 15,
    consultationFee: 400,
    isHomeopathy: false,
    isVerified: true,
    about: 'Internal medicine specialist focusing on metabolic disorders, hypertension, diabetes management and comprehensive preventive health checkups.',
    consultationHours: '10:00 AM - 02:00 PM, 05:00 PM - 08:00 PM',
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    slotDurationMinutes: 20,
    isDemo: true,
  });

  const docProfile3 = await DoctorProfile.create({
    userId: homeoDoctorUser._id,
    organizationId: arogyaHomeo._id,
    specialty: 'Homeopathy Physician',
    qualifications: ['BHMS', 'MD (Homeopathy)'],
    registrationNumber: 'CCH-MP-2018-9120',
    experienceYears: 8,
    consultationFee: 250,
    isHomeopathy: true,
    isVerified: true,
    about: 'Classical homeopathy practitioner addressing chronic allergic conditions, pediatric respiratory sensitivities, migraine and constitutional care.',
    consultationHours: '10:00 AM - 01:30 PM, 05:00 PM - 08:30 PM',
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    slotDurationMinutes: 20,
    isDemo: true,
  });

  // 5. Create Patient Profile
  console.log('[Seed] Creating patient medical profile...');
  await PatientProfile.create({
    userId: patientUser._id,
    dateOfBirth: new Date('1994-05-14'),
    gender: 'male',
    bloodGroup: 'B+',
    emergencyContact: {
      name: 'Sunita Verma',
      phone: '+91 98260 99887',
      relation: 'Mother',
    },
    allergies: ['Penicillin', 'Sulfa drugs'],
    chronicConditions: ['Mild Allergic Rhinitis'],
    currentMedications: ['Cetirizine 10mg (as needed)'],
    dependents: [
      {
        name: 'Aarav Verma',
        relation: 'Son',
        dateOfBirth: new Date('2021-08-20'),
        gender: 'male',
        allergies: [],
      },
    ],
    address: {
      area: 'Urrahat',
      city: 'Rewa',
      pincode: '486001',
      state: 'Madhya Pradesh',
    },
    consentSharing: true,
    isDemo: true,
  });

  // 6. Hospital Beds Data (with fresh & stale timestamps)
  console.log('[Seed] Setting up hospital beds inventory...');
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const thirtyHoursAgo = new Date(now.getTime() - 30 * 60 * 60 * 1000); // Intentionally stale

  await BedInventory.create([
    {
      organizationId: sgmHospital._id,
      ward: 'Critical Care ICU Wing A',
      category: 'icu',
      totalCapacity: 24,
      available: 6,
      occupied: 16,
      cleaning: 2,
      reserved: 0,
      lastUpdatedBy: bedManagerUser._id,
      lastUpdatedAt: twoHoursAgo,
      notes: '6 beds equipped with advanced Hamilton ventilators',
      isDemo: true,
    },
    {
      organizationId: sgmHospital._id,
      ward: 'Emergency Trauma Ward',
      category: 'emergency',
      totalCapacity: 20,
      available: 5,
      occupied: 14,
      cleaning: 1,
      reserved: 0,
      lastUpdatedBy: bedManagerUser._id,
      lastUpdatedAt: twoHoursAgo,
      notes: 'Direct triaged intake from ambulance arrival',
      isDemo: true,
    },
    {
      organizationId: sgmHospital._id,
      ward: 'High-Flow Oxygen Care Ward',
      category: 'oxygen',
      totalCapacity: 50,
      available: 18,
      occupied: 30,
      cleaning: 2,
      reserved: 0,
      lastUpdatedBy: bedManagerUser._id,
      lastUpdatedAt: twoHoursAgo,
      notes: 'Central liquid oxygen line connection with backup manifolds',
      isDemo: true,
    },
    {
      organizationId: sgmHospital._id,
      ward: 'General Medicine Ward (Male)',
      category: 'general',
      totalCapacity: 60,
      available: 22,
      occupied: 36,
      cleaning: 2,
      reserved: 0,
      lastUpdatedBy: bedManagerUser._id,
      lastUpdatedAt: twoHoursAgo,
      notes: 'General ward with round-the-clock nursing supervision',
      isDemo: true,
    },
    {
      organizationId: sgmHospital._id,
      ward: 'Pediatric Care Ward',
      category: 'pediatric',
      totalCapacity: 30,
      available: 10,
      occupied: 18,
      cleaning: 2,
      reserved: 0,
      lastUpdatedBy: bedManagerUser._id,
      lastUpdatedAt: thirtyHoursAgo, // Stale notice demo
      notes: 'Stale status demo: Last synced over 24 hours ago. Call desk to confirm live vacancy.',
      isDemo: true,
    },
  ]);

  // 7. Seed Appointments
  console.log('[Seed] Seeding sample appointments...');
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const appt1 = await Appointment.create({
    patientId: patientUser._id,
    doctorId: docProfile1._id,
    organizationId: sgmHospital._id,
    appointmentDate: todayStr,
    timeSlot: '10:30 AM',
    status: 'confirmed',
    reason: 'Routine cardiovascular checkup and blood pressure review',
    tokenNumber: 4,
    notes: 'Please bring recent lipid panel reports',
    statusHistory: [
      {
        status: 'confirmed',
        changedBy: patientUser._id,
        changedAt: twoHoursAgo,
        notes: 'Booked online via Swasthya AI portal',
      },
    ],
    isDemo: true,
  });

  await Appointment.create({
    patientId: patientUser._id,
    doctorId: docProfile2._id,
    organizationId: rewaClinic._id,
    appointmentDate: tomorrowStr,
    timeSlot: '11:00 AM',
    status: 'requested',
    reason: 'Follow-up consultation for mild seasonal rhinitis',
    tokenNumber: 2,
    statusHistory: [
      {
        status: 'requested',
        changedBy: patientUser._id,
        changedAt: now,
        notes: 'Requested slot',
      },
    ],
    isDemo: true,
  });

  // 8. Medical Records & Consultations
  console.log('[Seed] Seeding clinical consultations and visit notes...');
  await MedicalRecord.create({
    patientId: patientUser._id,
    doctorId: hospitalDoctorUser._id,
    organizationId: sgmHospital._id,
    type: 'visit_note',
    title: 'Cardiology Consultation - BP Follow-up',
    recordDate: new Date(Date.now() - 7 * 86400000),
    clinicalNotes: {
      symptoms: 'Occasional mild palpitations after heavy physical exertion. No chest discomfort or radiation.',
      examination: 'BP 128/82 mmHg, Pulse 74 bpm regular, S1 S2 heard normal, no murmurs. Chest clear.',
      diagnosis: 'Stage 1 Pre-hypertension, stable. Lifestyle and dietary sodium moderation advised.',
      plan: '1. Low sodium diet (< 2g/day)\n2. 30 mins brisk walking 5 days/week\n3. Review after 3 months with fasting lipid panel',
      followUpDate: '2026-11-20',
    },
    aiDraftSummary: '[AI DRAFT REVIEWED & SIGNED BY CLINICIAN]\nPatient presented with mild exertional palpitations. Vitals stable with BP 128/82. Clinical examination unremarkable. Lifestyle and sodium restriction recommended.',
    aiApprovedByDoctor: true,
    isDemo: true,
  });

  // 9. Digital Prescriptions
  console.log('[Seed] Seeding digital prescriptions...');
  await Prescription.create({
    patientId: patientUser._id,
    doctorId: hospitalDoctorUser._id,
    organizationId: sgmHospital._id,
    appointmentId: appt1._id,
    diagnosis: 'Mild Essential Hypertension & Allergic Rhinitis',
    medicines: [
      {
        name: 'Telmisartan 40mg',
        genericName: 'Telmisartan',
        dosage: '40 mg',
        frequency: '0-1-0 (After breakfast)',
        duration: '30 days',
        instructions: 'Take once daily in the morning with water.',
      },
      {
        name: 'Montelukast + Levocetirizine',
        genericName: 'Montelukast Sodium 10mg + Levocetirizine 5mg',
        dosage: '10mg/5mg',
        frequency: '0-0-1 (At bedtime)',
        duration: '10 days',
        instructions: 'Take at night if nasal congestion or sneezing occurs.',
      },
    ],
    advice: 'Drink 2.5L water daily, minimize fried foods and avoid late-night heavy meals.',
    followUpDate: '2026-11-20',
    allergyWarningTriggered: false,
    status: 'active',
    isDemo: true,
  });

  // 10. Pharmacy Inventory (with near-expiry and low-stock items)
  console.log('[Seed] Adding pharmacy medicine inventory...');
  await PharmacyInventoryItem.create([
    {
      organizationId: cityPharmacy._id,
      medicineName: 'Paracetamol Tablets 650mg',
      genericName: 'Paracetamol',
      brand: 'Dolo-650',
      strength: '650mg',
      dosageForm: 'tablet',
      packSize: 'Strip of 15',
      batchNumber: 'DOL-2024-918',
      expiryDate: '2027-08-31',
      quantity: 450,
      lowStockThreshold: 50,
      price: 33.5,
      isPrescriptionRequired: false,
      lastUpdatedBy: pharmacyOwnerUser._id,
      isDemo: true,
    },
    {
      organizationId: cityPharmacy._id,
      medicineName: 'Telmisartan Tablets 40mg',
      genericName: 'Telmisartan',
      brand: 'Telma 40',
      strength: '40mg',
      dosageForm: 'tablet',
      packSize: 'Strip of 15',
      batchNumber: 'TLM-2024-311',
      expiryDate: '2027-04-30',
      quantity: 120,
      lowStockThreshold: 30,
      price: 110.0,
      isPrescriptionRequired: true,
      lastUpdatedBy: pharmacyOwnerUser._id,
      isDemo: true,
    },
    {
      organizationId: cityPharmacy._id,
      medicineName: 'Azithromycin Tablets 500mg (Low Stock Alert)',
      genericName: 'Azithromycin',
      brand: 'Azee 500',
      strength: '500mg',
      dosageForm: 'tablet',
      packSize: 'Strip of 5',
      batchNumber: 'AZI-2024-002',
      expiryDate: '2026-12-15',
      quantity: 8, // Below threshold 20 -> triggers low stock alert!
      lowStockThreshold: 20,
      price: 119.5,
      isPrescriptionRequired: true,
      lastUpdatedBy: pharmacyOwnerUser._id,
      isDemo: true,
    },
    {
      organizationId: cityPharmacy._id,
      medicineName: 'Amoxicillin Oral Suspension 125mg (Near-Expiry Alert)',
      genericName: 'Amoxicillin',
      brand: 'Novamox Dry Syrup',
      strength: '125mg/5ml',
      dosageForm: 'syrup',
      packSize: 'Bottle of 60ml',
      batchNumber: 'AMX-2023-889',
      expiryDate: '2026-11-15', // Near expiry (< 30 days) -> triggers near-expiry alert!
      quantity: 25,
      lowStockThreshold: 10,
      price: 64.0,
      isPrescriptionRequired: true,
      lastUpdatedBy: pharmacyOwnerUser._id,
      isDemo: true,
    },
    {
      organizationId: cityPharmacy._id,
      medicineName: 'ORS Sachet (Oral Rehydration Salts)',
      genericName: 'WHO Oral Rehydration Formula',
      brand: 'Electral',
      strength: '21.8g',
      dosageForm: 'powder',
      packSize: 'Sachet 21.8g',
      batchNumber: 'ELC-2024-501',
      expiryDate: '2028-01-31',
      quantity: 300,
      lowStockThreshold: 50,
      price: 22.0,
      isPrescriptionRequired: false,
      lastUpdatedBy: pharmacyOwnerUser._id,
      isDemo: true,
    },
  ]);

  // 11. Diagnostic Lab Orders (Sample tracking & Release gating)
  console.log('[Seed] Setting up diagnostic lab orders...');
  // Order 1: Released report
  await LabOrder.create({
    patientId: patientUser._id,
    organizationId: diagnosticLab._id,
    testName: 'Complete Blood Count (CBC) with Platelets',
    category: 'Hematology',
    sampleId: 'SMP-CBC-881290',
    collectionDate: '2026-10-22',
    sampleStatus: 'completed',
    results: [
      { parameter: 'Hemoglobin (Hb)', value: '14.2', unit: 'g/dL', referenceRange: '13.0 - 17.0', isAbnormal: false },
      { parameter: 'Total WBC Count', value: '7,400', unit: '/mcL', referenceRange: '4,000 - 11,000', isAbnormal: false },
      { parameter: 'Platelet Count', value: '2,40,000', unit: '/mcL', referenceRange: '1,50,000 - 4,50,000', isAbnormal: false },
      { parameter: 'ESR (Erythrocyte Sedimentation Rate)', value: '12', unit: 'mm/1st hr', referenceRange: '0 - 15', isAbnormal: false },
    ],
    technicianNotes: 'Sample analyzed on 5-part automated hematology analyzer. Quality checks passed.',
    isReleasedToPatient: true,
    releasedAt: new Date(Date.now() - 3 * 86400000),
    releasedBy: labAdminUser._id,
    aiExplanation: 'All key parameters (Hemoglobin, WBC, Platelets, ESR) are within normal clinical intervals. No signs of infection, anemia, or abnormal clotting indicators.',
    isDemo: true,
  });

  // Order 2: Pending/Unreleased report (Must be masked from patient until released!)
  await LabOrder.create({
    patientId: patientUser._id,
    organizationId: diagnosticLab._id,
    testName: 'Comprehensive Metabolic Panel (CMP) & HbA1c',
    category: 'Biochemistry',
    sampleId: 'SMP-CMP-904128',
    collectionDate: todayStr,
    sampleStatus: 'processing',
    results: [
      { parameter: 'Fasting Blood Glucose', value: '98', unit: 'mg/dL', referenceRange: '70 - 100', isAbnormal: false },
      { parameter: 'HbA1c (Glycated Hemoglobin)', value: '5.4', unit: '%', referenceRange: '< 5.7', isAbnormal: false },
      { parameter: 'Serum Creatinine', value: '0.9', unit: 'mg/dL', referenceRange: '0.7 - 1.3', isAbnormal: false },
    ],
    technicianNotes: 'Preliminary readings logged. Pending Pathologist final review and sign-off.',
    isReleasedToPatient: false, // NOT released yet!
    isDemo: true,
  });

  // 12. Verification Cases
  console.log('[Seed] Seeding provider credential verification cases...');
  await VerificationCase.create([
    {
      targetType: 'hospital',
      targetId: sgmHospital._id,
      targetName: sgmHospital.name,
      submittedBy: hospitalAdminUser._id,
      status: 'verified',
      documents: [
        {
          docType: 'Clinical Establishment Act Certificate',
          documentNumber: 'CEA-MP-2024-001',
          issueDate: '2024-01-10',
          expiryDate: '2029-01-09',
          fileUrl: '/mock/docs/cea-sgmh.pdf',
          status: 'verified',
        },
        {
          docType: 'Fire Safety & NOC Certificate',
          documentNumber: 'FIRE-REW-2024-81',
          issueDate: '2024-03-01',
          expiryDate: '2027-02-28',
          fileUrl: '/mock/docs/fire-sgmh.pdf',
          status: 'verified',
        },
      ],
      reviewerId: verificationAdminUser._id,
      reviewerNotes: 'All statutory licenses verified against MP State Directorate of Health Services records.',
      decisionReason: 'Full compliance verified.',
      decisionAt: new Date(Date.now() - 30 * 86400000),
      isDemo: true,
    },
    {
      targetType: 'pharmacy',
      targetId: cityPharmacy._id,
      targetName: cityPharmacy.name,
      submittedBy: pharmacyOwnerUser._id,
      status: 'in_review',
      documents: [
        {
          docType: 'Retail Drug License (Form 20 & 21)',
          documentNumber: 'DL-20-44910-MP',
          issueDate: '2023-06-15',
          expiryDate: '2028-06-14',
          fileUrl: '/mock/docs/drug-license.pdf',
          status: 'pending',
        },
      ],
      reviewerId: verificationAdminUser._id,
      reviewerNotes: 'Under routine 5-year renewal check.',
      isDemo: true,
    },
  ]);

  // 13. Support Tickets
  console.log('[Seed] Seeding support tickets...');
  await SupportTicket.create({
    userId: patientUser._id,
    subject: 'Assistance with viewing previous lab report',
    category: 'technical',
    priority: 'low',
    status: 'resolved',
    description: 'I was unable to download the PDF report yesterday on mobile browser.',
    replies: [
      {
        senderId: hospitalAdminUser._id,
        senderName: 'Helpdesk Support',
        senderRole: 'support_agent',
        message: 'Hello Rahul, the report release has been confirmed. You can now access and download it directly from your Health Timeline.',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ],
    isDemo: true,
  });

  // 14. Initial Audit Logs
  console.log('[Seed] Creating initial system audit trail...');
  await AuditLog.create([
    {
      actorEmail: 'system.bootstrap@swasthya.demo',
      actorRole: 'system',
      action: 'SYSTEM_BOOTSTRAP_COMPLETE',
      targetType: 'Platform',
      details: { environment: 'development', version: '1.0.0', location: 'Rewa, MP' },
    },
    {
      actorId: hospitalAdminUser._id,
      actorEmail: hospitalAdminUser.email,
      actorRole: 'hospital_admin',
      action: 'BED_INVENTORY_INITIALIZED',
      organizationId: sgmHospital._id,
      details: { totalWards: 5, totalCapacity: 184 },
    },
  ]);

  console.log('[Seed] Demo database seeding completed successfully!');
  return true;
}

/**
 * Seeds the demo dataset into the *already connected* database, but only when it
 * is completely empty. Used by the dev server so localhost boots with data,
 * while an existing deployment is never overwritten.
 */
export async function seedIfEmpty(): Promise<boolean> {
  return runSeed({ connect: false, onlyIfEmpty: true });
}

if (require.main === module) {
  runSeed({
    onlyIfEmpty: process.env.SEED_RESET !== 'true',
    forceReset: process.env.SEED_RESET === 'true',
  })
    .then(() => {
      console.log('[Seed] Finished. Disconnecting DB...');
      return disconnectDB();
    })
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Error during seeding:', err);
      process.exit(1);
    });
}
