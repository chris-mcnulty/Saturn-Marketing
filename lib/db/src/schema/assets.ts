import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { categoriesTable } from "./categories";

export const assetsTable = pgTable("assets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  summaryText: text("summary_text"),
  suggestedImageUrl: text("suggested_image_url"),
  extractionStatus: text("extraction_status").notNull().default("pending"),
  mentions: text("mentions"),
  hashtags: text("hashtags"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAssetSchema = createInsertSchema(assetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assetsTable.$inferSelect;
