import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schemas from "./schema";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export function createDatabase(client: Pool) {
  return drizzle({ client, schema: schemas, casing: "snake_case" });
}

export const db = createDatabase(pool);
export type Database = typeof db;
