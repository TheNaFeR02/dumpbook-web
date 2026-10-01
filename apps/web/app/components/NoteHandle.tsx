'use client'

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { TextSelection } from 'prosemirror-state'
import TrashIcon from './icons/TrashIcon'

const LIST_ITEMS = ['listItem', 'taskItem']
// The left margin (beside the text) counts as hovering the line next to it,
// so the pointer can travel from the text to the handle without losing it.
const GUTTER_PX = 72
const HIDE_DELAY_MS = 250

/**
 * Desktop-only note controls in the left margin, next to the note under the
 * mouse: the trash can deletes it, ↑ moves it to the top. A single floating element (not
 * one per line), positioned from the hovered block's DOM rect.
 */
export default function NoteHandle({ editor }: { editor: Editor | null }) {
  const [box, setBox] = useState<{ top: number; left: number; pos: number } | null>(null)
  const overHandle = useRef(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!editor) return
    const view = editor.view
    const scroller = view.dom.closest('.editor-scroll-area') as HTMLElement | null
    if (!scroller) return

    const show = (next: { top: number; left: number; pos: number }) => {
      clearTimeout(hideTimer.current)
      setBox((prev) => (prev && prev.pos === next.pos && prev.top === next.top ? prev : next))
    }
    const hideSoon = () => {
      if (overHandle.current) return
      clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => { if (!overHandle.current) setBox(null) }, HIDE_DELAY_MS)
    }

    const onMove = (e: MouseEvent) => {
      if (overHandle.current) return
      const content = view.dom.getBoundingClientRect()
      const area = scroller.getBoundingClientRect()
      const inBand =
        e.clientX >= content.left - GUTTER_PX && e.clientX <= content.right &&
        e.clientY >= area.top && e.clientY <= area.bottom
      if (!inBand) return hideSoon()

      // Probe at the pointer's x when inside the text, else just inside the left
      // edge, so the margin targets the line beside it.
      const hit = view.posAtCoords({ left: Math.max(e.clientX, content.left + 2), top: e.clientY })
      if (!hit) return hideSoon()
      const $pos = view.state.doc.resolve(hit.pos)
      if ($pos.depth === 0) return hideSoon()

      // Same unit as the command: innermost list item, else the top-level block.
      let depth = 1
      for (let d = $pos.depth; d > 0; d--) {
        if (LIST_ITEMS.includes($pos.node(d).type.name)) { depth = d; break }
      }
      const start = $pos.before(depth)
      if (start === 0) return hideSoon() // already at the top
      const dom = view.nodeDOM(start) as HTMLElement | null
      if (!dom?.getBoundingClientRect) return hideSoon()
      show({ top: dom.getBoundingClientRect().top, left: content.left, pos: start })
    }
    const onScroll = () => { if (!overHandle.current) setBox(null) }

    document.addEventListener('mousemove', onMove)
    scroller.addEventListener('scroll', onScroll)
    return () => {
      document.removeEventListener('mousemove', onMove)
      scroller.removeEventListener('scroll', onScroll)
      clearTimeout(hideTimer.current)
    }
  }, [editor])

  if (!editor || !box) return null

  // Put the cursor in the hovered note, then run the action on it.
  const run = (action: 'moveToTop' | 'deleteNote') => {
    const { state } = editor
    const sel = TextSelection.near(state.doc.resolve(Math.min(box.pos + 1, state.doc.content.size)))
    editor.chain().setTextSelection({ from: sel.from, to: sel.to })[action]().run()
    overHandle.current = false
    setBox(null)
  }

  return (
    <div
      className="note-handle"
      style={{ top: box.top, left: box.left }}
      onMouseEnter={() => { overHandle.current = true; clearTimeout(hideTimer.current) }}
      onMouseLeave={() => { overHandle.current = false }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button type="button" className="note-handle-btn" title="Delete entry (⌘⇧⌫)" aria-label="Delete entry" onClick={() => run('deleteNote')}>
        <TrashIcon />
      </button>
      <button type="button" className="note-handle-btn" title="Move to top (⌘⇧↑)" aria-label="Move note to top" onClick={() => run('moveToTop')}>
        ↑
      </button>
    </div>
  )
}
