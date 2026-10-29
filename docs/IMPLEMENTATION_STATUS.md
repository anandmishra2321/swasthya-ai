# Implementation Status

## Scope and limitation
This status is based on the master transformation prompt and the code currently in this repository. The separate “Swasthya AI Complete Feature Blueprint” PDF referenced by the master prompt was not available, so blueprint-specific acceptance criteria and policy decisions cannot be verified.

## Verified implementation status

| Requirement area | Status | Evidence / limitation |
|---|---|---|
| Existing app and stack retained | Complete | React/TypeScript/Vite client and Express/TypeScript/Mongoose server remain in place |
| Public registration | Partial | Public endpoint now creates patients only; provider accounts require invitations. Email delivery is not implemented, so registration is disabled in production |
| Password/session handling | Partial | Hashed passwords, rate-limited login, refresh sessions, logout/reset paths exist; multi-instance rate limiting needs shared storage |
| Initial Super Admin | Partial | A one-time environment-gated CLI bootstrap exists; production operators must configure persistent MongoDB and run it securely |
| Organization provisioning | Partial | New organizations enter pending verification and owner access is withheld until approval; document upload/evidence submission needs further work |
| Staff invitations | Partial | Random single-use, expiring tokens are stored as hashes; development returns the token for local testing. Production invitations are blocked until real email delivery is integrated |
| Server-side role and tenant checks | Partial | RBAC and organization membership middleware exist; an exhaustive route-by-route authorization audit against the missing blueprint remains outstanding |
| Patient portal | Partial | Dashboard and patient API flows exist; dependent/caregiver consent, secure document uploads, and complete patient workflows need further verification |
| Appointment workflows | Partial | Booking/status validation and conflict prevention are implemented and covered by tests; reminders/referrals are not fully verified |
| Healthcare directory | Partial | Local organization and provider records are searchable; verified live provider data depends on deployment integrations |
| AI assistant/report analysis | Partial | A provider abstraction and safety messaging exist, but default AI is mock and report upload/extraction is not established as a real production integration |
| Wearables | Partial | Web Bluetooth and companion-ingestion paths exist; Apple Health, Health Connect and vendor cloud integrations require companion apps/provider approval |
| Notifications, support, consent | Partial | API/model flows exist; delivery providers and complete server-side privacy lifecycle need further verification |
| Demo-data isolation | Partial | Local seed accounts are labelled demo; seed/reset now refuses production and destructive reset requires explicit opt-in. Remaining UI/data surfaces still need a full audit |
| Security/privacy/clinical readiness | Partial | No regulatory compliance or production-readiness claim is made; deployment-specific review remains necessary |
| Automated verification | Complete for executed checks | Current backend tests pass and the workspace production build succeeds; see `TEST_REPORT.md` |
| Required documentation | Partial | Audit and setup documents are present; several items depend on the missing blueprint and further verified implementation |
| Release ZIP | Pending refresh | The archive must be regenerated after the current code and documentation changes |

## External blockers
- SMTP/email delivery is not implemented; production patient registration and organization invitations return an unavailable response instead of claiming delivery.
- Real AI, maps, payments, vendor wearables, SMS, and ambulance dispatch depend on provider credentials, approvals, and integration work.
- Health Connect and Apple Health require a supported native companion/bridge; a normal browser cannot directly read those data sources.
- Production deployment requires a persistent MongoDB URI, strong secrets, HTTPS, and operator security review.

## Current engineering changes
- Public signup rejects caller-selected roles and creates patient accounts only.
- Patient profile sharing consent defaults to off.
- Verification tokens expire after 24 hours; public signup is unavailable in production until real delivery is connected.
- Organization invitations are one-time, hashed, expire after 48 hours, and activate membership only after acceptance.
- New organizations are pending verification and cannot perform organization-admin operations before approval.
- Database connection failures no longer silently switch a configured database to ephemeral storage.
- Demo seeding is disabled in production; non-empty databases are preserved unless a local reset is explicitly requested.
- A one-time CLI bootstrap creates the initial production Super Admin without exposing privileged public signup.
