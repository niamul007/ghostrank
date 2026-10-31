# GhostRank

**Live:** https://ghostrank-one.vercel.app

GhostRank asks Claude 8 questions about a local business, 3 runs each (24 calls), with web search on, and counts how often the business is named. The report shows the score with a 95% Wilson range, because results vary between scans. It is built for web agencies and their clients.

![GhostRank report](docs/screenshots/report.png)

## Features

- Scan with web search: 8 questions, 3 runs each
- Report rebuilt from the saved runs
- "Websites the AI looked at" section
- Spelling merge for business names
- Print layout, saved as PDF through the browser print dialog
- Agency branding in Settings (name, colour, logo)

## Access

Sign-up is open, but new accounts cannot start scans until approved (the `scanApproved` flag in the `Agency` table), because every scan costs real API money. There is no public demo login. Sample reports are available as PDFs on request.

## How it works

1. An agency registers, logs in, and adds a client (business name, niche, location).
2. Starting a scan (`POST /api/clients/:clientId/scans/v2`) creates a `PENDING` scan record and returns `201` straight away. The scan then runs in the background in the same server process. The client needs a city or location, or the question builder throws.
3. The question builder (`src/scanner/questionBuilder.ts`, question set `v2`) makes 8 questions from the client's niche, location and business name: 3 "find", 2 "compare", 2 "need" and 1 "reputation". The 7 find, compare and need questions are scored. The reputation question is not scored.
4. Each question is asked 3 times, so a scan makes 24 calls to Claude, up to 6 at a time. **Claude is the only active provider today.** The ChatGPT, Perplexity and Gemini query code exists in `src/scanner/aiQuerier.ts` but is paused.
5. Web search is on for every call, with at most 3 searches per answer. The titles and URLs of the pages the AI looked at are kept with the answer. A call that fails is retried; a blank answer is retried once after 1 second.
6. Each run is saved as a `ScanRun` row as soon as it finishes, including failed runs. The scan is marked `COMPLETED` if at least one run succeeded and every run was saved. Otherwise it is marked `FAILED`.
7. The score is the share of successful scored runs where the business was named, as a whole percent (mentioned runs ÷ counted runs × 100). The reputation runs are tallied separately and are not part of the score. If fewer than 70% of the expected scored runs succeeded, the report is marked low confidence.
8. The frontend polls `GET /api/scans/:id` every 3 seconds while the scan is pending or running. Once it completes, a report can be generated (`POST /api/scans/:scanId/report`) and viewed on the report page.
9. The report is rebuilt from the saved `ScanRun` rows every time it is read, using the client's current business name and name variants, so it does not rely on a stored snapshot. It shows:
   - the score with a 95% Wilson range (for example "40-70%"), a label (70 or more is Strong, 40-69 Mixed, 1-39 Rarely named, 0 Not named), and the results by group and by question;
   - the other businesses named most often (top 10) and the client's chosen competitors;
   - up to 3 reputation answers, each cut at 400 characters;
   - a "Websites the AI looked at" section built from the saved sources: the top 8 domains, each counted once per scored successful run.

   No extra AI calls are made when a report is read.

The older scan (`POST /api/clients/:clientId/scans`, 5 prompts, no repeated runs, no web search) still exists, and reports for scans made with it still open. It is described under Scoring below.

## Scoring (older scan)

The v2 score is described in step 7 above. The table below is for the older scan only. Defined in [src/scorer/index.ts](src/scorer/index.ts).

| Component | Weight | Based on |
| --- | --- | --- |
| Mention rate | 40 | Share of prompts where the business was mentioned |
| Position quality | 30 | Average list position of mentions (1st = 1.0, 2nd = 0.8, 3rd = 0.6, 4th = 0.4, 5th or lower = 0.2, mentioned outside a numbered list = 0.3) |
| Platform coverage | 15 | Share of active platforms with at least one mention |
| Sentiment bonus | 15 | Positive = 1, neutral = 0.5, negative = -0.5 per mention, averaged and floored at 0 |

## Tech stack

**Backend** (root `package.json`)

