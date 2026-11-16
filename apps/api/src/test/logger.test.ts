import assert from "node:assert/strict";
import { test } from "node:test";
import { logError } from "../logger";

test("error logs keep diagnostic codes without database values or nested credentials", () => {
  const databaseError = Object.assign(new Error("duplicate private-note-content"), { code: "23505", detail: "private-account-data" });
  const queryError = Object.assign(new Error("Failed query: insert into notes; params: private-note-content", { cause: databaseError }), { params: ["private-account-data"] });
  const error = new Error("request failed with private-token-value", { cause: queryError });
  const records: unknown[] = [];
  logError({ error: (record, message) => records.push({ record, message }) }, error, { reqId: "request-123", trpc: { path: "workspace.createNote", code: "INTERNAL_SERVER_ERROR" } }, "tRPC request failed");
  const output = JSON.stringify(records);
  assert.match(output, /23505/);
  assert.match(output, /request-123/);
  assert.match(output, /workspace.createNote/);
  for (const sensitive of ["private-note-content", "private-account-data", "private-token-value", "Failed query", "insert into notes"])
    assert.ok(!output.includes(sensitive));
});

test("error logging handles arbitrary thrown values and circular causes without copying them", () => {
  const error = new Error("private-content");
  error.cause = error;
  const records: unknown[] = [];
  const logger = { error: (record: unknown) => records.push(record) };
  logError(logger, error, {}, "Request failed");
  logError(logger, "private-content", {}, "Request failed");
  assert.equal(records.length, 2);
  assert.ok(!JSON.stringify(records).includes("private-content"));
});
