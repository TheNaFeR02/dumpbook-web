'use client'

import { useEffect, useRef, useState } from 'react'
import { INIT_CACHE_KEY } from '../page'

type CheckoutState = 'idle' | 'loading' | 'checkout' | 'error' | 'success'

interface UpgradeModalProps {
  onClose: () => void
}

export default function UpgradeModal({ onClose }: UpgradeModalProps) {
  const [state, setState] = useState<CheckoutState>('idle')
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // /success page sends postMessage when the iframe lands there after payment.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'checkout_complete') setState('success')
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const handleUpgrade = async () => {
    setState('loading')
    try {
      const res = await fetch('/api/user/checkout', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create checkout session')
      const { checkoutUrl } = await res.json() as { checkoutUrl: string }
      setCheckoutUrl(checkoutUrl)
      setState('checkout')
    } catch {
      setState('error')
    }
  }

  if (state === 'checkout' && checkoutUrl) {
    return (
      <div className="checkout-modal">
        <div className="checkout-modal-inner">
          <div className="checkout-modal-header">
            <button
              className="modal-close"
              style={{ position: 'static' }}
              onClick={() => setState('idle')}
              aria-label="Back"
            >
              ←
            </button>
            <p className="checkout-modal-title">Dumpbook Full — 7-day trial</p>
            <div style={{ width: 28 }} />
          </div>
          <iframe
            ref={iframeRef}
            src={checkoutUrl}
            className="checkout-iframe"
            title="Checkout"
            allow="payment"
          />
          <p className="checkout-fallback">
            Having trouble?{' '}
            <a href={checkoutUrl} target="_blank" rel="noreferrer">
              Open in new tab →
            </a>
          </p>
        </div>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
          <p className="modal-title">You&apos;re all set!</p>
          <p className="modal-body">Dumpbook Full is now active. All writing limits are lifted.</p>
          <button className="btn-upgrade" onClick={() => {
            sessionStorage.removeItem(INIT_CACHE_KEY)
            window.location.reload()
          }}>Start writing</button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card upgrade-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        <p className="modal-title">Dumpbook Full</p>
        <p className="modal-body">Everything you need to dump and save your thoughts with practically no limits.</p>

        <div className="upgrade-tiers">
          <div className="upgrade-tier">
            <div className="upgrade-tier-row">
              <div>
                <p className="upgrade-tier-name">Local</p>
                <p className="upgrade-tier-detail">Local only · 1,000 words</p>
              </div>
              <p className="upgrade-tier-price">Free</p>
            </div>
          </div>
          <div className="upgrade-tier upgrade-tier--sync">
            <div className="upgrade-tier-row">
              <div>
                <p className="upgrade-tier-name">Sync</p>
                <p className="upgrade-tier-detail">Cloud sync · 2 devices · 2,000 words</p>
              </div>
              <p className="upgrade-tier-price">Free</p>
            </div>
          </div>
          <div className="upgrade-tier upgrade-tier--highlight">
            <div className="upgrade-tier-row">
              <div>
                <p className="upgrade-tier-name">
                  <svg className="upgrade-crown" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z"/>
                  </svg>
                  Dumpbook Full <span className="upgrade-trial-tag">7-day trial</span>
                </p>
                <p className="upgrade-tier-detail">Full history · 5 devices · Unlimited</p>
              </div>
              <p className="upgrade-tier-price">$4<span className="upgrade-tier-price-mo">/mo</span></p>
            </div>
          </div>
        </div>

        {state === 'error' && (
          <p className="checkout-error">Something went wrong. Please try again.</p>
        )}

        <p className="upgrade-hint">Start your 7-day trial.</p>
        <button
          className="btn-upgrade-close"
          onClick={handleUpgrade}
          disabled={state === 'loading'}
        >
          {state === 'loading' ? 'Loading…' : 'Upgrade'}
        </button>
      </div>
    </div>
  )
}
