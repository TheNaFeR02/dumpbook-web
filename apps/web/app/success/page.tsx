'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { INIT_CACHE_KEY } from '../page'

function SuccessContent() {
  const params = useSearchParams()
  const router = useRouter()
  const checkoutId = params.get('checkout_id')

  useEffect(() => {
    if (!checkoutId) {
      router.replace('/')
      return
    }
    // Reconcile against Polar so the paid tier is live before the user heads
    // back, in case the webhook hasn't landed yet. Then drop the cached init so
    // the next load of "/" refetches the fresh tier.
    fetch('/api/user/sync-subscription', { method: 'POST' })
      .catch(() => {})
      .finally(() => {
        sessionStorage.removeItem(INIT_CACHE_KEY)
      })
  }, [checkoutId, router])

  if (!checkoutId) return null

  return (
    <main style={{ textAlign: 'center', paddingTop: '20vh', fontFamily: 'inherit' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Welcome to Dumpbook Full
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '0.25rem' }}>
        Your subscription is active. All writing limits are now lifted.
      </p>
      <p style={{ color: '#9ca3af', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
        Your full document history will appear after the next sync.
      </p>
      <a
        href="/"
        style={{
          display: 'inline-block',
          padding: '0.6rem 1.25rem',
          background: '#111',
          color: '#fff',
          borderRadius: '6px',
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}
      >
        Back to writing →
      </a>
    </main>
  )
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  )
}
