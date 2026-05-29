import { resolve, dirname } from "node:path"
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Server } from "@hocuspocus/server"
import { TieredSQLite } from "./extensions/TieredSQLite.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(__dirname, "../data")
mkdirSync(dataDir, { recursive: true })

const server = new Server({
  port: 1234,
  extensions: [
    new TieredSQLite({ database: resolve(dataDir, "db.sqlite") }),
  ],
  async onConnect() {
    console.log("Client connected")
  },
})

server.listen()
