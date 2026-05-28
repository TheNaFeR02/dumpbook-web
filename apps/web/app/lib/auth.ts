import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";

const dbPath = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), "data", "auth.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null);
  CREATE TABLE IF NOT EXISTS "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);
  CREATE TABLE IF NOT EXISTS "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);
  CREATE TABLE IF NOT EXISTS "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);
  CREATE INDEX IF NOT EXISTS "session_userId_idx" on "session" ("userId");
  CREATE INDEX IF NOT EXISTS "account_userId_idx" on "account" ("userId");
  CREATE INDEX IF NOT EXISTS "verification_identifier_idx" on "verification" ("identifier");
`);

if (process.env.POLAR_ACCESS_TOKEN) {
    const missing = ['POLAR_WEBHOOK_SECRET', 'POLAR_PRODUCT_ID'].filter(k => !process.env[k])
    if (missing.length) {
        const msg = `[auth] Missing required env vars when POLAR_ACCESS_TOKEN is set: ${missing.join(', ')}`
        console.error(msg)
        throw new Error(msg)
    }
    if (process.env.NODE_ENV !== 'development' && process.env.POLAR_SERVER !== 'production') {
        console.warn('[auth] POLAR_SERVER is not set to "production" — Polar API calls will hit the sandbox')
    }
}

const polarClient = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN,
    server: (process.env.POLAR_SERVER ?? 'sandbox') as 'sandbox' | 'production',
});

export { db, polarClient };

export const auth = betterAuth({
    database: db,
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: [process.env.BETTER_AUTH_URL!],
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        }
    },
    plugins: [
        ...(process.env.POLAR_ACCESS_TOKEN ? [
            polar({
                client: polarClient,
                createCustomerOnSignUp: false,
                use: [
                    checkout({
                        products: [
                            {
                                productId: process.env.POLAR_PRODUCT_ID ?? "9ca90117-e4e5-4366-b152-83c3151bf79d",
                                slug: "full-archive"
                            }
                        ],
                        successUrl: `${process.env.BETTER_AUTH_URL}/success?checkout_id={CHECKOUT_ID}`,
                        authenticatedUsersOnly: true,
                        returnUrl: process.env.BETTER_AUTH_URL,
                    }),
                    portal(),
                    webhooks({
                        secret: process.env.POLAR_WEBHOOK_SECRET!,
                        onSubscriptionActive: async (payload) => {
                            console.log("Subscription activated:", payload.data.customerId);
                        },
                        onSubscriptionRevoked: async (payload) => {
                            console.log("Subscription revoked:", payload.data.customerId);
                        },
                    }),
                ],
            })
        ] : [])
    ]
})
