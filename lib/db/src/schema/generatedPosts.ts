import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { campaignsTable } from "./campaigns";
import { tenantsTable } from "./tenants";

export const generatedPostsTable = pgTable("generated_posts", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  postContent: text("post_content").notNull(),
  imageUrls: text("image_urls"),
  dateTime: text("date_time").notNull(),
  accountId: text("account_id").notNull(),
  firstComment: text("first_comment"),
  tags: text("tags"),
  assetId: integer("asset_id").notNull(),
  assetTitle: text("asset_title"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GeneratedPost = typeof generatedPostsTable.$inferSelect;
