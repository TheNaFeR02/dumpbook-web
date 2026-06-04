'use client'

import { useState, useEffect, useRef } from 'react'
import {
  useHocuspocusAwareness,
  useHocuspocusConnectionStatus,
  useHocuspocusEvent,
  useHocuspocusProvider,
} from '@hocuspocus/provider-react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import Collaboration from '@tiptap/extension-collaboration'
import { StarterKit } from '@tiptap/starter-kit'
import { authClient } from '../lib/auth-client'
import { TIERS, type TierName } from '../lib/tiers'
import { ContentLimit, type ContentLimitStorage } from '../lib/extensions/ContentLimit'
import SyncModal from './SyncModal'
import UpgradeModal from './UpgradeModal'
import EditorPlaceholder from './EditorPlaceholder'
import type { SubscriptionStatus } from '../api/user/subscription-status/route'

type Session = NonNullable<ReturnType<typeof authClient.useSession>['data']>

interface EditorProps {
  session: Session | null
  subscriptionStatus: SubscriptionStatus | null
}

export default function Editor({ session, subscriptionStatus }: EditorProps) {
  const provider = useHocuspocusProvider()
  const status = useHocuspocusConnectionStatus()
  const users = useHocuspocusAwareness()
  const [showModal, setShowModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  // Collapse the document title once the user scrolls into the text, so the
  // editor reclaims that vertical space. Hysteresis avoids threshold flicker.
  const [titleCollapsed, setTitleCollapsed] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  // The inline script in layout.tsx sets data-theme before paint; sync our
  // state to it on mount so the toggle reflects the active theme.
  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme')
    if (current === 'dark' || current === 'light') setTheme(current)
  }, [])

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      try { localStorage.setItem('dumpbook-theme', next) } catch {}
      return next
    })
  }

  // Redirect to the Polar-hosted customer portal so the user can manage or
  // cancel their subscription. The better-auth endpoint returns the URL as
  // JSON (it doesn't issue an HTTP redirect), so we navigate to it ourselves.
  const openPortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/auth/customer/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = await res.json()
      if (data?.url) {
        window.location.href = data.url
        return
      }
      console.error('[portal] no url in response', data)
    } catch (err) {
      console.error('[portal] failed to open customer portal', err)
    } finally {
      setPortalLoading(false)
    }
  }

  // Close the settings dropdown on outside click.
  useEffect(() => {
    if (!showSettings) return
    const onClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showSettings])

  const tier = (subscriptionStatus?.tier ?? (session ? 'sync' : 'local')) as TierName
  const limits = TIERS[tier]

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: provider.document }),
      ContentLimit.configure(limits),
    ],
  })

  const counts = useEditorState({
    editor,
    selector: (ctx) => {
      const storage = ctx.editor?.storage as unknown as { contentLimit: ContentLimitStorage } | undefined
      return {
        wordCount: storage?.contentLimit.wordCount ?? 0,
        charCount: storage?.contentLimit.charCount ?? 0,
        isEmpty: ctx.editor?.isEmpty ?? true,
      }
    },
  })

  // Show a loader until the initial document state has synced from the server,
  // so the editor doesn't flash in empty before the content arrives.
  const [synced, setSynced] = useState(() => provider.synced)
  useHocuspocusEvent('synced', () => setSynced(true))

  // Safety valve: never trap the user behind an infinite spinner if the synced
  // event is missed or the connection stalls.
  const [waitTimedOut, setWaitTimedOut] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setWaitTimedOut(true), 8000)
    return () => clearTimeout(t)
  }, [])

  const isLoadingContent = !synced && status !== 'disconnected' && !waitTimedOut

  const wsConnectedRef = useRef(false)

  useEffect(() => {
    try {
      const m = performance.measure('editor-mounted', 'db:page-mount', 'db:data-ready')
      if (process.env.NODE_ENV === 'development') console.log(`[perf] editor mounted: ${m.duration.toFixed(1)}ms`)
    } catch {}
  }, [])

  useEffect(() => {
    if (status !== 'connected' || wsConnectedRef.current) return
    wsConnectedRef.current = true
    try {
      performance.mark('db:ws-connected')
      const m = performance.measure('ws-connected', 'db:page-mount', 'db:ws-connected')
      if (process.env.NODE_ENV === 'development') console.log(`[perf] WebSocket connected: ${m.duration.toFixed(1)}ms`)
    } catch {}
  }, [status])

  // Over-limit state is derived entirely client-side from the current tier.
  // The server never truncates or flags the document, so an upgrade/downgrade
  // simply takes effect on the next connection — no stale server state to clear.
  // Editing stays possible while over limit: the ContentLimit extension blocks
  // additions but allows deletions, so the user can trim back under their cap.
  const isAtLimit =
    counts.wordCount >= limits.wordLimit || counts.charCount >= limits.charLimit

  return (
    <div className="editor-wrapper">
      <header className="navbar">
        <div>
          <span className="status-dot" data-status={status} />
          <span className="status-text">{users.length} online</span>
        </div>
        <div className="navbar-right">
          {tier === 'sync' && (
            <button className="btn-upgrade" onClick={() => setShowUpgradeModal(true)}>
              Upgrade
            </button>
          )}
          {tier === 'full' && (
            <span className="full-crown" title="Dumpbook Full" aria-label="Dumpbook Full">
              <svg className="upgrade-crown" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
              </svg>
            </span>
          )}
          {tier === 'full' && subscriptionStatus?.trialDaysLeft !== null && subscriptionStatus?.trialDaysLeft !== undefined && (
            <span className="trial-badge">Trial: {subscriptionStatus.trialDaysLeft}d</span>
          )}
          <button
            className={`btn-sync ${session ? 'btn-sync--in' : ''}`}
            onClick={() => setShowModal(true)}
          >
            {session ? session.user.name.split(' ')[0] : 'Sync'}
          </button>
          <div className="settings-menu" ref={settingsRef}>
            <button
              type="button"
              className="settings-trigger"
              aria-label="Settings"
              aria-haspopup="menu"
              aria-expanded={showSettings}
              onClick={() => setShowSettings((s) => !s)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32">
                <g className="gear-wrap">
                  <rect width="32" height="32" fill="transparent" />
                  <path fill="#b6b5b5" fillRule="evenodd" d="M13.003,29.003v-4h-2v2h-4v-2h-2v-4h2v-2h-4v-6h4v-2h-2v-4h2v-2h4v2h2v-4h6v4h2v-2h4v2h2v4h-2v2h4v6h-4v2h2v4h-2v2h-4v-2h-2v4H13.003z M20.003,20.003v-7.999h-8.001v7.999H20.003z" clipRule="evenodd" />
                  <path fill="#706d67" fillRule="evenodd" d="M13.003,23.003v-2h-2v-2h-2v-6h2v-2h2v-2h6v2h2v2h2v6h-2v2h-2v2H13.003z M19.003,19.003v-5.999h-6.001v5.999H19.003z" clipRule="evenodd" />
                </g>
              </svg>
            </button>
            {showSettings && (
              <div className="settings-dropdown" role="menu">
                {session ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="settings-item"
                    onClick={openPortal}
                    disabled={portalLoading}
                  >
                    {portalLoading ? 'Opening…' : 'Subscription'}
                  </button>
                ) : (
                  <span className="settings-empty">Sign in to manage your subscription</span>
                )}
                <div className="settings-divider" />
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={theme === 'dark'}
                  className="settings-item settings-item--toggle"
                  onClick={toggleTheme}
                >
                  <span>Dark mode</span>
                  <span className={`theme-switch ${theme === 'dark' ? 'theme-switch--on' : ''}`} aria-hidden="true">
                    <span className="theme-switch-knob" />
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Document title — collapses on scroll so the editor reclaims the space. */}
      <div className={`db-doc-head ${titleCollapsed ? 'db-doc-head--collapsed' : ''}`}>
        <svg
          className="db-doc-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        {/* <span className="db-hash" aria-hidden="true">#</span> */}
        <span>Dumpbook</span>
      </div>

      <div
        className="editor-scroll-area"
        data-loading={isLoadingContent ? '' : undefined}
        onClick={(e) => { if (e.target === e.currentTarget) editor?.commands.focus('end') }}
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop
          setTitleCollapsed((prev) => (prev ? top > 8 : top > 28))
        }}
      >
        <EditorContent editor={editor} className="editor-content" />
        {!isLoadingContent && counts.isEmpty && <EditorPlaceholder />}
        {isLoadingContent && (
          <div className="editor-loading" role="status" aria-live="polite">
            <span className="editor-spinner" aria-hidden="true" />
            <span className="editor-loading-text">Loading your dumpbook…</span>
          </div>
        )}
      </div>

      {isAtLimit && (
        <div className="editor-limit-banner">
          {tier === 'local' ? (
            <>
              You&apos;ve reached the {limits.wordLimit.toLocaleString()}-word limit.
              <button onClick={() => setShowModal(true)}>Sign in to keep dumping</button>
            </>
          ) : tier === 'sync' ? (
            <>
              You&apos;ve reached the {limits.wordLimit.toLocaleString()}-word limit.
              <button onClick={() => setShowUpgradeModal(true)}>Upgrade to keep dumping.</button>
            </>
          ) : (
            <>
              You&apos;ve reached the maximum document size.
            </>
          )}
        </div>
      )}

      {tier !== 'full' && !isLoadingContent && (
        <div className="content-limit-bar">
          <span className={counts.wordCount >= limits.wordLimit * 0.9 ? 'limit-warning' : ''}>
            {counts.wordCount.toLocaleString()} / {limits.wordLimit.toLocaleString()} words
          </span>
          <span className="limit-separator">·</span>
          <span className={counts.charCount >= limits.charLimit * 0.9 ? 'limit-warning' : ''}>
            {counts.charCount.toLocaleString()} / {limits.charLimit.toLocaleString()} characters
          </span>
        </div>
      )}

      {showModal && (
        <SyncModal session={session} onClose={() => setShowModal(false)} />
      )}
      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  )
}
