FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY apps/server ./apps/server
RUN pnpm --filter @dumpbook/server build
RUN pnpm deploy --filter @dumpbook/server --prod /prod/server

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /prod/server ./
COPY --from=build /app/apps/server/dist ./dist
RUN mkdir -p /app/data
EXPOSE 1234
CMD ["node", "dist/index.js"]
