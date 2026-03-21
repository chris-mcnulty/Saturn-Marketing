import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const brandAssetCategoriesTable = pgTable("brand_asset_categories", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBrandAssetCategorySchema = createInsertSchema(brandAssetCategoriesTable).omit({ id: true, createdAt: true });
export type InsertBrandAssetCategory = z.infer<typeof insertBrandAssetCategorySchema>;
export type BrandAssetCategory = typeof brandAssetCategoriesTable.$inferSelect;
