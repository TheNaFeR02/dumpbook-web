import { polarClient } from './auth'
import type { TierName } from '../api/user/subscription-status/route'

export interface UserTier {
  tier: TierName
  trialDaysLeft: number | null
}

export async function resolveUserTier(userId: string): Promise<UserTier> {
  try {
    const state = await polarClient.customers.getStateExternal({ externalId: userId })
    const activeSub = 'activeSubscriptions' in state ? state.activeSubscriptions[0] : undefined

    if (activeSub) {
      if (activeSub.status === 'trialing' && activeSub.trialEnd) {
        const msLeft = activeSub.trialEnd.getTime() - Date.now()
        const daysLeft = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))
        return { tier: 'full', trialDaysLeft: daysLeft }
      }
      return { tier: 'full', trialDaysLeft: null }
    }
  } catch (err) {
    console.error('[subscription] resolveUserTier failed for', userId, err)
  }

  return { tier: 'sync', trialDaysLeft: null }
}
