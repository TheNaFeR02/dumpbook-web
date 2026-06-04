'use client'

import { useEffect, useState } from 'react'

// First-run overlay shown over an empty, synced document. It's purely visual
// (pointer-events: none) so clicks fall through to focus the editor, and it
// vanishes the moment the user types their first character.
export default function EditorPlaceholder() {
  // Pick the right modifier glyph so the shortcut hints read natively on each
  // platform. Resolved after mount to avoid an SSR/CSR hydration mismatch.
  const [mod, setMod] = useState('⌘')
  useEffect(() => {
    const isApple = /Mac|iPhone|iPad|iPod/.test(
      navigator.platform || navigator.userAgent,
    )
    if (!isApple) setMod('Ctrl ')
  }, [])

  return (
    <div className="editor-placeholder" aria-hidden="true">
      <p className="ph-tagline">
        One page. You append forever — gravity sorts the rest.
      </p>

      <div className="ph-loop">
        <div className="ph-loop-row">
          <span className="ph-loop-icon">↑</span>
          <span className="ph-loop-name">Append</span>
          <span className="ph-loop-text">
            Dump whatever&apos;s on your mind at the top. No folders, no order —
            just add.
          </span>
        </div>
        <div className="ph-loop-row">
          <span className="ph-loop-icon">↓</span>
          <span className="ph-loop-name">Gravity</span>
          <span className="ph-loop-text">
            Older notes sink as you keep adding. What you stop touching fades.
          </span>
        </div>
        <div className="ph-loop-row">
          <span className="ph-loop-icon">↻</span>
          <span className="ph-loop-name">Review</span>
          <span className="ph-loop-text">
            Now and then, reread from the top — rewrite what still matters back
            up top.
          </span>
        </div>
      </div>

      <p className="ph-tip">
        Shortcuts just work: <kbd>{mod}B</kbd> <b>bold</b>,{' '}
        <kbd>{mod}I</kbd> <i>italic</i>.
      </p>

      <div className="ph-sample">
        <p className="ph-sample-label">— a few days in —</p>
        <p>call mom back</p>
        <p>[ ] ship the landing page copy</p>
        <p>respond to Stephen&apos;s email</p>
        <p>idea: an app that just nags me to drink water</p>
        <p>[x] water the plants</p>
        <p>gym at 6 — leg day</p>
        <p>&ldquo;the obstacle is the way&rdquo; — start it this weekend</p>
        <p>groceries — oats, coffee, lemons, olive oil</p>
        <p className="ph-more">…and so on, forever ↓</p>
      </div>

      <p className="ph-start">Start typing — this note clears itself.</p>
    </div>
  )
}
