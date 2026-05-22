import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// creates db programatically in /data/auth.sqlite 
const dbPath = path.join(process.cwd(), "data", "auth.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const auth = betterAuth({
    database: new Database("./data/auth.sqlite"),
    baseURL: process.env.BETTER_AUTH_URL,
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
        }
    } 
})