# Demo Data Audit

## Sources
- Backend synthetic records: `server/src/seed/seed.ts`
- Automatic development seeding: `server/src/index.ts` and `SEED_ON_START`
- Demo account shortcuts and labels: client login/demo controls and the README

## Current safeguards
- Seeded accounts and seeded healthcare records are marked as demo records.
- Automatic seed runs only when the database is empty and `NODE_ENV` is not production.
- The standalone seed command skips non-empty databases by default.
- A destructive local re-seed requires `SEED_RESET=true`.
- `runSeed()` refuses to run in production even if `SEED_RESET=true`.
- A configured MongoDB connection error is surfaced; the server does not silently switch to ephemeral storage.
- Patient-entered and provider-supplied data are stored separately from synthetic seed records through the normal application models.

## Remaining audit work
This is not yet a complete inventory of every hardcoded value or all client screens. The transformation brief's separate feature blueprint was not provided. Before production, audit every dashboard/card/chart and confirm it is either backed by authorized API data or explicitly labelled demo content. The demo toggles must not be exposed in a production build.

## Safe local reset
Use only a dedicated local development database. In PowerShell:
```powershell
$env:SEED_RESET = 'true'
npm run seed
Remove-Item Env:\SEED_RESET
```
This deletes the app's seeded collections in that configured development database before reseeding. Do not run it against a database containing real or needed data.
