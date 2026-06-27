# ─────────────────────────────────────────────────────────────────────────────
# MULTI-STAGE BUILD — WHY THIS MATTERS
# ─────────────────────────────────────────────────────────────────────────────
# A naive single-stage Dockerfile copies everything in and installs ALL
# dependencies (including TypeScript, ts-node, @types/*, nodemon, etc.).
# That produces an image ~500-700 MB where most of it is build tooling that
# the running app never touches.
#
# A multi-stage build uses two separate FROM instructions:
#   Stage 1 "builder" — has full dev tools, compiles TypeScript → JavaScript
#   Stage 2 "runtime" — starts FRESH, copies only the compiled output + prod deps
#
# The final image contains ZERO TypeScript source, ZERO ts-node, ZERO @types/*
# packages. Typical result: 150-200 MB instead of 500-700 MB.
#
# Running compiled JavaScript (node dist/server.js) is also ~30% faster startup
# than `npx ts-node src/server.ts` because ts-node transpiles files on every
# start; node just executes pre-compiled bytecode.
# ─────────────────────────────────────────────────────────────────────────────


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 1: builder
# ═══════════════════════════════════════════════════════════════════════════════
# "AS builder" gives this stage a name so Stage 2 can reference it with
# COPY --from=builder. This stage is discarded after the build; none of its
# layers appear in the final image.
FROM node:20-alpine AS builder

# Set the working directory for all following commands in this stage.
# /app is a convention; Docker creates it if it doesn't exist.
WORKDIR /app

# ── Layer caching trick ────────────────────────────────────────────────────
# Copy package files BEFORE copying source code.
# Docker caches each RUN/COPY as a layer. If package.json hasn't changed,
# Docker reuses the cached npm ci layer on the next build — skipping the
# slowest step (downloading packages). This makes rebuilds after code-only
# changes very fast.
COPY package*.json ./

# npm ci ("clean install") is preferred over npm install in automated/CI
# environments because:
#   - It reads package-lock.json exactly (reproducible, no version drift)
#   - It deletes node_modules before installing (clean slate every time)
#   - It's faster than npm install for clean installs
RUN npm ci

# Copy the Prisma schema so we can generate the client in this stage.
# We do this before copying all source to keep the schema layer separate.
COPY prisma ./prisma

# Generate the Prisma client from the schema.
# This creates the @prisma/client JavaScript files (type-safe query builder).
# We pass a dummy DATABASE_URL because prisma generate only reads the schema
# file — it never actually connects to a database.
RUN DATABASE_URL="postgresql://user:pass@localhost/db" npx prisma generate

# Now copy the rest of the source code.
# Done AFTER npm ci so that changing a .ts file doesn't bust the npm layer.
COPY . .

# Compile TypeScript → JavaScript. Output goes to ./dist (defined in tsconfig).
# The resulting .js files are plain Node.js — no TypeScript runtime needed.
RUN npx tsc


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 2: runtime
# ═══════════════════════════════════════════════════════════════════════════════
# Fresh start from the same base image. Nothing from Stage 1 carries over
# automatically — we explicitly copy only what the running app needs.
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy package files so we can install production dependencies.
COPY package*.json ./

# Install ONLY production dependencies (skip devDependencies).
# --omit=dev excludes everything in "devDependencies" in package.json:
# typescript, ts-node, nodemon, @types/*, prisma CLI, etc.
# This is the biggest size saving in Stage 2.
RUN npm ci --omit=dev

# Copy the compiled JavaScript from the builder stage.
# COPY --from=builder means "take files from Stage 1, not the host machine".
COPY --from=builder /app/dist ./dist

# Copy the generated Prisma client.
# The generated client is JavaScript files that the runtime needs to query
# the database. It lives inside node_modules/@prisma/client but was generated
# in Stage 1 from our specific schema — we copy it over so the schema-aware
# types and query engine are available.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy the Prisma schema itself — needed at runtime for Prisma to load the
# query engine binary and understand the data model.
COPY --from=builder /app/prisma ./prisma

# Tell Docker that the container listens on port 4000.
# This is documentation only — it doesn't publish the port.
# You still need -p 4000:4000 (or ports: in Compose) to access it from outside.
EXPOSE 4000

# Run the compiled JavaScript directly with Node.
# Faster than ts-node (no transpilation step) and uses less memory.
# The node binary is already in the image; no extra tools needed.
CMD ["node", "dist/server.js"]
