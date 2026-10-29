# Deployment Checklist

## Local development
Prerequisites: Node.js 20+ and npm 10+.

```powershell
cd D:\Swasthya
npm install
npm run dev
```

By default, the server uses an embedded MongoDB when no `MONGODB_URI` is provided and seeds only an empty development database. Data in embedded MongoDB is ephemeral.

## Persistent database setup
1. Configure `MONGODB_URI` to a dedicated database.
2. Use production-only, high-entropy `JWT_SECRET` and `JWT_REFRESH_SECRET` values.
3. Set `NODE_ENV=production` and `FRONTEND_ORIGIN` to the exact deployed frontend origin.
4. Confirm the configured MongoDB is reachable. Startup fails rather than falling back to memory.
5. Review the database backup, retention, recovery, and access policies.

## Initial platform administrator
Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in the operator environment, set `NODE_ENV=production`, then run once:
```powershell
npm run bootstrap:admin --workspace=server
```
The command refuses if a platform super-admin already exists or if the email is already in use. Remove the bootstrap credentials from the environment immediately after use.

## Email and other integrations
- Production patient signup and organization invitations are disabled until actual email delivery is implemented and verified.
- AI, maps, payments, wearables, SMS, and ambulance integrations must not be marked live until provider credentials, scopes, callbacks, and end-to-end behavior are validated.
- Use HTTPS, strict CORS, rate limiting appropriate to a multi-instance deployment, safe upload storage, and redacted logs.

## Tests and release
```powershell
npm test
npm run build
```
The current tests/build do not constitute an independent security audit or production approval.

## Demo reset warning
`npm run seed` skips populated databases by default. A destructive reset requires `SEED_RESET=true` and is prohibited in production. Never use a real patient or production database for demo seeding.
