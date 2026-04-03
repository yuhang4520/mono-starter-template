import { db } from "db/client";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { phoneNumber, username } from "better-auth/plugins";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  plugins: [phoneNumber(), username()],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    disableSignUp: true,
  },
});
