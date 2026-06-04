import { SQLite } from "@hocuspocus/extension-sqlite"
import type { SQLiteConfiguration } from "@hocuspocus/extension-sqlite"
import type { afterUnloadDocumentPayload } from "@hocuspocus/server"
import { TIERS, tierForDocument, type TierName } from "../tiers.js"
import { textFromYDoc, countWords } from "../yjs.js"

type TieredSQLiteConfig = Partial<SQLiteConfiguration> & {
  documentTiers: Map<string, TierName>
}

/**
 * SQLite persistence with a paywall guard: we never persist a document that
 * exceeds its tier's limits, so an over-limit doc can't grow on disk.
 *
 * Over-limit content is otherwise left untouched — the client owns the
 * over-limit UX (read-only-ish editing via the ContentLimit extension + a
 * banner). The server never mutates the live document, which keeps tier
 * transitions (upgrade/downgrade) stateless and bug-free.
 */
export class TieredSQLite extends SQLite {
  private readonly documentTiers: Map<string, TierName>

  constructor({ documentTiers, ...sqliteConfig }: TieredSQLiteConfig) {
    super(sqliteConfig)
    this.documentTiers = documentTiers

    const originalStore = this.configuration.store
    this.configuration.store = async (data) => {
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

  async afterUnloadDocument({ documentName }: afterUnloadDocumentPayload): Promise<void> {
    this.documentTiers.delete(documentName)
  }
}
