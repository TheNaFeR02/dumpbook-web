import { polarClient, db } from './auth'
import type { TierName } from '../api/user/subscription-status/route'

const CACHE_TTL_MS = 10 * 60 * 1000

export interface UserTier {
  tier: TierName
  trialDaysLeft: number | null
}

interface CacheRow {
  polarTier: string | null
  polarTierAt: number | null
}

export async function resolveUserTier(userId: string): Promise<UserTier> {
  const row = db
    .prepare('SELECT polarTier, polarTierAt FROM "user" WHERE id = ?')
    .get(userId) as CacheRow | undefined

  if (row?.polarTier && row.polarTierAt !== null && Date.now() - row.polarTierAt < CACHE_TTL_MS) {
    return { tier: row.polarTier as TierName, trialDaysLeft: null }
  }

  let result: UserTier = { tier: 'sync', trialDaysLeft: null }
  try {
    const state = await polarClient.customers.getStateExternal({ externalId: userId })
    const activeSub = 'activeSubscriptions' in state ? state.activeSubscriptions[0] : undefined

    if (activeSub) {
      if (activeSub.status === 'trialing' && activeSub.trialEnd) {
        const msLeft = activeSub.trialEnd.getTime() - Date.now()
        const daysLeft = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))
        result = { tier: 'full', trialDaysLeft: daysLeft }
      } else {
        result = { tier: 'full', trialDaysLeft: null }
      }
    }
  } catch (err) {
    console.error('[subscription] resolveUserTier failed for', userId, err)
    if (row?.polarTier) return { tier: row.polarTier as TierName, trialDaysLeft: null }
    return { tier: 'sync', trialDaysLeft: null }
  }

  db.prepare('UPDATE "user" SET polarTier = ?, polarTierAt = ? WHERE id = ?')
    .run(result.tier, Date.now(), userId)

  return result
}
