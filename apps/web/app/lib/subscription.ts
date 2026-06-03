import { db } from './db'
import type { TierName } from '../api/user/subscription-status/route'

const DAY_MS = 1000 * 60 * 60 * 24

// Polar subscription statuses that grant the paid ("full") tier.
// `past_due` is included as a grace period — Polar retries payment and fires
// `subscription.revoked` once it gives up, which flips `revoked` and drops access.
const ENTITLING_STATUSES = new Set(['trialing', 'active', 'past_due'])

export interface UserTier {
  tier: TierName
  trialDaysLeft: number | null
}

// Minimal shape shared by the webhook `Subscription` payload and the
// `CustomerStateSubscription` returned by the Polar customer-state API.
export interface PolarSubscriptionLike {
  id: string
  status: string
  productId: string
  currentPeriodEnd: Date
  trialEnd: Date | null
  endsAt: Date | null
  cancelAtPeriodEnd: boolean
  createdAt: Date
  modifiedAt: Date | null
}

export interface SubscriptionInput {
  userId: string
  subscriptionId: string
  status: string
  productId: string | null
  currentPeriodEnd: number | null
  trialEnd: number | null
  endsAt: number | null
  cancelAtPeriodEnd: boolean
  eventTime: number
  revoked: boolean
}

interface SubscriptionRow {
  userId: string
  subscriptionId: string
  status: string
  productId: string | null
  currentPeriodEnd: number | null
  trialEnd: number | null
  endsAt: number | null
  cancelAtPeriodEnd: number
  revoked: number
  modifiedAt: number
}

export function mapPolarSubscription(
  data: PolarSubscriptionLike,
  userId: string,
  revoked: boolean,
): SubscriptionInput {
  return {
    userId,
    subscriptionId: data.id,
    status: data.status,
    productId: data.productId ?? null,
    currentPeriodEnd: data.currentPeriodEnd ? data.currentPeriodEnd.getTime() : null,
    trialEnd: data.trialEnd ? data.trialEnd.getTime() : null,
    endsAt: data.endsAt ? data.endsAt.getTime() : null,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    // modifiedAt is null on creation; fall back to createdAt for ordering.
    eventTime: (data.modifiedAt ?? data.createdAt).getTime(),
    revoked,
  }
}

const upsertStmt = db.prepare(`
  INSERT INTO subscription
    (userId, subscriptionId, status, productId, currentPeriodEnd, trialEnd, endsAt, cancelAtPeriodEnd, revoked, modifiedAt)
  VALUES
    (@userId, @subscriptionId, @status, @productId, @currentPeriodEnd, @trialEnd, @endsAt, @cancelAtPeriodEnd, @revoked, @modifiedAt)
  ON CONFLICT(userId) DO UPDATE SET
    subscriptionId    = excluded.subscriptionId,
    status            = excluded.status,
    productId         = excluded.productId,
    currentPeriodEnd  = excluded.currentPeriodEnd,
    trialEnd          = excluded.trialEnd,
    endsAt            = excluded.endsAt,
    cancelAtPeriodEnd = excluded.cancelAtPeriodEnd,
    revoked           = excluded.revoked,
    modifiedAt        = excluded.modifiedAt
`)

const getRowStmt = db.prepare('SELECT * FROM subscription WHERE userId = ?')

/**
 * Upsert the local subscription mirror for a user.
 *
 * Webhooks can arrive out of order or be redelivered, so we ignore any event
 * that is older than the one we already stored (per user, monotonic by
 * modifiedAt). A genuine resubscribe always has a later timestamp than the old
 * subscription's final event, so it still wins.
 */
export function upsertSubscription(input: SubscriptionInput): void {
  const existing = getRowStmt.get(input.userId) as SubscriptionRow | undefined
  if (existing && input.eventTime < existing.modifiedAt) return

  upsertStmt.run({
    userId: input.userId,
    subscriptionId: input.subscriptionId,
    status: input.status,
    productId: input.productId,
    currentPeriodEnd: input.currentPeriodEnd,
    trialEnd: input.trialEnd,
    endsAt: input.endsAt,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ? 1 : 0,
    revoked: input.revoked ? 1 : 0,
    modifiedAt: input.eventTime,
  })
}

export function resolveUserTier(userId: string): UserTier {
  const row = getRowStmt.get(userId) as SubscriptionRow | undefined
  if (!row) return { tier: 'sync', trialDaysLeft: null }

  // Access explicitly revoked by Polar (final payment failure, refund, etc.).
  if (row.revoked) return { tier: 'sync', trialDaysLeft: null }

  const now = Date.now()

  // A scheduled end has passed but a follow-up webhook hasn't landed yet:
  // time wins so we never grant access past the paid window.
  if (row.endsAt !== null && row.endsAt <= now) return { tier: 'sync', trialDaysLeft: null }

  const entitledByStatus = ENTITLING_STATUSES.has(row.status)
  // Canceled-at-period-end: status may already read `canceled`, but the user
  // keeps full access until the current period ends.
  const inPaidWindow =
    row.cancelAtPeriodEnd && row.currentPeriodEnd !== null && row.currentPeriodEnd > now

  if (!entitledByStatus && !inPaidWindow) return { tier: 'sync', trialDaysLeft: null }

  if (row.status === 'trialing' && row.trialEnd !== null) {
    const daysLeft = Math.ceil((row.trialEnd - now) / DAY_MS)
    return { tier: 'full', trialDaysLeft: daysLeft > 0 ? daysLeft : null }
  }

  return { tier: 'full', trialDaysLeft: null }
}

// --- Webhook handlers wired into the Polar plugin in auth.ts ---------------

interface SubscriptionWebhookPayload {
  data: PolarSubscriptionLike & { customer: { externalId?: string | null } }
}

function handle(payload: SubscriptionWebhookPayload, revoked: boolean): void {
  const data = payload.data
  const userId = data.customer?.externalId
  if (!userId) {
    console.warn('[subscription] webhook for subscription', data.id, 'has no customer.externalId; skipping')
    return
  }
  try {
    upsertSubscription(mapPolarSubscription(data, userId, revoked))
  } catch (err) {
    console.error('[subscription] failed to persist webhook for', data.id, err)
  }
}

export const subscriptionWebhookHandlers = {
  onSubscriptionCreated: async (p: SubscriptionWebhookPayload) => handle(p, false),
  onSubscriptionUpdated: async (p: SubscriptionWebhookPayload) => handle(p, false),
  onSubscriptionActive: async (p: SubscriptionWebhookPayload) => handle(p, false),
  onSubscriptionCanceled: async (p: SubscriptionWebhookPayload) => handle(p, false),
  onSubscriptionUncanceled: async (p: SubscriptionWebhookPayload) => handle(p, false),
  // Authoritative "access ends now" signal from Polar.
  onSubscriptionRevoked: async (p: SubscriptionWebhookPayload) => handle(p, true),
}
