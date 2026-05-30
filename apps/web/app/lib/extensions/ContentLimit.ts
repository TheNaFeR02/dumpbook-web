import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import type { TierLimits } from '../tiers'

const pluginKey = new PluginKey('contentLimit')

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length
}

export interface ContentLimitStorage {
  wordCount: number
  charCount: number
}

export const ContentLimit = Extension.create<TierLimits, ContentLimitStorage>({
  name: 'contentLimit',

  addOptions() {
    return { wordLimit: Infinity, charLimit: Infinity }
  },

  addStorage() {
    return { wordCount: 0, charCount: 0 }
  },

  onTransaction({ transaction }) {
    if (!transaction.docChanged) return
    const text = this.editor.state.doc.textBetween(
      0,
      this.editor.state.doc.content.size,
      '\n',
    )
    this.storage.wordCount = countWords(text)
    this.storage.charCount = text.length
  },

  addProseMirrorPlugins() {
    const { wordLimit, charLimit } = this.options
    return [
      new Plugin({
        key: pluginKey,
        filterTransaction(tr, state) {
          if (!tr.docChanged) return true
          // Yjs sync transactions (initial load + remote changes) must never be blocked —
          // filtering them causes existing over-limit documents to appear blank.
          if (tr.getMeta('y-sync$') !== undefined) return true

          const newText = tr.doc.textBetween(0, tr.doc.content.size, '\n')
          const newChars = newText.length
          const newWords = countWords(newText)

          if (newChars > charLimit || newWords > wordLimit) return false

          // When at the word limit, block any addition (spaces/newlines included)
          const oldText = state.doc.textBetween(0, state.doc.content.size, '\n')
          if (countWords(oldText) >= wordLimit && newChars > oldText.length) return false

          return true
        },
      }),
    ]
  },
})
