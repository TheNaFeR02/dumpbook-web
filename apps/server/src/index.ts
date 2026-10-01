import { resolve, dirname } from "node:path"
import { mkdirSync } from "node:fs"
import { createHmac, timingSafeEqual } from "node:crypto"
import { fileURLToPath } from "node:url"
import { Server } from "@hocuspocus/server"
import { TieredSQLite } from "./extensions/TieredSQLite.js"
import { type TierName } from "./tiers.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env in local dev (Node 22+); silently ignored if unavailable or file absent.
try { (process as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(resolve(__dirname, "../.env")) } catch { /* ok */ }

const dataDir = resolve(__dirname, "../data")
mkdirSync(dataDir, { recursive: true })

const HOCUSPOCUS_SECRET = process.env.HOCUSPOCUS_SECRET ?? ""
if (!HOCUSPOCUS_SECRET) {
  // Fail closed: without the secret no token can be verified, so any client
  // could open any document.
  console.error("[server] HOCUSPOCUS_SECRET is not set — refusing to start")
  process.exit(1)
}

type AppContext = { tier: TierName }

type WsTokenPayload = { tier: TierName; room: string | null; exp: number }

function verifyWsToken(token: string): WsTokenPayload | null {
  try {
    const dot = token.indexOf(".")
    if (dot === -1) return null
    const b64 = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const expectedSig = createHmac("sha256", HOCUSPOCUS_SECRET).update(b64).digest("hex")
    if (sig.length !== expectedSig.length) return null
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString()) as WsTokenPayload
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

const tieredSQLite = new TieredSQLite({
  database: resolve(dataDir, "db.sqlite"),
})

const server = new Server<AppContext>({
  port: 1234,
  extensions: [tieredSQLite],

  async onAuthenticate({ documentName, token, context }) {
    const payload = verifyWsToken(token)
    if (!payload) throw new Error("Invalid or expired ws-token")
    // A token opens exactly its own user's document; anonymous tokens only anon rooms.
    const allowed = payload.room ? documentName === payload.room : documentName.startsWith("anon-")
    if (!allowed) throw new Error("ws-token not valid for this document")
    context.tier = payload.tier
  },

  async onConnect() {
    console.log("Client connected")
  },
})

server.listen()
