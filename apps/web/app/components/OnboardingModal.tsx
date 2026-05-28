'use client'

interface OnboardingModalProps {
  onClose: () => void
}

export default function OnboardingModal({ onClose }: OnboardingModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card onboarding-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        <p className="modal-title">Write freely. Review deeply.</p>
        <p className="modal-body">
          One document. Append anything. Come back to review.
        </p>

        <div className="onboarding-tiers">
          <div className="onboarding-tier">
            <p className="onboarding-tier-name">Anonymous</p>
            <p className="onboarding-tier-detail">Local only · 1,000 words</p>
          </div>
          <div className="onboarding-tier">
            <p className="onboarding-tier-name">Sync</p>
            <p className="onboarding-tier-detail">Cloud sync · 1 device · 2k visible</p>
          </div>
          <div className="onboarding-tier onboarding-tier--highlight">
            <p className="onboarding-tier-name">Full Archive <span className="onboarding-trial-tag">7-day trial</span></p>
            <p className="onboarding-tier-detail">Unlimited · 5 devices · full history</p>
          </div>
        </div>

        <p className="onboarding-hint">Sign in via the Sync button, then start your 7-day free trial.</p>
        <button className="btn-upgrade" onClick={onClose}>Start writing</button>
      </div>
    </div>
  )
}
