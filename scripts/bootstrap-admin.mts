import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
config({ path: resolve(fileURLToPath(new URL("../packages/db/.env", import.meta.url))) });

async function main() {
  const email = process.argv[2];
  if (!email || !email.includes("@") || process.argv.length !== 3) throw new Error("Usage: pnpm bootstrap:admin <registered-user-email>");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required; use packages/db/.env or an explicit environment variable");
  const { db, pool } = await import("../packages/db/src/client");
  const { users } = await import("../packages/db/src/schema");
  const { eq, sql } = await import("../packages/db/src/index");
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('template:first-admin', 0))`);
      const existing = await tx.query.users.findFirst({ where: eq(users.role, "admin") });
      if (existing) throw new Error("An administrator already exists; use a controlled maintenance procedure for additional administrators");
      const [user] = await tx.update(users).set({ role: "admin" }).where(eq(users.email, email)).returning({ id: users.id });
      if (!user) throw new Error("Register this user before bootstrapping the administrator");
    });
    console.log("First administrator initialized.");
  } finally { await pool.end(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Bootstrap failed"); process.exitCode = 1; });
