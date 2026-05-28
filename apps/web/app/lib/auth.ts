import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import path from "path";

const dbPath = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), "data", "auth.sqlite");

const db = new Database(dbPath);

export const auth = betterAuth({
    database: db,
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: [process.env.BETTER_AUTH_URL!],
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        }
    }
})
