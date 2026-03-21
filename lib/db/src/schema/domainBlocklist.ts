import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const domainBlocklistTable = pgTable("domain_blocklist", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  reason: text("reason"),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDomainBlocklistSchema = createInsertSchema(domainBlocklistTable).omit({ id: true, createdAt: true });
export type InsertDomainBlocklist = z.infer<typeof insertDomainBlocklistSchema>;
export type DomainBlocklist = typeof domainBlocklistTable.$inferSelect;
