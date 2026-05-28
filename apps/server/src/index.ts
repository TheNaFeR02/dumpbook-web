import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Server } from "@hocuspocus/server";
import { SQLite } from "@hocuspocus/extension-sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../data");
mkdirSync(dataDir, { recursive: true });

const HOCUSPOCUS_SECRET = process.env.HOCUSPOCUS_SECRET ?? "";
if (!HOCUSPOCUS_SECRET) {
  console.warn("[server] HOCUSPOCUS_SECRET is not set — word-limit enforcement disabled");
}

const WORD_LIMITS: Record<string, number> = {
  anonymous:        1_000,
  sync:             2_000,
  trial:          500_000,
  "full-archive": 500_000,
};

const CHAR_LIMITS: Record<string, number> = {
  anonymous:          6_000,
  sync:              12_000,
  trial:          3_000_000,
  "full-archive": 3_000_000,
};

type AppContext = { tier: string };

function verifyToken(token: string): { tier: string } | null {
  if (!HOCUSPOCUS_SECRET) return null;
  try {
    const dot = token.indexOf(".");
    if (dot === -1) return null;
    const b64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expectedSig = createHmac("sha256", HOCUSPOCUS_SECRET).update(b64).digest("hex");
    if (sig.length !== expectedSig.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString()) as {
      tier: string;
      exp: number;
    };
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { tier: payload.tier };
  } catch {
    return null;
  }
}


const server = new Server<AppContext>({
  port: 1234,

  extensions: [
    new SQLite({
      database: resolve(dataDir, "db.sqlite"),
    }),
  ],

  async onAuthenticate({ token, context }) {
    if (!HOCUSPOCUS_SECRET) {
      context.tier = "full-archive"; // enforcement disabled — allow all
      return;
    }
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid or expired ws-token");
    context.tier = payload.tier;
  },

  async onChange({ document, context }) {
    const tier = context?.tier ?? "anonymous";
    const wordLimit = WORD_LIMITS[tier] ?? WORD_LIMITS["full-archive"];
    const charLimit = CHAR_LIMITS[tier] ?? CHAR_LIMITS["full-archive"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xml: string = (document as any).getXmlFragment("default").toString();
    const text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const words = text.length === 0 ? 0 : text.split(" ").length;
    const chars = text.length;
    if (words > wordLimit || chars > charLimit) {
      throw new Error(`Limit exceeded for tier "${tier}": ${words} words, ${chars} chars`);
    }
  },

  async onConnect() {
    console.log("Client connected");
  },
});

server.listen();
