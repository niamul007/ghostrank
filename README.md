# Backend Starter

Express + TypeScript + Prisma v6 + Neon Postgres.

## Stack

- **Express** — HTTP server
- **TypeScript** — CommonJS, strict mode
- **Prisma v6** — ORM (pinned, never v7)
- **PostgreSQL** — hosted on Neon
- **JWT** — access tokens (15m expiry)
- **bcrypt** — password hashing
- **Zod** — request validation

---

## Getting Started

### 1. Prerequisites

- Node 20+
- A free [Neon](https://neon.tech) account and project

### 2. Install dependencies

```bash
npm install
```

This also runs `prisma generate` (via the `postinstall` script).

### 3. Configure environment

```bash
cp .env.example .env
```

Then set these in `.env`:

- `DATABASE_URL` — Neon pooled connection string (host contains `-pooler`)
- `DIRECT_URL` — Neon direct (non-pooled) connection string, used by Prisma migrations
- `ACCESS_TOKEN_SECRET` — long random string used to sign JWTs
- `ANTHROPIC_API_KEY` — Anthropic API key used by the scanner

### 4. Apply migrations

```bash
npx prisma migrate deploy
```

### 5. Start the API

```bash
npm run dev
```

The API listens on `http://localhost:4000`.

### 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` to the backend.

> Note: the first request after idle time may be slow because Neon free databases pause when idle.

---

## Prisma v6 Rules (important)

- **Always pin to `@6`** — never upgrade to v7. The query engine API changed in v7.
- **Do NOT add `previewFeatures = ["driverAdapters"]`** — that was needed for the Neon WebSocket adapter. Standard Postgres doesn't need it.
- **Do not use** `provider = "prisma-client-js"` with an `output` path (v7 pattern).
- Disable the VS Code Prisma extension — it defaults to v7 generator syntax (prisma-client provider with an output path), which is incompatible with this v6 setup and will cause errors.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with nodemon + ts-node |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output from `dist/` |

---

## Database Schema

### User

| Field | Type | Notes |
|---|---|---|
| `id` | `Int` | Primary key, auto-increments |
| `name` | `String` | Required |
| `email` | `String` | Required, must be unique |
| `password` | `String` | Stored as bcrypt hash |
| `role` | `Role` | Enum: `USER` or `ADMIN`, defaults to `USER` |
| `createdAt` | `DateTime` | Set automatically on creation |

---

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| POST | `/api/auth/register` | — | Register new user |
| POST | `/api/auth/login` | — | Login, returns access token |

---

## Project Structure

```
src/
  lib/prisma.ts           Prisma client (PrismaClient)
  middleware/
    auth.ts               Verify Bearer JWT, attach req.user
    authorize.ts          Role-based access guard
    validate.ts           Zod body validation
    errorHandler.ts       Global error handler
  utils/
    AppError.ts           Custom error with statusCode
    generateToken.ts      Sign JWT access token
  schemas/
    auth.schema.ts        Zod schemas for register/login
  controllers/
    auth.controller.ts    Register + login handlers
  routes/
    auth.routes.ts        Auth router
  app.ts                  Express app setup
  server.ts               HTTP server entry point
prisma/
  schema.prisma           User model + Role enum
```
