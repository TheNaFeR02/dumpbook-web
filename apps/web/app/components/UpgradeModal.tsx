'use client'

interface UpgradeModalProps {
  onClose: () => void
}

export default function UpgradeModal({ onClose }: UpgradeModalProps) {
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
                <p className="upgrade-tier-name"><img src="/crown.svg" alt="" className="upgrade-crown" />Dumpbook Full <span className="upgrade-trial-tag">7-day trial</span></p>
                <p className="upgrade-tier-detail">Full history · 5 devices · Unlimited</p>
              </div>
              <p className="upgrade-tier-price">$4<span className="upgrade-tier-price-mo">/mo</span></p>
            </div>
          </div>
        </div>

        <p className="upgrade-hint">Start your 7-day trial.</p>
        <button className="btn-upgrade-close" onClick={onClose}>Upgrade</button>
      </div>
    </div>
  )
}
