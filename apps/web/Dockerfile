FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY apps/web ./apps/web
ARG NEXT_PUBLIC_HOCUSPOCUS_URL
ENV NEXT_PUBLIC_HOCUSPOCUS_URL=$NEXT_PUBLIC_HOCUSPOCUS_URL
# Placeholders so env.ts doesn't throw during static build; real values are injected at runtime
ENV BETTER_AUTH_SECRET=build-placeholder
ENV BETTER_AUTH_URL=http://localhost:3000
ENV GOOGLE_CLIENT_ID=build-placeholder
ENV GOOGLE_CLIENT_SECRET=build-placeholder
ENV POLAR_ACCESS_TOKEN=build-placeholder
ENV POLAR_PRODUCT_ID=build-placeholder
ENV POLAR_WEBHOOK_SECRET=build-placeholder
ENV HOCUSPOCUS_SECRET=build-placeholder
RUN pnpm --filter @dumpbook/web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/data && chown nextjs:nodejs /app/data
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV AUTH_DB_PATH=/app/data/auth.sqlite
CMD ["node", "apps/web/server.js"]