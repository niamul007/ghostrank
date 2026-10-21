# GhostRank

GhostRank checks how often and how well AI assistants recommend a local business, and scores it from 0 to 100. It is built for web agencies and their clients.

## How it works

1. An agency registers, logs in, and adds a client (business name, niche, location).
2. Starting a scan (`POST /api/clients/:clientId/scans`) creates a `PENDING` scan record and returns `201` straight away. The scan then runs in the background in the same server process.
3. The prompt builder picks 5 prompts from templates: 2 "direct", 1 "comparison", 1 "discovery" and 1 "specific", filled in with the client's niche, location and business name.
4. Each prompt is sent to every platform listed in `ACTIVE_PLATFORMS`. **Claude is the only active provider today.** The ChatGPT, Perplexity and Gemini query code exists in `src/scanner/aiQuerier.ts` but is paused.
5. Each response is parsed: fuzzy name matching decides whether the business was mentioned, then list position and keyword-based sentiment are extracted.
6. The scorer combines the parsed results into a 0-100 score.
7. Results are saved (score, per-prompt `ScanResult` rows) and the scan is marked `COMPLETED`. If every AI call fails, or anything unexpected throws, the scan is marked `FAILED` instead.
8. The frontend polls `GET /api/scans/:id` every 3 seconds while the scan is pending or running. Once it completes, a report can be generated from the scan (`POST /api/scans/:scanId/report`) and viewed on the report page. Each prompt result in the report includes the saved AI answer (trimmed to 600 characters), the other businesses found in it, an issue label (not mentioned, low position, negative or ok) and a general improvement suggestion chosen by rule from the prompt category and the issue. No extra AI calls are made for this.

## Scoring

Defined in [src/scorer/index.ts](src/scorer/index.ts).

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
# edit .env (see Environment variables below)
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

This runs a Vitest suite for the scorer, name detector, parser and text sanitizer. It needs no database, API key or environment variables.

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
| `FRONTEND_URL` | No | Comma-separated list of frontend origins allowed by CORS. Defaults to `http://localhost:5173`. Example: `https://app.example.com`. |
| `TRUST_PROXY` | No | Number of reverse proxies in front of the server (positive integer). Set to `1` behind one proxy so rate limiting sees real client IPs. Ignored if unset or invalid. |
| `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GEMINI_API_KEY` | No | Commented out in `.env.example`. Only for the paused providers. |

## Deployment notes

- Set `FRONTEND_URL` to the frontend's origin (for example `https://app.example.com`). Requests from other origins are blocked by CORS.
- Set `TRUST_PROXY=1` when the server runs behind one proxy, so rate limits apply per client IP rather than per proxy.
- Run `npx prisma migrate deploy` once against the production database.
- Set `VITE_API_URL` to the backend's absolute origin when building the frontend. The `/api` proxy exists only in the Vite dev server.

## API

All routes except `/health`, `POST /api/auth/register` and `POST /api/auth/login` require an `Authorization: Bearer <token>` header.

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
| POST | `/api/clients/:clientId/scans` | Start a scan for a client |
| GET | `/api/clients/:clientId/scans` | List a client's scans |
| GET | `/api/scans/:id` | Get a scan (status, score, results) |
| POST | `/api/scans/:scanId/report` | Generate a report for a scan (idempotent) |
| GET | `/api/clients/:clientId/reports` | List a client's reports |
| GET | `/api/reports/:id` | Get a report with its full data |

## Project structure

```
src/
  config/       AI platform config, ACTIVE_PLATFORMS
  controllers/  Request handlers
  lib/          Prisma client
  middleware/   Auth, validation, rate limiting, param validation, error handler
  routes/       Express route definitions
  scanner/      Prompt builder, AI querier, name detector, response parser
  schemas/      Zod schemas for auth and clients
  scorer/       Score calculation
  services/     Scan orchestration, report building, per-prompt report detail (reportDetail.ts)
  types/        Shared types
  utils/        Token generation, text sanitizing, AppError
tests/          Vitest tests for the scorer, detector, parser and sanitizer
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
- `ACTIVE_PLATFORMS` is one shared constant used by the prompt builder, scorer and report service, so enabling a provider is a single change.
- Auth and client request bodies are validated with Zod. Registration requires a password of 8+ characters with at least one letter and one digit.
- Route `id` parameters are validated (letters and digits only, 1-64 characters) before they reach a controller; invalid ids get a `400`.
- Rate limiting: login allows 10 attempts per IP per 15 minutes, registration 5 per IP per hour, and starting a scan 10 per agency per hour.
- Per-prompt report detail (answer excerpt, other businesses, issue label, suggestion) is computed from the saved scan results when the report is built, with no extra AI calls.
- The server checks `ACCESS_TOKEN_SECRET` at startup and refuses to start if it is shorter than 32 characters.

## Known limitations and next steps

- Scans run inside the web process. There is no job queue, so a restart interrupts running scans.
- Tests cover the scorer, name detector, parser and text sanitizer only. There are no API or database tests.
- A bare `#1 Name` list item is not recognized as a position; only `1.` style items are.
- Only Claude is active. The other providers' code is paused.
- Sentiment is keyword-based.
- Reports are viewed in the web app only. There is no PDF or white-label output yet (the `Report` model has unused `pdfUrl` and `webUrl` fields).
- Competitor names come from a text heuristic that reads line-leading names, so unusual answer formats can be missed.
- The same business can appear twice under different suffixes (for example "Hospitals" and "Hospitals Ltd").
- A renamed business can appear in its own competitor list.
- The improvement suggestions are general rules, not advice tailored to the business.
- The access token is kept in `sessionStorage` and expires after 15 minutes. There is no refresh token.

## Screenshots

<!-- add screenshots of the scan page and report here -->
