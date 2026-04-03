import { fastifyTRPCPlugin, FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { randomUUID } from "node:crypto";

import { appRouter, type AppRouter } from "./router";
import { createContext } from "./trpc";
import { extractToken } from "./auth";
import { logger, loggerOptions, logError } from "./logger";

export const server = fastify({
  routerOptions: { maxParamLength: 5000 },
  genReqId: (req) => {
    const header = req.headers["x-request-id"];
    if (Array.isArray(header)) return header[0] || randomUUID();
    if (typeof header === "string" && header.length > 0) return header;
    return randomUUID();
  },
  logger: loggerOptions,
});

server.addHook("onRequest", async (request, reply) => {
  reply.header("x-request-id", request.id);
});

server.addHook("onRequest", async (request) => {
  const headers = new Headers(request.headers as Record<string, string>);
  const token = await extractToken(headers, "access");
  if (token) {
    const pinoLogger = request.log as any;
    if (typeof pinoLogger.setBindings === "function") {
      pinoLogger.setBindings({ user: { id: token.sub, studentId: token.studentId } });
    } else {
      request.log = request.log.child({ user: { id: token.sub, studentId: token.studentId } });
    }
  }
});

server.register(fastifyCors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400,
});

server.register(fastifyTRPCPlugin, {
  prefix: "/api/trpc",
  trpcOptions: {
    router: appRouter,
    createContext,
    onError: ({ ctx, error, path, type }) => {
      const requestId = ctx?.req?.id;
      const log = ctx?.req?.log ?? logger;
      logError(
        log,
        error,
        {
          reqId: requestId,
          trpc: { path: path ?? "<no-path>", type, code: error.code },
        },
        "tRPC request failed"
      );
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
});

server.setErrorHandler((error, request, reply) => {
  const err = error as { statusCode?: number; message?: string; code?: string; stack?: string };
  const statusCode = err.statusCode ?? reply.statusCode ?? 500;

  logError(
    request.log,
    error,
    { reqId: request.id, http: { method: request.method, url: request.url, statusCode } },
    "Request failed"
  );

  const isProd = process.env.NODE_ENV === "production";
  const responseError: Record<string, string | undefined> = {
    message: err.message ?? "Internal Server Error",
    code: err.code,
  };
  if (!isProd && err.stack) responseError.stack = err.stack;

  reply.status(statusCode).send({ error: responseError, reqId: request.id });
});

server.get("/health", async (_req, res) => {
  return res.status(200).send({ status: "ok" });
});
