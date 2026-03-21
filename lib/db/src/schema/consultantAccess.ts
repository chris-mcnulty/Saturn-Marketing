import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tenantsTable } from "./tenants";

export const consultantAccessTable = pgTable("consultant_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"),
  grantedBy: integer("granted_by").notNull().references(() => usersTable.id),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConsultantAccessSchema = createInsertSchema(consultantAccessTable).omit({ id: true, createdAt: true });
export type InsertConsultantAccess = z.infer<typeof insertConsultantAccessSchema>;
export type ConsultantAccess = typeof consultantAccessTable.$inferSelect;
