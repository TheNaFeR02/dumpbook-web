'use client'

import { useEffect, useState } from 'react'
import {
  HocuspocusProviderWebsocketComponent,
  HocuspocusRoom,
} from '@hocuspocus/provider-react'
import Editor from './components/Editor'
import { authClient } from './lib/auth-client'
import type { InitData } from './api/user/init/route'

export const INIT_CACHE_KEY = 'dumpbook_init'
const INIT_CACHE_TTL_MS = 50 * 60 * 1000    // 50 min (ws-token valid 60 min)

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
  const [subscriptionStatus, setSubscriptionStatus] = useState<InitData['subscriptionStatus'] | null>(null)
  const [wsToken, setWsToken] = useState<string | null>(null)

  useEffect(() => {
    if (isPending) return
    const userId = session?.user.id ?? null

    const cached = getCached<InitData>(INIT_CACHE_KEY, userId, INIT_CACHE_TTL_MS)

    if (cached) {
      setSubscriptionStatus(cached.subscriptionStatus)
      setWsToken(cached.wsToken)
      return
    }

    fetch('/api/user/init')
      .then(r => r.json() as Promise<InitData>)
      .then(data => {
        setCache(INIT_CACHE_KEY, userId, data)
        setSubscriptionStatus(data.subscriptionStatus)
        setWsToken(data.wsToken)
      })
      .catch(() => {
        setSubscriptionStatus({ tier: userId ? 'sync' : 'local', trialDaysLeft: null })
        setWsToken('unavailable')
      })
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
