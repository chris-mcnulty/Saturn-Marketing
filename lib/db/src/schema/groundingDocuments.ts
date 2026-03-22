import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { marketsTable } from "./markets";

export const groundingDocumentsTable = pgTable("grounding_documents", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }),
  marketId: integer("market_id").references(() => marketsTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("brand_voice"),
  fileType: text("file_type"),
  originalFileName: text("original_file_name"),
  extractedText: text("extracted_text").notNull(),
  wordCount: integer("word_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGroundingDocumentSchema = createInsertSchema(groundingDocumentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGroundingDocument = z.infer<typeof insertGroundingDocumentSchema>;
export type GroundingDocument = typeof groundingDocumentsTable.$inferSelect;
