import pino, { type LoggerOptions } from "pino";

const level =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === "production" ? "info" : "debug");

const baseOptions: LoggerOptions = {
  level,
  messageKey: "message",
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: "starter-api",
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "request.headers.authorization",
      "request.headers.cookie",
      "headers.authorization",
      "headers.cookie",
    ],
    remove: true,
  },
};

export const loggerOptions = baseOptions;
export const logger = pino(baseOptions);

type ErrorLogger = {
  error: (obj: unknown, msg?: string) => void;
};

export function logError(
  log: ErrorLogger,
  error: unknown,
  context: Record<string, unknown>,
  message: string
) {
  // Drizzle includes SQL parameters in Error.message, and Pino's default error
  // serializer expands causes and custom properties. Never serialize raw errors.
  const chain: { type: string; code?: string }[] = [];
  const seen = new Set<object>();
  let cause: unknown = error;
  while (typeof cause === "object" && cause !== null && !seen.has(cause) && chain.length < 5) {
    seen.add(cause);
    const type = cause instanceof Error ? cause.name : "Error";
    const code = "code" in cause && typeof cause.code === "string" && /^[A-Z0-9_]{1,64}$/.test(cause.code) ? cause.code : undefined;
    chain.push({ type: /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(type) ? type : "Error", ...(code ? { code } : {}) });
    cause = "cause" in cause ? cause.cause : undefined;
  }
  log.error({ error: chain.length ? chain : [{ type: "Error" }], ...context }, message);
}
