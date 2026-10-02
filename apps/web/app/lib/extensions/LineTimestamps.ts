import { Extension, combineTransactionSteps, getChangedRanges } from '@tiptap/core'
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { MOVE_META } from './NoteActions'

const pluginKey = new PluginKey('lineTimestamps')
export const TIMESTAMPED_TYPES = ['paragraph', 'heading']
const TYPES = TIMESTAMPED_TYPES

// `undefined` locale = the device's language (e.g. "jue 1 oct · 9:41" / "Thu Oct 1 · 9:41 AM").
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

const dayYearFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/** Local calendar day of a timestamp, e.g. "2026-10-2" (used to detect day changes). */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

const dayCache = new Map<string, string>()

/** "jue 2 oct" (device language); includes the year when it isn't the current one. */
export function formatDay(ms: number): string {
  const key = dayKey(ms)
  let out = dayCache.get(key)
  if (out === undefined) {
    const d = new Date(ms)
    const fmt = d.getFullYear() === new Date().getFullYear() ? dayFmt : dayYearFmt
    out = fmt.format(d).replace(/[.,]/g, '')
    dayCache.set(key, out)
  }
  return out
}

/**
 * When a line was placed where it is: the time it was brought to the top
 * (movedAt), else when it was written. Day separators group by this, so a
 * rescued note joins the day it was brought up, while its margin stamp keeps
 * the original written time.
 */
export function placedAt(attrs: { createdAt?: number | null; movedAt?: number | null }): number | null {
  return attrs.movedAt ?? attrs.createdAt ?? null
}

const stampCache = new Map<number, string>()

export function formatStamp(ms: number): string {
  let out = stampCache.get(ms)
  if (out === undefined) {
    const d = new Date(ms)
    out = `${dayFmt.format(d).replace(/[.,]/g, '')} · ${timeFmt.format(d)}`
    stampCache.set(ms, out)
  }
  return out
}

/**
 * Stamps every line (paragraph/heading) with the time it was first written.
 * The stamp lives as a node attribute in the shared Yjs doc, so it syncs and
 * never counts toward words. Copy/paste keeps the original stamp (it's carried
 * in the HTML), while Enter gives the new line a fresh one (keepOnSplit: false).
 * Lines written before this feature existed are never stamped.
 */
export const LineTimestamps = Extension.create({
  name: 'lineTimestamps',

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          createdAt: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => {
              const v = Number(el.getAttribute('data-created-at'))
              return Number.isFinite(v) && v > 0 ? v : null
            },
            // The formatted stamp is written straight onto the line's element, so
            // it only re-renders when that line changes (no per-keystroke work).
            renderHTML: (attrs) =>
              attrs.createdAt
                ? {
                    'data-created-at': String(attrs.createdAt),
                    'data-ts': formatStamp(attrs.createdAt),
                    class: 'ts',
                  }
                : {},
          },
          // Set by "move to top"; see placedAt(). Carried in the HTML so cut/paste keeps it.
          movedAt: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => {
              const v = Number(el.getAttribute('data-moved-at'))
              return Number.isFinite(v) && v > 0 ? v : null
            },
            renderHTML: (attrs) => (attrs.movedAt ? { 'data-moved-at': String(attrs.movedAt) } : {}),
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,

        // A line is stamped the moment it goes from empty to having text, and
        // loses its stamp when emptied. So brand-new lines get the current time,
        // lines that predate this feature (never empty) stay unstamped, and an
        // empty line left over from Enter can't carry an older line's time.
        // Remote/initial Yjs transactions are skipped so each device only
        // stamps its own typing.
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null
          if (transactions.some((tr) => tr.getMeta('y-sync$') !== undefined)) return null
          // A moved note isn't new writing (keeps its time; old notes stay undated).
          if (transactions.some((tr) => tr.getMeta(MOVE_META))) return null

          const now = Date.now()
          const combined = combineTransactionSteps(oldState.doc, transactions as never)
          const back = combined.mapping.invert()
          let tr: Transaction | null = null
          const set = (pos: number, value: number | null) => {
            tr ??= newState.tr
            tr.setNodeAttribute(pos, 'createdAt', value)
          }

          for (const { newRange } of getChangedRanges(combined)) {
            newState.doc.nodesBetween(newRange.from, newRange.to, (node, pos) => {
              if (!TYPES.includes(node.type.name)) return true
              const empty = node.content.size === 0
              if (empty && node.attrs.createdAt != null) set(pos, null)
              if (!empty && node.attrs.createdAt == null && !hadTextBefore(pos)) set(pos, now)
              return false
            })
          }
          return tr

          // Was this line already a non-empty line before these edits?
          function hadTextBefore(pos: number): boolean {
            const r = back.mapResult(pos + 1)
            if (r.deleted) return false // inside newly inserted content
            const old = oldState.doc.resolve(r.pos).parent
            return TYPES.includes(old.type.name) && old.content.size > 0
          }
        },

        props: {
          // Mark the cursor's line so CSS can reveal its stamp.
          decorations(state) {
            const { $head } = state.selection
            if ($head.depth === 0 || !$head.parent.attrs.createdAt) return DecorationSet.empty
            const pos = $head.before($head.depth)
            return DecorationSet.create(state.doc, [
              Decoration.node(pos, pos + $head.parent.nodeSize, { class: 'ts-current' }),
            ])
          },
        },
      }),
    ]
  },
})
