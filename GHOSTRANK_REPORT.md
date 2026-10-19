# GhostRank — Read-Only Audit

Audit date: 2026-10-19. Branch `main`, HEAD `849ea02`. Nothing in the repo was modified except this file. No migrations were run, no Docker commands were run (see 3.2 — Docker is not on PATH in this environment).

**Corrections to the brief, found in the code:**
- The scanner calls **Claude (Anthropic) only**. OpenAI, Perplexity and Gemini code exists but is commented out of the router (`src/scanner/aiQuerier.ts:241-251`). Every score today comes from one provider.
- The backend does **not compile in this checkout**: `node_modules` is stale and the Prisma client was never generated for the schema (see 1.4, 3.3). A fresh `npm install && npx prisma generate` is required first.
- **White-label report generation does not exist** in code. `Agency.logo` and `Agency.brandColors` are in the schema (`prisma/schema.prisma:26-28`) and are never read or written anywhere in `src/` or `frontend/src/`. The "report" is a JSON object; there is no PDF, no HTML export, no branding.
- "Tested end to end in Postman": **not found** — no Postman collection, test file, or script in the repo. Cannot verify.
- **No tenant isolation on scans or reports.** Any logged-in agency can read any other agency's scans and reports by ID (see 4, Broken #2).

---

## 1. Where we are right now

### 1.1 Folder structure

| Path | Purpose |
|---|---|
| `src/server.ts`, `src/app.ts` | Entry point (`dotenv`, listen on `PORT`‖4000) and Express app wiring (`app.ts:10-28`) |
| `src/routes/` | 4 routers: auth, clients, scans, reports |
| `src/controllers/` | HTTP handlers (auth, client, scan, report) |
| `src/services/` | `scan.service.ts` (pipeline orchestration), `report.service.ts` (report build) |
| `src/scanner/` | `promptBuilder.ts` (prompts), `aiQuerier.ts` (provider calls), `detector.ts` (fuzzy name match), `parser.ts` (position, sentiment) |
| `src/scorer/index.ts` | 0-100 score computation |
| `src/config/ai.config.ts` | Per-provider key/model/timeout + shared system prompt |
| `src/middleware/` | `auth.ts` (JWT verify), `authorize.ts` (role guard, **unused**), `validate.ts` (Zod), `errorHandler.ts` |
| `src/schemas/` | Zod schemas for auth and client bodies |
| `src/utils/` | `AppError`, `generateToken`, `sanitizeText` |
| `src/lib/prisma.ts` | Single `PrismaClient` |
| `prisma/` | `schema.prisma` and one migration (`20260630111354_init`) |
| `frontend/` | React 19 + Vite 8 + Tailwind 4 SPA (see section 7) |
| `Dockerfile`, `docker-compose.yml`, `.dockerignore` | Prod image build; Postgres-only compose |
| `README.md`, `DOCKER_NOTES.md` | Stale starter-template docs (see 4, Messy) |
| `server_out.txt` | Tracked, 0 bytes, no purpose |

Size, from `git ls-files`: `src/` 2,858 lines; `src/` + `frontend/src/` 6,067 lines.

### 1.2 Scripts

Backend `package.json:6-10`:

| Script | Command | Effect |
|---|---|---|
| `dev` | `nodemon --exec ts-node src/server.ts` | Dev server with reload |
| `build` | `tsc` | Compile `src/` to `dist/` (`tsconfig.json:6-7`) |
| `start` | `node dist/server.js` | Run compiled output |

No `test`, `lint`, `migrate` or `seed` script. Frontend `frontend/package.json:6-11`: `dev` = `vite`, `build` = `tsc -b && vite build`, `lint` = `oxlint`, `preview` = `vite preview`. No `test`.

### 1.3 Git state

- Branch `main`. Working tree clean (empty `git status --short`).
- Last 15 commits (17 total in history):

```
849ea02 2026-07-17 adding some chages regardingt he roptm
16936a0 2026-07-17 adding new system propmts
dbfa449 2026-07-16 adding front end
321dde1 2026-07-16 fixing all the bug
67dbb50 2026-07-16 checking claude working
d0d4868 2026-07-14 Merge branch 'main' of https://github.com/niamul007/ghostrank
05e31c6 2026-07-14 adding and stopped the other api
9e87bbc 2026-07-02 try to change api call but always getting 429
246f7fb 2026-07-01 adding zod to the routes
70a95ba 2026-07-01 adding report files
27bec3c 2026-07-01 adding gemini model 1.5 flesh
17ec4e7 2026-06-30 adding workflow working
89b9247 2026-06-30 adding controllers and routesZ
7de7e61 2026-06-30 adding prisma 6 to avoid error
a23b020 2026-06-28 adding parser working stage
```

- Secrets: no `.env` file in the working tree, none tracked (`git ls-files | grep .env` returns only `.env.example`). A history search for `AIza` and `sk-` key patterns returned nothing. Only those two patterns were checked, not an exhaustive secret scan.

### 1.4 Status of the pieces

