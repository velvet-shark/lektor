# The Lektor worker — build from the monorepo root:
#   docker build -f worker/Dockerfile -t lektor-worker .
FROM node:22.23.4-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

# manifests first for layer caching (pipeline + worker only)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY pipeline/package.json pipeline/package.json
COPY worker/package.json worker/package.json
RUN pnpm install --filter @lektor/worker... --frozen-lockfile

# sources (tsx runtime — no build step)
COPY pipeline pipeline
COPY worker worker

ENV NODE_ENV=production
EXPOSE 8080
CMD ["pnpm", "--dir", "worker", "start"]
