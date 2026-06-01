import { createHmac } from 'crypto'
import env from './env'
import type { TierName } from '../api/user/subscription-status/route'

const TOKEN_TTL_S = 60 * 60 // 1 hour

export function signWsToken(tier: TierName): string {
  const payload = JSON.stringify({ tier, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S })
  const b64 = Buffer.from(payload).toString('base64url')
  const sig = createHmac('sha256', env.HOCUSPOCUS_SECRET).update(b64).digest('hex')
  return `${b64}.${sig}`
}
