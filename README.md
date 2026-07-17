# Meeting Room Booking System

Take-home assignment: a small web application for managing bookings for a single meeting room, with role-based access control enforced server-side.

**Live demo:** https://meeting-room-booking-dusky-ten.vercel.app
**API:** https://meeting-room-booking-a397.onrender.com (health check: [`/health`](https://meeting-room-booking-a397.onrender.com/health))

> Note: the API runs on Render's free tier and spins down when idle — the first request after a quiet period takes ~30–60 seconds while it cold-starts. Log in as **Alice (Admin)**, **Oliver (Owner)**, or **Uma / Ben (User)** to try each role.

- **`api/`** — Node.js backend: Express 5 + TypeScript, Prisma, PostgreSQL
- **`web/`** — Frontend: Next.js 15 (App Router) + Tailwind CSS

## Running locally

Prerequisites: Node 20+, PostgreSQL.

### 1. API

```bash
cd api
cp .env.example .env          # point DATABASE_URL at your Postgres
npm install
npx prisma migrate dev        # creates the schema
npm run db:seed               # seeds 1 admin, 1 owner, 2 users + sample bookings
npm run dev                   # http://localhost:4000
```

### 2. Web

```bash
cd web
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                   # http://localhost:3000
```

Log in from the picker as **Alice (Admin)**, **Oliver (Owner)**, **Uma**, or **Ben** to exercise each role.

### Tests

```bash
cd api && npm test
```

## API overview

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/auth/users` | public | User list for the login picker |
| POST | `/auth/login` | public | Exchange a userId for a token |
| GET | `/bookings` | any authenticated | List all bookings |
| POST | `/bookings` | any authenticated | Create a booking |
| DELETE | `/bookings/:id` | own booking, or owner/admin | Delete a booking |
| GET | `/summary` | owner, admin | Bookings grouped by user + usage totals |
| GET | `/users` | admin | List users |
| POST | `/users` | admin | Create a user |
| PATCH | `/users/:id/role` | admin | Change a user's role |
| DELETE | `/users/:id` | admin | Delete a user (cascades to their bookings) |

Errors always have the shape `{ "error": { "code", "message", "details?" } }` with a stable machine-readable `code` (e.g. `BOOKING_OVERLAP`, `FORBIDDEN`, `VALIDATION_ERROR`).

## Key design decisions

**Time handling.** All times are UTC instants end-to-end: the API accepts and returns ISO 8601 with timezone, Postgres stores `timestamptz`, and comparisons happen on UTC milliseconds. The frontend converts the browser's local `datetime-local` input to UTC on submit and renders instants back in the viewer's local timezone.

**Overlap semantics.** Bookings are half-open intervals `[startTime, endTime)`. Two bookings conflict iff `a.start < b.end AND b.start < a.end`. This single rule correctly covers identical ranges, partial overlaps, and full containment — and it deliberately **allows back-to-back bookings** (one ending 10:00, the next starting 10:00), which is the behaviour people expect from a meeting room. `startTime` must be strictly before `endTime`, so zero-length bookings are rejected.

**Concurrency.** The overlap check and insert run inside a `SERIALIZABLE` transaction, so two simultaneous requests for the same slot cannot both pass the check; the loser is retried once and then surfaces as a clean `409 BOOKING_OVERLAP`.

**Authentication.** Per the brief, auth is intentionally not production-grade: logging in exchanges a chosen userId for a bearer token (the user's id). What matters is that *authorization is real*: the server resolves the user and role from the database on every request — clients can never claim a role, deleted users are rejected immediately, and role changes take effect on the next request. Swapping this for signed JWTs later would only touch `authenticate.ts` and the login route.

**Roles.** The permission matrix lives in one pure module (`api/src/domain/permissions.ts`) used by all routes — a single source of truth that is unit-tested directly. The frontend also hides buttons/links the current role can't use, but that is purely cosmetic; every check is enforced by the backend.

**Deleting a user** (admin) **cascades to their bookings** — the schema declares `onDelete: Cascade` — so the room slots they held are freed and no orphaned records remain. Admins cannot delete their own account, which prevents a sole admin from locking the system out of user management.

**Login user list.** `GET /auth/users` exposes `id`/`name`/`role` publicly, a deliberate exception to the admin-only user listing rule: the assignment requires a pre-auth "log in as user" picker, which needs the list before a session exists. Full user records stay admin-only.

**Layering.** Routes are thin (parse → authorize → delegate → respond); services own business rules and persistence; `domain/` holds pure, dependency-free logic (overlap detection, permission matrix). Every thrown error funnels through one error-handler middleware that maps `ApiError`, Zod validation errors, and Prisma not-found errors to the uniform error shape — nothing is swallowed, and unexpected errors are logged with stacks and returned as opaque 500s.

## Testing notes

**Tested** (21 unit tests, Vitest): the overlap matrix the brief calls out — identical ranges, partial overlaps both directions, containment both directions, back-to-back both directions, disjoint ranges, symmetry — range validation, and the full role/permission matrix. These are the pieces where a subtle bug is most likely and most costly, and they are pure functions, so the tests are fast and deterministic.

**Deliberately not tested, and why:**
- *Route handlers / services against a real database* — they are thin glue over Prisma; testing them properly means integration tests with a throwaway Postgres (e.g. Testcontainers), which I judged out of scope for the time budget. The end-to-end behaviour (401/403/404/409 paths, cascade delete, self-delete block) was verified manually via HTTP against the running server instead.
- *The React UI* — it contains no business logic beyond mirroring server permissions for usability; the server remains the enforcement point.
- *Zod schemas* — testing them re-tests the library.

## Trade-offs and what I'd do with more time

- **Integration test suite** against ephemeral Postgres for the HTTP + transaction paths (the serializable-transaction retry is the one piece unit tests can't reach).
- **A Postgres exclusion constraint** (`tstzrange` + GiST) as a database-level backstop for overlaps, making the no-overlap invariant hold even against out-of-band writes.
- **Real authentication** (signed JWTs or sessions + passwords) — isolated in one middleware by design.
- **Pagination and date-range filtering** on `GET /bookings` — fine for one room at demo scale, needed beyond that.
- **Optimistic UI updates** and a data-fetching library (e.g. TanStack Query) instead of manual refresh-after-mutate.
- Rejecting bookings in the past (currently allowed — the brief doesn't require it, and allowing it keeps demoing/seeding simple; it's a one-line rule in `booking-rules.ts`).

## Deployment

The app deploys as two services plus a database:

1. **Postgres on Supabase** — create a free project, then copy the **Session pooler** connection string (Connect → Session pooler; it is IPv4-compatible, which Render requires). Use it as `DATABASE_URL`.
2. **API on Render** — `render.yaml` is included; create a Web Service from this repo and set `DATABASE_URL` (the Supabase session-pooler URL) and `CORS_ORIGIN` (the Vercel URL). The build runs `npm ci && npm run build && npx prisma migrate deploy`, then `npm start`. Seed once from the Render shell (or locally against the same `DATABASE_URL`) with `npm run db:seed`.
3. **Web on Vercel** — import the repo, set the root directory to `web/`, and set `NEXT_PUBLIC_API_URL` to the Render API URL.
