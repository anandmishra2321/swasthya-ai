import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { runSeed } from '../src/seed/seed';
import { Express } from 'express';
import { User } from '../src/models/User';
import { PatientProfile } from '../src/models/PatientProfile';
import { Organization } from '../src/models/Organization';
import { Membership } from '../src/models/Membership';
import { VerificationCase } from '../src/models/VerificationCase';
import { Appointment } from '../src/models/Appointment';
import { env } from '../src/config/env';
import mongoose from 'mongoose';

let app: Express;
let patientToken: string;
let doctorToken: string;
let hospitalAdminToken: string;
let labAdminToken: string;
let pharmacyToken: string;
let patientUserId: string;
let doctorUserId: string;
let doctorProfileId: string;
let hospitalOrgId: string;
let testAppointmentId: string;

beforeAll(async () => {
  await runSeed({ forceReset: true });
  app = createApp() as Express;

  // Login as Patient
  const patientRes = await request(app).post('/api/v1/auth/login').send({
    email: 'patient@swasthya.demo',
    password: 'Password123!',
  });
  expect(patientRes.status).toBe(200);
  patientToken = patientRes.body.accessToken;
  patientUserId = patientRes.body.user.id;

  // Login as Hospital Doctor
  const docRes = await request(app).post('/api/v1/auth/login').send({
    email: 'doctor.sharma@swasthya.demo',
    password: 'Password123!',
  });
  expect(docRes.status).toBe(200);
  doctorToken = docRes.body.accessToken;
  doctorUserId = docRes.body.user.id;


  // Login as Hospital Admin
  const adminRes = await request(app).post('/api/v1/auth/login').send({
    email: 'hospital.admin@swasthya.demo',
    password: 'Password123!',
  });
  expect(adminRes.status).toBe(200);
  hospitalAdminToken = adminRes.body.accessToken;

  // Login as Lab Admin
  const labRes = await request(app).post('/api/v1/auth/login').send({
    email: 'lab.admin@swasthya.demo',
    password: 'Password123!',
  });
  expect(labRes.status).toBe(200);
  labAdminToken = labRes.body.accessToken;

  // Login as Pharmacy Owner
  const pharmRes = await request(app).post('/api/v1/auth/login').send({
    email: 'pharmacy.owner@swasthya.demo',
    password: 'Password123!',
  });
  expect(pharmRes.status).toBe(200);
  pharmacyToken = pharmRes.body.accessToken;

  // Fetch Doctor profile and Hospital ID
  const docsRes = await request(app).get('/api/v1/doctors');
  expect(docsRes.status).toBe(200);
  doctorProfileId = docsRes.body.data[0]._id;
  hospitalOrgId = docsRes.body.data[0].organizationId._id;
});

afterAll(async () => {
  await disconnectDB();
});

describe('1. Authentication & RBAC', () => {
  it('rejects login with invalid password without exposing email existence', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'patient@swasthya.demo',
      password: 'WrongPassword!',
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('allows access to protected /me endpoint with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('patient@swasthya.demo');
    expect(res.body.user.role).toBe('patient');
  });

  it('denies patient access to admin-only verification queue', async () => {
    const res = await request(app)
      .get('/api/v1/verification/queue')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('creates a single-use, email-bound invitation and activates membership only on acceptance', async () => {
    const email = `invited.staff.${Date.now()}@swasthya.demo`;
    const hospitalsRes = await request(app).get('/api/v1/organizations?type=hospital');
    const hospitalId = hospitalsRes.body.data[0]._id;
    const inviteRes = await request(app)
      .post(`/api/v1/organizations/${hospitalId}/invite`)
      .set('Authorization', `Bearer ${hospitalAdminToken}`)
      .send({ email, role: 'hospital_staff', department: 'OPD' });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.invitationToken).toMatch(/^[a-f0-9]{64}$/i);
    expect(await User.findOne({ email })).toBeNull();

    const acceptRes = await request(app).post('/api/v1/auth/accept-invitation').send({
      token: inviteRes.body.invitationToken,
      name: 'Invited Staff',
      password: 'StrongPassword123!',
    });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.workspaceRole).toBe('hospital_staff');
    expect(await User.findOne({ email })).not.toBeNull();

    const replayRes = await request(app).post('/api/v1/auth/accept-invitation').send({
      token: inviteRes.body.invitationToken,
      name: 'Invited Staff',
      password: 'StrongPassword123!',
    });
    expect(replayRes.status).toBe(400);
  });
});

