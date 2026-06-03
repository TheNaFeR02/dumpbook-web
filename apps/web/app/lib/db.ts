import Database from "better-sqlite3";
import path from "path";

const dbPath = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), "data", "auth.sqlite");

export const db = new Database(dbPath);

// Local mirror of the user's Polar subscription, kept up to date by webhooks.
// One row per user; the webhook payload is the source of truth.
db.exec(`
  CREATE TABLE IF NOT EXISTS subscription (
    userId            TEXT    PRIMARY KEY,
    subscriptionId    TEXT    NOT NULL,
    status            TEXT    NOT NULL,
    productId         TEXT,
    currentPeriodEnd  INTEGER,            -- epoch ms, null if unknown
    trialEnd          INTEGER,            -- epoch ms, null if not trialing
    endsAt            INTEGER,            -- epoch ms, set when a cancellation is scheduled
    cancelAtPeriodEnd INTEGER NOT NULL DEFAULT 0,
    revoked           INTEGER NOT NULL DEFAULT 0,
    modifiedAt        INTEGER NOT NULL    -- epoch ms of the event that produced this row (ordering guard)
  )
`);

// Note: the abandoned `polarTier` / `polarTierAt` columns on the `user` table
// are intentionally left in place. They're inert — the generated better-auth
// schema no longer references them and nothing here reads them — and dropping
// them would make a rollback to the previous image fail (the deploy's
// CREATE TABLE IF NOT EXISTS pipeline can't re-add them). Drop them as a
// deliberate one-off later if desired.
