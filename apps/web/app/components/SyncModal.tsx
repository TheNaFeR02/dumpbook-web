'use client'

import { authClient } from '../lib/auth-client'
import type { TierName } from '../lib/tiers'

type Session = NonNullable<ReturnType<typeof authClient.useSession>['data']>

const TIER_LABELS: Record<TierName, string> = {
  local: 'Local',
  sync: 'Sync',
  full: 'Full',
}

interface SyncModalProps {
  session: Session | null
  tier: TierName
  trialDaysLeft: number | null
  onClose: () => void
}

export default function SyncModal({ session, tier, trialDaysLeft, onClose }: SyncModalProps) {
  const handleSignIn = () => {
    authClient.signIn.social({ provider: 'google', callbackURL: "/" })
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        {session ? (
          <>
            <p className="modal-label">Signed in as</p>
            <p className="modal-name">{session.user.name}</p>
            <p className="modal-email">{session.user.email}</p>
            <div className="modal-plan">
              <span className="modal-plan-tier">
                {tier === 'full' && (
                  <svg className="modal-plan-crown" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
                  </svg>
                )}
                {TIER_LABELS[tier]} plan
              </span>
              {trialDaysLeft !== null && (
                <span className="modal-plan-trial">
                  Trial · {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left
                </span>
              )}
            </div>
            <button className="btn-signout" onClick={handleSignOut}>Sign out</button>
          </>
        ) : (
          <>
            <p className="modal-title">Sync your writing</p>
            <p className="modal-body">Sign in to keep your work across devices.</p>
            <button className="btn-google" onClick={handleSignIn}>Continue with Google</button>
          </>
        )}
      </div>
    </div>
  )
}
