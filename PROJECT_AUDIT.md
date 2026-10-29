# PROJECT_AUDIT.md

## Baseline
- Stack: React 18 + TypeScript + Vite (client), Express + TypeScript + Mongoose (server), MongoDB (persistent or MongoMemoryServer in dev).
- Auth: JWT access/refresh, RBAC, workspace scoping.
- Tests: Vitest (server), 42 tests passing after fixes.

## Key fixes applied
| Area | Root cause | Affected file | Fix | Verification |
|---|---|---|---|---|
| Rate limiter import | `redis` package not installed; `rateLimit` not a function | `server/src/middlewares/rateLimit.ts` | Removed hard redis import; in-memory limiter with module-level buckets; optional Redis via `REDIS_URL` | `npm test` pass |
| Notifications | Used `user.userId` instead of `user._id` | `server/src/routes/notifications.ts` | Changed to `user._id` | `GET /api/v1/notifications` 200 |
| Email service | `nodemailer` missing; `sendPasswordResetEmail` not imported | `server/src/services/emailService.ts`, `server/src/routes/auth.ts` | Lazy require nodemailer; added import | Forgot-password endpoint 200 |
| TypeScript | `sendPasswordResetEmail` undefined, nodemailer module missing | auth.ts, emailService.ts | Fixed imports + optional require | `tsc --noEmit` clean |
| MongoDB (env) | MongoMemoryServer fassert in this environment | `server/.env` | Pointed `MONGODB_URI` to local mongod on 27999 | Server boots, seed loads |
| Audit export | Missing CSV export | `server/src/routes/audit.ts` | Added `/export` route | tsc clean |
| Reminders | No reminder job | `server/src/services/reminderService.ts`, `index.ts` | Hourly job (mock logging) | Server boots |
| Docker | No container setup | `Dockerfile`s, `docker-compose.yml`, `nginx.conf` | Added | Files present |

## Remaining blockers (external)
- Real email/SMS delivery (needs provider credentials)
- Real AI provider (needs API key)
- Real payments (needs Razorpay keys)
- Ambulance dispatch (needs EMRI integration)
- Apple Health / Health Connect (needs native companion apps)
- Teleconsultation (needs WebRTC provider)
- MongoDB persistence in production (needs Atlas/managed cluster)
