# Marketing Management Dashboard

A centralized, production-ready internal portal for `marketing.bingobingo.tv` that handles
users, projects, marketing content, approval workflows, scheduling, and content calendars.
No spreadsheets — everything lives in MongoDB and S3-compatible storage.

## Highlights

- **Users** with granular role-based access control (5 roles)
- **Projects** with brand guidelines, social account links, and assignees
- **Content library** with full lifecycle: Draft → Review → Approved → Scheduled → Published
- **Approval workflow** with reasons on rejection and full audit trail
- **Content calendar** — monthly grid with project and platform filters
- **Activity log** — searchable audit trail of every important action
- **Authentication** with JWT cookies, TOTP MFA (Google Authenticator etc.), recovery codes,
  reCAPTCHA v3 protection, login lockout, and forced re-auth on password change
- **Media** uploaded directly to S3-compatible storage via presigned URLs
- **Responsive** UI built with Tailwind v4, accessible Radix primitives, and dark mode

## Tech stack

| Layer        | Technology                                    |
| ------------ | --------------------------------------------- |
| Framework    | Next.js 16 (App Router, `proxy.ts` middleware)|
| Language     | TypeScript                                    |
| UI           | Tailwind CSS v4, Radix UI, lucide-react       |
| Charts       | Recharts                                      |
| Database     | MongoDB via Mongoose                          |
| Auth         | JWT (jsonwebtoken) + httpOnly cookies         |
| 2FA          | TOTP via `speakeasy`, QR via `qrcode`         |
| Storage      | S3-compatible (DigitalOcean Spaces, AWS S3…) |
| Validation   | Zod                                           |
| Forms        | React Hook Form + Hookform Resolvers          |
| Notifications| Sonner                                        |

## Prerequisites

- Node.js 20+
- MongoDB 6+ (local or Atlas)
- An S3-compatible bucket (DigitalOcean Spaces, AWS S3, Cloudflare R2, MinIO…)
- Google reCAPTCHA v3 site & secret keys (optional, can be disabled in dev)

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — see "Environment variables" section below

# 3. Run the dev server
npm run dev
```

Open <http://localhost:3000>. On first run, if the `users` collection is empty, a super-admin
is created from the `BOOTSTRAP_ADMIN_*` env vars. Sign in with those credentials and **change
the password immediately**.

## Environment variables

All variables are documented in [`.env.example`](./.env.example). The required ones in
production are:

- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — long random string (min 64 chars); rotate to invalidate sessions
- `MFA_SECRET_ENCRYPTION_KEY` — 32-byte base64 key, used to encrypt TOTP secrets at rest
- `STORAGE_*` — S3 endpoint, region, bucket, access/secret keys, and public CDN URL
- `BOOTSTRAP_ADMIN_*` — initial super-admin (only used when no users exist)

Optional:

- `RECAPTCHA_ENABLED=true` + `RECAPTCHA_SECRET_KEY` + `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` to
  enable Google reCAPTCHA v3 on the login form
- `SESSION_COOKIE_DOMAIN` — set when serving on a sub-domain that shares cookies
- `MAX_LOGIN_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES` — brute-force protection

### Generating keys

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# MFA_SECRET_ENCRYPTION_KEY (32 bytes, base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Project structure

```
app/
  (auth)/                  # Login, MFA challenge — unauthenticated layouts
  (dashboard)/             # Authenticated app shell + modules
    dashboard/             #   KPI home
    content/               #   Content library + editor
    calendar/              #   Monthly calendar
    projects/              #   Projects CRUD
    users/                 #   Users CRUD
    activity/              #   Activity log viewer
    settings/              #   Profile, password, MFA, system settings
  api/                     # Route handlers
    auth/                  #   login, logout, me, change-password, mfa/*
    users/                 #   list/create/update/disable
    projects/              #   CRUD
    content/               #   list, get, update, workflow transitions
    calendar/              #   month query
    media/                 #   presign + register uploads
    activity/              #   audit log
    settings/              #   system settings
    dashboard/stats/       #   home page metrics
    profile/               #   self-service profile update
components/                # UI primitives, providers, status badges, etc.
lib/
  auth/                    # guard, session cookies, password hashing, MFA, recaptcha
  api.ts                   # consistent JSON response helpers
  rbac.ts                  # role → permission matrix
  constants.ts             # roles, statuses, content states, platforms
  db.ts                    # mongoose connection (cached for HMR)
  env.ts                   # typed env accessors
  storage.ts               # S3 client + presign helpers
  activity.ts              # logActivity() + client meta extraction
  bootstrap.ts             # idempotent first-run admin
