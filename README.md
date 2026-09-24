# InterviewAI — Gemini Q&A MVP

The design and target roles are unchanged. This version connects the backend to Google Gemini using Google's official `@google/genai` Node.js SDK.

## One-time Gemini setup

1. Create a Gemini API key in Google AI Studio.
2. Open `backend/.env`.
3. Paste the key after `GEMINI_API_KEY=` (do not add quotes).
4. Save the file and restart the backend.

```env
GEMINI_API_KEY=PASTE_YOUR_KEY_HERE
GEMINI_MODEL=gemini-3.8-flash
PORT=3000
```

Never put the key in the frontend or upload it to GitHub. `.env` is already ignored by Git.

## Run backend

```powershell
cd backend
npm install
npm run dev
```

Expected startup output includes:

```text
Server running on 3000 with Gemini (gemini-3.8-flash)
Gemini API: configured
```

## Run frontend

In a second PowerShell:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

## Flow

Choose the target role and experience level, ask any interview question, and Gemini answers. Recent messages are sent with each request so follow-up questions keep context.
