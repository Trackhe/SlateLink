# SlateLink – HAProxy Management UI mit SvelteKit
# Build (lokal):     docker build -t slatelink .
# Build (ARM+x86):  docker buildx build --platform linux/amd64,linux/arm64 -t trackhe/slatelink:latest --push .
# Run:              docker run -d -p 3000:3000 -v slatelink-data:/data -e DB_PATH=/data/slatelink.db trackhe/slatelink

FROM node:20-alpine AS base
WORKDIR /app

# OCI-Labels (Version/Revision setzt CI per --label)
LABEL org.opencontainers.image.source="https://github.com/Trackhe/SlateLink"
LABEL org.opencontainers.image.title="SlateLink"
LABEL org.opencontainers.image.description="Web-basiertes Management-UI für HAProxy mit Live-Statistiken und Konfigurationsverwaltung."
LABEL org.opencontainers.image.licenses="MIT"

# Abhängigkeiten installieren
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Build-Phase
FROM base AS builder
WORKDIR /app

# Alle Dev-Dependencies für den Build
COPY package.json package-lock.json* ./
RUN npm ci

# Quellcode und Konfigurationsdateien kopieren
COPY . .

# SvelteKit-Sync ausführen (erzeugt .svelte-kit mit tsconfig.json)
RUN npx svelte-kit sync

# SvelteKit-App bauen
RUN npm run build

# Production-Image
FROM node:20-alpine AS production
WORKDIR /app

# Nur Production-Dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Build-Output und statische Dateien
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV DB_PATH=/data/slatelink.db
ENV NODE_ENV=production

VOLUME /data

CMD ["node", "build"]