| Piece | Status | Evidence |
|---|---|---|
| Auth (register, login) | Finished | `auth.controller.ts:8-52` |
| Client CRUD | Finished, tenant-scoped | `client.controller.ts` (every query filters `agencyId`) |
| Scan start/get/list | Works, **not tenant-scoped** | `scan.controller.ts:42-44`, `scan.service.ts:167-190` |
| Scanner, Claude | Wired | `aiQuerier.ts:235-240` |
| Scanner, ChatGPT/Perplexity/Gemini | **Commented out** (functions written, unreachable) | `aiQuerier.ts:81-157` and `:241-251` |
| Fuzzy detection, position, sentiment, scoring | Finished (keyword-based sentiment) | `detector.ts`, `parser.ts:114-146`, `scorer/index.ts` |
| Report generation | JSON only | `report.service.ts:150-228` |
| White-label (logo, colors, PDF, web URL) | **Stub columns only** | `schema.prisma:26-28, 91-92`; `Report.pdfUrl/webUrl` never set (grep) |
| Role authorization | Written, unused | `middleware/authorize.ts` has no importers |
| Agency profile endpoint | Not found | no route reads or updates `Agency` after register |
| Tests | None | no test files; no `test` script |
| `ScanResult.alternatives` | Computed, not persisted | `types/index.ts:99-105`; no column |

TODO/FIXME grep across `src/` and `frontend/src/`: no matches. Stubs are the commented-out blocks and unused columns above.

**Local environment (not a code defect, but blocks running):** `npx tsc --noEmit` fails with 10 errors:
- `openai`, `@google/generative-ai`, `@anthropic-ai/sdk` are not installed (`node_modules` has 150 entries and none of the three), although all three are in `package-lock.json:35,78,1645`.
- `@prisma/client` has no `ScanStatus` export because `node_modules/.prisma/client` is a stub (no `schema.prisma` inside, dated Jun 27, before the schema had models). Needs `npx prisma generate`.
- The remaining errors (`TS7006` implicit-any on `block`, `r`, `tx`, `updateErr`) are knock-on effects of the two causes above.

I did not run `npm install` (it would modify the project). Whether the code compiles clean after install is **not verified**.

---

## 2. Architecture

### 2.1 Request flow

`server.ts` → `app.ts`: `express.json()`, `cookieParser()` (nothing reads cookies), `validateAIConfig()` (warns only), `/health`, then four routers, then `errorHandler` (`app.ts:12-28`).

Per route: router → `authenticate` (router-level `router.use`, `client.routes.ts:20`, `scan.routes.ts:12`, `report.routes.ts:12`) → `validate(zodSchema)` (auth and client create/update only) → controller → service → `prisma` → Postgres.

**Traced example, create a scan:** `POST /api/clients/:clientId/scans`
1. `scan.routes.ts:14` → `authenticate` (`middleware/auth.ts:18-35`) verifies the Bearer JWT with `ACCESS_TOKEN_SECRET`, sets `req.user`.
2. `startScan` (`scan.controller.ts:33`) does `prisma.client.findUnique({ where: { id: clientId } })` (`:42`). **It does not filter by `req.user.agencyId`**, so any authenticated agency can scan any client.
3. `createScan` (`scan.service.ts:39-58`) re-fetches the client, inserts `Scan{status: PENDING}`.
4. Controller fire-and-forgets `runScan(payload)` (`scan.controller.ts:68-70`), returns `201 { scanId }` immediately.
5. `runScan` (`scan.service.ts:76-157`): set `RUNNING` → `buildPrompts` → `queryAllPlatforms` → `parseAll` → `computeScore` → one `$transaction` inserting each `ScanResult` and updating the `Scan` to `COMPLETED` with `score`, `promptsUsed`, `rawResults`. Any thrown error sets `FAILED` + `errorMsg` (`:136-156`).
6. Client polls `GET /api/scans/:id` (frontend every 3 s, `ScanDetail.tsx:26,50`).

The background job runs inside the web process. A server restart mid-scan leaves the scan in `RUNNING` forever (no recovery sweep: not found).

### 2.2 Auth

- **Register:** `auth.controller.ts:8-30`; bcrypt cost 10 (`:19`), password stripped from response (`:24`). Password minimum is 6 chars (`auth.schema.ts:6`).
- **Issue:** `generateAccessToken` (`utils/generateToken.ts:8-12`) signs `{agencyId, role}` with HS256 default, `expiresIn: "15m"`. Returned in the JSON body (`auth.controller.ts:48`). No refresh token, no cookie, no logout/revocation endpoint.
- **Verify:** `middleware/auth.ts:18-35`, `Authorization: Bearer <token>` only.
- **Stored (frontend):** in-memory React state only (`AuthContext.tsx:4-7,50`). A page refresh logs the user out; after 15 min the next call gets a 401 and logs out (`client.ts:97-104`).
- **Protected routes:** all of `/api/clients/*`, `/api/scans/*`, `/api/clients/:id/scans`, `/api/reports/*`, `/api/clients/:id/reports`, `/api/scans/:id/report`. Public: `/health`, `/api/auth/register`, `/api/auth/login`.
- Note: `app.use("/api", scanRoutes)` and `app.use("/api", reportRoutes)` (`app.ts:25-26`) mount `router.use(authenticate)` at `/api`, so any unmatched `/api/*` request returns 401 instead of 404. Not a security problem, just misleading.