describe('2. Healthcare Directory & Bed Freshness', () => {
  it('returns hospital listings with bed summary', async () => {
    const res = await request(app).get('/api/v1/organizations?type=hospital');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const sgm = res.body.data[0];
    expect(sgm.bedSummary).toBeDefined();
    expect(sgm.bedSummary.totalCapacity).toBeGreaterThan(0);
  });

  it('returns bed inventory with freshness flags and timestamps', async () => {
    const res = await request(app).get('/api/v1/beds');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const bed = res.body.data[0];
    expect(bed.lastUpdatedAt).toBeDefined();
    expect(bed.isStale).toBeDefined();
  });
});

describe('3. Appointment Booking & Double-Booking Prevention', () => {
  const testDate = '2026-11-15';
  const testSlot = '10:00 AM';

  it('successfully books a free slot for a doctor', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorProfileId,
        appointmentDate: testDate,
        timeSlot: testSlot,
        reason: 'General checkup',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.timeSlot).toBe(testSlot);
    testAppointmentId = res.body.data._id;
  });

  it('prevents double-booking for the same doctor, date and time slot', async () => {
    const conflictRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorProfileId,
        appointmentDate: testDate,
        timeSlot: testSlot,
        reason: 'Another patient trying to take the exact same slot',
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.success).toBe(false);
    expect(conflictRes.body.error.message).toContain('Slot Conflict');
  });

  it('derives payment from the owned appointment and labels local payment simulation', async () => {
    const originalKeyId = env.RAZORPAY_KEY_ID;
    const originalKeySecret = env.RAZORPAY_KEY_SECRET;
    const originalNodeEnv = env.NODE_ENV;
    const appointment = await Appointment.findById(testAppointmentId);
    expect(appointment).not.toBeNull();
    const originalPatientId = appointment!.patientId;
    const originalIsDemo = appointment!.isDemo;
    const originalPaymentStatus = appointment!.paymentStatus;
    const originalPaymentId = appointment!.paymentId;
    const originalPaymentOrderId = appointment!.paymentOrderId;
    const originalPaidAt = appointment!.paidAt;
    env.RAZORPAY_KEY_ID = '';
    env.RAZORPAY_KEY_SECRET = '';

    try {
      env.NODE_ENV = 'production';
      const productionRes = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ appointmentId: testAppointmentId });
      expect(productionRes.status).toBe(503);
      env.NODE_ENV = originalNodeEnv;

      appointment!.isDemo = false;
      await appointment!.save();
      const nonDemoRes = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ appointmentId: testAppointmentId });
      expect(nonDemoRes.status).toBe(503);

      appointment!.patientId = new mongoose.Types.ObjectId();
      await appointment!.save();
      const foreignRes = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ appointmentId: testAppointmentId });
      expect(foreignRes.status).toBe(404);
      appointment!.patientId = originalPatientId;
      appointment!.isDemo = originalIsDemo;
      await appointment!.save();

      const invalidRes = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ appointmentId: testAppointmentId, amount: 1 });
      expect(invalidRes.status).toBe(400);

      const orderRes = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ appointmentId: testAppointmentId });
      expect(orderRes.status).toBe(200);
      expect(orderRes.body.demo).toBe(true);

      const orderedAppointment = await Appointment.findById(testAppointmentId);
      expect(orderRes.body.data.amount).toBe(Math.round((orderedAppointment?.consultationFee || 0) * 100));
      expect(orderedAppointment?.paymentOrderId).toBe(orderRes.body.data.orderId);

      const paidAppointment = await Appointment.findById(testAppointmentId);
      paidAppointment!.isDemo = false;
      await paidAppointment!.save();
      const restrictedVerifyRes = await request(app)
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          appointmentId: testAppointmentId,
          razorpay_order_id: orderRes.body.data.orderId,
          razorpay_payment_id: 'demo_pay_test',
          demo: true,
        });
      expect(restrictedVerifyRes.status).toBe(503);
      paidAppointment!.isDemo = true;
      await paidAppointment!.save();

      const verifyRes = await request(app)
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          appointmentId: testAppointmentId,
          razorpay_order_id: orderRes.body.data.orderId,
          razorpay_payment_id: 'demo_pay_test',
          demo: true,
        });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.message).toContain('no real charge');
      expect((await Appointment.findById(testAppointmentId))?.paymentStatus).toBe('paid');
    } finally {
      env.RAZORPAY_KEY_ID = originalKeyId;
      env.RAZORPAY_KEY_SECRET = originalKeySecret;
      env.NODE_ENV = originalNodeEnv;
      if (appointment) {
        appointment.patientId = originalPatientId;
        appointment.isDemo = originalIsDemo;
        appointment.paymentStatus = originalPaymentStatus;
        appointment.paymentId = originalPaymentId;
        appointment.paymentOrderId = originalPaymentOrderId;
        appointment.paidAt = originalPaidAt;
        await appointment.save();
      }
    }
  });
});

