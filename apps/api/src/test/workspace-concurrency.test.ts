import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { Pool, type PoolClient } from "pg";
import { eq, inArray } from "db";
import { createDatabase } from "db/client";
import { members, notes, organizations, users } from "db/schema";
import { createWorkspaceService, WorkspaceError } from "@your-project/workspace";

const url = process.env.TEST_DATABASE_URL;
test("workspace mutations serialize authorization with concurrent revocation", { skip: !url }, async (t) => {
  const name = `workspace-race-${randomUUID()}`;
  const pool = new Pool({ connectionString: url, application_name: name, max: 6, statement_timeout: 5000 });
  const database = createDatabase(pool);
  const workspace = createWorkspaceService(database);
  const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const [ownerId, actorId, targetId, newcomerId] = ids as [string, string, string, string];
  let organizationId: string | undefined;
  try {
    await database.insert(users).values(ids.map(id => ({ id, name: "Concurrency test", email: `${id}@example.test`, role: "user" })));
    const organization = await workspace.createOrganization(ownerId, { name: "Concurrency test", slug: `race-${randomUUID()}` });
    organizationId = organization.id;
    let actor = await workspace.addMember(ownerId, { organizationId, email: `${actorId}@example.test`, role: "admin" });
    const target = await workspace.addMember(ownerId, { organizationId, email: `${targetId}@example.test`, role: "member" });
    const note = await workspace.createNote(ownerId, { organizationId, title: "Original" });
    const orgId = organizationId;

    async function blockedMutation(change: (client: PoolClient) => Promise<unknown>, mutate: () => Promise<unknown>, expectedCode: string) {
      const blocker = await pool.connect();
      await blocker.query("BEGIN");
      let operation: Promise<{ error?: unknown; value?: unknown }> | undefined;
      try {
        await change(blocker);
        let settled = false;
        operation = mutate().then(value => ({ value }), error => ({ error })).finally(() => { settled = true; });
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const result = await pool.query("select 1 from pg_stat_activity where application_name = $1 and wait_event_type = 'Lock' and pid <> pg_backend_pid()", [name]);
          if (result.rowCount) { waiting = true; break; }
          if (settled) break;
          await delay(10);
        }
        assert.ok(waiting, "Mutation must wait for the in-flight authorization change, not use the old committed role");
        await blocker.query("COMMIT");
        const outcome = await operation;
        assert.ok(outcome.error instanceof WorkspaceError, "Mutation must be rejected after revocation commits");
        assert.equal(outcome.error.code, expectedCode);
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
        await operation;
      }
    }

    for (const operation of ["create", "update", "delete", "addMember", "removeMember", "updateMemberRole"] as const) {
      await t.test(`${operation} rechecks a role change that was uncommitted at request start`, async () => {
        await database.update(members).set({ role: operation === "updateMemberRole" ? "owner" : "admin" }).where(eq(members.id, actor.id));
        const mutations = {
          create: () => workspace.createNote(actorId, { organizationId: orgId, title: "Must not exist" }),
          update: () => workspace.updateNote(actorId, { organizationId: orgId, id: note.id, title: "Must not change" }),
          delete: () => workspace.deleteNote(actorId, { organizationId: orgId, id: note.id }),
          addMember: () => workspace.addMember(actorId, { organizationId: orgId, email: `${newcomerId}@example.test`, role: "member" }),
          removeMember: () => workspace.removeMember(actorId, { organizationId: orgId, memberId: target.id }),
          updateMemberRole: () => workspace.updateMemberRole(actorId, { organizationId: orgId, memberId: target.id, role: "admin" }),
        };
        await blockedMutation(client => client.query("update members set role = 'member' where id = $1", [actor.id]), mutations[operation], "FORBIDDEN");
        assert.equal((await database.query.notes.findFirst({ where: eq(notes.id, note.id) }))?.title, "Original");
        assert.equal((await database.query.members.findFirst({ where: eq(members.id, target.id) }))?.role, "member");
      });
    }
    await t.test("membership removal, locked organization and banned user each block writes", async () => {
      await database.update(members).set({ role: "admin" }).where(eq(members.id, actor.id));
      const create = () => workspace.createNote(actorId, { organizationId: orgId, title: "Must not exist" });
      await blockedMutation(client => client.query("delete from members where id = $1", [actor.id]), create, "FORBIDDEN");
      actor = await workspace.addMember(ownerId, { organizationId: orgId, email: `${actorId}@example.test`, role: "admin" });
      await blockedMutation(client => client.query("update organizations set locked = true where id = $1", [orgId]), create, "FORBIDDEN");
      await database.update(organizations).set({ locked: false }).where(eq(organizations.id, orgId));
      await blockedMutation(client => client.query("update users set banned = true where id = $1", [actorId]), create, "UNAUTHORIZED");
      await database.update(users).set({ banned: false }).where(eq(users.id, actorId));
      assert.equal((await workspace.listNotes(ownerId, { organizationId: orgId })).total, 1);
    });
    await t.test("concurrent member additions produce one row and controlled conflicts", async () => {
      const results = await Promise.allSettled(Array.from({ length: 5 }, () => workspace.addMember(ownerId, { organizationId: orgId, email: `${newcomerId}@example.test`, role: "member" })));
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      for (const result of results) if (result.status === "rejected") {
        assert.ok(result.reason instanceof WorkspaceError);
        assert.equal(result.reason.code, "CONFLICT");
      }
      const rows = await workspace.listMembers(ownerId, orgId);
      assert.equal(rows.filter(row => row.userId === newcomerId).length, 1);
    });
    await t.test("organization creation waits for concurrent account disable", async () => {
      await blockedMutation(client => client.query("update users set banned = true where id = $1", [actorId]),
        () => workspace.createOrganization(actorId, { name: "Must not exist", slug: `blocked-${randomUUID()}` }), "UNAUTHORIZED");
      assert.equal((await database.select().from(organizations).where(eq(organizations.name, "Must not exist"))).length, 0);
    });
  } finally {
    if (organizationId) await database.delete(organizations).where(eq(organizations.id, organizationId));
    await database.delete(users).where(inArray(users.id, ids));
    await pool.end();
  }
});