### 2.3 Scanner

**Prompts** (`promptBuilder.ts:25-47, 104-135`): 11 templates in four categories. Per scan it picks 2 direct, 1 comparison, 1 discovery, 1 specific, randomly (`pickRandom` uses `sort(() => Math.random() - 0.5)`, a biased shuffle). `PLATFORMS = ["claude"]` (`:54`), so **5 prompts, 5 API calls per scan**. The comments still say "15 API calls" (`:97`, `scan.service.ts:87,91`, `scan.controller.ts:28`).

**Provider calls** (`aiQuerier.ts`):

| Provider | Function | Library | Model (`ai.config.ts`) | Reachable? |
|---|---|---|---|---|
| Claude | `queryClaude` `:180-209` | `@anthropic-ai/sdk`, `max_tokens: 1024`, `cache_control: ephemeral` on system prompt | `claude-opus-4-8` (`:83`) | **Yes** |
| ChatGPT | `queryChatGPT` `:81-100` | `openai`, `temperature 0.7` | `gpt-4o-mini` (`:65`) | No |
| Perplexity | `queryPerplexity` `:115-133` | `openai` SDK with `baseURL` | `sonar` (`:71`) | No |
| Gemini | `queryGemini` `:146-157` | `@google/generative-ai`, `systemInstruction` | `gemini-2.0-flash-lite` (`:77`) | No |

All use the shared `AI_SYSTEM_PROMPT` (`ai.config.ts:26-28`). A new SDK client is built on every call (the comment at `aiQuerier.ts:20-22` says "initialized once, reused"; it is not).

**Score** (`scorer/index.ts`), sum of four parts, rounded, clamped 0-100 (`:253-272`):

| Component | Weight | Formula |
|---|---|---|
| Mention rate | 40 | mentioned ÷ total results × 40 (`:55-62`) |
| Position quality | 30 | mean over mentions of {1:1.0, 2:0.8, 3:0.6, 4:0.4, 5+:0.2, unlisted:0.3} × 30 (`:79-103`) |
| Platform coverage | 15 | covered platforms ÷ platforms, with the list hard-coded to `["claude"]` (`:119`), so it is **all-or-nothing: 15 points if Claude mentioned the business even once** |
| Sentiment | 15 | mean of {positive 1, neutral 0.5, negative −0.5} floored at 0, × 15 (`:143-168`) |

Detection (`detector.ts`) is word-window Levenshtein: ≥0.92 "exact", ≥0.72 "fuzzy", else none (`:114-122`). Sentiment is a keyword count on the matched sentence (`parser.ts:114-146`). Position needs a line that starts with `1.`/`1)`/`#1` and contains the name (`parser.ts:46-70`).

**Failures, retries, timeouts, rate limits:**
- Timeout: 30 s per provider client (`ai.config.ts:67,73,79,85`) passed to the SDK constructor.
- Rate limiting: calls run sequentially with a fixed 2 s sleep between them (`aiQuerier.ts:302-312`). No concurrency, no token-bucket, no `Retry-After` handling.
- Retries: **none in repo code.** The Anthropic and OpenAI SDKs retry some errors by default; I did not read the SDK source (not installed here), so treat that as unverified. `@google/generative-ai` has no retry that I can see in repo code.
- Failure: a failed call is `console.error`'d and skipped (`:306-308`). **If every call fails, `responses` is `[]`, `computeScore([])` returns 0, and the scan is saved as `COMPLETED` with score 0** (`scan.service.ts:98-134`). A dead API key looks identical to a business that is genuinely invisible. This is the most important correctness bug in the scanner.
- A missing key only warns at startup (`ai.config.ts:99-115`). Note `validateAIConfig` iterates all four platforms, so with only the Anthropic key set it warns about OpenAI/Perplexity/Gemini on every boot.

### 2.4 Report generation (not white-label)

- **Input:** `POST /api/scans/:scanId/report`, no body (`report.routes.ts:14`).
- **Process:** `generateReport` (`report.service.ts:150-228`): load scan + results + client; require `status === COMPLETED`; build the per-platform breakdown (hard-coded to `["claude"]`, `:172`), a score label (`:59-65`) and rule-based recommendations (`:74-139`); insert a `Report{scanId, clientId}` row (`:204-209`).
- **Output:** JSON `ReportData` (`:19-50`). Nothing about the agency (no name, logo, colors).
- Defects: every POST creates a new `Report` row (not idempotent). Only `id/scanId/clientId` are persisted, so `GET /api/reports/:id` returns the raw row plus nested scan, **not** the `ReportData` shape. The frontend therefore reconstructs `scoreLabel` and recommendations client-side (`frontend/src/lib/reportPresentation.ts`, `ReportDetail.tsx:63-68` banner), duplicating the logic. `GET /api/reports/:id` and `GET /api/clients/:clientId/reports` have no agency check. A line in `generateRecommendations` is a leftover concatenation `"... 'How to choose a " + "provider in your area' ..."` (`:124`) — it never uses the client's niche.

