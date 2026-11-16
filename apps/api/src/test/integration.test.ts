import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { decodeJwt, SignJWT } from "jose";
import { createDatabase } from "db/client";
import { accounts, members, organizations, sessions, users } from "db/schema";
import { eq, inArray } from "db";
import { createWorkspaceService, WorkspaceError } from "@your-project/workspace";
import { buildServer } from "../server";

const url = process.env.TEST_DATABASE_URL;
// Tests only use an explicitly selected disposable database, never an application's .env.
test("authentication, tenant isolation, uploads and readiness", { skip: !url }, async (t) => {
  process.env.AUTH_SECRET = "test-only-".repeat(8);
  process.env.AUTH_URL = "http://localhost:4000";
  const pool = new Pool({ connectionString: url });
  const database = createDatabase(pool);
  const workspace = createWorkspaceService(database);
  const createdUsers: string[] = [];
  const createdOrgs: string[] = [];
  const writes: { key: string; body: Buffer; type: string }[] = [];
  const server = buildServer({ database, logging: false, storage: {
    async put(key, body, type) { writes.push({ key, body, type }); },
    async sign(key) { return `https://storage.invalid/${key}?signed=test`; },
  } });
  async function user(name: string, phoneNumber: string) {
    const id = randomUUID(); createdUsers.push(id);
    const email = `${id}@example.test`;
    await database.insert(users).values({ id, name, email, phoneNumber, username: phoneNumber, role: "user" });
    await database.insert(accounts).values({ id: randomUUID(), userId: id, accountId: id, providerId: "credential", password: await hashPassword("test-only-password-123"), updatedAt: new Date() });
    return { id, email, phoneNumber };
  }
  async function rpc(path: string, token?: string, input?: unknown, query = false) {
    return server.inject({ method: query ? "GET" : "POST", url: `/api/trpc/${path}${query && input !== undefined ? `?input=${encodeURIComponent(JSON.stringify(input))}` : ""}`,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(query ? {} : { payload: JSON.stringify(input === undefined ? {} : input) }),
    });
  }
  function multipart(parts: { name?: string; type: string; content: Buffer | string }[]) {
    const boundary = "template-test-boundary";
    const chunks: Buffer[] = [];
    for (const part of parts) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${part.name ?? "file"}"; filename="upload.bin"\r\nContent-Type: ${part.type}\r\n\r\n`), Buffer.from(part.content), Buffer.from("\r\n"));
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    return { payload: Buffer.concat(chunks), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
  }
  try {
    const owner = await user("Owner", `1${Date.now().toString().slice(-10)}`);
    const reader = await user("Reader", `2${Date.now().toString().slice(-10)}`);
    const outsider = await user("Outsider", `3${Date.now().toString().slice(-10)}`);
    await t.test("first administrator bootstrap is explicit and cannot be repeated", async () => {
      const script = resolve(process.cwd(), "../../scripts/bootstrap-admin.mts");
      const args = ["--import", "tsx", script, owner.email];
      const env = { ...process.env, DATABASE_URL: url };
      const attempts = await Promise.allSettled([
        promisify(execFile)(process.execPath, args, { env }),
        promisify(execFile)(process.execPath, ["--import", "tsx", script, reader.email], { env }),
      ]);
      assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1, "Concurrent bootstrap must promote exactly one administrator");
      const candidates = await database.select().from(users).where(inArray(users.id, [owner.id, reader.id]));
      assert.equal(candidates.filter(user => user.role === "admin").length, 1);
      assert.throws(() => execFileSync(process.execPath, ["--import", "tsx", script, reader.email], { env, stdio: "pipe" }));
      await database.update(users).set({ role: "user" }).where(inArray(users.id, [owner.id, reader.id]));
    });
    const login = await rpc("auth.loginByPhoneNumber", undefined, { phoneNumber: owner.phoneNumber, password: "test-only-password-123" });
    assert.equal(login.statusCode, 200, login.body);
    const { accessToken, refreshToken } = login.json().result.data;
    await t.test("JWT works without cookies; audiences and issuer are enforced", async () => {
      const me = await rpc("auth.getMe", accessToken, undefined, true);
      assert.equal(me.statusCode, 200, me.body); assert.equal(me.json().result.data.id, owner.id);
      assert.equal((await rpc("auth.getMe", refreshToken, undefined, true)).statusCode, 401);
      assert.equal((await rpc("auth.refresh", accessToken)).statusCode, 401);
      assert.equal((await rpc("auth.refresh", refreshToken)).statusCode, 200);
      const bad = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(owner.id).setJti(randomUUID()).setIssuer("https://wrong.invalid").setAudience("access").setExpirationTime("1h").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
      assert.equal((await rpc("auth.getMe", bad, undefined, true)).statusCode, 401);
    });
    await t.test("signed credentials still require a live session owned by the token subject", async () => {
      const sessionId = decodeJwt(accessToken).jti!;
      async function signed(subject: string, id: string) {
        return new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(subject).setJti(id)
          .setIssuer(process.env.AUTH_URL!).setAudience("access").setExpirationTime("1h")
          .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
      }
      assert.equal((await rpc("auth.getMe", await signed(owner.id, randomUUID()), undefined, true)).statusCode, 401);
      assert.equal((await rpc("auth.getMe", await signed(reader.id, sessionId), undefined, true)).statusCode, 401);
      const session = await database.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
      assert.ok(session);
      await database.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, sessionId));
      assert.equal((await rpc("auth.getMe", accessToken, undefined, true)).statusCode, 401);
      assert.equal((await rpc("auth.refresh", refreshToken)).statusCode, 401);
      await database.update(sessions).set({ expiresAt: session.expiresAt }).where(eq(sessions.id, sessionId));
    });
    const org = await workspace.createOrganization(owner.id, { name: "Test", slug: `org-${randomUUID()}` }); createdOrgs.push(org.id);
    const otherOrg = await workspace.createOrganization(outsider.id, { name: "Other", slug: `org-${randomUUID()}` }); createdOrgs.push(otherOrg.id);
    const member = await workspace.addMember(owner.id, { organizationId: org.id, email: reader.email, role: "member" });
    const note = await workspace.createNote(owner.id, { organizationId: org.id, title: "Private note" });
    await t.test("members read; only current administrators write; tenants cannot cross IDs", async () => {
      await assert.rejects(workspace.addMember(owner.id, { organizationId: org.id, email: reader.email, role: "member" }), (error: unknown) => error instanceof WorkspaceError && error.code === "CONFLICT");
      const ownerMember = await workspace.requireMember(owner.id, org.id);
      await assert.rejects(workspace.removeMember(owner.id, { organizationId: org.id, memberId: ownerMember.memberId }));
      await assert.rejects(workspace.updateMemberRole(owner.id, { organizationId: org.id, memberId: ownerMember.memberId, role: "member" }));
      assert.equal((await workspace.listNotes(reader.id, { organizationId: org.id })).items.length, 1);
      await assert.rejects(workspace.createNote(reader.id, { organizationId: org.id, title: "No" }), (error: unknown) => error instanceof WorkspaceError && error.code === "FORBIDDEN");
      await assert.rejects(workspace.listNotes(outsider.id, { organizationId: org.id }), (error: unknown) => error instanceof WorkspaceError && error.code === "FORBIDDEN");
      await assert.rejects(workspace.updateNote(outsider.id, { organizationId: otherOrg.id, id: note.id, title: "No" }), (error: unknown) => error instanceof WorkspaceError && error.code === "NOT_FOUND");
      assert.equal((await rpc("workspace.notes", accessToken, { organizationId: otherOrg.id }, true)).statusCode, 403);
      await workspace.updateMemberRole(owner.id, { organizationId: org.id, memberId: member.id, role: "admin" });
      await workspace.createNote(reader.id, { organizationId: org.id, title: "Allowed" });
      await workspace.updateMemberRole(owner.id, { organizationId: org.id, memberId: member.id, role: "member" });
      await assert.rejects(workspace.deleteNote(reader.id, { organizationId: org.id, id: note.id }));
      await workspace.removeMember(owner.id, { organizationId: org.id, memberId: member.id });
      await assert.rejects(workspace.listNotes(reader.id, { organizationId: org.id }));
      await database.update(organizations).set({ locked: true }).where(eq(organizations.id, org.id));
      await assert.rejects(workspace.listNotes(owner.id, { organizationId: org.id }));
      await database.update(organizations).set({ locked: false }).where(eq(organizations.id, org.id));
    });
    await t.test("upload validates authentication, bytes, size, parts and private ownership", async () => {
      const good = multipart([{ type: "application/pdf", content: "%PDF-1.7\nexample" }]);
      assert.equal((await server.inject({ method: "POST", url: "/api/upload", ...good })).statusCode, 401);
      const uploaded = await server.inject({ method: "POST", url: "/api/upload", ...good, headers: { ...good.headers, authorization: `Bearer ${accessToken}` } });
      assert.equal(uploaded.statusCode, 201, uploaded.body);
      const key = uploaded.json().key; assert.equal(writes.length, 1);
      assert.equal((await server.inject({ url: `/api/files?key=${encodeURIComponent(key)}`, headers: { authorization: `Bearer ${accessToken}` } })).statusCode, 200);
      assert.equal((await server.inject({ url: `/api/files?key=users/${reader.id}/${randomUUID()}.pdf`, headers: { authorization: `Bearer ${accessToken}` } })).statusCode, 403);
      for (const parts of [[{ type: "image/png", content: "not a png" }], [{ type: "text/html", content: "<script>" }], [{ type: "application/pdf", content: "%PDF-1.7" }, { type: "application/pdf", content: "%PDF-1.7" }], [{ type: "application/pdf", content: Buffer.alloc(10 * 1024 * 1024 + 1) }]]) {
        const request = multipart(parts);
        const response = await server.inject({ method: "POST", url: "/api/upload", ...request, headers: { ...request.headers, authorization: `Bearer ${accessToken}` } });
        assert.ok(response.statusCode >= 400, response.body);
      }
      assert.equal(writes.length, 1);
    });
    await t.test("ban is checked on access and refresh; expired bans recover", async () => {
      await database.update(users).set({ banned: true }).where(eq(users.id, owner.id));
      assert.equal((await rpc("auth.getMe", accessToken, undefined, true)).statusCode, 401);
      assert.equal((await rpc("auth.refresh", refreshToken)).statusCode, 401);
      await database.update(users).set({ banExpires: new Date(Date.now() - 1000) }).where(eq(users.id, owner.id));
      assert.equal((await rpc("auth.getMe", accessToken, undefined, true)).statusCode, 200);
    });
    await t.test("logout revokes both credentials and readiness queries the database", async () => {
      assert.equal((await server.inject({ url: "/ready" })).statusCode, 200);
      assert.equal((await rpc("auth.logout", accessToken)).statusCode, 200);
      assert.equal((await rpc("auth.getMe", accessToken, undefined, true)).statusCode, 401);
      assert.equal((await rpc("auth.refresh", refreshToken)).statusCode, 401);
    });
  } finally {
    await server.close();
    if (createdOrgs.length) await database.delete(organizations).where(inArray(organizations.id, createdOrgs));
    if (createdUsers.length) await database.delete(users).where(inArray(users.id, createdUsers));
    await pool.end();
  }
});