models/                    # Mongoose schemas
proxy.ts                   # Next.js 16 proxy (optimistic session gate)
```

## Roles & permissions

Five roles, defined in [`lib/rbac.ts`](./lib/rbac.ts):

| Role               | Purpose                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `super_admin`      | Full access to everything, including settings and user management|
| `admin`            | All operational permissions, manages users                        |
| `project_manager`  | Manages assigned projects, reviews & approves content             |
| `reviewer`         | Reviews and approves/rejects content                              |
| `marketing_user`   | Creates and submits content for review                            |

Permissions are checked both server-side (via `requirePermission()` in route handlers) and
client-side (via `useUser().hasPermission()`).

## Content workflow

```
draft  ──submit──►  under_review  ──approve──►  approved  ──schedule──►  scheduled  ──publish──►  published
                          │                          ▲                          │
                          └────── reject ────────────┘                          │
                                                                                ▼
                                                                        archived / rejected
```

Transitions are enforced both in the API (`/api/content/[id]` PATCH) and in the UI
(`TransitionDialog`). Rejection requires a reason; every transition is recorded in the
activity log with the actor, previous state and new state.

## API overview

All endpoints return JSON with shape `{ ok: true, data }` on success or
`{ ok: false, error }` on failure. Authentication is via the `mkt_session` httpOnly cookie.
Pagination uses `?page=1&limit=20` and responds with `{ items, total, page, limit }`.

See route handlers under [`app/api/`](./app/api) for exact shapes and Zod schemas.

## Storage / media uploads

Files are uploaded **directly from the browser** to S3-compatible storage using presigned
PUT URLs:

1. Client calls `POST /api/media/presign` with the file's name, size and MIME type.
2. Server returns `{ uploadUrl, key, publicUrl }`.
3. Client PUTs the binary to `uploadUrl`.
4. Client calls `POST /api/media` to register the upload (creates a `Media` document).

CORS must allow `PUT` from your app's origin on the bucket.

### DigitalOcean Spaces example

```
STORAGE_ENDPOINT=https://nyc3.digitaloceanspaces.com
STORAGE_REGION=nyc3
STORAGE_BUCKET=bingobingo-marketing
STORAGE_PUBLIC_URL=https://bingobingo-marketing.nyc3.cdn.digitaloceanspaces.com
STORAGE_FORCE_PATH_STYLE=false
```

### AWS S3 example

```
STORAGE_ENDPOINT=https://s3.us-east-1.amazonaws.com
STORAGE_REGION=us-east-1
STORAGE_BUCKET=my-bucket
STORAGE_PUBLIC_URL=https://my-bucket.s3.us-east-1.amazonaws.com
STORAGE_FORCE_PATH_STYLE=false
```

### MinIO (self-hosted) example

```
STORAGE_ENDPOINT=https://minio.internal:9000
STORAGE_REGION=us-east-1
STORAGE_BUCKET=marketing
STORAGE_PUBLIC_URL=https://media.example.com
STORAGE_FORCE_PATH_STYLE=true
```

## Security notes

- Passwords are hashed with bcrypt (cost 12).
- MFA secrets are encrypted with AES-256-GCM using `MFA_SECRET_ENCRYPTION_KEY` and stored
  with `select: false`. They are never returned by the API.
- Recovery codes are single-use; consumed codes are removed from the user document.
- Sessions are httpOnly + Secure + SameSite=Lax cookies. Logout clears all cookies.
- Changing your password bumps `tokenVersion`, invalidating any stale JWTs.
- Brute-force protection locks the account after `MAX_LOGIN_ATTEMPTS` failed attempts.
- reCAPTCHA v3 is verified server-side against `RECAPTCHA_MIN_SCORE`.
- All inputs are validated with Zod before touching the database.
- Activity log captures actor, IP, user agent, and resource for every important action.

## Deployment

The app is a standard Next.js 16 application and can run anywhere Node.js 20+ runs:
Vercel, Fly.io, Render, a VPS with `pm2`, Docker, etc.

```bash
npm run build
npm run start
```

Behind a reverse proxy, terminate TLS upstream and forward `X-Forwarded-For`, `X-Real-IP`,
and `X-Forwarded-Host` so that activity logs record the correct client IP.

### Notes for Next.js 16

- This project uses `proxy.ts` (not `middleware.ts`). Edge runtime is **not** supported.
- Dynamic route params and `searchParams` are async — always `await` them in page components.
- See [`AGENTS.md`](./AGENTS.md) for project-wide conventions.

## Development tips

- The MongoDB connection is cached across HMR reloads (see `lib/db.ts`).
- Permission errors return `403`; expired sessions return `401`. The client provider
  redirects to `/login` on `401`.
- To reset the bootstrap admin, drop the `users` collection — the next request will recreate
  it from `BOOTSTRAP_ADMIN_*`.
- Tailwind v4 uses `@theme` directives in `app/globals.css`; no separate config file.

## License

Internal — BingoBingo Marketing.

