'use client'

import { useEffect, useState } from 'react'
import {
  HocuspocusProviderWebsocketComponent,
  HocuspocusRoom,
} from '@hocuspocus/provider-react'
import Editor from './components/Editor'
import OnboardingModal from './components/OnboardingModal'
import DevTierSwitcher from './components/DevTierSwitcher'
import { authClient } from './lib/auth-client'
import type { SubscriptionStatus } from './api/user/subscription-status/route'

export const STATUS_CACHE_KEY = 'dumpbook_sub_status'
export const WS_TOKEN_CACHE_KEY = 'dumpbook_ws_token'
const STATUS_CACHE_TTL_MS = 60 * 60 * 1000  // 1 hour
const WS_TOKEN_CACHE_TTL_MS = 50 * 60 * 1000 // 50 min (token valid for 60)

// Each cache entry is keyed by userId so a stale anonymous entry is never
// served to a signed-in user (and vice-versa after sign-out).
function getCachedStatus(userId: string | null): SubscriptionStatus | null {
  try {
    const raw = sessionStorage.getItem(STATUS_CACHE_KEY)
    if (!raw) return null
    const { ts, userId: cachedId, data } = JSON.parse(raw)
    if (cachedId !== userId) return null
    if (Date.now() - ts > STATUS_CACHE_TTL_MS) return null
    return data
  } catch {
    return null
  }
}

function setCachedStatus(userId: string | null, data: SubscriptionStatus) {
  try {
    sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify({ ts: Date.now(), userId, data }))
  } catch {}
}

function getCachedWsToken(userId: string | null): string | null {
  try {
    const raw = sessionStorage.getItem(WS_TOKEN_CACHE_KEY)
    if (!raw) return null
    const { ts, userId: cachedId, token } = JSON.parse(raw)
    if (cachedId !== userId) return null
    if (Date.now() - ts > WS_TOKEN_CACHE_TTL_MS) return null
    return token as string
  } catch {
    return null
  }
}

function setCachedWsToken(userId: string | null, token: string) {
  try {
    sessionStorage.setItem(WS_TOKEN_CACHE_KEY, JSON.stringify({ ts: Date.now(), userId, token }))
  } catch {}
}

export default function Home() {
  const { data: session, isPending } = authClient.useSession()
  const [roomName, setRoomName] = useState<string | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [wsToken, setWsToken] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // First-visit onboarding
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem('dumpbook_visited')) {
      setShowOnboarding(true)
    }
  }, [])

  const handleOnboardingClose = () => {
    localStorage.setItem('dumpbook_visited', '1')
    setShowOnboarding(false)
  }

  // Fetch subscription status + ws-token (both cached per userId)
  useEffect(() => {
    if (isPending) return

    const userId = session?.user.id ?? null

    const cachedStatus = getCachedStatus(userId)
    const cachedToken = getCachedWsToken(userId)

    if (cachedStatus) setSubscriptionStatus(cachedStatus)
    if (cachedToken) setWsToken(cachedToken)
    if (cachedStatus && cachedToken) return

    if (!cachedStatus) {
      fetch('/api/user/subscription-status')
        .then(r => r.json() as Promise<SubscriptionStatus>)
        .then(data => { setCachedStatus(userId, data); setSubscriptionStatus(data) })
        .catch(err => console.error('[page] subscription-status fetch failed', err))
    }

    if (!cachedToken) {
      fetch('/api/user/ws-token')
        .then(r => r.json() as Promise<{ token: string }>)
        .then(({ token }) => { setCachedWsToken(userId, token); setWsToken(token) })
        .catch(err => console.error('[page] ws-token fetch failed', err))
    }
  }, [isPending, session?.user.id])

  // Determine room name
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

  if (!roomName || !wsToken) return null

  return (
    <>
      <HocuspocusProviderWebsocketComponent key={roomName} url={process.env.NEXT_PUBLIC_HOCUSPOCUS_URL!}>
        <HocuspocusRoom name={roomName} token={wsToken}>
          <Editor session={session ?? null} subscriptionStatus={subscriptionStatus} />
        </HocuspocusRoom>
      </HocuspocusProviderWebsocketComponent>

      {showOnboarding && (
        <OnboardingModal onClose={handleOnboardingClose} />
      )}

      {process.env.NODE_ENV === 'development' && <DevTierSwitcher />}
    </>
  )
}
