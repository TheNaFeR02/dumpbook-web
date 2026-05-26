# Dumpbook

A personal single-document writing app inspired by Andrej Karpathy's append-and-review system. One shared document, real-time collaborative, minimal UI.

## Architecture

pnpm monorepo with two apps:

- **`apps/server`** — Hocuspocus WebSocket server (port 1234). Persists document state via SQLite (`data/db.sqlite`). Stateless otherwise.
- **`apps/web`** — Next.js 16 frontend. Tiptap editor with Hocuspocus real-time sync. better-auth for Google OAuth, auth state in SQLite (`data/auth.sqlite`).

Nginx sits in front in production, routing `/ws` to the Hocuspocus server and everything else to Next.js.

## Key files

- [apps/server/src/index.ts](apps/server/src/index.ts) — entire server (Hocuspocus + SQLite extension)
- [apps/web/app/page.tsx](apps/web/app/page.tsx) — root page, sets up Hocuspocus provider + room (`"example-document"`)
- [apps/web/app/components/Editor.tsx](apps/web/app/components/Editor.tsx) — Tiptap editor component
- [apps/web/app/lib/auth.ts](apps/web/app/lib/auth.ts) — better-auth config (Google OAuth, SQLite)
- [nginx/nginx.conf](nginx/nginx.conf) — routes `/ws` → server:1234, rest → web:3000
- [docker-compose.prod.yml](docker-compose.prod.yml) — production compose (uses GHCR images + volumes)

## Dev

```bash
pnpm install          # from root
pnpm --filter @dumpbook/server dev   # Hocuspocus on :1234
pnpm --filter @dumpbook/web dev      # Next.js on :3000
```

Local `.env.local` in `apps/web/` needs:
```
NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Deployment

Push to `main` → GitHub Actions:
1. Builds both Docker images, pushes to GHCR (`ghcr.io/thenafer02/dumpbook-web/{server,web}:latest`)
2. SSHs into DigitalOcean VPS, writes `.env.production`, pulls images, runs `docker compose -f docker-compose.prod.yml up -d`

`NEXT_PUBLIC_HOCUSPOCUS_URL` is baked in at build time as `wss://dumpbook.ink/ws`.

Production domain: **dumpbook.ink**

## Volumes (production)

- `hocuspocus-data` → `/app/data` in server (document SQLite)
- `web-data` → `/app/data` in web (auth SQLite)

## Tech

| Layer | Tech |
|---|---|
| Editor | Tiptap v3 + StarterKit + Collaboration extension |
| Sync | Hocuspocus v4 (Yjs CRDT) |
| Auth | better-auth v1 + Google OAuth |
| DB | better-sqlite3 (two separate SQLite files) |
| Frontend | Next.js 16, React 19, TypeScript |
| Infra | Docker Compose, Nginx, DigitalOcean VPS |