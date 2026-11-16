import { z } from "zod";
import { and, eq } from "db";
import { sessions, users } from "db/schema";
import { TRPCError } from "@trpc/server";
import { APIError } from "better-auth/api";
import { protectedProcedure, publicProcedure, requestHeaders, router } from "../trpc";
import { extractToken, findSession, toToken } from "../auth";
import { isUserBanned } from "@your-project/workspace";
export interface User { id: string; name: string; email: string; phoneNumber?: string | null }
const credentialErrorCodes = new Set(["INVALID_PHONE_NUMBER", "INVALID_PHONE_NUMBER_OR_PASSWORD", "PHONE_NUMBER_NOT_VERIFIED", "BANNED_USER"]);
function publicUser(user: User): User { return { id: user.id, name: user.name, email: user.email, phoneNumber: user.phoneNumber }; }
async function issueTokens(userId: string, session: { id: string; expiresAt: Date }) {
  const remaining = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
  if (remaining <= 0) throw new TRPCError({ code: "UNAUTHORIZED", message: "登录已过期" });
  const [accessToken, refreshToken] = await Promise.all([
    toToken(userId, "access", Math.min(7200, remaining), { id: session.id }),
    toToken(userId, "refresh", remaining, { id: session.id }),
  ]);
  return { accessToken, refreshToken };
}
export const authRouter = router({
  loginByPhoneNumber: publicProcedure.input(z.object({ phoneNumber: z.string().trim().min(6).max(30), password: z.string().min(6).max(128) })).mutation(async ({ input, ctx }) => {
    let result;
    try { result = await ctx.auth.api.signInPhoneNumber({ body: { ...input, rememberMe: true } }); }
    catch (error) {
      // Better Auth also uses APIError for infrastructure/session failures. Only
      // explicit credential or account denials should invalidate client auth.
      if (error instanceof APIError && [400, 401, 403].includes(error.statusCode)
        && typeof error.body?.code === "string" && credentialErrorCodes.has(error.body.code)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: error.body.code === "BANNED_USER" ? "账号不可用" : "手机号或密码错误", cause: error });
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暂时无法登录，请稍后重试", cause: error });
    }
    const session = await ctx.db.query.sessions.findFirst({ where: and(eq(sessions.token, result.token), eq(sessions.userId, result.user.id)) });
    const user = await ctx.db.query.users.findFirst({ where: eq(users.id, result.user.id) });
    if (!session || !user || isUserBanned(user)) {
      if (session) await ctx.db.delete(sessions).where(eq(sessions.id, session.id));
      throw new TRPCError({ code: "UNAUTHORIZED", message: "账号不可用" });
    }
    return { ...await issueTokens(user.id, session), user: publicUser(user) };
  }),
  refresh: publicProcedure.mutation(async ({ ctx }) => {
    const token = await extractToken(requestHeaders(ctx.req.headers), "refresh");
    if (!token || !await findSession(ctx.db, token)) throw new TRPCError({ code: "UNAUTHORIZED", message: "登录已过期" });
    const session = await ctx.db.query.sessions.findFirst({ where: eq(sessions.id, token.jti) });
    if (!session) throw new TRPCError({ code: "UNAUTHORIZED" });
    return issueTokens(token.sub, session);
  }),
  getMe: protectedProcedure.query(({ ctx }) => publicUser(ctx.session.user)),
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.delete(sessions).where(and(eq(sessions.id, ctx.session.token.jti), eq(sessions.userId, ctx.session.user.id)));
    return { success: true as const };
  }),
});
