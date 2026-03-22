import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const generatedEmailsTable = pgTable("generated_emails", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  emailBody: text("email_body").notNull(),
  subjectLineSuggestions: jsonb("subject_line_suggestions").notNull().$type<string[]>(),
  coachingTips: jsonb("coaching_tips").notNull().$type<string[]>(),
  assetTitles: jsonb("asset_titles").notNull().$type<string[]>(),
  assetIds: jsonb("asset_ids").notNull().$type<number[]>(),
  tone: text("tone"),
  callToAction: text("call_to_action"),
  recipientContext: text("recipient_context"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGeneratedEmailSchema = createInsertSchema(generatedEmailsTable).omit({ id: true, createdAt: true });
export type InsertGeneratedEmail = z.infer<typeof insertGeneratedEmailSchema>;
export type GeneratedEmail = typeof generatedEmailsTable.$inferSelect;
