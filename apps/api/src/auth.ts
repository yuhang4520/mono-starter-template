import { jwtVerify, SignJWT } from "jose";
import { and, eq, gt } from "db";
import type { Database } from "db/client";
import { sessions, users } from "db/schema";
import { isUserBanned } from "@your-project/workspace";

const alg = "HS256";
export type Token = { sub: string; exp: number; iss: string; jti: string };
export type Session = { token: Token; user: typeof users.$inferSelect };
function config() {
  const secret = process.env.AUTH_SECRET;
  const issuer = process.env.AUTH_URL;
  if (!secret || secret.length < 32 || !issuer) throw new Error("AUTH_SECRET (at least 32 characters) and AUTH_URL are required");
  return { secret: new TextEncoder().encode(secret), issuer };
}
export function validateAuthConfig() { config(); }
export async function toToken(sub: string, tokenType: "access" | "refresh", expiresIn: number, options: { id: string }) {
  const { secret, issuer } = config();
  return new SignJWT({}).setProtectedHeader({ alg }).setJti(options.id).setSubject(sub)
    .setIssuer(issuer).setAudience(tokenType).setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(expiresIn))).sign(secret);
}
export async function extractToken(headers: Headers, expectedType: "access" | "refresh"): Promise<Token | undefined> {
  const bearer = headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) return undefined;
  const { secret, issuer } = config();
  try {
    const { payload } = await jwtVerify(bearer.slice(7), secret, { algorithms: [alg], audience: expectedType, issuer });
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number" || typeof payload.iss !== "string" || typeof payload.jti !== "string") return undefined;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(payload.sub) || !uuid.test(payload.jti)) return undefined;
    return { sub: payload.sub, exp: payload.exp, iss: payload.iss, jti: payload.jti };
  } catch { return undefined; }
}
export async function findSession(database: Database, token: Token): Promise<Session | undefined> {
  const [row] = await database.select({ user: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, token.jti), eq(sessions.userId, token.sub), gt(sessions.expiresAt, new Date()))).limit(1);
  return row && !isUserBanned(row.user) ? { token, user: row.user } : undefined;
}
