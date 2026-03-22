import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { brandAssetCategoriesTable } from "./brandAssetCategories";
import { marketsTable } from "./markets";

export const brandAssetsTable = pgTable("brand_assets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  marketId: integer("market_id").references(() => marketsTable.id, { onDelete: "set null" }),
  imageUrl: text("image_url").notNull(),
  title: text("title"),
  description: text("description"),
  tags: text("tags"),
  categoryId: integer("category_id").references(() => brandAssetCategoriesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBrandAssetSchema = createInsertSchema(brandAssetsTable).omit({ id: true, createdAt: true });
export type InsertBrandAsset = z.infer<typeof insertBrandAssetSchema>;
export type BrandAsset = typeof brandAssetsTable.$inferSelect;
