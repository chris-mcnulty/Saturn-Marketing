import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, usersTable, tenantsTable, servicePlansTable, domainBlocklistTable, tenantInvitesTable, consultantAccessTable } from "@workspace/db";
import { requireAuth, requireAdmin, requireGlobalAdmin } from "../middlewares/auth";
import { invalidatePlanCache, FEATURE_REGISTRY, FEATURE_CATEGORIES } from "../services/plan-policy";
import crypto from "crypto";

const router: IRouter = Router();

router.get("/admin/service-plans", requireAuth, requireGlobalAdmin, async (_req, res): Promise<void> => {
  const plans = await db.select().from(servicePlansTable).orderBy(servicePlansTable.name);
  res.json(plans);
});

router.get("/service-plans/active", async (_req, res): Promise<void> => {
  const plans = await db.select().from(servicePlansTable).where(eq(servicePlansTable.isActive, true));
  res.json(plans);
});

router.get("/admin/service-plans/:id", requireAuth, requireGlobalAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [plan] = await db.select().from(servicePlansTable).where(eq(servicePlansTable.id, id));
  if (!plan) { res.status(404).json({ error: "Service plan not found" }); return; }
  res.json(plan);
});

router.post("/admin/service-plans", requireAuth, requireGlobalAdmin, async (req, res): Promise<void> => {
  const { name, displayName, description, ...limits } = req.body;
  if (!name || !displayName) { res.status(400).json({ error: "Name and display name are required" }); return; }

  const [existing] = await db.select().from(servicePlansTable).where(eq(servicePlansTable.name, name));
  if (existing) { res.status(400).json({ error: "A plan with this name already exists" }); return; }

  const [plan] = await db.insert(servicePlansTable).values({
    name: name.toLowerCase().replace(/\s+/g, "_"),
    displayName,
    description,
    ...limits,
  }).returning();
  invalidatePlanCache();
  res.status(201).json(plan);
});

router.patch("/admin/service-plans/:id", requireAuth, requireGlobalAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [plan] = await db.select().from(servicePlansTable).where(eq(servicePlansTable.id, id));
  if (!plan) { res.status(404).json({ error: "Service plan not found" }); return; }

  if (req.body.name && req.body.name !== plan.name) {
    const [existing] = await db.select().from(servicePlansTable).where(eq(servicePlansTable.name, req.body.name));
    if (existing) { res.status(400).json({ error: "A plan with this name already exists" }); return; }
  }

  const [updated] = await db.update(servicePlansTable).set(req.body).where(eq(servicePlansTable.id, id)).returning();
  invalidatePlanCache();
  res.json(updated);
});

router.delete("/admin/service-plans/:id", requireAuth, requireGlobalAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [plan] = await db.select().from(servicePlansTable).where(eq(servicePlansTable.id, id));
  if (!plan) { res.status(404).json({ error: "Service plan not found" }); return; }
  if (plan.isDefault) { res.status(400).json({ error: "Cannot delete the default plan" }); return; }

  await db.delete(servicePlansTable).where(eq(servicePlansTable.id, id));
  invalidatePlanCache();
  res.json({ success: true });
});

router.get("/admin/feature-registry", requireAuth, requireGlobalAdmin, async (_req, res): Promise<void> => {
  res.json({ features: FEATURE_REGISTRY, categories: FEATURE_CATEGORIES });
});

router.get("/admin/domain-blocklist", requireAuth, requireGlobalAdmin, async (_req, res): Promise<void> => {
  const blocklist = await db.select().from(domainBlocklistTable).orderBy(domainBlocklistTable.domain);
  res.json(blocklist);
});

router.post("/admin/domain-blocklist", requireAuth, requireGlobalAdmin, async (req, res): Promise<void> => {
  const { domain, reason } = req.body;
  if (!domain) { res.status(400).json({ error: "Domain is required" }); return; }

  const normalizedDomain = domain.toLowerCase().trim();
  const [existing] = await db.select().from(domainBlocklistTable).where(eq(domainBlocklistTable.domain, normalizedDomain));
  if (existing) { res.status(400).json({ error: "Domain already blocked" }); return; }

  const [entry] = await db.insert(domainBlocklistTable).values({
    domain: normalizedDomain,
    reason: reason || null,
    createdBy: req.userId!,
  }).returning();
  res.status(201).json(entry);
});

router.delete("/admin/domain-blocklist/:domain", requireAuth, requireGlobalAdmin, async (req, res): Promise<void> => {
  const domain = req.params.domain.toLowerCase();
  await db.delete(domainBlocklistTable).where(eq(domainBlocklistTable.domain, domain));
  res.json({ success: true, message: `Domain ${domain} removed from blocklist` });
});

router.get("/admin/tenants", requireAuth, requireGlobalAdmin, async (_req, res): Promise<void> => {
  const allTenants = await db.select().from(tenantsTable).orderBy(tenantsTable.createdAt);
  res.json(allTenants);
});

router.get("/admin/tenants/:id", requireAuth, requireGlobalAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, id));
  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
  res.json(tenant);
});

router.patch("/admin/tenants/:id", requireAuth, requireGlobalAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, id));
  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  const [updated] = await db.update(tenantsTable).set(req.body).where(eq(tenantsTable.id, id)).returning();
  res.json(updated);
});

