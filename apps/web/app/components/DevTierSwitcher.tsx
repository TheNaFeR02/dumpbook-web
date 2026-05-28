'use client'

import { useState } from 'react'
import type { SubscriptionStatus } from '../api/user/subscription-status/route'

const STATUS_CACHE_KEY = 'dumpbook_sub_status'
const WS_TOKEN_CACHE_KEY = 'dumpbook_ws_token'

function setMockStatus(data: SubscriptionStatus) {
  // Preserve the userId from the existing entry so the new mock passes the user-ID cache check
  const existingRaw = sessionStorage.getItem(STATUS_CACHE_KEY)
  const userId = existingRaw ? (JSON.parse(existingRaw).userId ?? null) : null
  sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify({ ts: Date.now(), userId, data }))
  sessionStorage.removeItem(WS_TOKEN_CACHE_KEY) // force fresh token on reload
  window.location.reload()
}

function resetAll() {
  sessionStorage.removeItem(STATUS_CACHE_KEY)
  sessionStorage.removeItem(WS_TOKEN_CACHE_KEY)
  localStorage.removeItem('dumpbook_visited')
  localStorage.removeItem('dumpbook_anon_id')
  window.location.reload()
}

const TIERS: { label: string; data: SubscriptionStatus }[] = [
  {
    label: 'Anonymous',
    data: { tier: 'anonymous', trialDaysLeft: null, anonWordLimit: 1000, syncVisibleWords: 2000 },
  },
  {
    label: 'Sync',
    data: { tier: 'sync', trialDaysLeft: null, anonWordLimit: 1000, syncVisibleWords: 2000 },
  },
  {
    label: 'Trial (7d)',
    data: { tier: 'trial', trialDaysLeft: 7, anonWordLimit: 1000, syncVisibleWords: 2000 },
  },
  {
    label: 'Trial (1d)',
    data: { tier: 'trial', trialDaysLeft: 1, anonWordLimit: 1000, syncVisibleWords: 2000 },
  },
  {
    label: 'Full Archive',
    data: { tier: 'full-archive', trialDaysLeft: null, anonWordLimit: 1000, syncVisibleWords: 2000 },
  },
]

export default function DevTierSwitcher() {
  const [open, setOpen] = useState(false)

  const currentRaw = typeof window !== 'undefined' ? sessionStorage.getItem(STATUS_CACHE_KEY) : null
  const currentTier = currentRaw ? (JSON.parse(currentRaw).data as SubscriptionStatus).tier : 'live'

  return (
    <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 9999, fontFamily: 'monospace' }}>
      {open && (
        <div style={{
          marginBottom: '0.5rem',
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '0.75rem',
          minWidth: '180px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          <p style={{ color: '#888', fontSize: '0.65rem', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Dev · Tier Override
          </p>
          <p style={{ color: '#aaa', fontSize: '0.7rem', margin: '0 0 0.6rem' }}>
            Active: <span style={{ color: '#6ee7b7' }}>{currentTier}</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.6rem' }}>
            {TIERS.map(({ label, data }) => (
              <button
                key={label}
                onClick={() => setMockStatus(data)}
                style={{
                  background: currentTier === data.tier ? '#2a2a2a' : 'transparent',
                  border: `1px solid ${currentTier === data.tier ? '#555' : '#333'}`,
                  color: currentTier === data.tier ? '#fff' : '#aaa',
                  borderRadius: '4px',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #333', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <button
              onClick={() => { sessionStorage.removeItem(STATUS_CACHE_KEY); sessionStorage.removeItem(WS_TOKEN_CACHE_KEY); window.location.reload() }}
              style={{ background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer', textAlign: 'left' }}
            >
              Use live API
            </button>
            <button
              onClick={() => { localStorage.removeItem('dumpbook_visited'); window.location.reload() }}
              style={{ background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer', textAlign: 'left' }}
            >
              Reset onboarding
            </button>
            <button
              onClick={resetAll}
              style={{ background: 'transparent', border: '1px solid #553333', color: '#f87171', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer', textAlign: 'left' }}
            >
              Reset everything
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          color: '#6ee7b7',
          borderRadius: '6px',
          padding: '0.35rem 0.6rem',
          fontSize: '0.7rem',
          cursor: 'pointer',
          display: 'block',
          marginLeft: 'auto',
        }}
      >
        {open ? '✕ dev' : '⚙ dev'}
      </button>
    </div>
  )
}
