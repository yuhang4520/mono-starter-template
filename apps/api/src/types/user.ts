import type { inferProcedureOutput } from "@trpc/server";
import type { authRouter } from "../routers/auth";

/**
 * 用户基本信息封装类型
 * getMe 返回的用户信息
 */
export type UserInfo = inferProcedureOutput<typeof authRouter.getMe>;

/**
 * 登录后的授权返回信息
 */
export type AuthResponse = inferProcedureOutput<typeof authRouter.loginByPhoneNumber>;
