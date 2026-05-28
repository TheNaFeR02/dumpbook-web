'use client'

import { authClient, startCheckout } from '../lib/auth-client'
import type { SubscriptionStatus } from '../api/user/subscription-status/route'

type Session = NonNullable<ReturnType<typeof authClient.useSession>['data']>

interface SyncModalProps {
  session: Session | null
  subscriptionStatus: SubscriptionStatus | null
  onClose: () => void
}

export default function SyncModal({ session, subscriptionStatus, onClose }: SyncModalProps) {
  const handleSignIn = () => {
    authClient.signIn.social({ provider: 'google', callbackURL: window.location.href })
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    onClose()
  }

  const handleUpgrade = () => startCheckout('full-archive')

  const handleManageBilling = () => {
    window.location.href = '/api/auth/customer/portal'
  }

  const tier = subscriptionStatus?.tier ?? 'anonymous'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        {session ? (
          <>
            <p className="modal-label">Signed in as</p>
            <p className="modal-name">{session.user.name}</p>
            <p className="modal-email">{session.user.email}</p>

            <div className="modal-divider" />

            {tier === 'full-archive' && (
              <div className="modal-tier-row">
                <span className="modal-tier-badge modal-tier-badge--pro">Full Archive ✓</span>
                <button className="btn-billing" onClick={handleManageBilling}>Manage billing</button>
              </div>
            )}

            {tier === 'trial' && (
              <div className="modal-tier-row">
                <span className="modal-tier-badge">
                  Trial — <strong>{subscriptionStatus?.trialDaysLeft} day{subscriptionStatus?.trialDaysLeft !== 1 ? 's' : ''} left</strong>
                </span>
                <button className="btn-billing" onClick={handleManageBilling}>Manage billing</button>
              </div>
            )}

            {tier === 'sync' && (
              <>
                <p className="modal-tier-info modal-tier-info--muted">Dumpbook Sync</p>
                <button className="btn-upgrade" onClick={handleUpgrade}>
                  Start free trial
                </button>
              </>
            )}

            <button className="btn-signout" onClick={handleSignOut}>Sign out</button>
          </>
        ) : (
          <>
            <p className="modal-title">Sync your writing</p>
            <p className="modal-body">Sign in to keep your work across devices.</p>
            <p className="modal-trial-hint">Sign in, then start a 7-day free trial</p>
            <button className="btn-google" onClick={handleSignIn}>Continue with Google</button>
          </>
        )}
      </div>
    </div>
  )
}
