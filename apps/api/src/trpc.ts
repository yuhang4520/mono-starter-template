import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { ZodError, flattenError } from "zod";
import { db, type Database } from "db/client";
import { createWorkspaceService, WorkspaceError } from "@your-project/workspace";
import { extractToken, findSession } from "./auth";
import { identityTransformer } from "./lib/identityTransformer";
import { auth, type createAuth } from "./lib/auth";
export function requestHeaders(record: Record<string, string | string[] | undefined>) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(record)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(",") : value);
  return headers;
}
export function createContextFor(database: Database, authentication: ReturnType<typeof createAuth>) {
  return async ({ req }: CreateFastifyContextOptions) => {
    const token = await extractToken(requestHeaders(req.headers), "access");
    return { req, db: database, auth: authentication, workspace: createWorkspaceService(database), session: token ? await findSession(database, token) : undefined };
  };
}
export const createContext = createContextFor(db, auth);
export type Context = Awaited<ReturnType<typeof createContext>>;
const t = initTRPC.context<Context>().create({
  transformer: identityTransformer,
  errorFormatter: ({ shape, error }) => ({ ...shape,
    message: process.env.NODE_ENV === "production" && error.code === "INTERNAL_SERVER_ERROR" ? "服务暂时不可用" : shape.message,
    data: { ...shape.data, zodError: error.cause instanceof ZodError ? flattenError(error.cause) : null } }),
});
export const router = t.router;
export async function serviceCall<T>(call: () => Promise<T>): Promise<T> {
  try { return await call(); }
  catch (error) {
    if (error instanceof WorkspaceError) throw new TRPCError({ code: error.code, message: error.message, cause: error });
    if (error instanceof ZodError) throw new TRPCError({ code: "BAD_REQUEST", message: "输入无效", cause: error });
    throw error;
  }
}
export const publicProcedure = t.procedure;
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED", message: "请重新登录" });
  return next({ ctx: { ...ctx, session: ctx.session } });
});
