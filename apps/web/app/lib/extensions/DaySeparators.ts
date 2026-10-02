import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, Selection, TextSelection, type EditorState } from 'prosemirror-state'
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view'
import { TIMESTAMPED_TYPES, dayKey, formatDay } from './LineTimestamps'

type PMNode = EditorState['doc']

const pluginKey = new PluginKey<DecorationSet>('daySeparators')

function separatorDOM(label: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'day-sep'
  el.contentEditable = 'false'
  el.setAttribute('aria-hidden', 'true')
  const dash = () => Object.assign(document.createElement('span'), { className: 'day-sep-dash' })
  const text = Object.assign(document.createElement('span'), { className: 'day-sep-date', textContent: label })
  el.append(dash(), text, dash())
  return el
}

/**
 * Above the first dated line and wherever the day changes between two
 * consecutive dated lines, draw a quiet "— jue 2 oct —" separator. Derived from the lines' createdAt stamps, so
 * nothing is stored in the document: it can't be typed into, doesn't count
 * as words, and undated (older) lines are simply skipped.
 */
function buildSeparators(doc: PMNode): DecorationSet {
  const decos: Decoration[] = []
  let prevDay: string | null = null
  let i = 0
  doc.descendants((node, pos) => {
    if (!TIMESTAMPED_TYPES.includes(node.type.name)) return true
    const ts = node.attrs.createdAt as number | null
    if (!ts) return false
    const day = dayKey(ts)
    if (day !== prevDay) {
      // Put the separator before the outermost block that starts with this
      // line (e.g. before a checkbox item, not inside it).
      const $pos = doc.resolve(pos)
      let at = pos
      for (let d = $pos.depth; d > 0 && $pos.index(d) === 0; d--) at = $pos.before(d)
      decos.push(
        Decoration.widget(at, () => separatorDOM(formatDay(ts)), {
          side: -1,
          ignoreSelection: true,
          key: `${day}#${i++}`,
        }),
      )
    }
    prevDay = day
    return false
  })
  return DecorationSet.create(doc, decos)
}

// Browsers can't move the caret vertically past a non-editable widget, so
// ArrowUp/Down got stuck at a separator. When one sits between the cursor's
// line and the next line in that direction, move the cursor ourselves,
// keeping its horizontal position.
function arrowAcrossSeparator(view: EditorView, dir: -1 | 1, extend: boolean): boolean {
  const { state } = view
  const { $head } = state.selection
  if ($head.depth === 0 || !view.endOfTextblock(dir < 0 ? 'up' : 'down')) return false
  const boundary = dir < 0 ? $head.before($head.depth) : $head.after($head.depth)
  const next = Selection.findFrom(state.doc.resolve(boundary), dir, true)
  if (!next) return false
  const [a, b] = dir < 0 ? [next.from, boundary] : [boundary, next.from]
  if (!pluginKey.getState(state)?.find(a, b).length) return false // no separator in between

  // Same column on the adjacent line (its last line going up, first going down).
  let target = next.from
  const block = view.domAtPos(next.$from.start()).node as HTMLElement
  const el = block.nodeType === 1 ? block : block.parentElement
  if (el) {
    const r = el.getBoundingClientRect()
    const hit = view.posAtCoords({ left: view.coordsAtPos($head.pos).left, top: dir < 0 ? r.bottom - 4 : r.top + 4 })
    if (hit && hit.pos >= next.$from.start() && hit.pos <= next.$from.end()) target = hit.pos
  }
  const sel = extend
    ? TextSelection.create(state.doc, state.selection.anchor, target)
    : TextSelection.create(state.doc, target)
  view.dispatch(state.tr.setSelection(sel).scrollIntoView())
  return true
}

export const DaySeparators = Extension.create({
  name: 'daySeparators',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: (_, state) => buildSeparators(state.doc),
          apply: (tr, old) => (tr.docChanged ? buildSeparators(tr.doc) : old),
        },
        props: {
          decorations: (state) => pluginKey.getState(state),
          handleKeyDown(view, event) {
            if (event.altKey || event.metaKey || event.ctrlKey) return false
            if (event.key === 'ArrowUp') return arrowAcrossSeparator(view, -1, event.shiftKey)
            if (event.key === 'ArrowDown') return arrowAcrossSeparator(view, 1, event.shiftKey)
            return false
          },
        },
      }),
    ]
  },
})
