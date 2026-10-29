# Role Permission Matrix

## Audit status
This is a high-level inventory from the role union in `server/src/models/User.ts` and route middleware. The separate feature blueprint was unavailable, so it is not a complete or approved policy matrix. The server is the authorization authority; frontend visibility is not an access boundary.

## Roles currently represented

| Role | Intended scope | Current enforcement notes |
|---|---|---|
| patient | Own patient data | Public registration assigns only this role; resource-level ownership is required |
| hospital_doctor | Hospital workspace | Workspace roles and doctor route gates |
| hospital_admin | Hospital workspace | Organization membership and admin route gates |
| hospital_receptionist | Hospital workspace | Route-specific operational gates |
| hospital_staff | Hospital workspace | Route-specific operational gates |
| private_doctor | Private clinic workspace | Workspace and doctor route gates |
| private_clinic_admin | Private clinic workspace | Admin route gates |
| clinic_receptionist | Clinic workspace | Route-specific operational gates |
| homeopathy_doctor | Homeopathy clinic workspace | Workspace and doctor route gates |
| homeopathy_clinic_admin | Homeopathy clinic workspace | Admin route gates |
| medical_store_owner | Pharmacy workspace | Inventory and organization route gates |
| pharmacist | Pharmacy workspace | Inventory and prescription workflow gates |
| platform_super_admin | Platform | Administrative override in middleware; initial account uses a one-time CLI bootstrap |
| verification_admin | Verification | Verification queue and decision routes |
| ambulance_provider | Emergency provider | Directory/limited workflows; no live dispatch integration |
| lab_admin | Laboratory workspace | Lab workflow gates |
| lab_tech | Laboratory workspace | Lab workflow gates |
| nurse | Hospital workspace | Route-specific care/bed gates |
| bed_manager | Hospital workspace | Bed inventory route gates |
| doctor_assistant | Doctor/clinic workspace | Model role exists; complete route policy needs verification |
| support_agent | Support workspace | Model role exists; complete route policy needs verification |
| public_health_admin | Public-health scope | Analytics route gate |

`MembershipRole` additionally uses `clinic_admin` and `store_owner` as organization-scoped membership labels. The invite acceptance flow maps those to account roles according to organization type.

## Enforced building blocks
- `server/src/middlewares/auth.ts`: JWT authentication and workspace membership resolution
- `server/src/middlewares/rbac.ts`: role checks and organization membership/verification checks
- Route-level `authenticate`, `requireRole`, and `requireOrganizationAccess` middleware
- Patient/clinician consent checks in the consent and record access services

## Required follow-up before production
Audit each route for authentication, object ownership, organization scope, role, consent, audit logging, and denial tests. Resolve policy decisions using the missing blueprint rather than inferring permissions from frontend dashboards or role names.
