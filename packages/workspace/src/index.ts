import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, sql } from "db";
import { db, type Database } from "db/client";
import { members, notes, organizations, users } from "db/schema";
import { z } from "zod";

export class WorkspaceError extends Error {
  constructor(public readonly code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT", message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

const organizationIdSchema = z.uuid();
const noteInput = z.object({ organizationId: z.uuid(), title: z.string().trim().min(1).max(200), body: z.string().max(20_000).default("") });
const roleSchema = z.enum(["admin", "member"]);
const roles = ["owner", "admin", "member"];

export function isUserBanned(user: { banned: boolean | null; banExpires: Date | null }, now = new Date()) {
  return user.banned === true && (!user.banExpires || user.banExpires > now);
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export function createWorkspaceService(database: Database) {
  async function lookupUser(userId: string, tx?: Transaction) {
    const user = tx
      ? (await tx.select().from(users).where(eq(users.id, userId)).for("share"))[0]
      : await database.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user || isUserBanned(user)) throw new WorkspaceError("UNAUTHORIZED", "账号不存在或已被禁用");
    return user;
  }

  const getUser = (userId: string) => lookupUser(userId);

  async function memberFor(userId: string, organizationId: string, write = false, tx?: Transaction, memberMutation = false) {
    organizationIdSchema.parse(organizationId);
    // Use one lock order: organization, actor user, actor member. Membership
    // mutations serialize at the organization to avoid actor/target lock cycles.
    if (tx) await tx.select({ id: organizations.id }).from(organizations)
      .where(eq(organizations.id, organizationId)).for(memberMutation ? "update" : "share");
    await lookupUser(userId, tx);
    const query = (tx ?? database).select({ memberId: members.id, role: members.role, locked: organizations.locked })
      .from(members).innerJoin(organizations, eq(organizations.id, members.organizationId))
      .where(and(eq(members.userId, userId), eq(members.organizationId, organizationId))).limit(1);
    // Keep authorization valid through the write: concurrent bans, organization
    // locks and role changes must finish before this check or wait for commit.
    const [row] = await (tx ? query.for("share") : query);
    if (!row || !roles.includes(row.role) || row.locked) throw new WorkspaceError("FORBIDDEN", "无法访问该组织");
    if (write && row.role === "member") throw new WorkspaceError("FORBIDDEN", "需要组织管理员权限");
    return { userId, organizationId, memberId: row.memberId, role: row.role };
  }

  const requireMember = (userId: string, organizationId: string, write = false) => memberFor(userId, organizationId, write);
  async function authorizedWrite<T>(userId: string, organizationId: string, write: (tx: Transaction, actor: Awaited<ReturnType<typeof memberFor>>) => Promise<T>, memberMutation = false) {
    return database.transaction(async (tx) => write(tx, await memberFor(userId, organizationId, true, tx, memberMutation)));
  }

  return {
    getUser,
    requireMember,
    async listOrganizations(userId: string) {
      await getUser(userId);
      return database.select({ id: organizations.id, name: organizations.name, slug: organizations.slug,
        logo: organizations.logo, locked: organizations.locked, createdAt: organizations.createdAt,
        memberId: members.id, role: members.role }).from(members)
        .innerJoin(organizations, eq(organizations.id, members.organizationId))
        .where(eq(members.userId, userId)).orderBy(asc(organizations.name));
    },
    async createOrganization(userId: string, input: { name: string; slug: string }) {
      const data = z.object({ name: z.string().trim().min(1).max(100), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80) }).parse(input);
      try {
        return await database.transaction(async (tx) => {
          await lookupUser(userId, tx);
          const [organization] = await tx.insert(organizations).values({ ...data, id: randomUUID(), createdAt: new Date(), locked: false }).returning();
          if (!organization) throw new Error("Organization insert returned no row");
          await tx.insert(members).values({ organizationId: organization.id, userId, role: "owner", createdAt: new Date() });
          return organization;
        });
      } catch (error) {
        if (isUniqueConflict(error)) throw new WorkspaceError("CONFLICT", "组织标识已存在");
        throw error;
      }
    },
    async listMembers(userId: string, organizationId: string) {
      await requireMember(userId, organizationId);
      return database.select({ id: members.id, userId: members.userId, role: members.role, createdAt: members.createdAt, name: users.name, email: users.email })
        .from(members).innerJoin(users, eq(users.id, members.userId)).where(eq(members.organizationId, organizationId)).orderBy(asc(members.createdAt));
    },
    async addMember(userId: string, input: { organizationId: string; email: string; role: "admin" | "member" }) {
      const data = z.object({ organizationId: z.uuid(), email: z.email().max(254), role: roleSchema }).parse(input);
      return authorizedWrite(userId, data.organizationId, async (tx, actor) => {
        if (data.role === "admin" && actor.role !== "owner") throw new WorkspaceError("FORBIDDEN", "只有所有者可以设置管理员");
        const target = await tx.query.users.findFirst({ where: eq(users.email, data.email) });
        if (!target) throw new WorkspaceError("NOT_FOUND", "请先注册该用户");
        // Serialize membership changes without changing existing auth table constraints.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`member:${data.organizationId}:${target.id}`}, 0))`);
        const existing = await tx.query.members.findFirst({ where: and(eq(members.organizationId, data.organizationId), eq(members.userId, target.id)) });
        if (existing) throw new WorkspaceError("CONFLICT", "用户已加入该组织");
        const [member] = await tx.insert(members).values({ organizationId: data.organizationId, userId: target.id, role: data.role, createdAt: new Date() }).onConflictDoNothing().returning();
        if (!member) throw new WorkspaceError("CONFLICT", "用户已加入该组织");
        return member;
      }, true);
    },
    async updateMemberRole(userId: string, input: { organizationId: string; memberId: string; role: "admin" | "member" }) {
      const data = z.object({ organizationId: z.uuid(), memberId: z.uuid(), role: roleSchema }).parse(input);
      return authorizedWrite(userId, data.organizationId, async (tx, actor) => {
        if (actor.role !== "owner") throw new WorkspaceError("FORBIDDEN", "只有所有者可以修改成员角色");
        const [member] = await tx.update(members).set({ role: data.role }).where(and(eq(members.id, data.memberId), eq(members.organizationId, data.organizationId), sql`${members.role} <> 'owner'`)).returning();
        if (!member) throw new WorkspaceError("NOT_FOUND", "成员不存在或不允许修改所有者");
        return member;
      }, true);
    },
    async removeMember(userId: string, input: { organizationId: string; memberId: string }) {
      const data = z.object({ organizationId: z.uuid(), memberId: z.uuid() }).parse(input);
      return authorizedWrite(userId, data.organizationId, async (tx, actor) => {
        const [member] = await tx.delete(members).where(and(eq(members.id, data.memberId), eq(members.organizationId, data.organizationId), actor.role === "owner" ? sql`${members.role} <> 'owner'` : eq(members.role, "member"))).returning();
        if (!member) throw new WorkspaceError("NOT_FOUND", "成员不存在或无权移除");
        return { success: true as const };
      }, true);
    },
    async listNotes(userId: string, input: { organizationId: string; offset?: number; limit?: number }) {
      const data = z.object({ organizationId: z.uuid(), offset: z.number().int().min(0).max(100_000).default(0), limit: z.number().int().min(1).max(100).default(20) }).parse(input);
      await requireMember(userId, data.organizationId);
      const scope = eq(notes.organizationId, data.organizationId);
      const [items, totals] = await Promise.all([
        database.select().from(notes).where(scope).orderBy(desc(notes.createdAt), desc(notes.id)).limit(data.limit).offset(data.offset),
        database.select({ total: count() }).from(notes).where(scope),
      ]);
      return { items, total: totals[0]?.total ?? 0 };
    },
    async createNote(userId: string, input: { organizationId: string; title: string; body?: string }) {
      const data = noteInput.parse(input);
      return authorizedWrite(userId, data.organizationId, async (tx) => {
        const [note] = await tx.insert(notes).values({ ...data, createdBy: userId }).returning();
        return note!;
      });
    },
    async updateNote(userId: string, input: { organizationId: string; id: string; title: string; body?: string }) {
      const { id, ...data } = noteInput.extend({ id: z.uuid() }).parse(input);
      return authorizedWrite(userId, data.organizationId, async (tx) => {
        const [note] = await tx.update(notes).set({ title: data.title, body: data.body, updatedAt: new Date() }).where(and(eq(notes.id, id), eq(notes.organizationId, data.organizationId))).returning();
        if (!note) throw new WorkspaceError("NOT_FOUND", "记录不存在");
        return note;
      });
    },
    async deleteNote(userId: string, input: { organizationId: string; id: string }) {
      const data = z.object({ organizationId: z.uuid(), id: z.uuid() }).parse(input);
      return authorizedWrite(userId, data.organizationId, async (tx) => {
        const [note] = await tx.delete(notes).where(and(eq(notes.id, data.id), eq(notes.organizationId, data.organizationId))).returning({ id: notes.id });
        if (!note) throw new WorkspaceError("NOT_FOUND", "记录不存在");
        return { success: true as const };
      });
    },
  };
}

function isUniqueConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueConflict(error.cause);
}

export const workspace = createWorkspaceService(db);
