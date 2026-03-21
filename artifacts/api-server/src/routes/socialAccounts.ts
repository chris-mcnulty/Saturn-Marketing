import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, socialAccountsTable } from "@workspace/db";
import {
  CreateSocialAccountBody,
  UpdateSocialAccountParams,
  UpdateSocialAccountBody,
  DeleteSocialAccountParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/social-accounts", requireAuth, async (req, res): Promise<void> => {
  const accounts = await db.select().from(socialAccountsTable)
    .where(eq(socialAccountsTable.tenantId, req.tenantId!))
    .orderBy(socialAccountsTable.createdAt);
  res.json(accounts);
});

router.post("/social-accounts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateSocialAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [account] = await db.insert(socialAccountsTable).values({
    tenantId: req.tenantId!,
    platform: parsed.data.platform,
    accountName: parsed.data.accountName,
    socialPilotAccountId: parsed.data.socialPilotAccountId,
  }).returning();

  res.status(201).json(account);
});

router.patch("/social-accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateSocialAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSocialAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [account] = await db.update(socialAccountsTable)
    .set(parsed.data)
    .where(and(eq(socialAccountsTable.id, params.data.id), eq(socialAccountsTable.tenantId, req.tenantId!)))
    .returning();

  if (!account) {
    res.status(404).json({ error: "Social account not found" });
    return;
  }

  res.json(account);
});

router.delete("/social-accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteSocialAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(socialAccountsTable)
    .where(and(eq(socialAccountsTable.id, params.data.id), eq(socialAccountsTable.tenantId, req.tenantId!)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Social account not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
