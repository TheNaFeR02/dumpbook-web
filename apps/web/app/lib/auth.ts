import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import path from "path";
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import env from "./env";

const dbPath = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), "data", "auth.sqlite");

const db = new Database(dbPath);

export const polarClient = new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: env.POLAR_SERVER,
});

export const auth = betterAuth({
    database: db,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.BETTER_AUTH_URL],
    socialProviders: {
        google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
        }
    },
    plugins: [
        polar({
            client: polarClient,
            createCustomerOnSignUp: true,
            use: [
                checkout({
                    products: [
                        {
                            productId: env.POLAR_PRODUCT_ID,
                            slug: "full-archive"
                        }
                    ],
                    successUrl: "/success?checkout_id={CHECKOUT_ID}",
                    authenticatedUsersOnly: true,
                    returnUrl: env.BETTER_AUTH_URL
                }),
                portal(),
                webhooks({
                    secret: env.POLAR_WEBHOOK_SECRET,
                })
            ],
        })
    ]
})
