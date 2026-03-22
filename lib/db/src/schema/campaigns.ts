import { pgTable, serial, text, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { marketsTable } from "./markets";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  marketId: integer("market_id").references(() => marketsTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  startDate: date("start_date").notNull(),
  durationDays: integer("duration_days").notNull().default(7),
  postsPerDay: integer("posts_per_day").notNull().default(1),
  postingTimes: text("posting_times"),
  hashtags: text("hashtags"),
  repetitionIntervalDays: integer("repetition_interval_days").notNull().default(7),
  status: text("status").notNull().default("draft"),
  alwaysIncludeImages: boolean("always_include_images").notNull().default(false),
  businessHoursOnly: boolean("business_hours_only").notNull().default(false),
  businessHoursStart: text("business_hours_start").notNull().default("09:00"),
  businessHoursEnd: text("business_hours_end").notNull().default("17:00"),
  includeSaturday: boolean("include_saturday").notNull().default(true),
  includeSunday: boolean("include_sunday").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
