# Tier System

## Tier names

| Tier | When | Limits | Price |
|---|---|---|---|
| `local` | Anonymous (not signed in) | 1,000 words / 6,000 chars | Free |
| `sync` | Signed in, no subscription | 2,000 words / 12,000 chars | Free |
| `full` | Active Polar subscription | Unlimited (hidden cap, not shown to user) | $4/mo — includes 7-day trial |

---

## Where limits live

Two files hold the same constants — one per app. Both must stay in sync.

| File | Used by |
|---|---|
| `apps/web/app/lib/tiers.ts` | Client-side editor (blocks input in real time) |
| `apps/server/src/tiers.ts` | Server-side storage guard + load-time truncation |

---

## How the tier is resolved

### Client-side

`GET /api/user/subscription-status` checks the user's Polar subscription and returns `{ tier, trialDaysLeft }`. The Editor reads this to set the correct limits on `ContentLimit`.

- No session → `local`
- Session, no Polar subscription → `sync`
- Session, subscription `trialing` → `full` (with `trialDaysLeft`)
- Session, subscription `active` → `full`
- Polar unreachable → falls back to `sync` (never locks the user out)

### Server-side

`tierForDocument(documentName)` in `apps/server/src/tiers.ts` maps room names to tiers:
- `user-{id}` → `sync` (default for all signed-in users)
- `anon-{id}` → `local`

Mapping `full` tier on the server requires passing the user's subscription state at WebSocket connection time — that's Step 4 (ws-token).

---

## How limits are enforced

Limits are enforced at **two layers**. The client layer is UX; the server layer is the security boundary.

### 1. Client — `ContentLimit` extension (`apps/web/app/lib/extensions/ContentLimit.ts`)

A ProseMirror `filterTransaction` plugin blocks any local user input that would push the document past the tier limit. Yjs sync transactions (remote/initial load) are whitelisted and always pass through — this is intentional so the editor can display server-truncated content accurately.

### 2. Server — `TieredSQLite` (`apps/server/src/extensions/TieredSQLite.ts`)

Two responsibilities:

**Write guard** — wraps the SQLite `store` operation. If the document content exceeds the tier limit, the write is silently skipped. The document stays at its last valid state in SQLite.

**Load-time truncation** — implemented in the `afterLoadDocument` hook. After the SQLite extension loads a document, `TieredSQLite` checks whether its content exceeds the tier limit. If it does:
1. The document is added to an in-memory `overLimitDocs` set.
2. `truncateYDocToLimit` walks the Yjs `XmlFragment` elements forward, finds the element that crosses the word/char boundary, and deletes everything from that element to the end in a single Yjs transaction.
3. The truncated Y.Doc is what gets synced to the client — the client never receives over-limit content.
4. Saves remain blocked for documents in `overLimitDocs` (write guard checks the set first) so the **full original content is preserved in SQLite**.

When the document is unloaded from memory (`afterUnloadDocument`), it is removed from `overLimitDocs`. The next load re-evaluates it against the then-current tier.

This means a tier upgrade takes effect automatically on the next document load (server restart or idle unload), without any data migration.

---

## Over-limit scenario (downgrade / tier change)

When a stored document exceeds the user's current tier limit — e.g. after a plan downgrade — the server truncates the in-memory document before sending it to the client. The user sees the first N words (up to their limit) with the standard "you've reached the limit" banner. Their full content is safe in SQLite and will be restored when they upgrade.

The client never receives over-limit content, so there is nothing to bypass on the frontend.

---

## Changing a limit

Edit both files and deploy.

```ts
// apps/web/app/lib/tiers.ts
// apps/server/src/tiers.ts  ← same change in both

export const TIERS = {
  local: { wordLimit: 1_000,    charLimit: 6_000 },
  sync:  { wordLimit: 2_000,    charLimit: 12_000 },
  full:  { wordLimit: 50_000, charLimit: 300_000 }, // hidden cap — not shown to the user, for stability
} as const
```

The counter UI and the 90% warning threshold are automatic — no other changes needed.

---

## Centralization

Limits live in two mirrored files. The comment `// Keep in sync with…` is the only guard — update both or the client and server will drift.
