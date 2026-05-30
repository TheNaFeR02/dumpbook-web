'use client'

import { authClient } from '../lib/auth-client'

type Session = NonNullable<ReturnType<typeof authClient.useSession>['data']>

interface SyncModalProps {
  session: Session | null
  onClose: () => void
}

export default function SyncModal({ session, onClose }: SyncModalProps) {
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
