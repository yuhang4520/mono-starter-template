import assert from "node:assert/strict";
import { test } from "node:test";
import fastify from "fastify";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { APIError } from "better-auth/api";
import { authRouter } from "../routers/auth";
import type { Context } from "../trpc";

async function loginResponse(failure: unknown) {
  const server = fastify({ logger: false });
  // Exercise the real router and HTTP error serialization; only the failed
  // authentication dependency is substituted, so no database is required.
  await server.register(fastifyTRPCPlugin, {
    prefix: "/auth",
    trpcOptions: {
      router: authRouter,
      createContext: () => ({ auth: { api: { signInPhoneNumber: async () => { throw failure; } } } } as unknown as Context),
    },
  });
  try {
    const response = await server.inject({ method: "POST", url: "/auth/loginByPhoneNumber", payload: { phoneNumber: "13800138000", password: "test-input" } });
    return { status: response.statusCode, error: response.json().error };
  } finally {
    await server.close();
  }
}

test("only explicit Better Auth credential and banned-account errors return 401", async () => {
  for (const code of ["INVALID_PHONE_NUMBER", "INVALID_PHONE_NUMBER_OR_PASSWORD", "PHONE_NUMBER_NOT_VERIFIED", "BANNED_USER"]) {
    const failure = new APIError(code === "BANNED_USER" ? "FORBIDDEN" : "UNAUTHORIZED", { code, message: "private upstream detail" });
    const response = await loginResponse(failure);
    assert.equal(response.status, 401, code);
    assert.equal(response.error.data.code, "UNAUTHORIZED", code);
    assert.ok(!response.error.message.includes("private upstream detail"));
  }
});

test("database and unknown authentication failures return 500 instead of invalid credentials", async () => {
  const databaseError = Object.assign(new Error("private database query parameters"), { code: "ECONNREFUSED" });
  const failures = [
    databaseError,
    new APIError("INTERNAL_SERVER_ERROR", { code: "INTERNAL_SERVER_ERROR", message: "private upstream detail" }),
    new APIError("UNAUTHORIZED", { code: "FAILED_TO_CREATE_SESSION", message: "private upstream detail" }),
    new APIError("UNAUTHORIZED", { code: "UNEXPECTED_ERROR", message: "private upstream detail" }),
    new Error("private unexpected failure"),
    { code: "INVALID_PHONE_NUMBER_OR_PASSWORD", message: "not a typed authentication error" },
  ];
  for (const failure of failures) {
    const response = await loginResponse(failure);
    assert.equal(response.status, 500);
    assert.equal(response.error.data.code, "INTERNAL_SERVER_ERROR");
    assert.ok(!response.error.message.includes("private"));
    assert.notEqual(response.error.message, "手机号或密码错误");
  }
});
