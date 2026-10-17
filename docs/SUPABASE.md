# Supabase Integration Guide

## Overview

DevForge.ai uses Supabase Cloud for:

- **Authentication** — sign-in, sign-up, OAuth, magic links, session management
- **PostgreSQL database** — application data via Drizzle ORM
- **JWT verification** — Fastify verifies Supabase-issued access tokens locally (HS256, no network round-trip)

The Fastify API never issues its own JWTs or stores passwords. Supabase Auth is the single authority for user identity.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**, choose an organization, name, password, and region.
3. Wait for provisioning (~2 minutes).

---

## 2. Collect required dashboard values

### Project URL and API keys

Dashboard → **Settings → API**

| Variable                             | Where to find it                                   |
| ------------------------------------ | -------------------------------------------------- |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | **Project URL**                                    |
| `VITE_SUPABASE_PUBLISHABLE_KEY`      | **Project API keys → anon public**                 |
| `SUPABASE_SECRET_KEY`                | **Project API keys → service_role** ⚠️ server only |

### JWT secret

Dashboard → **Settings → API → JWT Settings**

| Variable              | Where to find it                 |
| --------------------- | -------------------------------- |
| `SUPABASE_JWT_SECRET` | **JWT Secret** (reveal and copy) |

### Database connection strings

Dashboard → **Settings → Database → Connection string**

| Variable                 | Connection type           | Port |
| ------------------------ | ------------------------- | ---- |
| `DATABASE_URL`           | **Session pooler** URI    | 5432 |
| `DATABASE_MIGRATION_URL` | **Direct connection** URI | 5432 |

Use the session pooler for the running API server.
Use the direct connection for `drizzle-kit migrate` (requires a DDL-capable connection).

---

## 3. Configure environment files

### API server — `apps/api/.env`

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=<service_role_key>
SUPABASE_JWT_SECRET=<jwt_secret>
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
DATABASE_MIGRATION_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
DATABASE_SSL=true
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:8443
```

### Frontend — `apps/web/.env`

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>
VITE_API_URL=http://localhost:3000
```

Only `VITE_` prefixed variables are safe for the browser. Never put `SUPABASE_SECRET_KEY` or `SUPABASE_JWT_SECRET` in a `VITE_` variable.

---

## 4. Run migrations

```bash
# From the repo root — uses DATABASE_MIGRATION_URL (direct connection)
pnpm db:migrate
# or with npm:
npm run db:migrate --workspace=database
```

This runs `drizzle-kit migrate` against the direct Supabase connection. Review the generated SQL in `packages/database/migrations/` before applying to production.

Do **not** run migrations against the session pooler (port 6543) — DDL requires a direct connection.

---

## 5. Identity mapping

Supabase Auth manages user identity in its own `auth.users` table (not accessible via Drizzle).

The application maintains a `user_profiles` table:

```
auth.users.id (Supabase UUID)
       ↓
user_profiles.auth_id   ← JWT `sub` claim
user_profiles.id        ← used for all application FK relationships
```

**On first sign-in**, call `POST /api/v1/auth/profile` with the Supabase access token. This creates the `user_profiles` row.

```ts
// Frontend — after supabase.auth.signIn succeeds:
const {
  data: { session },
} = await supabase.auth.getSession();
await fetch(`${API_URL}/api/v1/auth/profile`, {
  method: "POST",
  headers: { Authorization: `Bearer ${session.access_token}` },
});
```

---

## 6. Authentication flow

```
Browser
  └─ supabase.auth.signInWithPassword({ email, password })
       │
       ▼
  Supabase Auth (cloud)
       │  issues access_token (JWT, HS256, 1 hour)
       │  issues refresh_token (rotated automatically)
       ▼
  Browser stores session (localStorage by default)
       │
       ▼
  fetch("/api/v1/...", { Authorization: "Bearer <access_token>" })
       │
       ▼
  Fastify authMiddleware
       ├─ jwt.verify(token, SUPABASE_JWT_SECRET)  ← local, no network call
       ├─ extract sub (= auth.users.id)
       ├─ db.query.userProfiles.findFirst({ authId: sub })
       └─ attach { id, authId, email, role } to request.user
```

---

## 7. Configure authentication redirect URLs

Dashboard → **Authentication → URL Configuration**

| Setting       | Value                                                |
| ------------- | ---------------------------------------------------- |
| Site URL      | `http://localhost:8443` (dev) or your production URL |
| Redirect URLs | `http://localhost:8443/**`                           |

Add your production domain to Redirect URLs before deploying.

---

## 8. Row Level Security

The Fastify API uses the `service_role` key (via `SUPABASE_SECRET_KEY`) which bypasses RLS. Authorization is enforced in Fastify middleware and route handlers.

For defense-in-depth, RLS policies will be added in Stage B for:

- `user_profiles` — owner can read/update their own row
- `organization_memberships` — members can read their org's memberships
- Application tables scoped to organization

Do not enable broad `FOR ALL USING (true)` policies.

---

## 9. Switching between local Docker and Supabase Cloud

**Local Docker (unit tests, no Supabase project):**

```bash
docker compose up -d
# In apps/api/.env:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/devforge
DATABASE_SSL=false
SUPABASE_URL=https://placeholder.supabase.co
SUPABASE_SECRET_KEY=placeholder-not-real
SUPABASE_JWT_SECRET=test-jwt-secret-minimum-32-characters-long
```

**Supabase Cloud:**
Use the values from Step 2. Set `DATABASE_SSL=true`.

---

## 10. Running tests

```bash
# Unit tests (no Supabase or database required)
npm run test --workspace=apps/api
npm run test --workspace=apps/web
npm run test --workspace=packages/config

# Type check
npx tsc --noEmit --project apps/api/tsconfig.json

# Web production build
npm run build --workspace=web
```

Integration tests against a real Supabase project require `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `DATABASE_URL` to be set. These will be added in Stage B.

---

## Security limitations (current state)

- RLS policies are not yet enabled — authorization is enforced only in Fastify.
- The `user_profiles` row is created on first API call, not at sign-up time. A signed-in user with no profile row will receive 404 from protected routes until `POST /api/v1/auth/profile` is called.
- `apps/web/src/lib/supabase.ts` throws at module load if `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are missing. During local demo-only development without Supabase credentials, this initialization must be deferred or guarded.
- The existing demo login flow in `App.tsx` still uses localStorage — it is preserved as a demo mode and does not connect to the Supabase-backed API.
