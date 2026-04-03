import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { extractToken, toToken } from "../auth";
import { TRPCError } from "@trpc/server";
import { auth } from "../lib/auth";

function toHeaders(record: Record<string, unknown>) {
  const headers = new Headers();
  Object.entries(record).forEach(([key, value]) => {
    if (value != null) headers.append(key, String(value));
  });
  return headers;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
}

export const authRouter = router({
  /**
   * 手机号密码登录
   * 返回访问令牌、刷新令牌和用户信息
   */
  loginByPhoneNumber: publicProcedure
    .input(
      z.object({
        phoneNumber: z.string(),
        password: z.string().min(6),
      })
    )
    .mutation(async ({ input }) => {
      const { user } = await auth.api.signInPhoneNumber({
        body: {
          phoneNumber: input.phoneNumber,
          password: input.password,
          rememberMe: true,
        },
      });

      const accessToken = await toToken(user.id, "access", 2 * 3600);
      const refreshToken = await toToken(user.id, "refresh", 30 * 86400);

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
        } satisfies User,
      };
    }),

  /**
   * 刷新令牌
   * 使用刷新令牌获取新的访问令牌和刷新令牌
   */
  refresh: publicProcedure.mutation(
    async ({ ctx }): Promise<{ accessToken: string; refreshToken: string }> => {
      const headers = toHeaders(ctx.req.headers as Record<string, unknown>);
      const token = await extractToken(headers, "refresh");

      if (!token) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid refresh token",
        });
      }

      const accessToken = await toToken(token.sub, "access", 2 * 3600);
      const refreshToken = await toToken(token.sub, "refresh", 30 * 86400);

      return { accessToken, refreshToken };
    }
  ),

  /**
   * 获取当前用户信息
   */
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const headers = toHeaders(ctx.req.headers as Record<string, unknown>);
    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      phoneNumber: session.user.phoneNumber,
    } satisfies User;
  }),
});
