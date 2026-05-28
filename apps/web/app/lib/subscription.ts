import { polarClient } from './auth'
import type { SubscriptionTier } from '../api/user/subscription-status/route'

// Only the first active subscription is inspected; multiple concurrent subscriptions
// are not supported and not expected with the current single-product setup.
export async function resolveUserTier(userId: string): Promise<SubscriptionTier> {
    try {
        const state = await polarClient.customers.getStateExternal({ externalId: userId })
        const activeSub = state.activeSubscriptions[0]
        if (activeSub) {
            if (activeSub.status === 'trialing' && activeSub.trialEnd) {
                return 'trial'
            }
            return 'full-archive'
        }
    } catch {}
    return 'sync'
}
