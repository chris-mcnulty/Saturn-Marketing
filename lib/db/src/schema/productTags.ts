import { pgTable, serial, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { assetsTable } from "./assets";
import { brandAssetsTable } from "./brandAssets";
import { marketsTable } from "./markets";

export const productTagsTable = pgTable("product_tags", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  marketId: integer("market_id").references(() => marketsTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assetProductTagsTable = pgTable("asset_product_tags", {
  assetId: integer("asset_id").notNull().references(() => assetsTable.id, { onDelete: "cascade" }),
  productTagId: integer("product_tag_id").notNull().references(() => productTagsTable.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.assetId, t.productTagId] }),
]);

export const brandAssetProductTagsTable = pgTable("brand_asset_product_tags", {
  brandAssetId: integer("brand_asset_id").notNull().references(() => brandAssetsTable.id, { onDelete: "cascade" }),
  productTagId: integer("product_tag_id").notNull().references(() => productTagsTable.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.brandAssetId, t.productTagId] }),
]);

export const insertProductTagSchema = createInsertSchema(productTagsTable).omit({ id: true, createdAt: true });
export type InsertProductTag = z.infer<typeof insertProductTagSchema>;
export type ProductTag = typeof productTagsTable.$inferSelect;
