import { SQLite } from "@hocuspocus/extension-sqlite"
import type { SQLiteConfiguration } from "@hocuspocus/extension-sqlite"
import { TIERS } from "../tiers.js"
import { textFromYDoc, countWords } from "../yjs.js"

/**
 * SQLite persistence with an abuse backstop only.
 *
 * The per-tier word cap is purely client-side UX (banner + upgrade prompt) —
 * the server never enforces it, because doing so silently dropped saves for
 * any document larger than the *current* tier limit. That meant a legitimate
 * document written on a higher tier became permanently unsavable after a
 * downgrade (its whole size re-checked against the smaller cap on every save).
 *
 * So we reject only documents that exceed the absolute maximum any tier allows
 * (Full), regardless of the connection's tier. This caps unbounded storage
 * growth without ever holding a real, tier-legitimate document hostage.
 */
export class TieredSQLite extends SQLite {
  constructor(sqliteConfig: Partial<SQLiteConfiguration>) {
    super(sqliteConfig)

    const MAX = TIERS.full

    const originalStore = this.configuration.store
    this.configuration.store = async (data) => {
      const text = textFromYDoc(data.document)
      if (text.length > MAX.charLimit || countWords(text) > MAX.wordLimit) {
        console.warn(`[storage] Rejected ${data.documentName}: exceeds absolute max (Full) limits`)
        return
      }

      return originalStore(data)
    }
  }
}
