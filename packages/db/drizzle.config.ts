import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import path from "path";

// CLI and migration containers own their configuration; shell variables take precedence.
dotenv.config({
  path: path.resolve(__dirname, ".env"),
});

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema.ts",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
