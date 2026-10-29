# BLUEPRINT_GAP_ANALYSIS.md

## Implemented (P0/P1 core)
- Email authentication, password reset (demo link), logout, sessions
- Automatic dashboard routing by role
- Patient/doctor/hospital/lab/pharmacy/receptionist/admin dashboards
- Hospital/doctor directory, location search/geocoding
- Appointment booking with conflict prevention
- Hospital-reported bed updates with freshness/stale flags
- Patient registration (patient-only)
- Basic consent/access controls
- AI health education (mock) + red-flag interception
- Report upload + record creation (new `/records/upload`)
- Digital prescriptions with allergy conflict
- Reminders/follow-ups (mock scheduler)
- Medical-store listings + stock updates
- Homeopathy directory (via doctors directory)
- Verification queue
- Lab booking/report workflow with release gating
- Real-time Socket.IO (notifications, beds, appointments, lab)
- Audit logs + CSV export
- RBAC + tenant isolation + workspace switcher

## Partial / Mocked
- AI: mock provider only (no live adapter)
- Email/SMS: mock (no delivery)
- Payments: demo mode (no live settlement)
- Wearables: Web Bluetooth only; OAuth not configured
- Ambulance: directory only (no dispatch)
- Report OCR/explanation: mock
- Teleconsultation: not implemented
- Referral workflow: partial
- Family/dependent profiles: model exists, CRUD partial
- Profile photo/accessibility prefs: not implemented
- Advanced analytics: basic only

## External blockers
- Provider credentials (AI, email, SMS, payments, wearables, maps limits)
- Native companion apps for Apple Health/Health Connect
- EMRI/ambulance integration
- Clinical/legal validation
- Production MongoDB (Atlas) + Redis
