# Billing Implementation

Four steps implemented to wire Polar billing into Dumpbook.

---

## Step 1 — Upgrade button & checkout flow

**What was built:**
- `POST /api/user/checkout` creates a Polar checkout session (using the SDK directly) and returns `{ checkoutUrl }`
- `UpgradeModal` has four states: `idle` → `loading` → `checkout` (iframe) → `success`
- The Polar checkout runs inside a dedicated iframe modal (not a page redirect)
- `/success?checkout_id=...` signals the parent via `postMessage({ type: 'checkout_complete' })`; without `checkout_id` it redirects to `/`

**Files:**
- `apps/web/app/api/user/checkout/route.ts`
- `apps/web/app/components/UpgradeModal.tsx`
- `apps/web/app/success/page.tsx`

---

## Step 2 — Subscription status API

**What was built:**
- `GET /api/user/subscription-status` returns `{ tier: 'local' | 'sync' | 'full', trialDaysLeft: number | null }`
- Queries Polar via `polarClient.customers.getStateExternal({ externalId: userId })`
- Maps `trialing` → `full` with `trialDaysLeft`, `active` → `full`, no subscription → `sync`
- Falls back to `sync` on any Polar error (never locks users out)
- Shared helper `resolveUserTier(userId)` in `apps/web/app/lib/subscription.ts` used by both API routes

**Files:**
- `apps/web/app/api/user/subscription-status/route.ts`
- `apps/web/app/lib/subscription.ts`

---

## Step 3 — Client tier resolution

**What was built:**
- `page.tsx` fetches subscription status and ws-token in parallel on load
- Both cached in `sessionStorage` keyed by `userId` (1 hr / 50 min TTL); sign-in/out invalidates automatically
- Editor only mounts once both are ready — `ContentLimit` is configured with correct limits from the start
- `full` tier: no word count bar, no Upgrade button
- `full` + trial: "Trial: Nd" badge in navbar
- Both caches cleared on checkout complete (UpgradeModal success + `/success` page)

**Files:**
- `apps/web/app/page.tsx`
- `apps/web/app/components/Editor.tsx`
- `apps/web/app/components/UpgradeModal.tsx` (cache clear + reload)
- `apps/web/app/success/page.tsx` (cache clear)

---

## Step 4 — Server-side enforcement

**What was built:**
- `apps/web/app/lib/ws-token.ts` signs `{ tier, exp }` with HMAC-SHA256 using `HOCUSPOCUS_SECRET`, TTL 1 hr
- `GET /api/user/ws-token` resolves the user's actual Polar tier and returns a signed token
- `page.tsx` passes `token={wsToken}` to `<HocuspocusRoom>`
- Server `onAuthenticate` verifies the signature and expiry; stores tier in `context.tier` and a shared `documentTiers` map; rejects invalid/expired tokens
- `TieredSQLite` write guard and `afterLoadDocument` use `context.tier → documentTiers → room-name fallback` in that order
- `full` users get the 50k-word hidden cap; `sync` users are still capped at 2k
- If `HOCUSPOCUS_SECRET` is not set (local dev without secrets), enforcement is disabled and room-name fallback is used

**Files:**
- `apps/web/app/lib/ws-token.ts`
- `apps/web/app/api/user/ws-token/route.ts`
- `apps/server/src/index.ts`
- `apps/server/src/extensions/TieredSQLite.ts`

---

## Testing workflows

### 1. Upgrade button

1. Sign in → confirm "Upgrade" button appears in the navbar
2. Click "Upgrade" → tier comparison modal opens
3. Click "Upgrade" button → brief loading state → Polar checkout opens in its own modal
4. Click "←" back button → returns to tier comparison, no broken state
5. Click "Open in new tab →" fallback link → Polar checkout opens in a new tab
6. Navigate to `/success` (no query param) → should redirect to `/`
7. Navigate to `/success?checkout_id=anything` → should show the success page with "Back to writing →"

---

### 2. Subscription status API

Open these URLs in the browser while watching the JSON response:

| State | URL | Expected |
|---|---|---|
| Signed out | `/api/user/subscription-status` | `{ "tier": "local", "trialDaysLeft": null }` |
| Signed in, no sub | `/api/user/subscription-status` | `{ "tier": "sync", "trialDaysLeft": null }` |
| Active trial | `/api/user/subscription-status` | `{ "tier": "full", "trialDaysLeft": 7 }` |
| Active paid | `/api/user/subscription-status` | `{ "tier": "full", "trialDaysLeft": null }` |

---

### 3. Client tier resolution

**Sync user (signed in, no subscription):**
- "Upgrade" button visible in navbar
- Word count bar visible at bottom
- Input blocked at 2,000 words

**Full user (active subscription):**
- No "Upgrade" button
- No word count bar
- Can write past 2,000 words without being blocked

**Trial user:**
- Same as full + "Trial: Nd" badge in navbar

**Cache behavior:**
- Open DevTools → Application → Session Storage
- After page load, `dumpbook_sub_status` and `dumpbook_ws_token` entries exist
- Reload the page → Network tab shows no calls to `/api/user/subscription-status` or `/api/user/ws-token` (served from cache)
- After checkout complete, both entries are cleared and re-fetched on next load

---

### 4. Server-side enforcement

**Confirm full tier saves past 2k words:**
1. Subscribe (or use an active sandbox subscription)
2. Write past 2,000 words
3. Reload the page → content is preserved (server accepted the save)

**Confirm sync tier is blocked past 2k words:**
1. Cancel the sandbox subscription (or use a different account with no subscription)
2. Clear sessionStorage to force a fresh tier fetch
3. Write up to 2,000 words — works
4. Try to write more — client blocks input (ContentLimit)
5. Open server logs → should see `[storage] Rejected user-xxx: exceeds sync tier limits` if somehow a save was attempted

**Confirm invalid token is rejected:**
1. Open DevTools → Application → Session Storage
2. Edit `dumpbook_ws_token` → corrupt the token value
3. Reload → server rejects the token → client gets disconnected → the page falls back to `'unavailable'` token and the editor shows a disconnected state
4. A fresh page reload fetches a valid token and reconnects

---

### 5. End-to-end checkout flow

1. Sign in with a fresh account (no Polar subscription)
2. Confirm tier = `sync` (Upgrade button visible, 2k word limit)
3. Click Upgrade → complete Polar sandbox checkout
4. UpgradeModal shows "You're all set!" → click "Start writing"
5. Page reloads → editor loads as `full` tier (no Upgrade button, no word count bar)
6. Write past 2,000 words → verify content is saved across page reloads
