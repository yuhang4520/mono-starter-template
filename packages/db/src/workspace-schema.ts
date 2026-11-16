import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./auth-schema";

export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("notes_organization_created_idx").on(table.organizationId, table.createdAt)]);

export const notesRelations = relations(notes, ({ one }) => ({
  organization: one(organizations, { fields: [notes.organizationId], references: [organizations.id] }),
  creator: one(users, { fields: [notes.createdBy], references: [users.id] }),
}));