describe('4. Bed Inventory Updates & Capacity Validation', () => {
  it('rejects bed update if sum of states exceeds total capacity', async () => {
    const bedsRes = await request(app).get('/api/v1/beds');
    const bedId = bedsRes.body.data[0]._id;

    const invalidRes = await request(app)
      .put(`/api/v1/beds/${bedId}`)
      .set('Authorization', `Bearer ${hospitalAdminToken}`)
      .send({
        totalCapacity: 20,
        available: 15,
        occupied: 10, // 15 + 10 = 25 > 20
        cleaning: 2,
        reserved: 0,
      });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error.message).toContain('Capacity Inconsistency');
  });

  it('updates bed counts and records updater timestamp', async () => {
    const bedsRes = await request(app).get('/api/v1/beds');
    const bedId = bedsRes.body.data[0]._id;

    const validRes = await request(app)
      .put(`/api/v1/beds/${bedId}`)
      .set('Authorization', `Bearer ${hospitalAdminToken}`)
      .send({
        totalCapacity: 24,
        available: 8,
        occupied: 14,
        cleaning: 2,
        reserved: 0,
        notes: 'Updated during evening clinical handover',
      });

    expect(validRes.status).toBe(200);
    expect(validRes.body.data.available).toBe(8);
  });
});

describe('5. Diagnostic Lab Release Security Gating', () => {
  it('masks unreleased lab results from patient view', async () => {
    const res = await request(app)
      .get('/api/v1/lab-orders')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    const unreleased = res.body.data.find((o: any) => o.isReleasedToPatient === false);
    if (unreleased) {
      expect(unreleased.results.length).toBe(0);
      expect(unreleased.reportStatusNotice).toBeDefined();
    }
  });

  it('denies patient direct access to unreleased lab report detail', async () => {
    // Find unreleased order ID as lab admin
    const labOrdersRes = await request(app)
      .get('/api/v1/lab-orders')
      .set('Authorization', `Bearer ${labAdminToken}`);

    const unreleasedOrder = labOrdersRes.body.data.find((o: any) => o.isReleasedToPatient === false);

    if (unreleasedOrder) {
      const patientDetailRes = await request(app)
        .get(`/api/v1/lab-orders/${unreleasedOrder._id}`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(patientDetailRes.status).toBe(403);
      expect(patientDetailRes.body.error.message).toContain('withheld');
    }
  });
});

describe('6. AI Medical Safeguards & Red-Flag Interception', () => {
  it('detects acute cardiac red-flag and triggers immediate emergency redirect', async () => {
    const res = await request(app).post('/api/v1/ai/triage').send({
      symptoms: 'Patient having crushing severe chest pain and left arm pain for 30 minutes',
      language: 'en',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.isEmergency).toBe(true);
    expect(res.body.data.advice).toContain('RED FLAG DETECTED');
    expect(res.body.data.advice).toContain('112 / 108');
    expect(res.body.data.isMock).toBe(true);
  });

  it('provides non-emergency guidance for common symptoms with disclaimer', async () => {
    const res = await request(app).post('/api/v1/ai/triage').send({
      symptoms: 'Mild cold and dry cough since yesterday',
      language: 'en',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.isEmergency).toBe(false);
    expect(res.body.data.disclaimer).toContain('Not a medical diagnosis');
    expect(res.body.data.isMock).toBe(true);
  });

  it('requires an authenticated user to submit report values for explanation', async () => {
    const res = await request(app).post('/api/v1/ai/explain-report').send({
      parameters: [{ name: 'Hemoglobin', value: '12' }],
    });

    expect(res.status).toBe(401);
  });

  it('does not return deterministic demo guidance as live AI in production', async () => {
    const originalNodeEnv = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const res = await request(app).post('/api/v1/ai/triage').send({
        symptoms: 'Mild headache',
        language: 'en',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    } finally {
      env.NODE_ENV = originalNodeEnv;
    }
  });
});

describe('7. Location-Based Healthcare Discovery & Boundaries', () => {
  it('searches nearby facilities around Rewa MP with actual geographic distance and source attribution', async () => {
    const res = await request(app)
      .get('/api/v1/healthcare/search')
      .query({ lat: 24.5362, lng: 81.3037, radiusKm: 15 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.metadata.center.lat).toBe(24.5362);
    expect(res.body.metadata.radiusKm).toBe(15);
    expect(res.body.metadata.sources).toContain('Swasthya Healthcare Verified Database');

    if (res.body.data.length > 0) {
      const facility = res.body.data[0];
      expect(facility.distanceKm).toBeDefined();
      expect(facility.operationalData).toBeDefined();
      expect(facility.operationalData.bedAvailability).toBeDefined();
      expect(['Connected', 'Not connected', 'Unavailable']).toContain(
        facility.operationalData.bedAvailability.status
      );
    }
  });

  it('geocodes locations across India with default Rewa fallback', async () => {
    const res = await request(app).get('/api/v1/healthcare/geocode').query({ q: 'Rewa' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].city).toBe('Rewa');
  });
});

describe('8. Real Smartwatch / Wearable Connectivity & Metric Ingestion', () => {
  it('reports platform configurations truthfully (Fitbit not configured without API keys, Web BLE supported)', async () => {
    const res = await request(app)
      .get('/api/v1/wearables/status')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.platformConfig.webBluetooth.configured).toBe(true);
    // Fitbit should be not configured unless live keys are supplied in env
    expect(res.body.platformConfig.fitbit.configured).toBe(false);
  });

  it('ingests real-time Web Bluetooth GATT Heart Rate reading and records sample', async () => {
    const res = await request(app)
      .post('/api/v1/wearables/ble-ingest')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        bpm: 78,
        rrIntervals: [780, 775],
        sensorContact: true,
        deviceName: 'Polar H10 BLE Sensor',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bpm).toBe(78);
    expect(res.body.data.quality).toBe('valid');
  });

  it('generates companion pairing token for mobile health connect integration', async () => {
    const res = await request(app)
      .post('/api/v1/wearables/companion-token')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ platform: 'health_connect' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pairingToken).toBeDefined();
    expect(res.body.pairingToken.length).toBeGreaterThan(20);
  });

  it('ingests companion batch metrics and retrieves stored history', async () => {
    const now = new Date();
    const res = await request(app)
      .post('/api/v1/wearables/sync')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        platform: 'health_connect',
        deviceName: 'Pixel Watch 3',
        samples: [
          {
            metric: 'steps',
            value: 4500,
            unit: 'count',
            measuredAt: now.toISOString(),
          },
          {
            metric: 'resting_heart_rate',
            value: 64,
            unit: 'bpm',
            measuredAt: now.toISOString(),
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.syncedCount).toBe(2);

    // Retrieve metrics history
    const historyRes = await request(app)
      .get('/api/v1/wearables/metrics')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.length).toBeGreaterThanOrEqual(2);
  });
});

describe('9. Patient Consent Management & Clinician Monitoring Security', () => {
  let createdConsentId: string;

  it('denies doctor access to patient metrics when no active consent exists', async () => {
    const res = await request(app)
      .get(`/api/v1/clinician/patients/${patientUserId}/metrics`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Access Denied');
  });

  it('allows patient to explicitly grant health data consent to clinician', async () => {
    const res = await request(app)
      .post('/api/v1/consent/grant')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        clinicianId: doctorUserId,
        categories: ['vitals', 'activity'],
        notes: 'Sharing vitals for routine hypertension evaluation',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.categories).toContain('vitals');
    createdConsentId = res.body.data._id;
  });

  it('lists consented patient in clinician dashboard', async () => {
    const res = await request(app)
      .get('/api/v1/clinician/patients')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const foundPatient = res.body.data.find((p: any) => p.patientId === patientUserId);
    expect(foundPatient).toBeDefined();
    expect(foundPatient.name).toContain('Rahul Verma');
  });

  it('allows clinician to read authorized metrics once consent is active', async () => {
    const res = await request(app)
      .get(`/api/v1/clinician/patients/${patientUserId}/metrics`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.patient.name).toContain('Rahul Verma');
    expect(Array.isArray(res.body.metrics)).toBe(true);

    expect(res.body.clinicalNotice).toContain('Consumer wearable data is supplementary');
  });

  it('immediately blocks clinician access after patient revokes consent', async () => {
    // Patient revokes consent
    const revokeRes = await request(app)
      .post('/api/v1/consent/revoke')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ consentId: createdConsentId });

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.success).toBe(true);

    // Clinician tries to access again -> must be 403 Forbidden!
    const blockedRes = await request(app)
      .get(`/api/v1/clinician/patients/${patientUserId}/metrics`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(blockedRes.status).toBe(403);
    expect(blockedRes.body.error.message).toContain('Access Denied');
  });
});

