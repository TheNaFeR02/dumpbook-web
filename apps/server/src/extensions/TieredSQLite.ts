import { SQLite } from "@hocuspocus/extension-sqlite"
import type { SQLiteConfiguration } from "@hocuspocus/extension-sqlite"
import { TIERS, tierForDocument } from "../tiers.js"
import { textFromYDoc, countWords } from "../yjs.js"

export class TieredSQLite extends SQLite {
  constructor(config: Partial<SQLiteConfiguration>) {
    super(config)
    const originalStore = this.configuration.store
    this.configuration.store = async (data) => {
      const tier = tierForDocument(data.documentName)
      const limits = TIERS[tier]

      // Skip Y.Doc traversal for tiers with no limits.
      if (isFinite(limits.charLimit) || isFinite(limits.wordLimit)) {
        const text = textFromYDoc(data.document)

        // Returning without calling originalStore skips the SQL write.
        // e.x User pasts the limit of ~1000 words, the document won't persist the latest
        // changes past the limit. When reloads, the document will be in the state before.
        // This is an extra measure if someone tries to bypass client-side limits.
        if (text.length > limits.charLimit || countWords(text) > limits.wordLimit) {
          console.warn(`[storage] Rejected ${data.documentName}: exceeds ${tier} tier limits`)
          return
        }
      }

      return originalStore(data)
    }
  }
}
