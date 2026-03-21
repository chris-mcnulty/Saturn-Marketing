import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const tenantInvitesTable = pgTable("tenant_invites", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  tenantId: integer("tenant_id").notNull(),
  invitedRole: text("invited_role").notNull().default("Standard User"),
  invitedBy: integer("invited_by").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTenantInviteSchema = createInsertSchema(tenantInvitesTable).omit({ id: true, createdAt: true });
export type InsertTenantInvite = z.infer<typeof insertTenantInviteSchema>;
export type TenantInvite = typeof tenantInvitesTable.$inferSelect;
