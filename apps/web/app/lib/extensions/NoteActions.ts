import { Extension } from '@tiptap/core'
import { TextSelection, type EditorState } from 'prosemirror-state'

type PMNode = EditorState['doc']

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteActions: {
      /** Move the note at the cursor (or the selected notes) to the top of the document. */
      moveToTop: () => ReturnType
      /** Delete the note at the cursor (or the selected notes). */
      deleteNote: () => ReturnType
    }
  }
}

const LIST_ITEMS = ['listItem', 'taskItem']

/** Meta flag so other plugins (e.g. LineTimestamps) treat this as a move, not new writing. */
export const MOVE_META = 'moveToTop'
/** Meta flag marking a note deletion (drives the "Entry deleted · Undo" toast). */
export const DELETE_META = 'deleteNote'

/**
 * The "note" both actions operate on:
 * - a selection spanning several top-level blocks → all of them, in order;
 * - the cursor inside a list/checkbox item → that item (with its sub-items),
 *   re-wrapped in the same kind of list at the top;
 * - otherwise → the top-level block containing the cursor.
 */
function findTarget(state: EditorState): { from: number; to: number; content: PMNode[] } | null {
  const { $from, $to, empty } = state.selection
  if ($from.depth === 0) return null

  if (!empty && $from.index(0) !== $to.index(0)) {
    const from = $from.before(1)
    const to = $to.after(1)
    const content: PMNode[] = []
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (pos >= from && pos + node.nodeSize <= to) content.push(node)
      return false
    })
    return { from, to, content }
  }

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (!LIST_ITEMS.includes(node.type.name)) continue
    const list = $from.node(d - 1)
    // Last item of its list: move the whole list so no empty list is left behind.
    if (list.childCount === 1) {
      return { from: $from.before(d - 1), to: $from.after(d - 1), content: [list] }
    }
    return { from: $from.before(d), to: $from.after(d), content: [list.type.create(list.attrs, node)] }
  }

  return { from: $from.before(1), to: $from.after(1), content: [$from.node(1)] }
}

export const NoteActions = Extension.create({
  name: 'noteActions',

  addCommands() {
    return {
      moveToTop:
        () =>
        ({ state, tr, dispatch, view }) => {
          const target = findTarget(state)
          if (!target || target.from === 0) return false
          if (!dispatch) return true

          const anchor = tr.selection.from
          // Where the note's first line sits on screen now, so the next note can take its place.
          let screenTop: number | null = null
          try {
            screenTop = view.coordsAtPos(TextSelection.near(state.doc.resolve(target.from)).from).top
          } catch { /* not rendered (e.g. headless) */ }
          tr.delete(target.from, target.to)
          tr.insert(0, target.content)

          // If the moved item landed right above a list of the same kind, merge
          // them so it reads as the newest item of that list.
          const first = tr.doc.firstChild
          const second = tr.doc.childCount > 1 ? tr.doc.child(1) : null
          if (first && second && first.type === second.type && first.type.name.endsWith('List')) {
            tr.join(first.nodeSize)
          }

          // Stay where you were: put the cursor at the spot the note left (no
          // scrollIntoView, so the viewport doesn't jump to the top).
          const $pos = tr.doc.resolve(Math.min(tr.mapping.map(anchor), tr.doc.content.size))
          tr.setSelection(TextSelection.near($pos))
          tr.setMeta(MOVE_META, { screenTop })
          return true
        },

      deleteNote:
        () =>
        ({ state, tr, dispatch }) => {
          const target = findTarget(state)
          if (!target) return false
          if (!dispatch) return true

          // The document must keep at least one block.
          if (target.from === 0 && target.to === state.doc.content.size) {
            tr.replaceWith(0, target.to, state.schema.nodes.paragraph.create())
          } else {
            tr.delete(target.from, target.to)
          }
          // Cursor stays at the spot the note left; text below simply moves up.
          const $pos = tr.doc.resolve(Math.min(tr.mapping.map(target.from), tr.doc.content.size))
          tr.setSelection(TextSelection.near($pos))
          tr.setMeta(DELETE_META, true)
          return true
        },
    }
  },

  // Keep the reading position: scroll so the block now at the cursor sits
  // exactly where the moved note was.
  onTransaction({ transaction }) {
    const meta = transaction.getMeta(MOVE_META) as { screenTop: number | null } | undefined
    if (!meta || meta.screenTop == null) return
    // Runs after the view has rendered this transaction, so we can measure now.
    const view = this.editor.view
    const scroller = view.dom.closest('.editor-scroll-area') as HTMLElement | null
    if (!scroller) return
    scroller.scrollTop += view.coordsAtPos(view.state.selection.from).top - meta.screenTop
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-ArrowUp': () => this.editor.commands.moveToTop(),
      'Mod-Shift-Backspace': () => this.editor.commands.deleteNote(),
    }
  },
})
