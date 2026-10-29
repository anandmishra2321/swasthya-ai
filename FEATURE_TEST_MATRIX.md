# FEATURE_TEST_MATRIX.md

| Feature | Status | Evidence |
|---|---|---|
| Authentication (login/logout/refresh) | PASS | `npm test` (42 tests) |
| RBAC / tenant isolation | PASS | backend tests |
| Patient portal (dashboard/records/prescriptions/labs) | PASS | API smoke tests |
| Appointments + conflict prevention | PASS | backend tests |
| Bed board + capacity validation | PASS | backend tests |
| Prescriptions + allergy interceptor | PASS | backend tests |
| Lab report release gating | PASS | backend tests |
| AI safety filter (mock) | PASS | backend tests |
| Wearables Web Bluetooth | NOT VERIFIED | No physical device in CI |
| Wearables OAuth (Fitbit) | BLOCKED | No credentials |
| Email delivery | BLOCKED | No SMTP credentials |
| SMS delivery | NOT IMPLEMENTED | No provider |
| Real AI provider | BLOCKED | No API key |
| Payments (Razorpay) | BLOCKED (demo mode works) | No keys |
| Ambulance dispatch | NOT IMPLEMENTED | No provider |
| Apple Health / Health Connect | BLOCKED | Needs native app |
| Teleconsultation | NOT IMPLEMENTED | Needs WebRTC provider |
| Location discovery | PASS | backend test (geocoding) |
| Notifications (in-app) | PASS | API smoke test |
| Audit log export CSV | PASS | tsc clean |
| Appointment reminders | PASS (mock logging) | server boots |
| Docker deployment | PASS (files) | files present |
