# Test Report

## Executed on 2026-10-28

### Backend tests
Command:
```powershell
cd D:\Swasthya
npm test
```
Result: **Passed — 39 tests across 2 test files.**

Coverage includes authentication/RBAC, directory and bed freshness, appointment conflict handling, bed capacity validation, lab release gating, AI safety behavior, public signup restrictions, one-time staff invitation acceptance, pending organization access, and configured MongoDB failure behavior.

### Production build
Command:
```powershell
cd D:\Swasthya
npm run build
```
Result: **Passed** — server TypeScript build and client TypeScript/Vite production build succeeded.

The client bundler reports a warning that one generated chunk exceeds 500 kB. This does not fail the build, but bundle splitting remains a performance follow-up.

## Not verified
- Browser end-to-end flows beyond local page loading
- SMTP email delivery, SMS delivery, real AI provider calls, payment settlement, vendor wearable APIs, or ambulance dispatch
- Apple Health / Android Health Connect native companion flows
- Production deployment, backups, retention/deletion policy, independent security review, or regulatory compliance

No external provider call or production deployment is claimed as successful.

## Latest verification — payment and email hardening

Executed on 2026-10-28:

- `npm run build`: **Passed** — server TypeScript and client TypeScript/Vite production builds succeeded. Vite still warns that the LandingPage chunk exceeds 500 kB.
- `npm exec --workspace=server -- vitest run tests/db.test.ts`: **Passed — 1 test.**
- `npm exec --workspace=server -- tsc --noEmit --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --strict tests/api.test.ts`: **Passed** — the API regression test file type-checks.
- `npm test`: **Blocked** — the API suite could not start `MongoMemoryServer` (`mongod` exited with an internal `fassert()` failure); its 41 tests were skipped. The database test passed. Payment API behavior is therefore not runtime-verified.

No external provider call or production deployment is claimed as successful. Re-run `npm test` after resolving the embedded MongoDB startup issue.
