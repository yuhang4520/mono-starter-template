import { db, type Database } from "db/client";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { phoneNumber, username } from "better-auth/plugins";
export function createAuth(database: Database) {
  return betterAuth({
    database: drizzleAdapter(database, { provider: "pg", usePlural: true }),
    advanced: { database: { generateId: "uuid" } },
    plugins: [phoneNumber(), username()],
    session: { expiresIn: 30 * 86400 },
    emailAndPassword: { enabled: true, minPasswordLength: 8, disableSignUp: true },
  });
}
export const auth = createAuth(db);
