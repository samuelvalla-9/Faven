---
applyTo: "api/**/*.js"
---

# Faven API (Node/Express) rules

- Routes live in `api/src/routes/`, business logic in `api/src/services/`, DB access via `api/src/db/pool.js`.
- Every new endpoint needs auth middleware (`api/src/middleware/auth.js`) unless explicitly public.
- Add/update Jest tests in `api/tests/` for any service change; run `npm test` in `api/` before committing.
- Never log or commit secrets; config comes from `api/.env` (gitignored).