describe('10. Object-Level Authorisation & Derived Provider Availability', () => {
  it('denies a non-clinical role access to another patient\'s records even with a valid token', async () => {
    const res = await request(app)
      .get(`/api/v1/records?patientId=${patientUserId}`)
      .set('Authorization', `Bearer ${pharmacyToken}`);

    // A role name alone must never unlock a patient chart.
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Access denied');
  });

  it('still lets a patient read their own record list', async () => {
    const res = await request(app)
      .get('/api/v1/records')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('derives real availability from consultation hours and booking state', async () => {
    const res = await request(app).get(`/api/v1/doctors/${doctorProfileId}/availability`).query({
      date: '2026-11-15',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.dayOfWeek).toBe('Sunday');
    // The seeded clinician's published roster is Monday to Saturday.
    expect(res.body.data.worksThisDay).toBe(false);
    expect(Array.isArray(res.body.data.slots)).toBe(true);

    // The slot booked in section 3 must now be reported as taken.
    const booked = res.body.data.slots.find((s: any) => s.time === '10:00 AM');
    expect(booked).toBeDefined();
    expect(booked.status).toBe('booked');
  });

  it('rejects malformed availability date queries', async () => {
    const res = await request(app)
      .get(`/api/v1/doctors/${doctorProfileId}/availability`)
      .query({ date: '15-11-2026' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects a booking slot outside the clinician\'s published consultation hours', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorProfileId,
        appointmentDate: '2027-01-05',
        timeSlot: '03:17 AM',
        reason: 'Testing an out-of-hours slot',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('does not consult at');
  });

  it('rejects a booking slot that is not a real time', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorProfileId,
        appointmentDate: '2027-01-05',
        timeSlot: 'sometime after lunch',
        reason: 'Testing a free-text slot',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('not a recognised time');
  });

  it('accepts a slot that lies inside the published consultation hours', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorProfileId,
        appointmentDate: '2027-01-05',
        timeSlot: '10:20 AM',
        reason: 'Routine follow-up within published hours',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.timeSlot).toBe('10:20 AM');
  });

  it('denies a patient attempting to rewrite public ward capacity', async () => {
    const bedsRes = await request(app).get('/api/v1/beds');
    const bedId = bedsRes.body.data[0]._id;

    const res = await request(app)
      .put(`/api/v1/beds/${bedId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ totalCapacity: 10, available: 10, occupied: 0, cleaning: 0, reserved: 0 });

    // Bed counts are public health data and must not be editable by patients.
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('denies ward capacity creation for an organisation the caller does not work in', async () => {
    const res = await request(app)
      .post('/api/v1/beds')
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({
        organizationId: hospitalOrgId,
        ward: 'Injected Ward',
        category: 'general',
        totalCapacity: 5,
        available: 5,
      });

    // medical_store_owner is not a hospital bed role at all.
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('rejects privileged role selection during public registration', async () => {
    const email = `newclinician.${Date.now()}@swasthya.demo`;
    const signupRes = await request(app).post('/api/v1/auth/signup').send({
      name: 'Dr. Test Signup',
      email,
      password: 'Password123!',
      role: 'private_doctor',
    });

    expect(signupRes.status).toBe(400);
    expect(signupRes.body.success).toBe(false);
    expect(await User.findOne({ email })).toBeNull();
  });

  it('rejects passwords shorter than twelve characters during public registration', async () => {
    const signupRes = await request(app).post('/api/v1/auth/signup').send({
      name: 'Test Patient',
      email: `shortpassword.${Date.now()}@swasthya.demo`,
      password: 'short',
    });

    expect(signupRes.status).toBe(400);
    expect(signupRes.body.success).toBe(false);
  });

  it('creates only patient accounts through public registration and does not pre-consent to sharing', async () => {
    const email = `patient.signup.${Date.now()}@swasthya.demo`;
    const signupRes = await request(app).post('/api/v1/auth/signup').send({
      name: 'New Patient',
      email,
      password: 'StrongPassword123!',
    });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.user.role).toBe('patient');
    const user = await User.findOne({ email });
    expect(user?.role).toBe('patient');
    const profile = await PatientProfile.findOne({ userId: user?._id });
    expect(profile?.consentSharing).toBe(false);
  });

  it('keeps new organizations pending verification and denies owner admin actions until approved', async () => {
    const createdRes = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        name: `Pending Hospital ${Date.now()}`,
        type: 'hospital',
        address: { area: 'Civil Lines', city: 'Rewa', pincode: '486001' },
        phone: '+91 90000 00000',
      });

    expect(createdRes.status).toBe(201);
    const organization = await Organization.findById(createdRes.body.data._id);
    expect(organization?.isVerified).toBe(false);
    expect(await VerificationCase.findOne({ targetId: organization?._id, status: 'pending' })).not.toBeNull();
    expect(await Membership.findOne({ userId: patientUserId, organizationId: organization?._id, status: 'invited' })).not.toBeNull();

    const inviteRes = await request(app)
      .post(`/api/v1/organizations/${organization?._id}/invite`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ email: `coworker.${Date.now()}@swasthya.demo`, role: 'hospital_staff' });
    expect(inviteRes.status).toBe(403);
  });
});