- Node.js, TypeScript `^6.0.3`, Express `^5.2.1`
- Prisma `6.19.3` (pinned) with PostgreSQL on Neon
- Zod `^4.4.3`, jsonwebtoken `^9.0.3`, bcrypt `^6.0.0`, dotenv `^17.4.2`
- AI SDKs: `@anthropic-ai/sdk` `^0.111.0` (active), `openai` `^6.45.0` and `@google/generative-ai` `^0.24.1` (paused providers)
- Dev: nodemon, ts-node

**Frontend** (`frontend/package.json`)

- React `^19.2.7`, React Router `^7.18.1`, Axios `^1.18.1`, Zod `^4.4.3`
- Vite `^8.1.1`, Tailwind CSS `^4.3.3`, TypeScript `~6.0.2`
- Lint: oxlint

Versions are the ranges declared in the package files.

## Getting started

### Prerequisites

- Node.js and npm (neither `package.json` declares an `engines` field, so no minimum version is specified here)
- A [Neon](https://neon.tech) account and project (PostgreSQL)
- An Anthropic API key

### Backend

```bash
git clone https://github.com/niamul007/ghostrank.git
cd ghostrank
npm install
cp .env.example .env
# edit .env and fill in your own values (see Environment variables below)
npx prisma migrate deploy
npm run dev
```

The API listens on `PORT` (default `4000`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

This starts the Vite dev server. It runs at http://localhost:5173 (Vite's default port). The dev server proxies `/api` to `http://localhost:4000`, so start the backend first.

Neon free databases pause when idle, so the first request after a quiet period may be slow.

### Tests

```bash
npm test
```

This runs a Vitest suite that covers both scorers, the question builder, the runner, the v2 scan, the report builders, name matching, parsing, text sanitizing, the scan approval gate, agency settings and client validation. The tests that touch the database mock the Prisma module, and none call the Anthropic API.

## Environment variables

From [.env.example](.env.example).

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon pooled connection string (host contains `-pooler`). Used by the app at runtime. |
| `DIRECT_URL` | Yes | Neon direct (non-pooled) connection string. Used by Prisma migrations. |
| `ACCESS_TOKEN_SECRET` | Yes | Secret used to sign JWT access tokens. Must be at least 32 characters; the server refuses to start otherwise. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `PORT` | No | Port the Express server listens on. Defaults to `4000`. |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key used for scans. Without it, scans on the Claude platform fail and a warning is logged at startup. |
| `ANTHROPIC_MODEL` | No | Claude model id. Defaults to `claude-sonnet-5-5`. |
| `FRONTEND_URL` | No | Comma-separated list of frontend origins allowed by CORS. Defaults to `http://localhost:5173`. Example: `https://ghostrank-one.vercel.app`. |
| `TRUST_PROXY` | No | Number of reverse proxies in front of the server (positive integer). Set to `1` behind one proxy so rate limiting sees real client IPs. Ignored if unset or invalid. |
| `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GEMINI_API_KEY` | No | Commented out in `.env.example`. Only for the paused providers. |
| `VITE_API_URL` | No (frontend) | Absolute origin of the backend, set when building the frontend. Empty in local dev, where Vite proxies `/api`. |

## Deployment notes

- Set `FRONTEND_URL` to the frontend's origin (for example `https://ghostrank-one.vercel.app`; the backend runs on a separate host). Requests from other origins are blocked by CORS.
- Set `TRUST_PROXY=1` when the server runs behind one proxy, so rate limits apply per client IP rather than per proxy.
- Run `npx prisma migrate deploy` once against the production database.
- Set `VITE_API_URL` to the backend's absolute origin when building the frontend. The `/api` proxy exists only in the Vite dev server.

## API

All routes except `/health`, `POST /api/auth/register` and `POST /api/auth/login` require an `Authorization: Bearer <token>` header. Scan-start routes also return an error until the agency is approved.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Health check |
| POST | `/api/auth/register` | Register an agency |
| POST | `/api/auth/login` | Log in and receive an access token |
| POST | `/api/clients` | Create a client |
| GET | `/api/clients` | List the agency's clients |
| GET | `/api/clients/:id` | Get one client |
| PATCH | `/api/clients/:id` | Update a client |
| DELETE | `/api/clients/:id` | Delete a client |
| POST | `/api/clients/:clientId/scans` | Start a scan for a client (requires scan approval) |
| POST | `/api/clients/:clientId/scans/v2` | Start a web-search scan with repeated runs (requires scan approval) |
| GET | `/api/clients/:clientId/scans` | List a client's scans |
| GET | `/api/scans/:id` | Get a scan (status, score, results) |
| GET | `/api/scans/:id/runs` | Get the saved runs of a scan |
| POST | `/api/scans/:scanId/report` | Generate a report for a scan (idempotent) |
| GET | `/api/clients/:clientId/reports` | List a client's reports |
| GET | `/api/reports/:id` | Get a report with its full data |
| GET | `/api/agency` | Get the current agency (name, colour, logo) |
| PATCH | `/api/agency` | Update the agency name, brand colour or logo URL |

## Project structure

```
src/
  config/       AI platform config, ACTIVE_PLATFORMS
  controllers/  Request handlers
  lib/          Prisma client
  middleware/   Auth, validation, rate limiting, param validation, error handler
  routes/       Express route definitions
  scanner/      v2 scan (question builder, runner, runScanV2, scorer), AI querier and providers, plus the older scan's prompt builder, name detector and parser
  schemas/      Zod schemas for auth and clients
  scorer/       Score calculation for the older scan
  services/     Scan orchestration, report building (reportV2.ts for v2, report.service.ts picks v2 or older), per-prompt report detail for the older scan (reportDetail.ts)
  types/        Shared types
  utils/        Token generation, text sanitizing, AppError
tests/          Vitest tests (scanner, scorers, reports, scan approval, validation)
prisma/         Schema and migrations
frontend/
  src/api/        Axios API modules
  src/components/ Shared UI components
  src/context/    Auth context
  src/pages/      Auth, Dashboard, Clients, Scans, Reports
```

## Design decisions

- Scans run in the background and the client polls for status, so the start request returns immediately.
- Scans left `PENDING` or `RUNNING` by a server restart are marked `FAILED` on startup.
- A scan is marked `FAILED` if every AI call fails, instead of saving a meaningless score.
- Scan and report endpoints scope their queries to the logged-in agency's ID.
- `ACTIVE_PLATFORMS` is one shared constant used by the older scan's prompt builder and scorer and by the report service, so enabling a provider is a single change.
- Auth and client request bodies are validated with Zod. Registration requires a password of 8+ characters with at least one letter and one digit.
- Route `id` parameters are validated (letters and digits only, 1-64 characters) before they reach a controller; invalid ids get a `400`.
- Rate limiting: login allows 10 attempts per IP per 15 minutes, registration 5 per IP per hour, and starting a scan 10 per agency per hour.
- v2 reports are rebuilt from the saved `ScanRun` rows on every read, so editing a client's name or variants updates old reports. No extra AI calls are made.
- For the older scan, per-prompt report detail (answer excerpt, other businesses, issue label, suggestion) is computed from the saved scan results when the report is built, with no extra AI calls.
- The server checks `ACCESS_TOKEN_SECRET` at startup and refuses to start if it is shorter than 32 characters.

## Known limitations and next steps

- Scans run inside the web process. There is no job queue, so a restart interrupts running scans.
- Tests mock the database. There are no tests against a real database or a running API server.
- A bare `#1 Name` list item is not recognized as a position; only `1.` style items are.
- Only Claude is active. The other providers' code is paused.
- Sentiment is keyword-based.
- PDF output is the browser's print dialog ("Save as PDF"). There is no server-generated PDF (the `Report` model has unused `pdfUrl` and `webUrl` fields).
- Competitor names come from a text heuristic that reads line-leading names, so unusual answer formats can be missed.
- The same business can appear twice under different suffixes (for example "Hospitals" and "Hospitals Ltd").
- A renamed business can appear in its own competitor list.
- The improvement suggestions are general rules, not advice tailored to the business.
- The access token is kept in `sessionStorage` and expires after 15 minutes. There is no refresh token.
