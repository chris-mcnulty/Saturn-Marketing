import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, tenantsTable } from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatAuthResponse(user: typeof usersTable.$inferSelect, tenant: typeof tenantsTable.$inferSelect) {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      createdAt: user.createdAt.toISOString(),
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      createdAt: tenant.createdAt.toISOString(),
    },
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

    const passwordHash = await bcrypt.hash(password, 10);

    const [tenant] = await db.insert(tenantsTable).values({ name: organizationName }).returning();

    const [user] = await db.insert(usersTable).values({
      tenantId: tenant.id,
      email,
      passwordHash,
      name,
      role: "admin",
    }).returning();

    const defaultCategories = ["Workshop", "Model", "Podcast", "Service", "Case Study", "White Paper", "Video", "Session"];
    const { categoriesTable } = await import("@workspace/db");
    for (const catName of defaultCategories) {
      await db.insert(categoriesTable).values({ tenantId: tenant.id, name: catName });
    }

    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({ error: "Session error" });
        return;
      }
      req.session.userId = user.id;
      req.session.tenantId = tenant.id;
      res.status(201).json(formatAuthResponse(user, tenant));
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

    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({ error: "Session error" });
        return;
      }
      req.session.userId = user.id;
      req.session.tenantId = user.tenantId;
      res.json(formatAuthResponse(user, tenant));
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

    res.json(formatAuthResponse(user, tenant));
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

export default router;