router.get("/admin/tenants/:id/users", requireAuth, requireGlobalAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const users = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    role: usersTable.role,
    status: usersTable.status,
    authProvider: usersTable.authProvider,
    emailVerified: usersTable.emailVerified,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.tenantId, id));
  res.json(users);
});

router.get("/admin/users", requireAuth, requireGlobalAdmin, async (_req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    role: usersTable.role,
    tenantId: usersTable.tenantId,
    status: usersTable.status,
    authProvider: usersTable.authProvider,
    emailVerified: usersTable.emailVerified,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

router.patch("/admin/users/:id", requireAuth, requireGlobalAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { role, status } = req.body;

  const updates: Record<string, any> = {};
  if (role) updates.role = role;
  if (status) updates.status = status;

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }

  const { passwordHash: _, ...userWithoutPassword } = updated;
  res.json(userWithoutPassword);
});

router.post("/tenant/invites", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { email, role } = req.body;
  if (!email) { res.status(400).json({ error: "Email is required" }); return; }

  const validRoles = ["Standard User", "Domain Admin"];
  const invitedRole = validRoles.includes(role) ? role : "Standard User";

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [invite] = await db.insert(tenantInvitesTable).values({
    token,
    email: email.toLowerCase(),
    tenantId: req.tenantId!,
    invitedRole,
    invitedBy: req.userId!,
    status: "pending",
    expiresAt,
  }).returning();

  res.status(201).json(invite);
});

router.get("/tenant/invites", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const invites = await db.select().from(tenantInvitesTable)
    .where(eq(tenantInvitesTable.tenantId, req.tenantId!))
    .orderBy(desc(tenantInvitesTable.createdAt));
  res.json(invites);
});

router.delete("/tenant/invites/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [invite] = await db.select().from(tenantInvitesTable)
    .where(and(eq(tenantInvitesTable.id, id), eq(tenantInvitesTable.tenantId, req.tenantId!)));
  if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }

  await db.update(tenantInvitesTable).set({ status: "revoked" }).where(eq(tenantInvitesTable.id, id));
  res.json({ success: true });
});

router.post("/auth/accept-invite", async (req, res): Promise<void> => {
  try {
    const { token, name, password } = req.body;
    if (!token || !name || !password) {
      res.status(400).json({ error: "Token, name, and password are required" });
      return;
    }

    const [invite] = await db.select().from(tenantInvitesTable).where(eq(tenantInvitesTable.token, token));
    if (!invite) { res.status(400).json({ error: "Invalid invite link" }); return; }
    if (invite.status !== "pending") { res.status(400).json({ error: "This invite has already been used or revoked" }); return; }
    if (new Date() > invite.expiresAt) { res.status(400).json({ error: "This invite has expired" }); return; }

    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, invite.email));
    if (existingUser) { res.status(400).json({ error: "A user with this email already exists" }); return; }

    const passwordHash = await (await import("bcryptjs")).default.hash(password, 10);

    const [user] = await db.insert(usersTable).values({
      tenantId: invite.tenantId,
      email: invite.email,
      passwordHash,
      name,
      role: invite.invitedRole,
      avatar: name.charAt(0).toUpperCase(),
      authProvider: "local",
      emailVerified: true,
      status: "active",
    }).returning();

    await db.update(tenantInvitesTable).set({ status: "accepted", acceptedAt: new Date() }).where(eq(tenantInvitesTable.id, invite.id));

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, invite.tenantId));

    req.session.regenerate((err) => {
      if (err) { res.status(500).json({ error: "Session error" }); return; }
      req.session.userId = user.id;
      req.session.tenantId = user.tenantId;
      res.status(201).json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId },
        tenant: tenant ? { id: tenant.id, name: tenant.name } : null,
      });
    });
  } catch (error: any) {
    console.error("Accept invite error:", error);
    res.status(500).json({ error: "Failed to accept invite" });
  }
});

router.get("/auth/invite/:token", async (req, res): Promise<void> => {
  const [invite] = await db.select().from(tenantInvitesTable).where(eq(tenantInvitesTable.token, req.params.token));
  if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }
  if (invite.status !== "pending") { res.status(400).json({ error: "This invite has already been used or revoked" }); return; }
  if (new Date() > invite.expiresAt) { res.status(400).json({ error: "This invite has expired" }); return; }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, invite.tenantId));
  res.json({
    email: invite.email,
    role: invite.invitedRole,
    tenantName: tenant?.name || "Unknown",
    expiresAt: invite.expiresAt.toISOString(),
  });
});

router.post("/admin/consultant-access", requireAuth, requireGlobalAdmin, async (req, res): Promise<void> => {
  const { userId, tenantId } = req.body;
  if (!userId || !tenantId) { res.status(400).json({ error: "userId and tenantId are required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.role !== "Consultant") { res.status(400).json({ error: "User must have Consultant role" }); return; }

  const [access] = await db.insert(consultantAccessTable).values({
    userId,
    tenantId,
    status: "active",
    grantedBy: req.userId!,
  }).returning();
  res.status(201).json(access);
});

router.delete("/admin/consultant-access/:id", requireAuth, requireGlobalAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.update(consultantAccessTable).set({ status: "revoked", revokedAt: new Date() }).where(eq(consultantAccessTable.id, id));
  res.json({ success: true });
});

export default router;
