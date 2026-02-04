# SlateLink: Ein Container für Backend + Frontend
# Stage 1: Frontend bauen (SvelteKit)
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci 2>/dev/null || npm install
COPY frontend/ .
ENV PUBLIC_BACKEND_URL=
RUN npm run build

# Stage 2: Backend + Frontend-Build
FROM oven/bun:1-alpine
WORKDIR /app
COPY backend/package.json backend/bun.lockb* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install
COPY backend/ .
COPY --from=frontend-build /app/frontend/build ./frontend/build
ENV PORT=3000
ENV STATIC_PATH=/app/frontend/build
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
