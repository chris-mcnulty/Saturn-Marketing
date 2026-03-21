import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tenantsTable = pgTable("tenants", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("trial"),
  status: text("status").notNull().default("active"),
  trialStartDate: timestamp("trial_start_date", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  userCount: integer("user_count").notNull().default(0),
  competitorLimit: integer("competitor_limit").notNull().default(3),
  analysisLimit: integer("analysis_limit").notNull().default(5),
  adminUserLimit: integer("admin_user_limit").notNull().default(1),
  readWriteUserLimit: integer("read_write_user_limit").notNull().default(2),
  readOnlyUserLimit: integer("read_only_user_limit").notNull().default(5),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#810FFB"),
  secondaryColor: text("secondary_color").default("#E60CB3"),
  entraClientId: text("entra_client_id"),
  entraTenantId: text("entra_tenant_id"),
  entraClientSecret: text("entra_client_secret"),
  entraEnabled: boolean("entra_enabled").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenantsTable.$inferSelect;
