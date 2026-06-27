# Docker Notes — Learning Reference

A plain-language guide to every Docker concept used in this project. Written for someone seeing Docker for the first time.

---

## What is Docker?

Docker lets you run software in an isolated, self-contained environment called a **container**. Instead of installing Postgres directly on your Windows machine (and fighting with version conflicts, PATH issues, service configuration), you tell Docker "give me a Postgres 16 server" and it appears in seconds, fully configured, and disappears just as easily.

The key promise: **it works the same on every machine**. If it runs on your laptop it'll run on your teammate's laptop and on a cloud server, because they're all running the same container image.

---

## Images vs Containers

These two words are easy to mix up, so here's a concrete analogy:

| Docker term | Analogy | What it actually is |
|---|---|---|
| **Image** | A recipe / blueprint | A read-only snapshot of a filesystem + startup instructions. Think of it as a ZIP file of an operating system + software. |
| **Container** | A running kitchen using that recipe | A live, running instance created FROM an image. You can have 10 containers from one image, all independent. |

```
postgres:16-alpine  ←  Image  (downloaded from Docker Hub, never changes)
        │
        ├── container "db_1"  (running, has your data)
        └── container "db_2"  (could be running in parallel, separate data)
```

When you run `docker compose up`, Docker pulls the `postgres:16-alpine` image (once, then cached) and starts a **container** from it.

---

## What is Docker Compose?

Docker Compose is a tool for defining and running **multi-container applications** using a single `docker-compose.yml` file.

Without Compose, you'd start a Postgres container with something like:

```bash
docker run -d \
  --name my-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=mydb \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:16-alpine
```

That's one long command you'd have to remember and re-type every time. Compose puts all of that into `docker-compose.yml` so you just type `docker compose up -d`.

As your project grows to need more services (e.g. a Redis cache, the Node app itself, an nginx reverse proxy), you add more entries to the same file and they all start/stop together.

---

## Volumes — Why Databases Need Them

By default, **everything written inside a container is thrown away when the container stops**. Containers are designed to be stateless and replaceable.

That's great for your API server (stateless — no local data). It's terrible for a database.

A **volume** is persistent storage that lives OUTSIDE the container and is mounted INTO it. When the container stops, the volume stays on your host machine. When you start a new container, you attach the same volume and all the data is still there.

```
Your Windows filesystem
└── Docker-managed volume: "postgres_data"
    └── All your Postgres database files

Container "db" (running)
└── /var/lib/postgresql/data  ←  mounted from "postgres_data" volume
    └── reads and writes go here
```

**Named volumes** (like `postgres_data`) are managed by Docker. You don't need to know where they live on your filesystem — Docker handles it.

### Volume commands

| Command | What happens to data |
|---|---|
| `docker compose down` | Containers stop. Volume **survives**. Data still there. |
| `docker compose up -d` | Containers start again, reconnect to the same volume. Data resumes. |
| `docker compose down -v` | Containers stop AND volumes are deleted. **All data wiped.** Use this to start fresh. |

---

## Port Mapping — How localhost:5432 Works

Containers run in their own network namespace. A process inside a container can't be reached from your host machine unless you explicitly map a port.

```
docker-compose.yml:  ports: "5432:5432"

Your Windows machine         Docker container
  localhost:5432    ────►    postgres:5432 (inside container)
```

The format is `HOST_PORT:CONTAINER_PORT`. So `"5432:5432"` means: forward traffic from port 5432 on your machine to port 5432 inside the container.

This is why the network block doesn't affect you: your network's firewall blocks outbound TCP connections to port 5432 on remote servers. But `localhost:5432` is a loopback address — the traffic never leaves your machine, so the firewall rule doesn't trigger.

---

## Healthcheck — Knowing When Postgres is Ready

Starting a container doesn't mean the software inside is ready. Postgres takes a second or two to initialize its data directory, run startup scripts, and begin accepting connections.

The healthcheck runs a test command on a schedule:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 5s
  timeout: 5s
  retries: 5
```

`pg_isready` is a Postgres utility that does a lightweight connection test. Docker checks it every 5 seconds. After 5 consecutive successes, the container is marked **healthy**.

If another service in your Compose file declares `depends_on: db: condition: service_healthy`, it won't start until the db is healthy. This prevents "connection refused" race conditions on startup.

For this project (where the Node app runs outside Docker during development), the healthcheck is mainly useful so you can tell at a glance whether Postgres is ready — run `docker compose ps` and look at the STATUS column.

---

## How This Postgres Container Fits Into Local Development

Here's the full picture:

```
Your Windows machine
├── Node.js process  (npm run dev  →  ts-node src/server.ts)
│   └── connects to localhost:5432 via DATABASE_URL
│
└── Docker Desktop
    └── Container "db"  (postgres:16-alpine)
        ├── Listens on port 5432 inside the container
        ├── Port 5432 mapped to localhost:5432 on your machine
        └── Data stored in named volume "postgres_data"
```

The Node app and the Postgres container are **not** in the same Docker network here — the Node app runs natively on Windows and connects to the container via `localhost:5432` through the port mapping. This is intentional during development: it lets you restart the Node server instantly without rebuilding any Docker image.

When you package the app into a Docker image (using the Dockerfile), both the app and the database would typically run in the same Compose network, and the app would connect to host `db` instead of `localhost`.

---

## Multi-Stage Docker Builds

See the comments inside [Dockerfile](Dockerfile) for a line-by-line explanation. The short version:

**Stage 1 (builder):** Install everything, generate Prisma client, compile TypeScript → JavaScript.

**Stage 2 (runtime):** Fresh start. Copy only the compiled JavaScript + production dependencies. No TypeScript source, no dev tools, no type definitions in the final image.

**Result:** ~150-200 MB image instead of ~500-700 MB. Faster pulls, faster deploys, smaller attack surface.

---

## Quick Reference Commands

```bash
# Start the database in the background (-d = detached, runs without blocking your terminal)
docker compose up -d

# Check if it's healthy
docker compose ps

# View logs from the database container
docker compose logs db

# Follow logs in real time (Ctrl+C to stop)
docker compose logs -f db

# Stop containers but keep data
docker compose down

# Stop containers AND delete all data (fresh start)
docker compose down -v

# Connect to Postgres directly in the container (useful for debugging)
docker compose exec db psql -U postgres -d mydb

# Build the app Docker image
docker build -t backend-starter .

# Run the app image (after Postgres is already running)
docker run --rm -p 4000:4000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/mydb" \
  -e ACCESS_TOKEN_SECRET="your-secret" \
  backend-starter
```

> **Note on `host.docker.internal`:** When running the Node app *inside* a Docker container and Postgres *also* in Docker via Compose, use `host.docker.internal` instead of `localhost` in `DATABASE_URL`. `localhost` inside a container refers to the container itself, not your Windows machine. `host.docker.internal` is a special Docker Desktop hostname that resolves to your host machine's IP.
