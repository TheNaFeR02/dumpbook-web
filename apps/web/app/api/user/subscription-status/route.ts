import { NextResponse } from 'next/server'
import { auth } from '@/app/lib/auth'
import { headers } from 'next/headers'
import { resolveUserTier } from '@/app/lib/subscription'

export type TierName = 'local' | 'sync' | 'full'

export interface SubscriptionStatus {
  tier: TierName
  trialDaysLeft: number | null
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return NextResponse.json({ tier: 'local', trialDaysLeft: null } satisfies SubscriptionStatus)
  }

  const { tier, trialDaysLeft } = resolveUserTier(session.user.id)
  return NextResponse.json({ tier, trialDaysLeft } satisfies SubscriptionStatus)
}
