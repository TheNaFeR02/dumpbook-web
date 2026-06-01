'use client'

import { useEffect, useState } from 'react'
import {
  HocuspocusProviderWebsocketComponent,
  HocuspocusRoom,
} from '@hocuspocus/provider-react'
import Editor from './components/Editor'
import { authClient } from './lib/auth-client'
import type { SubscriptionStatus } from './api/user/subscription-status/route'

export const STATUS_CACHE_KEY = 'dumpbook_sub_status'
export const WS_TOKEN_CACHE_KEY = 'dumpbook_ws_token'
const STATUS_CACHE_TTL_MS = 60 * 60 * 1000      // 1 hour
const WS_TOKEN_CACHE_TTL_MS = 50 * 60 * 1000    // 50 min (token valid 60 min)

function getCached<T>(key: string, userId: string | null, ttl: number): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const { ts, userId: cachedId, data } = JSON.parse(raw)
    if (cachedId !== userId) return null
    if (Date.now() - ts > ttl) return null
    return data as T
  } catch { return null }
}

function setCache(key: string, userId: string | null, data: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), userId, data }))
  } catch {}
}

export default function Home() {
  const { data: session, isPending } = authClient.useSession()
  const [roomName, setRoomName] = useState<string | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [wsToken, setWsToken] = useState<string | null>(null)

  useEffect(() => {
    if (isPending) return
    const userId = session?.user.id ?? null

    const cachedStatus = getCached<SubscriptionStatus>(STATUS_CACHE_KEY, userId, STATUS_CACHE_TTL_MS)
    const cachedToken = getCached<string>(WS_TOKEN_CACHE_KEY, userId, WS_TOKEN_CACHE_TTL_MS)

    if (cachedStatus) setSubscriptionStatus(cachedStatus)
    if (cachedToken) setWsToken(cachedToken)

    if (!cachedStatus) {
      fetch('/api/user/subscription-status')
        .then(r => r.json() as Promise<SubscriptionStatus>)
        .then(data => { setCache(STATUS_CACHE_KEY, userId, data); setSubscriptionStatus(data) })
        .catch(() => {
          setSubscriptionStatus({ tier: userId ? 'sync' : 'local', trialDaysLeft: null })
        })
    }

    if (!cachedToken) {
      fetch('/api/user/ws-token')
        .then(r => r.json() as Promise<{ token: string }>)
        .then(({ token }) => { setCache(WS_TOKEN_CACHE_KEY, userId, token); setWsToken(token) })
        .catch(() => {
          // If ws-token fetch fails, generate a fallback — server will reject it and
          // the client will retry on next page load. Better than blocking the editor forever.
          setWsToken('unavailable')
        })
    }
  }, [isPending, session?.user.id])

  useEffect(() => {
    if (isPending) return
    if (session?.user) {
      setRoomName(`user-${session.user.id}`)
    } else {
      let anonId = localStorage.getItem('dumpbook_anon_id')
      if (!anonId) {
        anonId = crypto.randomUUID()
        localStorage.setItem('dumpbook_anon_id', anonId)
      }
      setRoomName(`anon-${anonId}`)
    }
  }, [session, isPending])

  if (!roomName || !subscriptionStatus || !wsToken) return null

  return (
    <HocuspocusProviderWebsocketComponent key={roomName} url={process.env.NEXT_PUBLIC_HOCUSPOCUS_URL!}>
      <HocuspocusRoom name={roomName} token={wsToken}>
        <Editor session={session ?? null} subscriptionStatus={subscriptionStatus} />
      </HocuspocusRoom>
    </HocuspocusProviderWebsocketComponent>
  )
}
