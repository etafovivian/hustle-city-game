# syntax=docker/dockerfile:1
# Naija Hustle City — one build, two images:
#   --target server : API, worker and migrations (Node)
#   --target web    : static web app on nginx, proxying /api to the API

FROM node:24-alpine AS base
RUN corepack enable pnpm
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app

# ---- build everything ------------------------------------------------------
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm -r build

# ---- server runtime: production dependencies + compiled output -------------
FROM base AS server
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod --filter @hc/api --filter @hc/worker --filter @hc/db --filter @hc/shared
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/db/dist packages/db/dist
COPY --from=build /app/packages/db/migrations packages/db/migrations
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/worker/dist apps/worker/dist
USER node
EXPOSE 4180
CMD ["node", "apps/api/dist/index.js"]

# ---- web runtime ------------------------------------------------------------
FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
