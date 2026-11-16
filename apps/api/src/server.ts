import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { db, type Database } from "db/client";
import { sql } from "db";
import { appRouter } from "./router";
import { createContextFor, requestHeaders } from "./trpc";
import { extractToken, findSession } from "./auth";
import { createAuth } from "./lib/auth";
import { createStorage, uploadTypes, validFileSignature, type FileStorage } from "./lib/storage";
import { loggerOptions, logError } from "./logger";

export function buildServer(options: { database?: Database; storage?: FileStorage; logging?: boolean } = {}) {
  const database = options.database ?? db;
  const storage = options.storage ?? createStorage();
  const server = fastify({
    routerOptions: { maxParamLength: 5000 },
    bodyLimit: 11 * 1024 * 1024,
    genReqId: () => randomUUID(),
    logger: options.logging === false ? false : loggerOptions,
  });
  server.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
    const diagnostic = (name: string) => {
      const value = request.headers[name];
      return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 128) : undefined;
    };
    // Client metadata is untrusted diagnostics only, never identity or authorization.
    request.log = request.log.child({ client: { source: diagnostic("x-app-source"), platform: diagnostic("x-app-platform"), version: diagnostic("x-app-version"), os: diagnostic("x-client-os") } });
  });
  const origins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:5173").split(",").map((value) => value.trim()).filter(Boolean);
  server.register(fastifyCors, {
    origin: origins, methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-App-Source", "X-App-Platform", "X-App-Version", "X-Client-OS"],
    exposedHeaders: ["x-request-id"], credentials: false, maxAge: 86400,
  });
  server.register(fastifyTRPCPlugin, { prefix: "/api/trpc", trpcOptions: {
    router: appRouter, createContext: createContextFor(database, createAuth(database)),
    onError: ({ ctx, error, path, type }) => { logError(ctx?.req.log ?? server.log, error, { reqId: ctx?.req.id, trpc: { path, type, code: error.code } }, "tRPC request failed"); },
  } });
  server.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 1 } });
  async function authenticated(headers: Record<string, string | string[] | undefined>) {
    const token = await extractToken(requestHeaders(headers), "access");
    return token ? findSession(database, token) : undefined;
  }
  server.post("/api/upload", async (request, reply) => {
    const session = await authenticated(request.headers);
    if (!session) return reply.code(401).send({ error: { message: "请重新登录" } });
    const chunks: Buffer[] = [];
    let type: string | undefined;
    // Consume the entire multipart stream before writing, so a second part cannot be silently accepted.
    for await (const part of request.parts()) {
      if (part.type !== "file" || part.fieldname !== "file" || !uploadTypes[part.mimetype]) return reply.code(400).send({ error: { message: "仅支持 PNG/JPEG/WebP/PDF 文件" } });
      type = part.mimetype;
      chunks.push(await part.toBuffer());
    }
    const body = chunks[0];
    if (!body?.length || !type || !validFileSignature(body, type)) return reply.code(400).send({ error: { message: "文件内容与类型不匹配" } });
    const key = `users/${session.user.id}/${randomUUID()}.${uploadTypes[type]}`;
    await storage.put(key, body, type);
    return reply.code(201).send({ key });
  });
  server.get<{ Querystring: { key?: string } }>("/api/files", async (request, reply) => {
    const session = await authenticated(request.headers);
    if (!session) return reply.code(401).send({ error: { message: "请重新登录" } });
    const key = request.query.key;
    const prefix = `users/${session.user.id}/`;
    if (typeof key !== "string" || !key.startsWith(prefix) || !/^[0-9a-f-]{36}\.(png|jpg|webp|pdf)$/.test(key.slice(prefix.length))) return reply.code(403).send({ error: { message: "无法访问该文件" } });
    return { url: await storage.sign(key), expiresIn: 900 };
  });
  server.get("/health", async () => ({ status: "ok" }));
  server.get("/ready", async (_request, reply) => {
    try { await database.execute(sql`select 1`); return { status: "ready" }; }
    catch { return reply.code(503).send({ status: "unavailable" }); }
  });
  server.setErrorHandler((error, request, reply) => {
    const status = typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : undefined;
    const statusCode = typeof status === "number" && status >= 400 && status < 600 ? status : 500;
    logError(request.log, error, { reqId: request.id, statusCode }, "Request failed");
    reply.code(statusCode).send({ error: { message: statusCode >= 500 ? "服务暂时不可用" : error instanceof Error ? error.message : "请求无效" }, reqId: request.id });
  });
  return server;
}
export const server = buildServer();
