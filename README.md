# Student Resume Generator

A chatbot that asks students preset questions and generates a polished resume (PDF + DOCX).

The bot walks through contact info, education, experience, projects, skills, and activities. For free-form answers (e.g. "what did you do at this job?"), it sends the raw text to **Google Gemini (free tier)** and turns it into resume-quality bullets. Students can accept, retry, or edit the polished version before it lands on the resume.

## Stack

- **Client** — React + Vite (`client/`)
- **Server** — Node + Express (`server/`)
- **LLM** — Google Gemini 2.5 Flash-Lite via `@google/generative-ai`
- **PDF** — Puppeteer (HTML → PDF)
- **DOCX** — `docx` npm package

## Setup

### 1. Get a free Gemini API key

Go to <https://aistudio.google.com/apikey>, sign in, and create a key. The free tier is plenty for development.

### 2. Configure the server

```sh
cd server
cp .env.example .env
# then edit .env and paste your key after GEMINI_API_KEY=
```

If you skip this step the app still works — the polish endpoint falls back to using the student's raw text as a single bullet.

### 3. Install (already done if you scaffolded just now)

```sh
cd client && npm install
cd ../server && npm install
```

## Run

In two terminals:

```sh
# terminal 1
cd server && npm run dev

# terminal 2
cd client && npm run dev
```

Open <http://localhost:5173>.

## How it works

1. `client/src/questions.js` defines the question flow (sections, fields, repeatable groups like education/experience).
2. `client/src/App.jsx` is a small state machine that walks the flow, collecting answers into a structured resume object.
3. When a `polish` question is answered, the client posts the raw text to `POST /api/polish`, which calls Gemini and returns 2–4 bullets.
4. When the student finishes, they hit "Download PDF" or "Download DOCX". The client posts the resume object to `POST /api/generate/pdf` or `/api/generate/docx`, which renders and streams the file back.
