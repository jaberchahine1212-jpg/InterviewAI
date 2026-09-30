# InterviewAI - OpenRouter Q&A MVP

## Stack

React with JavaScript/JSX and Vite; Node.js/Express with TypeScript;
PostgreSQL via pg; bcrypt password hashing; JWT Bearer authentication.
AI answers come from OpenRouter, not the unused Gemini SDK dependency.

## Setup

Use Node.js 22.12+ or Node.js 24. Install locked dependencies using npm ci
in backend and frontend separately.

Create backend/.env locally with your own values for:

- OPENROUTER_API_KEY: your provider key.
- OPENROUTER_MODEL: optional; defaults to openrouter/free.
- JWT_SECRET: a strong random signing secret, stable across instances/restarts.
- DATABASE_URL: your PostgreSQL connection URL, including host-required SSL options.
- PORT: optional; defaults to 3000.

Never commit .env or real credentials. Do not put private keys in VITE_ variables.
Without DATABASE_URL, the backend uses DB_HOST, DB_PORT, DB_NAME, DB_USER,
and DB_PASSWORD (defaults: localhost, 5432, interviewai, postgres).

The existing database needs users (id, email, password, created_at), interviews
(id, user_id, role, topic), and questions (id, interview_id, question_text, answer).
No schema migration is included yet. Confirm generated IDs, defaults, email
uniqueness, and foreign keys in your database. Password values are bcrypt hashes.

Run in separate terminals:

```powershell
cd backend
npm ci
npm run dev
```

```powershell
cd frontend
npm ci
npm run dev
```

Local frontend API requests default to http://localhost:3000.
VITE_API_URL overrides that origin. Set it at frontend build time when deploying
the backend separately; otherwise production uses the frontend origin for API
requests. Redeploy after changing Vite environment variables. Configure database,
AI and JWT variables on the backend host, not in the browser.

## Request flow

Signup/login returns a seven-day JWT. The backend verifies it for /api/ask,
checks ownership of an existing interview, and includes the selected role/level
in the system prompt. Up to eight prior messages (4,000 characters each) are
sent as context. Non-empty answers are saved with their questions; creating a
new interview and inserting its question share a database transaction.

The AI call has a 45-second deadline, and the browser request has a 60-second
deadline. Hosting limits may be shorter. New chat/logout abort the browser
request and ignore its late response. This does not guarantee that backend
processing or database saving stops. Retries are not yet idempotent.

## Current limitations

- Saved conversations are not reloaded into the UI after refresh.
- Expired JWTs require logging out and logging back in.
- /api/health checks database access and key presence, not actual key validity,
  provider quota or model availability.
- This is a Q&A assistant, not RAG or an autonomous tool-using agent.
- Production work still includes rate limits, stronger validation, migrations,
  integration tests and AI answer evaluation.

## Checks and demo

```powershell
cd backend
npm run typecheck
cd ../frontend
npm run build
```

Test a fresh login, question, follow-up, and confirm records in the intended
Neon database. Test New chat during a pending answer. A local build does not
verify deployment settings or live AI availability.
