'use client'

import { useState, useMemo, useRef } from 'react'
import {
  useHocuspocusAwareness,
  useHocuspocusConnectionStatus,
  useHocuspocusProvider,
} from '@hocuspocus/provider-react'
import { EditorContent, useEditor, Extension } from '@tiptap/react'
import Collaboration from '@tiptap/extension-collaboration'
import { StarterKit } from '@tiptap/starter-kit'
import CharacterCount from '@tiptap/extension-character-count'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { authClient, startCheckout } from '../lib/auth-client'
import SyncModal from './SyncModal'
import type { SubscriptionStatus } from '../api/user/subscription-status/route'

type Session = NonNullable<ReturnType<typeof authClient.useSession>['data']>

interface EditorProps {
  session: Session | null
  subscriptionStatus: SubscriptionStatus | null
}

const WORD_LIMITS = {
  anonymous:     1_000,
  sync:          2_000,
  trial:       500_000,
  'full-archive': 500_000,
} as const

const CHAR_LIMITS = {
  anonymous:       6_000,
  sync:           12_000,
  trial:       3_000_000,
  'full-archive': 3_000_000,
} as const

type LimitRef = { current: { wordLimit: number; charLimit: number } }

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length
}

// Plugin reads limits from a ref so it picks up tier changes without recreating the editor.
function createWordLimitPlugin(limitRef: LimitRef) {
  return new Plugin({
    key: new PluginKey('wordLimit'),
    filterTransaction(tr, state) {
      if (!tr.docChanged) return true
      const { wordLimit, charLimit } = limitRef.current
      const oldText = state.doc.textContent
      const newText = tr.doc.textContent
      // Pure deletion — always allow
      if (newText.length < oldText.length) return true
      // Already at either limit — block any growth (including spaces and newlines)
      if (countWords(oldText) >= wordLimit || oldText.length >= charLimit) return false
      // Under both limits — allow only if new state stays within them
      return countWords(newText) <= wordLimit && newText.length <= charLimit
    },
  })
}

export default function Editor({ session, subscriptionStatus }: EditorProps) {
  const provider = useHocuspocusProvider()
  const status = useHocuspocusConnectionStatus()
  const users = useHocuspocusAwareness()
  const [showModal, setShowModal] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [charCount, setCharCount] = useState(0)

  const tier = subscriptionStatus?.tier ?? (session ? 'sync' : 'anonymous')
  const wordLimit = WORD_LIMITS[tier] ?? WORD_LIMITS['full-archive']
  const charLimit = CHAR_LIMITS[tier] ?? CHAR_LIMITS['full-archive']
  const isAtLimit = wordCount >= wordLimit || charCount >= charLimit

  // Updated every render — the plugin reads from this ref, so enforcement is always current.
  const limitRef = useRef({ wordLimit, charLimit })
  limitRef.current = { wordLimit, charLimit }

  // Extension created once; limits come from the ref, not a stale closure.
  const WordLimitExtension = useMemo(() => Extension.create({
    name: 'wordLimit',
    addProseMirrorPlugins: () => [createWordLimitPlugin(limitRef)],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: provider.document }),
      CharacterCount.configure({}),
      WordLimitExtension,
    ],
    onUpdate: ({ editor: e }) => {
      const text = e.state.doc.textContent
      setWordCount(countWords(text))
      setCharCount(text.length)
    },
  })

  const handleUpgrade = () => {
    if (!session) {
      setShowModal(true)
      return
    }
    startCheckout('full-archive')
  }

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

      <EditorContent editor={editor} className="editor-content" />

      {isAtLimit && (
        <div className="editor-limit-banner">
          {tier === 'anonymous' ? (
            <>
              You&apos;ve reached the {WORD_LIMITS.anonymous.toLocaleString()}-word limit.
              <button onClick={() => setShowModal(true)}>Sign in to keep dumping</button>
            </>
          ) : tier === 'sync' ? (
            <>
              You&apos;ve reached the {WORD_LIMITS.sync.toLocaleString()}-word Sync limit.
              <button onClick={handleUpgrade}>Start free trial to keep writing</button>
            </>
          ) : (
            <>
              You&apos;ve reached the maximum document size.
            </>
          )}
        </div>
      )}

      {showModal && (
        <SyncModal
          session={session}
          subscriptionStatus={subscriptionStatus}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
