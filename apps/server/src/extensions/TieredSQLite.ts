import { SQLite } from "@hocuspocus/extension-sqlite"
import type { SQLiteConfiguration } from "@hocuspocus/extension-sqlite"
import type { afterLoadDocumentPayload, afterUnloadDocumentPayload } from "@hocuspocus/server"
import { TIERS, tierForDocument, type TierName } from "../tiers.js"
import { textFromYDoc, countWords, truncateYDocToLimit } from "../yjs.js"

type TieredSQLiteConfig = Partial<SQLiteConfiguration> & {
  documentTiers: Map<string, TierName>
}

export class TieredSQLite extends SQLite {
  private readonly overLimitDocs = new Set<string>()
  private readonly documentTiers: Map<string, TierName>

  constructor({ documentTiers, ...sqliteConfig }: TieredSQLiteConfig) {
    super(sqliteConfig)
    this.documentTiers = documentTiers

    const originalStore = this.configuration.store
    this.configuration.store = async (data) => {
      if (this.overLimitDocs.has(data.documentName)) return

      const tier = this.documentTiers.get(data.documentName) ?? tierForDocument(data.documentName)
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

  async afterLoadDocument(payload: afterLoadDocumentPayload): Promise<void> {
    const { document, documentName, context } = payload
    const tier =
      (context?.tier as TierName | undefined) ??
      this.documentTiers.get(documentName) ??
      tierForDocument(documentName)
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
    this.documentTiers.delete(documentName)
  }
}
