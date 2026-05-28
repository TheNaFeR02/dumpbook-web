import { NextResponse } from "next/server"
import { auth, polarClient } from "@/app/lib/auth"
import { headers } from "next/headers"

const ANON_WORD_LIMIT = 1000
const SYNC_VISIBLE_WORDS = 2000

export type SubscriptionTier = "anonymous" | "trial" | "sync" | "full-archive"

export interface SubscriptionStatus {
    tier: SubscriptionTier
    trialDaysLeft: number | null
    anonWordLimit: number
    syncVisibleWords: number
}

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
        return NextResponse.json({
            tier: "anonymous",
            trialDaysLeft: null,
            anonWordLimit: ANON_WORD_LIMIT,
            syncVisibleWords: SYNC_VISIBLE_WORDS,
        } satisfies SubscriptionStatus)
    }

    try {
        const state = await polarClient.customers.getStateExternal({ externalId: session.user.id })
        // Only the first active subscription is checked; the product setup has a single plan.
        const activeSub = state.activeSubscriptions[0]

        if (activeSub) {
            if (activeSub.status === "trialing" && activeSub.trialEnd) {
                const msLeft = activeSub.trialEnd.getTime() - Date.now()
                const daysLeft = Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)))
                return NextResponse.json({
                    tier: "trial",
                    trialDaysLeft: daysLeft,
                    anonWordLimit: ANON_WORD_LIMIT,
                    syncVisibleWords: SYNC_VISIBLE_WORDS,
                } satisfies SubscriptionStatus)
            }

            return NextResponse.json({
                tier: "full-archive",
                trialDaysLeft: null,
                anonWordLimit: ANON_WORD_LIMIT,
                syncVisibleWords: SYNC_VISIBLE_WORDS,
            } satisfies SubscriptionStatus)
        }
    } catch {
        console.error('[subscription-status] Polar lookup failed for user', session.user.id)
    }

    return NextResponse.json({
        tier: "sync",
        trialDaysLeft: null,
        anonWordLimit: ANON_WORD_LIMIT,
        syncVisibleWords: SYNC_VISIBLE_WORDS,
    } satisfies SubscriptionStatus)
}
