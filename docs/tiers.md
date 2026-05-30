# Tier System

## Tier names

| Tier | When | Limits |
|---|---|---|
| `local` | Anonymous (not signed in) | 1,000 words / 6,000 chars |
| `sync` | Signed in (free) | 2,000 words / 12,000 chars |
| `full` | Paid subscription | Unlimited |

---

## Where limits live

Two files hold the same constants — one per app. Both must stay in sync.

| File | Used by |
|---|---|
| `apps/web/app/lib/tiers.ts` | Client-side editor (blocks input in real time) |
| `apps/server/src/tiers.ts` | Server-side storage guard + load-time truncation |

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

When a stored document exceeds the user's current tier limit — e.g. after a plan downgrade or a tier rename in code — the server truncates the in-memory document before sending it to the client. The user sees the first N words (up to their limit) with the standard "you've reached the limit" banner. Their full content is safe in SQLite and will be restored when they upgrade.

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
  full:  { wordLimit: Infinity, charLimit: Infinity },
} as const
```

The counter UI and the 90% warning threshold are automatic — no other changes needed.

---

## Adding a tier

1. Add the tier to both `tiers.ts` files.

2. Map documents to the new tier in `apps/server/src/tiers.ts`:

```ts
export function tierForDocument(documentName: string): TierName {
  if (documentName.startsWith("user-")) return "sync"
  return "local"
}
```

Mapping paid tiers (`full`) requires knowing the user's subscription at connection time. The `afterLoadDocument` payload includes `requestParameters` and `context` which can carry auth/subscription data passed at WebSocket connection time.

3. Update `apps/web/app/components/Editor.tsx` to resolve the correct tier from the session:

```ts
// today
const tier = (session ? 'sync' : 'local') as TierName

// with paid tiers, read subscription status from session or an API call
const tier = resolveClientTier(session) as TierName
```

---

## Centralization: current vs alternatives

### Current: two mirrored files

**Good for now because:**
- Zero build complexity — no shared package, no env parsing
- Each app is self-contained; the server can run without the web app
- Limits change rarely (business decision, not runtime data)

**Risk:** forgetting to update one of the two files. The comment `// Keep in sync with…` is the only guard.

---

### Option A — `packages/shared` workspace package

Create a single `@dumpbook/shared` package consumed by both apps.

```
packages/
  shared/
    src/tiers.ts   ← one source of truth
```

**Good when:** you have several shared constants and the cross-app duplication is growing.  
**Cost:** adds build-order complexity (shared package must compile before the apps) and requires configuring module resolution for both Next.js and the server's TypeScript build.

---

### Option B — Environment variables

Set `SYNC_WORD_LIMIT=2000` and read it at startup in both apps.

**Good when:** you want ops/product to change limits without a deploy.  
**Cost:** no compile-time safety; a typo silently sets the limit to `NaN`. Requires validation.

---

### Option C — Database-driven limits (most flexible)

Store tier definitions in the database. Each user row gets a `tier` column; the server reads limits from a `tiers` table at connection time.

**Good when:** limits change per-user (trials, promotions, grandfathered plans) or you want to update them without a deploy.  
**Cost:** highest complexity. Requires a database lookup on every store operation and a way to propagate tier changes to active connections.

---

## Recommendation

**Stay with two mirrored files until paid tiers are live.**

Once `full` tier is introduced via Polar billing, the server needs to resolve the user's subscription at connection time anyway. At that point, move `tierForDocument` to query the subscription status from the auth database — the added complexity is justified by the need for per-user tier resolution.
