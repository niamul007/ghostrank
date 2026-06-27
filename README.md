# Backend Starter

Express + TypeScript + Prisma v6 + local Docker Postgres boilerplate.

## Stack

- **Express** — HTTP server
- **TypeScript** — CommonJS, strict mode
- **Prisma v6** — ORM (pinned, never v7)
- **PostgreSQL 16** — running in Docker via `docker-compose.yml`
- **JWT** — access tokens (15m expiry)
- **bcrypt** — password hashing
- **Zod** — request validation

---

## Local Database with Docker

### What Docker Compose does

`docker-compose.yml` defines a single PostgreSQL container. Instead of installing Postgres on your machine, you run one command and Docker starts a fully-configured database instantly. Stop it just as easily. Your data is safe between restarts because it's stored in a **named volume** — persistent storage that lives outside the container on your host machine.

### What the volume does

By default, anything written inside a container is lost when it stops. The `postgres_data` volume mounts Docker-managed storage into `/var/lib/postgresql/data` inside the container, so your tables and rows survive `docker compose down`. Only `docker compose down -v` (the `-v` flag) deletes the volume and wipes all data.

### What the healthcheck does

Starting a container doesn't mean Postgres is immediately ready. The healthcheck runs `pg_isready` every 5 seconds and marks the container **healthy** only when Postgres is actually accepting connections. Run `docker compose ps` to see the status.

### Why port 5432 works on localhost

Your network blocks outbound TCP connections to port 5432 on remote servers. The Docker port mapping `"5432:5432"` forwards traffic from `localhost:5432` on your Windows machine to port 5432 inside the container — that's a loopback connection that never leaves your machine, so the firewall rule doesn't apply.

---

## Getting Started

### 1. Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running on Windows

### 2. Install dependencies

```bash
npm install
```

This reads package.json and installs every dependency at once — you never install packages individually.

### 3. Configure environment

```bash
cp .env.example .env
```

The default `.env` already has the right values for the Docker Compose setup — no edits needed to get started. Just set a real `ACCESS_TOKEN_SECRET`.

### 4. Start the database

```bash
docker compose up -d
```

This starts the Postgres container in the background. Wait a few seconds, then verify it's healthy:

```bash
docker compose ps
```

Look for `healthy` in the STATUS column before proceeding.

### 5. Run migrations

This creates the tables in your database from the Prisma schema. Only needed once (or after schema changes):

```bash
npx prisma migrate dev --name init
```

### 6. Generate the Prisma client

This generates the TypeScript-aware query builder from your schema. Run after any schema change:

```bash
npx prisma generate
```

### 7. Start the dev server

```bash
npm run dev
```

The server starts at `http://localhost:4000`.

---

## Day-to-day workflow

```bash
# Start Postgres (if not already running)
docker compose up -d

# Start the dev server
npm run dev

# Stop Postgres when done (data is safe)
docker compose down
```

To wipe the database completely and start over:

```bash
docker compose down -v   # -v deletes the volume — all data gone
docker compose up -d
npx prisma migrate dev --name init
```

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
  lib/prisma.ts           Prisma client (standard TCP connection)
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
docker-compose.yml        Local Postgres container definition
Dockerfile                Optimized multi-stage production image
DOCKER_NOTES.md           Docker learning reference
```

---

## Building and Running the Production Docker Image

The `Dockerfile` uses a multi-stage build to produce a small, fast image:

- **Stage 1 (builder):** installs all dependencies, generates the Prisma client, compiles TypeScript to JavaScript with `tsc`
- **Stage 2 (runtime):** starts fresh, copies only the compiled `dist/`, the generated Prisma client, and installs production-only dependencies

**Result:** ~150-200 MB final image (vs ~500-700 MB for a naive single-stage build). No TypeScript source, no ts-node, no dev tooling in the image.

### Build the image

```bash
docker build -t backend-starter .
```

### Run the image

Postgres must already be running (via `docker compose up -d`). The app container connects to it via `host.docker.internal` — a Docker Desktop hostname that resolves to your Windows host machine:

```bash
docker run --rm -p 4000:4000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/mydb" \
  -e ACCESS_TOKEN_SECRET="your-secret-here" \
  backend-starter
```

> `host.docker.internal` is needed because inside the container, `localhost` refers to the container itself — not your Windows machine. Docker Desktop provides `host.docker.internal` to bridge the gap.

See [DOCKER_NOTES.md](DOCKER_NOTES.md) for a thorough explanation of every Docker concept used in this project.
