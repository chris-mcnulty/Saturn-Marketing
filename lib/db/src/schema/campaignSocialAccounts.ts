import { pgTable, serial, integer } from "drizzle-orm/pg-core";
import { campaignsTable } from "./campaigns";
import { socialAccountsTable } from "./socialAccounts";

export const campaignSocialAccountsTable = pgTable("campaign_social_accounts", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  socialAccountId: integer("social_account_id").notNull().references(() => socialAccountsTable.id, { onDelete: "cascade" }),
});

export type CampaignSocialAccount = typeof campaignSocialAccountsTable.$inferSelect;
