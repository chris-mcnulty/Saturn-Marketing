import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const servicePlansTable = pgTable("service_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  competitorLimit: integer("competitor_limit").notNull().default(3),
  analysisLimit: integer("analysis_limit").notNull().default(5),
  adminUserLimit: integer("admin_user_limit").notNull().default(1),
  readWriteUserLimit: integer("read_write_user_limit").notNull().default(2),
  readOnlyUserLimit: integer("read_only_user_limit").notNull().default(5),
  features: jsonb("features").notNull().default({}),
  trialDays: integer("trial_days"),
  monthlyPrice: integer("monthly_price"),
  annualPrice: integer("annual_price"),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertServicePlanSchema = createInsertSchema(servicePlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServicePlan = z.infer<typeof insertServicePlanSchema>;
export type ServicePlan = typeof servicePlansTable.$inferSelect;
