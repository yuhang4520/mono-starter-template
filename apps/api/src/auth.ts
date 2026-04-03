import { jwtVerify, SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
const issuer = process.env.AUTH_URL!;

const alg = "HS256";

export type Session = {
  token: {
    sub: string;
    exp: number;
    iss: string;
    jti: string;
  };
};

export async function toToken(
  sub: string,
  tokenType: "access" | "refresh",
  expiresIn: number,
  options?: {
    id?: string;
  }
) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg })
    .setJti(options?.id ?? crypto.randomUUID())
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience([tokenType])
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(secret);

  return token;
}

export async function extractToken(
  headers: Headers,
  expectedType: "access" | "refresh"
): Promise<Session["token"] | undefined> {
  const bearerValue = headers.get("Authorization");

  const tokenValue = bearerValue?.startsWith("Bearer ")
    ? bearerValue.slice(7)
    : null;

  if (!tokenValue) {
    return;
  }

  try {
    const token = await jwtVerify(tokenValue, secret, {
      algorithms: [alg],
      audience: expectedType,
    });

    if (
      !token.payload.sub ||
      !token.payload.exp ||
      !token.payload.iss ||
      !token.payload.jti
    ) {
      return;
    }

    return {
      sub: token.payload.sub as string,
      exp: token.payload.exp,
      iss: token.payload.iss,
      jti: token.payload.jti,
    };
  } catch (error) {
    return;
  }
}
