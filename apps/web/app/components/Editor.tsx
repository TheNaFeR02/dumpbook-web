'use client'

import { useState } from 'react'
import {
  useHocuspocusAwareness,
  useHocuspocusConnectionStatus,
  useHocuspocusProvider,
} from '@hocuspocus/provider-react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import Collaboration from '@tiptap/extension-collaboration'
import { StarterKit } from '@tiptap/starter-kit'
import { authClient } from '../lib/auth-client'
import { TIERS, type TierName } from '../lib/tiers'
import { ContentLimit, type ContentLimitStorage } from '../lib/extensions/ContentLimit'
import SyncModal from './SyncModal'

type Session = NonNullable<ReturnType<typeof authClient.useSession>['data']>

interface EditorProps {
  session: Session | null
}

export default function Editor({ session }: EditorProps) {
  const provider = useHocuspocusProvider()
  const status = useHocuspocusConnectionStatus()
  const users = useHocuspocusAwareness()
  const [showModal, setShowModal] = useState(false)

  const tier = (session ? 'sync' : 'local') as TierName
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
      }
    },
  })

  const isAtLimit =
    counts.wordCount >= limits.wordLimit || counts.charCount >= limits.charLimit
  const isOverLimit =
    counts.wordCount > limits.wordLimit || counts.charCount > limits.charLimit

  return (
    <div className="editor-wrapper">
      <header className="navbar">
        <div>
          <span className="status-dot" data-status={status} />
          <span className="status-text">{users.length} online</span>
        </div>
        <div className="navbar-right">
          <button
            className={`btn-sync ${session ? 'btn-sync--in' : ''}`}
            onClick={() => setShowModal(true)}
          >
            {session ? session.user.name.split(' ')[0] : 'Sync'}
          </button>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32">
            <g className="gear-wrap">
              <rect width="32" height="32" fill="transparent" />
              <path fill="#b6b5b5" fillRule="evenodd" d="M13.003,29.003v-4h-2v2h-4v-2h-2v-4h2v-2h-4v-6h4v-2h-2v-4h2v-2h4v2h2v-4h6v4h2v-2h4v2h2v4h-2v2h4v6h-4v2h2v4h-2v2h-4v-2h-2v4H13.003z M20.003,20.003v-7.999h-8.001v7.999H20.003z" clipRule="evenodd" />
              <path fill="#706d67" fillRule="evenodd" d="M13.003,23.003v-2h-2v-2h-2v-6h2v-2h2v-2h6v2h2v2h2v6h-2v2h-2v2H13.003z M19.003,19.003v-5.999h-6.001v5.999H19.003z" clipRule="evenodd" />
            </g>
          </svg>
        </div>
      </header>

      <div className="editor-scroll-area">
        <EditorContent editor={editor} className="editor-content" />
        {isOverLimit && <div className="editor-over-limit-gradient" aria-hidden="true" />}
      </div>

      {isOverLimit && (
        <div className="editor-limit-banner">
          Your document exceeds the {limits.wordLimit.toLocaleString()}-word {tier === 'sync' ? 'Sync' : ''} plan limit — read below, but no new writing until you upgrade.
        </div>
      )}

      {isAtLimit && !isOverLimit && (
        <div className="editor-limit-banner">
          {tier === 'local' ? (
            <>
              You&apos;ve reached the {limits.wordLimit.toLocaleString()}-word limit.
              <button onClick={() => setShowModal(true)}>Sign in to keep dumping</button>
            </>
          ) : tier === 'sync' ? (
            <>
              You&apos;ve reached the {limits.wordLimit.toLocaleString()}-word limit.
            </>
          ) : (
            <>
              You&apos;ve reached the maximum document size.
            </>
          )}
        </div>
      )}

      {tier !== 'full' && (
        <div className="content-limit-bar">
          <span className={counts.wordCount >= limits.wordLimit * 0.9 ? 'limit-warning' : ''}>
            {counts.wordCount} / {limits.wordLimit.toLocaleString()} words
          </span>
          <span className="limit-separator">·</span>
          <span className={counts.charCount >= limits.charLimit * 0.9 ? 'limit-warning' : ''}>
            {counts.charCount} / {limits.charLimit.toLocaleString()} characters
          </span>
        </div>
      )}

      {showModal && (
        <SyncModal session={session} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}
