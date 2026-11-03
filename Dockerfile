# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN --mount=type=secret,id=proxy_ca \
    if [ -s /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm install --global pnpm@10.11.0 --strict-ssl=true --no-audit --no-fund
COPY . .
RUN --mount=type=secret,id=proxy_ca \
    if [ -s /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    pnpm install --frozen-lockfile && pnpm run build && chmod -R a+rX /app
FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /app /app
RUN mkdir -p /app/storage/assets /app/storage/exports && chown -R node:node /app/storage
ENV NODE_ENV=production SERVE_WEB=true API_HOST=0.0.0.0 API_PORT=3001 COOKIE_SECURE=true ASSET_DIR=/app/storage/assets EXPORT_DIR=/app/storage/exports
USER node
EXPOSE 3001
CMD ["sh","-c","node db/migrate.cjs && node apps/api/dist/main.js"]
