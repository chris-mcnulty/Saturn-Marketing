import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tenantsTable, usersTable } from "@workspace/db";
import {
  UpdateTenantBody,
  UpdateTenantUserParams,
  UpdateTenantUserBody,
  RemoveTenantUserParams,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/tenant", requireAuth, async (req, res): Promise<void> => {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, req.tenantId!));
  res.json(tenant);
});

router.patch("/tenant", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateTenantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [tenant] = await db.update(tenantsTable)
    .set(parsed.data)
    .where(eq(tenantsTable.id, req.tenantId!))
    .returning();

  res.json(tenant);
});

router.get("/tenant/users", requireAuth, async (req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    role: usersTable.role,
    tenantId: usersTable.tenantId,
    createdAt: usersTable.createdAt,
  }).from(usersTable)
    .where(eq(usersTable.tenantId, req.tenantId!))
    .orderBy(usersTable.createdAt);
  res.json(users);
});

router.patch("/tenant/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateTenantUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTenantUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.update(usersTable)
    .set({ role: parsed.data.role })
    .where(and(eq(usersTable.id, params.data.id), eq(usersTable.tenantId, req.tenantId!)))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    createdAt: user.createdAt,
  });
});

router.delete("/tenant/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = RemoveTenantUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (params.data.id === req.userId) {
    res.status(400).json({ error: "Cannot remove yourself" });
    return;
  }

  const [deleted] = await db.delete(usersTable)
    .where(and(eq(usersTable.id, params.data.id), eq(usersTable.tenantId, req.tenantId!)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
