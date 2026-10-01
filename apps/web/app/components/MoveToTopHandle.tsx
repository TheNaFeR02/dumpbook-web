'use client'

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { TextSelection } from 'prosemirror-state'

const LIST_ITEMS = ['listItem', 'taskItem']

/**
 * Desktop-only "↑" button in the left margin, next to the note under the mouse.
 * A single floating element (not one per line), positioned from the hovered
 * block's DOM rect. Clicking moves that note to the top.
 */
export default function MoveToTopHandle({ editor }: { editor: Editor | null }) {
  const [box, setBox] = useState<{ top: number; left: number; pos: number } | null>(null)
  const overHandle = useRef(false)

  useEffect(() => {
    if (!editor) return
    const view = editor.view
    const area = view.dom.closest('.editor-wrapper') as HTMLElement | null
    if (!area) return

    const onMove = (e: MouseEvent) => {
      if (overHandle.current) return
      const content = view.dom.getBoundingClientRect()
      // Probe at the pointer's x when inside the text, else just inside the left
      // edge, so hovering the margin still targets the line beside it.
      const x = Math.max(e.clientX, content.left + 2)
      const hit = view.posAtCoords({ left: x, top: e.clientY })
      if (!hit) return setBox(null)
      const $pos = view.state.doc.resolve(hit.pos)
      if ($pos.depth === 0) return setBox(null)

      // Same unit as the command: innermost list item, else the top-level block.
      let depth = 1
      for (let d = $pos.depth; d > 0; d--) {
        if (LIST_ITEMS.includes($pos.node(d).type.name)) { depth = d; break }
      }
      const start = $pos.before(depth)
      if (start === 0) return setBox(null) // already at the top
      const dom = view.nodeDOM(start) as HTMLElement | null
      if (!dom?.getBoundingClientRect) return setBox(null)
      const r = dom.getBoundingClientRect()
      setBox({ top: r.top, left: content.left, pos: start })
    }
    const onLeave = () => { if (!overHandle.current) setBox(null) }
    const onScroll = () => setBox(null)

    area.addEventListener('mousemove', onMove)
    area.addEventListener('mouseleave', onLeave)
    area.addEventListener('scroll', onScroll, true)
    return () => {
      area.removeEventListener('mousemove', onMove)
      area.removeEventListener('mouseleave', onLeave)
      area.removeEventListener('scroll', onScroll, true)
    }
  }, [editor])

  if (!editor || !box) return null

  return (
    <button
      type="button"
      className="move-top-handle"
      style={{ top: box.top, left: box.left }}
      title="Move to top (⌘⇧↑)"
      aria-label="Move note to top"
      onMouseEnter={() => { overHandle.current = true }}
      onMouseLeave={() => { overHandle.current = false; setBox(null) }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        const { state } = editor
        const sel = TextSelection.near(state.doc.resolve(Math.min(box.pos + 1, state.doc.content.size)))
        editor.chain().setTextSelection({ from: sel.from, to: sel.to }).moveToTop().run()
        overHandle.current = false
        setBox(null)
      }}
    >
      ↑
    </button>
  )
}