### 2.5 System diagram

```mermaid
flowchart LR
  subgraph FE[frontend - React/Vite :5173]
    UI[Pages: login, register, dashboard,<br/>clients, scans, reports]
    AX[axios api client<br/>Bearer token in memory]
  end
  subgraph BE[backend - Express 5 :4000]
    MW[authenticate / validate zod]
    CT[controllers]
    SC[scan.service runScan - in-process background job]
    RS[report.service]
    subgraph SCN[scanner]
      PB[promptBuilder 5 prompts]
      AQ[aiQuerier sequential, 2s gap]
      PA[parser + detector]
      SO[scorer 0-100]
    end
  end
  DB[(PostgreSQL 16 in Docker :5432<br/>Agency Client Scan ScanResult Report)]
  CL[Anthropic API - active]
  OA[OpenAI / Perplexity / Gemini - disabled]

  UI --> AX -->|/api via Vite proxy| MW --> CT
  CT --> SC --> PB --> AQ --> PA --> SO --> SC
  AQ --> CL
  AQ -.commented out.-> OA
  CT --> RS
  SC --> DB
  RS --> DB
  CT --> DB
```

---

## 3. Database and Docker

### 3.1 Files

**`docker-compose.yml`** (one service):

| Item | Value | Line |
|---|---|---|
| Service | `db` | `:24` |
| Image | `postgres:16-alpine` | `:33` |
| Restart | `unless-stopped` | `:38` |
| Env | `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`, `POSTGRES_DB=mydb` | `:44-46` |
| Port | `5432:5432` (published on all host interfaces) | `:59` |
| Volume | named `postgres_data` → `/var/lib/postgresql/data`, `driver: local` | `:71, 98-102` |
| Healthcheck | `pg_isready -U postgres`, 5 s interval, 5 retries | `:77-89` |
| Network | none declared (Compose default network) | — |
| `version: "3.8"` | obsolete key, Compose v2 ignores it with a warning | `:14` |

There is **no app service** and no `depends_on`.

**`Dockerfile`:** two-stage `node:20-alpine`. Builder: `npm ci`, `prisma generate` with a dummy URL (`:57`), `COPY . .`, `npx tsc`. Runtime: `npm ci --omit=dev`, copies `dist`, `node_modules/.prisma`, `prisma/`, `EXPOSE 4000`, `CMD node dist/server.js`. No `prisma migrate deploy` step anywhere, so a container started from this image does not create tables. No `HEALTHCHECK`, no `USER` (runs as root).

**`.dockerignore`:** excludes `node_modules`, `.env`, `dist`, `.git`, `docker-compose.yml`. It does not exclude `frontend/` (the whole SPA, and its `node_modules` if installed, goes into the build context), `*.md`, or `server_out.txt`.

**`.env.example`:** `DATABASE_URL` (`postgresql://postgres:postgres@localhost:5432/mydb`), `ACCESS_TOKEN_SECRET` (blank), `PORT=4000`, `ANTHROPIC_API_KEY` (blank), and `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GEMINI_API_KEY` commented out. Missing from the example: `VITE_API_URL` (frontend, optional).

### 3.2 Read-only Docker checks

`docker` is **not on PATH** in either the bash or PowerShell environment of this session, and `C:\Program Files\Docker\Docker\resources\bin\docker.exe` does not exist. So `docker ps -a`, `docker images`, `docker volume ls`, `docker compose config` were **not run**, and I cannot list unused or left-over containers, images or volumes. Nothing was removed.

