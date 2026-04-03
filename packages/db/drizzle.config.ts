import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import path from "path";

// 加载 apps/admin/.env 文件（包含 DATABASE_URL 等环境变量）
dotenv.config({
  path: path.resolve(__dirname, "../../apps/admin/.env"),
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
