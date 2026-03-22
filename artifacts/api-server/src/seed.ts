import bcrypt from "bcryptjs";
import { db, usersTable, tenantsTable } from "@workspace/db";
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
