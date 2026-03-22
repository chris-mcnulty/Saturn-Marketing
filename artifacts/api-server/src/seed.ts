import bcrypt from "bcryptjs";
import { db, usersTable, tenantsTable, marketsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";

export async function seedAdminUser() {
  const adminEmail = "chris.mcnulty@synozur.com";
  const adminPassword = "East2west!";

  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, adminEmail));

  if (existingUser) {
    logger.info("Admin user already exists, skipping seed");
    return;
  }

  let [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.domain, "synozur.com"));

  if (!tenant) {
    const [newTenant] = await db
      .insert(tenantsTable)
      .values({
        name: "Synozur",
        domain: "synozur.com",
        plan: "enterprise",
        status: "active",
      })
      .returning();
    tenant = newTenant;
    logger.info({ tenantId: tenant.id }, "Created Synozur tenant");
  }

  const existingMarkets = await db
    .select()
    .from(marketsTable)
    .where(eq(marketsTable.tenantId, tenant.id));

  if (existingMarkets.length === 0) {
    await db.insert(marketsTable).values({
      tenantId: tenant.id,
      name: tenant.name,
      description: "Default market",
      isDefault: true,
      status: "active",
    });
    logger.info({ tenantId: tenant.id }, "Created default market for tenant");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const [user] = await db
    .insert(usersTable)
    .values({
      email: adminEmail,
      passwordHash,
      name: "Chris McNulty",
      role: "Global Admin",
      tenantId: tenant.id,
      status: "active",
      authProvider: "local",
    })
    .returning();

  logger.info({ userId: user.id }, "Created admin user");

  const adminEmail2 = "admin@synozur.com";
  const [existingAdmin2] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, adminEmail2));

  if (!existingAdmin2) {
    const passwordHash2 = await bcrypt.hash(adminPassword, 10);
    const [user2] = await db
      .insert(usersTable)
      .values({
        email: adminEmail2,
        passwordHash: passwordHash2,
        name: "Synozur Admin",
        role: "Global Admin",
        tenantId: tenant.id,
        status: "active",
        authProvider: "local",
      })
      .returning();
    logger.info({ userId: user2.id }, "Created secondary admin user");
  }
}

export async function ensureDefaultMarkets() {
  const tenants = await db.select().from(tenantsTable);
  for (const tenant of tenants) {
    const existingMarkets = await db
      .select()
      .from(marketsTable)
      .where(eq(marketsTable.tenantId, tenant.id));

    if (existingMarkets.length === 0) {
      await db.insert(marketsTable).values({
        tenantId: tenant.id,
        name: tenant.name,
        description: "Default market",
        isDefault: true,
        status: "active",
      });
      logger.info({ tenantId: tenant.id }, "Created default market for existing tenant");
    }
  }

  await backfillMarketIds();
}

async function backfillMarketIds() {
  const { sql } = await import("drizzle-orm");

  const tables = [
    "assets", "brand_assets", "brand_asset_categories", "categories",
    "campaigns", "social_accounts", "generated_posts", "generated_emails", "product_tags"
  ];

  for (const table of tables) {
    try {
      await db.execute(sql.raw(`
        UPDATE ${table} SET market_id = (
          SELECT m.id FROM markets m
          WHERE m.tenant_id = ${table}.tenant_id AND m.is_default = true
          LIMIT 1
        ) WHERE market_id IS NULL
      `));
    } catch (err) {
      logger.warn({ table, err }, "Backfill skipped for table (may not have market_id column yet)");
    }
  }
}
