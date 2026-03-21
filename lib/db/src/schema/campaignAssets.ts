import { pgTable, serial, text, integer, primaryKey } from "drizzle-orm/pg-core";
import { campaignsTable } from "./campaigns";
import { assetsTable } from "./assets";

export const campaignAssetsTable = pgTable("campaign_assets", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  assetId: integer("asset_id").notNull().references(() => assetsTable.id, { onDelete: "cascade" }),
  overrideSummaryText: text("override_summary_text"),
  overrideImageUrl: text("override_image_url"),
});

export type CampaignAsset = typeof campaignAssetsTable.$inferSelect;