To do this yourself, these are the read-only commands:
```
docker ps -a
docker images
docker volume ls
docker compose config
```
What to look for: a volume named `<folder>_postgres_data` is the one this project uses (Compose prefixes with the project directory name, here likely `ghostrank_postgres_data`). Other `postgres` containers/volumes from earlier Neon-era or starter-template experiments (`prisma.ts:1-9` says the project previously used Neon, and `package.json:2` and the repo URL say `backend-starter`) may be left over. Candidates are images named `backend-starter` (from README's `docker build -t backend-starter .`).

### 3.3 Prisma

- Provider `postgresql`, generator `prisma-client-js`, `DATABASE_URL` from env (`schema.prisma:1-8`). Prisma CLI and client are both 6.19.3 (`package.json:25,41`, confirmed in `node_modules`).
- Models and relations:
  - `Agency` 1—N `Client` (cascade delete)
  - `Client` 1—N `Scan` (cascade), `Client` 1—N `Report` (cascade)
  - `Scan` 1—N `ScanResult` (cascade), `Scan` 1—N `Report` (cascade)
  - Enums `Role{AGENCY,ADMIN}`, `ScanStatus{PENDING,RUNNING,COMPLETED,FAILED}`
  - Indexes on `Client.agencyId`, `Scan.clientId`, `Scan.status`, `ScanResult.scanId`, `Report.scanId`, `Report.clientId`; unique `Agency.email`
- `ScanResult.platform` and `category` are free `String`, not enums. `Scan.rawResults` is `Json`.
- **Migrations:** one, `20260630111354_init` + `migration_lock.toml`.
- **Schema vs migration:** I compared them by hand, table by table, column by column, index by index and FK by FK, and found **no difference**. I could not run `prisma migrate diff` or `migrate status` (needs a database; Docker unavailable), so this is a manual check, not a tool-verified one.
- **"Reverted by AI tools":** git history for `prisma/` shows 3 commits (`40fa2f9`, `7de7e61`, `17ec4e7`), and the schema was last changed in `17ec4e7` (2026-06-30), the same day as the migration. No commit reverts it. The current schema matches the migration. I can't see reverts that happened outside git (uncommitted edits that were later undone).
- The installed generated client is stale (see 1.4).

### 3.4 How the app connects

- `DATABASE_URL` is read by Prisma itself via `env("DATABASE_URL")` (`schema.prisma:7`). `src/lib/prisma.ts:12` does `new PrismaClient()` with no arguments. `dotenv/config` is imported first in `server.ts:1`, which loads `.env` from the process working directory.
- Shape: `postgresql://postgres:postgres@localhost:5432/mydb`, which matches compose (user `postgres`, password `postgres`, db `mydb`, host port 5432). **No mismatch for host-run `npm run dev`.**
- Mismatch for a containerized backend: `localhost` inside a container is the container itself. README tells `docker run` users to use `host.docker.internal` (`README.md:~195`), but compose has no app service, so there is no `db` hostname wiring.
- Prisma CLI loads `.env` automatically, so `prisma migrate` works from the project root with a `.env`.
- Credentials are the default `postgres/postgres` and port 5432 is published on all interfaces (`docker-compose.yml:59`). Fine for a laptop, not for a shared host.

### 3.5 Reproducibility: could a fresh clone run with one command?

**No.** Steps that work today (from the README plus code, assuming Docker Desktop, Node 20+, and that `node_modules` is built fresh):

```
git clone … && cd ghostrank
npm install
cp .env.example .env            # then set ACCESS_TOKEN_SECRET and ANTHROPIC_API_KEY
docker compose up -d            # Postgres only
npx prisma migrate deploy       # or: npx prisma migrate dev   (README says `migrate dev --name init`)
npx prisma generate
npm run dev                     # API on :4000
cd frontend && npm install && npm run dev   # SPA on :5173, proxies /api to :4000
```

Not verified end to end (I did not execute these). What is missing for one command:
- No script chaining db up, migrate, generate (`postinstall: prisma generate` would remove one step).
- No seed script, so a fresh DB has no agency, clients, or sample scan. You have to register through the UI or API first.
- No compose service for the API or the frontend.
- Frontend isn't mentioned in the root README; `frontend/README.md` is the unmodified Vite template.
- Docker image doesn't run migrations.
- `README.md` documents a `User` model with `Int` ids and only the two auth routes (`README.md:141-160`) — the real app has `Agency`, cuid ids and 14 endpoints.

---

## 4. Problems to fix before showing this project

Fix size: S = under an hour, M = a few hours, L = a day or more. Order is my recommendation: 1 is first.

### Broken

| # | Item | Where | Why it matters | Size |
|---|---|---|---|---|
| 1 | All-provider failure saves a `COMPLETED` scan with score 0 | `aiQuerier.ts:302-312`, `scan.service.ts:93-134` | A bad key, expired credit, or an outage produces a believable "Ghost, 0/100" report for a real client. Should mark `FAILED` when zero (or too few) responses came back, and store which prompts failed | S |
| 2 | No tenant isolation on scans and reports | `scan.controller.ts:42` (`findUnique` by id only), `scan.service.ts:167-190`, `report.service.ts:150-264`, `report.controller.ts:23,47,79` | Any registered agency can start scans on, read scans of, and read reports of any other agency's clients if they have/guess the ID. IDs are unguessable cuids, but IDs also appear in URLs and the data is client business data. `client.controller.ts` does it correctly (`findFirst({id, agencyId})`) — copy that pattern | S-M |
| 3 | Backend does not build from a fresh state without `npx prisma generate`; and generate isn't automated | `package.json` scripts; stale `node_modules/.prisma` | `npm install` alone leaves `ScanStatus` missing and `tsc` failing. `postinstall` fixes it | S |
| 4 | Scan stuck in `RUNNING` if the process restarts | `scan.controller.ts:68`, `scan.service.ts:81` | Frontend polls forever (`ScanDetail.tsx:49-50`). Needs a startup sweep marking old `RUNNING`/`PENDING` scans `FAILED`, or a job queue | S (sweep) / L (queue) |
| 5 | `GET /api/reports/:id` returns a different shape from `POST …/report` | `report.service.ts:233-245` vs `:150-228` | Forces frontend reconstruction (`reportPresentation.ts`), so the page shows "Reconstructed from stored scan data" for every report opened after creation. Persist `ReportData` JSON on the `Report` row | M |
| 6 | Model id `claude-opus-4-8` | `ai.config.ts:83` | I can't confirm this is a valid current model id from the repo, and the commit history says "checking claude working" (`67dbb50`) but I did not see a logged success. If it is invalid every scan fails and (via #1) saves score 0. Check it against the current model list | S |

### Risky

| # | Item | Where | Why it matters | Size |
|---|---|---|---|---|
| 8 | No rate limiting on any route, including `/api/auth/login` and `POST …/scans` | `app.ts` | Brute-force login; unlimited paid Claude calls per authenticated user (5 calls per scan) | S-M |
| 9 | No cost cap or concurrency limit on scans | `scan.controller.ts:68` | One user can start many scans at once; each runs a 10+ s sequential loop in the web process | M |
| 10 | No security headers or CORS config | `app.ts` (no `helmet`, no `cors`) | Fine for Vite proxy dev. A deployed SPA on another origin fails; headers default to Express's | S |
| 11 | Weak password rule and no brute-force defence | `auth.schema.ts:6` (min 6), `:11` login only `min(1)` | | S |
| 12 | JWT: HS256 default, 15 min, no refresh, no revocation; secret may be empty string if set blank | `generateToken.ts:11`, `.env.example:13` (blank value) | `ACCESS_TOKEN_SECRET=` (empty) is falsy, so it errors (`:10`) rather than signing with empty. OK. But there is no minimum-length check | S |
| 13 | Input validation gaps | `scan`, `report` routes have no `validate`; `:clientId`, `:id` params not checked; `listScans`/`listReports` unauthenticated-by-owner (see #2) | | S |
| 14 | Error handler leaks nothing, but scan `errorMsg` stores raw provider/SDK error text and returns it to the client | `scan.service.ts:139-148`, `getScan` returns the full row | Could expose provider/internal messages | S |
| 15 | DB creds default `postgres/postgres`, port published to all interfaces | `docker-compose.yml:44-45,59` | Bind to `127.0.0.1:5432:5432`; move creds to `.env` | S |
| 16 | Container runs as root; no healthcheck | `Dockerfile` | | S |
| 17 | `cookieParser` loaded but unused | `app.ts:2,13` | Dead middleware | S |

### Messy

| # | Item | Where | Size |
|---|---|---|---|
| 18 | `README.md` and `DOCKER_NOTES.md` describe the old starter template (User model, 2 routes), not GhostRank; `package.json` name is `backend-starter`, repo URL points to `backend-starter` | `README.md:141-160, 161-170`, `package.json:2,12-21` | M |
| 19 | Comments still say "3 platforms / 15 calls" while the code does 1 platform / 5 calls | `promptBuilder.ts:96-102`, `scan.service.ts:87,91`, `scan.controller.ts:28`, `scorer/index.ts:30,108` | S |
| 20 | Platform list hard-coded as `["claude"]` in 3 separate files instead of one shared constant | `promptBuilder.ts:54`, `scorer/index.ts:119`, `report.service.ts:94,172` | S |
| 21 | Commented-out provider code, unused provider clients/functions, unused deps | `aiQuerier.ts:28-55, 81-157`; `openai`, `@google/generative-ai` still installed | S |
| 22 | `authorize.ts` unused; `Agency.logo/brandColors`, `Report.pdfUrl/webUrl`, `Role.ADMIN` never used | | S (delete) or M (build the feature) |
| 23 | `server_out.txt` tracked and empty | repo root | S |
| 24 | Two comment lines claim `gemini-2.0-flash` but the value is `gemini-2.0-flash-lite` | `ai.config.ts:51` vs `:77`; stray `// ← change this line` at `:77` | S |
| 25 | `docker-compose.yml` `version:` key obsolete | `:14` | S |
| 26 | Imports use `../types/index.ts` with extension in some files and `../types` in others | `aiQuerier.ts:17`, `ai.config.ts:7` vs elsewhere | S |
| 27 | Duplicated recommendation logic (backend + `frontend/src/lib/reportPresentation.ts`) | | M (resolved by #5) |
| 28 | Biased shuffle `sort(() => Math.random() - 0.5)` | `promptBuilder.ts:84` | S |
| 29 | `ScanResult.alternatives` computed but dropped | `types/index.ts:105`, `scan.service.ts:111-120` | S-M |
| 30 | Commit messages like "adding some chages regardingt he roptm" | git | cosmetic |

### Missing tests

| # | Item | Size |
|---|---|---|
| 31 | Zero tests, backend and frontend, no test runner installed | — |
| 32 | Highest value first: `scorer/index.ts` (pure function), `detector.ts` fuzzy matching and `parser.ts` (pure), `sanitizeText.ts` (pure). Then auth + tenant-isolation API tests (supertest) once #2 is fixed | M for the pure-function suite, M-L for API tests |

**Recommended order:** 1 → 3 → 2 → 6 → 4 → 8/9 → 15 → 5 → 18/19/20/21/23 (cleanup pass) → 31/32 → 22 (white-label, if you want to show it).

---

## 5. Showcase readiness

### 5.1 What you can honestly show today

If you do the local setup in 3.5 and #3 (generate):
- Register/login as an agency, add a client, run a real scan against **Claude** (5 prompts, about 10-20 s), watch the status poll, see a 0-100 score, per-prompt mention/position/sentiment, and a generated report page with rule-based recommendations. All of that is in code (`frontend/src/pages/*`, 9 routes).
- Fuzzy name detection that survives typos (`detector.ts`) and a transparent weighted score.

Do **not** present as existing: multi-AI-platform coverage, white-label/branded/PDF reports, shareable report links, monthly tracking, tests, or "tested end to end" (no evidence in the repo). Per-platform "coverage" is Claude only, so the 15-point coverage component is just "did Claude mention you at all".

### 5.2 Smallest additions to make it demonstrable

1. `npm run setup` / `postinstall`: install + `prisma generate`; a single `docker compose up -d && prisma migrate deploy` script. (S)
2. A seed script: one demo agency, 2-3 clients, one pre-computed `COMPLETED` scan with realistic `ScanResult` rows so the demo works without an API key or spend. (M)
3. Fix #1 so a demo can't show a fake zero. (S)
4. A rewritten README: what it is, screenshot, 6-line setup, env table. (S-M)
5. Persist the report JSON (#5) and add a print-friendly `/reports/:id` page using `Agency.name/logo/brandColors`, which is the smallest honest "white-label" (print to PDF from the browser). (M)
6. Re-enable one more provider (see section 6) if you want the multi-AI claim. (M)

### 5.3 Real numbers, from the code only

| Metric | Value | Source |
|---|---|---|
| HTTP endpoints | **14** (1 health, 2 auth, 5 clients, 3 scans, 3 reports) | route files, `app.ts:18` |
| Prisma models / enums | 5 / 2 | `schema.prisma` |
| Migrations | 1 | `prisma/migrations/` |
| AI providers coded / active | 4 / **1** (Claude) | `aiQuerier.ts` |
| Prompt templates / prompts per scan / calls per scan | 11 / 5 / 5 | `promptBuilder.ts:25-47,108-113` |
| Score components | 4 (40/30/15/15) | `scorer/index.ts:42-47` |
| Frontend routes / components | 9 pages / 15 component files | `App.tsx:169-178`, `frontend/src/components` |
| Backend / total source lines | 2,858 / 6,067 (`src` + `frontend/src`) | `git ls-files … wc -l` |
| Tests | **0** | none found |
| Commits | 17, 2026-06-27 to 2026-07-17 | `git log` |

I have no cost, latency, accuracy or scan-count numbers. None are recorded in the repo (`server_out.txt` is empty). Don't quote any.

---

## 6. Why ChatGPT, Perplexity and Gemini are paused

**What the repo actually says.** The pause is a code change in `05e31c6` (2026-07-14, "adding and stopped the other api"). The comment in the code gives one reason: *"Paused for now — testing against Claude only (we only have an Anthropic key at the moment)"* (`aiQuerier.ts:241-242`); `ai.config.ts:57-60` and `.env.example:20` say the same ("until we have keys for the others"). **The documented reason is missing keys, not 429s.**

**The 429 history, per provider:**

| Provider | Evidence of a 429 / error in repo | Cause |
|---|---|---|
| **Gemini** | Commit message `9e87bbc` (2026-07-02): "try to change api call but always getting 429". Before it, `27bec3c` (07-01) had switched `gemini-2.0-flash` → `gemini-1.5-flash`. In `9e87bbc` the model was changed again to `gemini-2.0-flash-lite` (`ai.config.ts:77`) **and** `Promise.allSettled` over all prompts was replaced by sequential calls with a 2 s delay (`aiQuerier.ts:297-317`). The message says it still returned 429. No later commit touches Gemini | Your note is that the free-tier quota was hit. That is consistent with a 429 from Google's API, but **the repo contains no error body, log or status text** (`server_out.txt` is empty), so I can't confirm the exact cause (per-minute vs per-day quota, a zero-quota model on the free tier, or a retired model id). Changing the model twice and slowing the calls didn't help, which suggests the limit was not request spacing. I did not call the API |
| **ChatGPT** | None found in code, commits, or notes | Not paused for an error. The only recorded reason is no key. Whether a key was ever configured: **not found** |
| **Perplexity** | None found | Same: no key. Never exercised in any recorded run |

Note the initial commit's `ai.config.ts` was written with `gemini-2.0-flash` (`24d204c`), so the 429 first appeared on that default model, or after the first Gemini attempt; the repo doesn't say which call first failed.

**Current state of each integration:**
- **Claude:** active, `queryClaude` (`aiQuerier.ts:180-209`). Prompt caching marker is present but the file's own comment says the ~190-token prompt is below the minimum cacheable size, so it does nothing (`:173-178`). Whether it has ever run successfully end to end: the commit `67dbb50` is "checking claude working" and `321dde1` adds cache-usage logging, which suggests it was run, but no log output is saved. Not verified by me.
- **ChatGPT, Perplexity, Gemini:** the query functions, config entries, SDK dependencies and the shared system prompt are all present and typed. They're unreachable only because the three `case` branches are commented out (`:243-251`).

**What re-enabling each takes:**

| Provider | Steps | Size | Watch out for |
|---|---|---|---|
| ChatGPT | Set `OPENAI_API_KEY`; uncomment `case "chatgpt"`; add `"chatgpt"` to `PLATFORMS` (`promptBuilder.ts:54`), the platform lists in `scorer/index.ts:119` and `report.service.ts:94,172` | S | Cost per scan roughly doubles with each provider |
| Perplexity | Set `PERPLEXITY_API_KEY`; same three edits; `sonar` needs a paid API credit balance | S | It is the one that answers from live web search, so scores will differ from model-only providers |
| Gemini | Set `GEMINI_API_KEY`; same edits; **first verify the key's quota and that `gemini-2.0-flash-lite` is a model your key/tier can still call** (check in Google AI Studio). Likely needs billing enabled, or a different/current model id. Then add 429 handling | S-M | This is the one with a known 429; re-enabling without retry/backoff will reproduce it |

**Prerequisites before re-enabling any of them (otherwise failures turn into silent zeros):**
1. Fix #1 (all-fail → `COMPLETED` 0).
2. Per-provider failure handling: catch a 429, honor `Retry-After`, back off, retry up to N times; record which provider/prompt failed and show it in the report. Today `aiQuerier.ts:306-308` only logs.
3. Make `queryAllPlatforms` group by provider, since each has different limits (Gemini's free tier is far stricter than the paid APIs; I'm stating that as general knowledge, not from the repo).
4. Replace the three hard-coded `["claude"]` lists with one shared constant (#20), so enabling a provider is a one-line change as the comments claim.
5. Update scoring text: with 2-4 providers the 15-point coverage component becomes meaningful again.

---

## 7. Frontend

- **Framework:** React 19.2, React Router 7, Vite 8, TypeScript ~6.0, Tailwind 4 via `@tailwindcss/vite`, axios, zod, IBM Plex Mono and Sora fonts (`frontend/package.json:12-31`). Lint: oxlint.
- **Pages / routes** (`App.tsx:169-178`): `/login`, `/register`, `/` (dashboard), `/clients`, `/clients/:id`, `/scans`, `/scans/:id`, `/reports`, `/reports/:id`; everything else redirects to `/`. All except login/register sit behind `ProtectedRoute` + `Layout`.
- **How it calls the backend:** one axios instance, `baseURL = import.meta.env.VITE_API_URL || ""` (`api/client.ts:69-75`). In dev, relative `/api/...` is proxied by Vite to `http://localhost:4000` (`vite.config.ts:46-49`). A request interceptor adds `Authorization: Bearer <token>` from a module variable; a 401 response calls logout (`client.ts:90-105`). Endpoint modules: `api/auth.ts`, `clients.ts`, `scans.ts`, `reports.ts`; they match the 14 backend routes (it uses all except `GET /health`).
- **Scan flow:** `ScansList`/`ClientDetail` start a scan, `ScanDetail` polls every 3 s while `PENDING`/`RUNNING` (`ScanDetail.tsx:26,49-50`), then "Generate report" posts and navigates with the report in router state (`:52-67`). Opening a report later goes through `GET /api/reports/:id`, which has a different shape, so it's reconstructed (`ReportDetail.tsx:34-48`). The dashboard fans out one request per client (up to 6) because there is no agency-wide reports or scans endpoint (`Dashboard.tsx:45-49`); `ScansList` fans out one request per client (`ScansList.tsx:39-42`), an N+1 pattern.
- **Env vars:** only `VITE_API_URL`, optional, undocumented. No `frontend/.env*` file exists.
- **Auth UX limits:** token is in memory, so refresh = logged out (stated in `AuthContext.tsx:4-7`); no "me" endpoint, so the top bar shows the email you typed (`:9-13, 71-73`). Register then redirects to login.
- **No white-label UI** (grep for logo/brand/pdf/print finds nothing).
- **Does it run?** **Not verified.** `frontend/node_modules` does not exist, so I could not build or start it, and I didn't install anything. Static read: code is consistent with the backend contract; I can't confirm it type-checks (the `tsconfig.app.json` writes a build-info file, which I avoided). `frontend/README.md` is the unmodified Vite template.

---

## 8. Open questions for you

1. Which provider returned the 429s in `9e87bbc`: only Gemini, or also OpenAI/Perplexity? Do you have the actual error text or response headers? The repo has none.
2. Do you have valid OpenAI and Perplexity keys, and does the Gemini key have billing enabled, or is it still free tier?
3. Is `claude-opus-4-8` the model you intended, and did a full scan ever succeed on it? Any saved output from that run?
4. What was the "Postman end-to-end test" run against: which commit, and is the collection saved anywhere?
5. What should "white-label" mean for the first showable version: logo and colors on an on-screen report, a downloadable PDF, or a public share link?
6. "Schema reverted by AI tools": when did that happen, and is there a `schema.prisma` you consider correct that differs from the committed one? Git history shows no revert.
7. Docker is not on PATH in this session. Is Docker Desktop installed on this machine, and can you paste the output of `docker ps -a`, `docker images`, `docker volume ls` so I can finish the cleanup section?
8. Is the intended deployment single-process on one host, or do you want a job queue and a separate worker for scans?
9. Do you want multi-tenant correctness fixed (#2) before any demo, even if the demo uses only one agency account?
