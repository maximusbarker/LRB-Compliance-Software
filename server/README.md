# LRB Compliance API (local-friendly)

Lightweight Express API for auth, orgs, submissions, and uploads. Runs locally with SQLite and file uploads, and can be deployed to a web server without changing code (swap env vars for Postgres/object storage later).

## Quickstart (local)

1. `cd server`
2. `npm install`
3. Copy `env.sample` to `.env` and adjust if needed (defaults are local-friendly).
4. `npm run db:migrate` (creates SQLite db and default org code `DEMO-CITY`)
5. `npm run dev` (or `npm start`)
6. API available at `http://localhost:4000/api`

Uploads are stored in `uploads/` (one level above `server/`) with `yyyymmddhhmm_originalName.ext` naming.

## Key env vars (see `env.sample`)

- `PORT` (default 4000)
- `DATABASE_URL` (default `sqlite://./dev.db`)
- `JWT_SECRET` (set to a strong value)
- `UPLOAD_DIR` (default `../uploads`)
- `ALLOW_ORIGIN` (for CORS; `*` or a specific origin)

## Routes (high level)

- `POST /api/auth/signup` `{ email, password, orgCode }`
- `POST /api/auth/login` `{ email, password }`
- `POST /api/auth/forgot` `{ email }` (logs reset token in dev)
- `POST /api/auth/reset` `{ token, password }`
- `GET /api/me`
- `POST /api/orgs` (admin) `{ name, code? }`
- `GET /api/orgs/:id`
- `POST /api/submissions` `{ year, payload }`
- `GET /api/submissions?year=2024`
- `POST /api/uploads` multipart `file` + `submissionId`

All protected routes expect `Authorization: Bearer <token>`. Org scoping is enforced via the token.

## Notes

- Default org is `Demo City` with code `DEMO-CITY` (for quick signup).
- Password reset flow logs the token to the server console in dev; swap to an email provider in production.
- Uploads accept PDFs only (5MB cap by default) and are date-prefixed to keep names unique while retaining the user-provided name.

## Deploying

- Keep the same code; change env vars for DB and storage.
- Serve uploads from a bucket or network file store; return signed URLs if needed.
- Harden CORS, JWT secret, and HTTPS in production.


