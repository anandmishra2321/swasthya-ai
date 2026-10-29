# Feature Audit

## Audit basis
This audit uses the master transformation prompt and repository code. The separate feature-blueprint PDF mentioned in the prompt was not present, so this is not a blueprint-complete acceptance audit.

## Status summary

| Area | Status | Findings |
|---|---|---|
| Authentication | Partial | JWT access tokens, refresh sessions, logout, reset flow, rate-limited login/signup; email delivery is not implemented |
| Public registration | Improved / Partial | Patient-only, rejects caller-selected roles, enforces 12-character minimum; production returns unavailable until verification email can actually be delivered |
| Role provisioning | Partial | Organization invite tokens are hashed, one-time, expire after 48 hours, and create memberships on acceptance; real email delivery is blocked |
| Initial Super Admin | Partial | Added production-only one-time CLI bootstrap; operator must run it against persistent MongoDB |
| Organization onboarding | Partial | New organizations enter pending verification; owner membership is inactive until verification |
| RBAC and tenant isolation | Partial | Route middleware and scoped operations exist, but a full endpoint-by-endpoint review against the missing blueprint is still required |
| Patient portal | Partial | Dashboard, records, prescriptions, appointments, consent and wearable paths exist; full family, upload, privacy and support flows need further validation |
| Appointments | Partial | Conflict detection, status transitions and scheduling checks exist; all reminder/referral edge cases are not verified |
| Directory and operations | Partial | Database-backed organizations, doctors, beds, pharmacies and labs are present; live completeness depends on configured data sources |
| AI | Partial | Service abstraction and safety messaging exist; default configuration is mock and real-provider calls require credentials |
| Reports | Partial | Lab workflow and release gating exist; real document extraction/upload is not established |
| Wearables | Partial | Web Bluetooth and companion sync paths are implemented; HealthKit/Health Connect/vendor integrations are not available without native/provider setup |
| Payments, email, SMS, maps, dispatch | Partial / Blocked | Health/status configuration exists; provider credentials and/or delivery adapters are missing |
| Seed data | Partial | Local synthetic records are seeded only in development; destructive reseeding is opt-in and prohibited in production |
| Automated tests/build | Verified | 39 backend tests passed and the production build passed on 2026-10-28; the build reports a large-chunk warning |

## Recent hardening
- Fixed the missing `requireAuth` middleware export that prevented the notifications and payments routes from loading.
- Prevented public signup from assigning provider or administrative roles.
- Added expiring, single-use organization invitations and acceptance.
- Prevented pending organizations from granting admin access before verification.
- Prevented configured MongoDB failures from silently falling back to an in-memory database.
- Added a production-only Super Admin bootstrap command.
- Added explicit production guards and opt-in for destructive demo seeding.

## Still outstanding
- Obtain and audit the separate feature blueprint PDF.
- Implement real email delivery before enabling production signup/invitations.
- Audit all API routes, data ownership, uploads, caregiver consent, retention, deletion and role-specific tests.
- Integrate and validate actual external provider APIs using deployment credentials.
- Perform an independent security, clinical-safety and regulatory review before any production healthcare use.
