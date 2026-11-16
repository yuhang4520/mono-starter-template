import { z } from "zod";
import { protectedProcedure, router, serviceCall } from "../trpc";
const organization = z.object({ organizationId: z.uuid() });
const note = organization.extend({ title: z.string().trim().min(1).max(200), body: z.string().max(20_000).optional() });
const member = organization.extend({ memberId: z.uuid() });
const role = z.enum(["admin", "member"]);
export const workspaceRouter = router({
  organizations: protectedProcedure.query(({ ctx }) => serviceCall(() => ctx.workspace.listOrganizations(ctx.session.user.id))),
  createOrganization: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(100), slug: z.string().min(1).max(80) })).mutation(({ ctx, input }) => serviceCall(() => ctx.workspace.createOrganization(ctx.session.user.id, input))),
  members: protectedProcedure.input(organization).query(({ ctx, input }) => serviceCall(() => ctx.workspace.listMembers(ctx.session.user.id, input.organizationId))),
  addMember: protectedProcedure.input(organization.extend({ email: z.email(), role })).mutation(({ ctx, input }) => serviceCall(() => ctx.workspace.addMember(ctx.session.user.id, input))),
  updateMemberRole: protectedProcedure.input(member.extend({ role })).mutation(({ ctx, input }) => serviceCall(() => ctx.workspace.updateMemberRole(ctx.session.user.id, input))),
  removeMember: protectedProcedure.input(member).mutation(({ ctx, input }) => serviceCall(() => ctx.workspace.removeMember(ctx.session.user.id, input))),
  notes: protectedProcedure.input(organization.extend({ offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(100).optional() })).query(({ ctx, input }) => serviceCall(() => ctx.workspace.listNotes(ctx.session.user.id, input))),
  createNote: protectedProcedure.input(note).mutation(({ ctx, input }) => serviceCall(() => ctx.workspace.createNote(ctx.session.user.id, input))),
  updateNote: protectedProcedure.input(note.extend({ id: z.uuid() })).mutation(({ ctx, input }) => serviceCall(() => ctx.workspace.updateNote(ctx.session.user.id, input))),
  deleteNote: protectedProcedure.input(organization.extend({ id: z.uuid() })).mutation(({ ctx, input }) => serviceCall(() => ctx.workspace.deleteNote(ctx.session.user.id, input))),
});
