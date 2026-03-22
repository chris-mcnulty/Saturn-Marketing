import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, desc } from "drizzle-orm";
import { db, usersTable, tenantsTable, domainBlocklistTable, emailVerificationTokensTable, marketsTable } from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import crypto from "crypto";

const router: IRouter = Router();

function formatAuthResponse(
  user: typeof usersTable.$inferSelect,
  tenant: typeof tenantsTable.$inferSelect,
  markets: (typeof marketsTable.$inferSelect)[] = []
) {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      avatar: user.avatar,
      authProvider: user.authProvider,
      emailVerified: user.emailVerified,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      plan: tenant.plan,
      status: tenant.status,
      createdAt: tenant.createdAt.toISOString(),
    },
    markets: markets.map(m => ({
      id: m.id,
      tenantId: m.tenantId,
      name: m.name,
      description: m.description,
      isDefault: m.isDefault,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    defaultMarket: (() => {
      const def = markets.find(m => m.isDefault);
      if (!def) return null;
      return {
        id: def.id,
        tenantId: def.tenantId,
        name: def.name,
        description: def.description,
        isDefault: def.isDefault,
        status: def.status,
        createdAt: def.createdAt.toISOString(),
        updatedAt: def.updatedAt.toISOString(),
      };
    })(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  try {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { email, password, name, organizationName } = parsed.data;

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing.length > 0) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    const domain = email.split("@")[1].toLowerCase();

    const [blockedDomain] = await db.select().from(domainBlocklistTable).where(eq(domainBlocklistTable.domain, domain));
    if (blockedDomain) {
      res.status(403).json({
        error: "This email domain is not allowed for self-registration. Please use a work email address."
      });
      return;
    }

    const [existingTenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.domain, domain));

    const role = existingTenant ? "Standard User" : "Domain Admin";

    const passwordHash = await bcrypt.hash(password, 10);

    let tenant = existingTenant;
    if (!tenant) {
      const trialStartDate = new Date();
      const trialEndsAt = new Date(trialStartDate);
      trialEndsAt.setDate(trialEndsAt.getDate() + 60);

      const [newTenant] = await db.insert(tenantsTable).values({
        name: organizationName,
        domain,
        plan: "trial",
        status: "active",
        trialStartDate,
        trialEndsAt,
        userCount: 0,
      }).returning();
      tenant = newTenant;

      await db.insert(marketsTable).values({
        tenantId: tenant.id,
        name: organizationName,
        description: "Default market",
        isDefault: true,
        status: "active",
      });
    }

    const [user] = await db.insert(usersTable).values({
      tenantId: tenant.id,
      email,
      passwordHash,
      name,
      role,
      avatar: name.charAt(0).toUpperCase(),
      authProvider: "local",
      emailVerified: true,
      status: "active",
    }).returning();

    const defaultCategories = ["Workshop", "Model", "Podcast", "Service", "Case Study", "White Paper", "Video", "Session"];
    if (!existingTenant) {
      const { categoriesTable } = await import("@workspace/db");
      for (const catName of defaultCategories) {
        await db.insert(categoriesTable).values({ tenantId: tenant.id, name: catName });
      }
    }

    const markets = await db.select().from(marketsTable)
      .where(eq(marketsTable.tenantId, tenant.id));

    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({ error: "Session error" });
        return;
      }
      req.session.userId = user.id;
      req.session.tenantId = tenant!.id;
      res.status(201).json(formatAuthResponse(user, tenant!, markets));
    });
  } catch (error: any) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { email, password } = parsed.data;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (user.authProvider === "entra") {
      res.status(401).json({ error: "Please use Microsoft SSO to sign in" });
      return;
    }

    if (user.status !== "active") {
      res.status(401).json({ error: "Account is not active. Please check your email for verification." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, user.tenantId));
    if (!tenant) {
      res.status(500).json({ error: "Tenant not found" });
      return;
    }

    const markets = await db.select().from(marketsTable)
      .where(eq(marketsTable.tenantId, tenant.id));

    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({ error: "Session error" });
        return;
      }
      req.session.userId = user.id;
      req.session.tenantId = user.tenantId;
      res.json(formatAuthResponse(user, tenant, markets));
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, req.tenantId!));

    const markets = await db.select().from(marketsTable)
      .where(eq(marketsTable.tenantId, req.tenantId!));

    res.json(formatAuthResponse(user, tenant, markets));
  } catch (error: any) {
    console.error("GetMe error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

router.get("/auth/entra/status", (_req, res): void => {
  const configured = !!(process.env.ENTRA_CLIENT_ID && process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_SECRET);
  res.json({ configured });
});

export default router;
