# Architecture

## Components
- `client/`: React 18, TypeScript, Vite, React Router, Tailwind CSS
- `server/`: Express, TypeScript, Mongoose, JWT, Zod request validation
- Root npm workspaces: scripts for development, tests, and builds

## Request/data flow
1. The React app calls the REST API under `/api/v1`.
2. Express applies security headers, CORS, body-size limits, request IDs, logging, and centralized error handling.
3. Protected routes use JWT authentication, workspace membership, role checks, and resource-specific ownership/consent checks.
4. Mongoose stores application records in MongoDB.
5. In local development/tests only, an embedded MongoDB can be started when `MONGODB_URI` is empty. A supplied URI failure is an error, not a fallback.
6. External integrations report a not-configured state when credentials/provider implementation are unavailable.

## Startup and data safety
- `NODE_ENV=production` requires an explicitly configured persistent MongoDB URI and strong secrets.
- Demo seed-on-start is disabled in production.
- The seed command skips populated databases unless local destructive reset is explicitly enabled.
- Organization creation generates a pending verification case and does not provide active admin membership before approval.
- Initial production platform-admin creation uses `npm run bootstrap:admin --workspace=server`.

## Known limitations
- SMTP/email delivery is not implemented; production signup and organization invitation creation are disabled until delivery is available.
- The default AI provider is mock; live calls require a provider adapter and credentials.
- SMS, payments, vendor wearable APIs, native health platforms, and ambulance dispatch are not verified as live.
- No production readiness, clinical safety certification, or regulatory compliance is claimed.
