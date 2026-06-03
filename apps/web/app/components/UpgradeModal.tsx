'use client'

import { useState } from 'react'

type CheckoutState = 'idle' | 'loading' | 'error'

interface UpgradeModalProps {
  onClose: () => void
}

export default function UpgradeModal({ onClose }: UpgradeModalProps) {
  const [state, setState] = useState<CheckoutState>('idle')

  const handleUpgrade = async () => {
    setState('loading')
    try {
      const res = await fetch('/api/user/checkout', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create checkout session')
      const { checkoutUrl } = await res.json() as { checkoutUrl: string }
      // Top-level redirect to Polar's hosted checkout. Polar returns the user
      // to /success, which reconciles the subscription and sends them home.
      window.location.href = checkoutUrl
    } catch {
      setState('error')
    }
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
