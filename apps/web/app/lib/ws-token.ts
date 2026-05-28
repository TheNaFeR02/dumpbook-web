import { createHmac, timingSafeEqual } from 'crypto'
import type { SubscriptionTier } from '../api/user/subscription-status/route'

const TOKEN_TTL_S = 60 * 60 // 1 hour

export function signWsToken(tier: SubscriptionTier): string {
    const secret = process.env.HOCUSPOCUS_SECRET
    const payload = JSON.stringify({ tier, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S })
    const b64 = Buffer.from(payload).toString('base64url')
    if (!secret) {
        // No secret configured — server runs with enforcement disabled and accepts this token as-is
        return `${b64}.nosig`
    }
    const sig = createHmac('sha256', secret).update(b64).digest('hex')
    return `${b64}.${sig}`
}

export function verifyWsToken(token: string): { tier: SubscriptionTier } | null {
    const secret = process.env.HOCUSPOCUS_SECRET
    if (!secret) return null
    try {
        const dot = token.indexOf('.')
        if (dot === -1) return null
        const b64 = token.slice(0, dot)
        const sig = token.slice(dot + 1)
        const expectedSig = createHmac('sha256', secret).update(b64).digest('hex')
        if (sig.length !== expectedSig.length) return null
        if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null
        const payload = JSON.parse(Buffer.from(b64, 'base64url').toString())
        if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
        return { tier: payload.tier as SubscriptionTier }
    } catch {
        return null
    }
}
