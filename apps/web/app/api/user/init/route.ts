import { NextResponse } from 'next/server'
import { auth } from '@/app/lib/auth'
import { headers } from 'next/headers'
import { resolveUserTier } from '@/app/lib/subscription'
import { signWsToken } from '@/app/lib/ws-token'
import type { SubscriptionStatus } from '../subscription-status/route'

export interface InitData {
  subscriptionStatus: SubscriptionStatus
  wsToken: string
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return NextResponse.json({
      subscriptionStatus: { tier: 'local', trialDaysLeft: null },
      wsToken: signWsToken('local'),
    } satisfies InitData)
  }

  const { tier, trialDaysLeft } = await resolveUserTier(session.user.id)
  return NextResponse.json({
    subscriptionStatus: { tier, trialDaysLeft },
    wsToken: signWsToken(tier),
  } satisfies InitData)
}
