import { SQLite } from "@hocuspocus/extension-sqlite"
import type { SQLiteConfiguration } from "@hocuspocus/extension-sqlite"
import type { afterLoadDocumentPayload, afterUnloadDocumentPayload } from "@hocuspocus/server"
import { TIERS, tierForDocument } from "../tiers.js"
import { textFromYDoc, countWords, truncateYDocToLimit } from "../yjs.js"

export class TieredSQLite extends SQLite {
  // Tracks documents that were loaded over-limit and have been truncated in memory.
  // Saves are blocked for these so the full content is never overwritten in SQLite.
  private readonly overLimitDocs = new Set<string>()

  constructor(config: Partial<SQLiteConfiguration>) {
    super(config)
    const originalStore = this.configuration.store
    this.configuration.store = async (data) => {
      if (this.overLimitDocs.has(data.documentName)) return

      const tier = tierForDocument(data.documentName)
      const limits = TIERS[tier]

      if (isFinite(limits.charLimit) || isFinite(limits.wordLimit)) {
        const text = textFromYDoc(data.document)
        if (text.length > limits.charLimit || countWords(text) > limits.wordLimit) {
          console.warn(`[storage] Rejected ${data.documentName}: exceeds ${tier} tier limits`)
          return
        }
      }

      return originalStore(data)
    }
  }

  // Called after the SQLite extension loads the document — truncate it before the
  // client receives it so the client only ever sees tier-limited content.
  async afterLoadDocument({ document, documentName }: afterLoadDocumentPayload): Promise<void> {
    const tier = tierForDocument(documentName)
    const limits = TIERS[tier]
    if (!isFinite(limits.wordLimit) && !isFinite(limits.charLimit)) return

    const text = textFromYDoc(document)
    if (countWords(text) <= limits.wordLimit && text.length <= limits.charLimit) return

    console.log(`[storage] ${documentName} exceeds ${tier} limits — truncating for display`)
    this.overLimitDocs.add(documentName)
    truncateYDocToLimit(document, limits)
  }

  async afterUnloadDocument({ documentName }: afterUnloadDocumentPayload): Promise<void> {
    this.overLimitDocs.delete(documentName)
  }
}
