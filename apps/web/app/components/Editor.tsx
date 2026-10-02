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
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { authClient } from '../lib/auth-client'
import { TIERS, type TierName } from '../lib/tiers'
import { ContentLimit, type ContentLimitStorage } from '../lib/extensions/ContentLimit'
import { LineTimestamps, TIMESTAMPED_TYPES, formatStamp } from '../lib/extensions/LineTimestamps'
import { NoteActions, MOVE_META, DELETE_META } from '../lib/extensions/NoteActions'
import SyncModal from './SyncModal'
import UpgradeModal from './UpgradeModal'
import EditorPlaceholder from './EditorPlaceholder'
import NoteHandle from './NoteHandle'
import TrashIcon from './icons/TrashIcon'
import type { SubscriptionStatus } from '../api/user/subscription-status/route'

type Session = NonNullable<ReturnType<typeof authClient.useSession>['data']>

interface EditorProps {
  session: Session | null
  subscriptionStatus: SubscriptionStatus | null
}

// The text line (paragraph/heading) vertically beside a y coordinate, or the
// nearest one when y falls in the gap between lines.
function lineBesideY(root: HTMLElement, y: number): HTMLElement | null {
  let best: HTMLElement | null = null
  let bestDist = Infinity
  for (const el of root.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, h5, h6')) {
    const r = el.getBoundingClientRect()
    const dist = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0
    if (dist < bestDist) { best = el; bestDist = dist }
    if (dist === 0) break
  }
  return best
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
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#161618' : '#ffffff')
      try { localStorage.setItem('dumpbook-theme', next) } catch { }
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
    // Rendered client-side only; skip the first render to avoid SSR hydration mismatches.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: provider.document }),
      TaskList,
      // `[ ] ` / `[x] ` at line start creates a checkbox; nested lets sub-tasks indent with Tab.
      TaskItem.configure({ nested: true }),
      ContentLimit.configure(limits),
      LineTimestamps,
      NoteActions,
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
  }) ?? { wordCount: 0, charCount: 0, isEmpty: true }

  // The cursor line's timestamp, shown in the bottom bar on narrow screens
  // (desktop shows stamps in the right margin instead).
  const currentStamp = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) return null
      const block = ctx.editor.state.selection.$head.parent
      const ts = TIMESTAMPED_TYPES.includes(block.type.name) ? block.attrs.createdAt : null
      return ts ? formatStamp(ts) : null
    },
  }) ?? null

  // Undo/redo availability for the phone buttons (no ⌘Z on touch keyboards).
  const history = useEditorState({
    editor,
    selector: (ctx) => ({
      canUndo: ctx.editor?.can().undo() ?? false,
      canRedo: ctx.editor?.can().redo() ?? false,
    }),
  }) ?? { canUndo: false, canRedo: false }

  // "Moved to top · Undo" / "Entry deleted · Undo" toast, shown however the
  // action was triggered (shortcut, margin handle, bottom bar) by watching for
  // the action's transaction.
  const [noteToast, setNoteToast] = useState<string | null>(null)
  useEffect(() => {
    if (!editor) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const onTransaction = ({ transaction }: { transaction: { getMeta: (k: string) => unknown } }) => {
      const message = transaction.getMeta(MOVE_META)
        ? 'Moved to top'
        : transaction.getMeta(DELETE_META)
          ? 'Entry deleted'
          : null
      if (!message) return
      setNoteToast(message)
      clearTimeout(timer)
      timer = setTimeout(() => setNoteToast(null), 5000)
    }
    editor.on('transaction', onTransaction)
    return () => { editor.off('transaction', onTransaction); clearTimeout(timer) }
  }, [editor])

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
    } catch { }
  }, [])

  useEffect(() => {
    if (status !== 'connected' || wsConnectedRef.current) return
    wsConnectedRef.current = true
    try {
      performance.mark('db:ws-connected')
      const m = performance.measure('ws-connected', 'db:page-mount', 'db:ws-connected')
      if (process.env.NODE_ENV === 'development') console.log(`[perf] WebSocket connected: ${m.duration.toFixed(1)}ms`)
    } catch { }
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
          <text x="12" y="8" fontFamily="var(--font-duospace)" fontSize="4" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">Dump</text>
          <text x="12" y="14" fontFamily="var(--font-duospace)" fontSize="4" fontWeight="normal" fontStyle="italic" textAnchor="middle" fill="currentColor" stroke="none">book</text>
        </svg>
        {/* <span className="db-hash" aria-hidden="true">#</span> */}
        <span>Dumpbook</span>
      </div>

      <div
        className="editor-scroll-area"
        data-loading={isLoadingContent ? '' : undefined}
        onClick={(e) => {
          // Clicks on empty space around the text (e.g. the timestamp margin)
          // put the cursor at the end of the line beside the click; only clicks
          // below the last line go to the end of the document.
          if (e.target !== e.currentTarget || !editor) return
          const view = editor.view
          if (e.clientY > view.dom.getBoundingClientRect().bottom) return void editor.commands.focus('end')
          const line = lineBesideY(view.dom, e.clientY)
          if (!line) return void editor.commands.focus('end')
          const r = line.getBoundingClientRect()
          const y = Math.min(Math.max(e.clientY, r.top + 1), r.bottom - 1)
          const start = view.posAtDOM(line, 0)
          const end = view.posAtDOM(line, line.childNodes.length)
          const hit = view.posAtCoords({ left: r.right - 1, top: y })?.pos
          const pos = hit != null && hit >= start && hit <= end ? hit : end
          editor.chain().setTextSelection(pos).focus(undefined, { scrollIntoView: false }).run()
        }}
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

      {!isLoadingContent && (
        <div className={`content-limit-bar ${tier === 'full' ? 'content-limit-bar--stamp-only' : ''}`}>
          {tier !== 'full' && (
            <>
              <span className={counts.wordCount >= limits.wordLimit * 0.9 ? 'limit-warning' : ''}>
                {counts.wordCount.toLocaleString()} / {limits.wordLimit.toLocaleString()} words
              </span>
              <span className="limit-separator">·</span>
              <span className={counts.charCount >= limits.charLimit * 0.9 ? 'limit-warning' : ''}>
                {counts.charCount.toLocaleString()} / {limits.charLimit.toLocaleString()} characters
              </span>
            </>
          )}
          <span className="line-stamp" aria-live="off">
            <span className="history-btns">
              <button
                type="button"
                className="bar-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor?.commands.undo()}
                disabled={!history.canUndo}
                aria-label="Undo"
                title="Undo"
              >
                ↶
              </button>
              <button
                type="button"
                className="bar-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor?.commands.redo()}
                disabled={!history.canRedo}
                aria-label="Redo"
                title="Redo"
              >
                ↷
              </button>
            </span>
            <span className="line-stamp-text">{currentStamp}</span>
            <span className="note-btns">
              <button
                type="button"
                className="bar-btn"
                // Keep focus in the editor so the phone keyboard stays open.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor?.commands.moveToTop()}
                aria-label="Move note to top"
                title="Move to top"
              >
                ↑
              </button>
              <button
                type="button"
                className="bar-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor?.commands.deleteNote()}
                aria-label="Delete entry"
                title="Delete entry"
              >
                <TrashIcon />
              </button>
            </span>
          </span>
        </div>
      )}

      <NoteHandle editor={editor} />

      {noteToast && (
        <div className="moved-toast" role="status">
          {noteToast}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { editor?.commands.undo(); setNoteToast(null) }}
          >
            Undo
          </button>
        </div>
      )}

      {showModal && (
        <SyncModal
          session={session}
          tier={tier}
          trialDaysLeft={subscriptionStatus?.trialDaysLeft ?? null}
          onClose={() => setShowModal(false)}
        />
      )}
      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  )
}
