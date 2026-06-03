import { NextResponse } from 'next/server'
import { auth, polarClient } from '@/app/lib/auth'
import { headers } from 'next/headers'
import { mapPolarSubscription, resolveUserTier, upsertSubscription } from '@/app/lib/subscription'
import type { SubscriptionStatus } from '../subscription-status/route'

// Webhooks are the source of truth, but they can land a beat after the user is
// redirected back from checkout. This endpoint does a one-off reconcile against
// Polar so the paid tier shows up immediately. Safe to call any time.
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const state = await polarClient.customers.getStateExternal({ externalId: userId })
    const activeSub = 'activeSubscriptions' in state ? state.activeSubscriptions[0] : undefined
    if (activeSub) {
      upsertSubscription(mapPolarSubscription(activeSub, userId, false))
    }
  } catch (err) {
    console.error('[sync-subscription] reconcile failed for', userId, err)
  }

  const { tier, trialDaysLeft } = resolveUserTier(userId)
  return NextResponse.json({ tier, trialDaysLeft } satisfies SubscriptionStatus)
}
