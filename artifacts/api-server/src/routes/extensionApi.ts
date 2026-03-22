import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db, usersTable, tenantsTable, assetsTable, brandAssetsTable, categoriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const tokenStore = new Map<string, { userId: number; tenantId: number; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenStore) {
    if (now > data.expiresAt) {
      tokenStore.delete(token);
    }
  }
}, 5 * 60 * 1000);

function requireExtensionAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  const token = authHeader.slice(7);
  const session = tokenStore.get(token);
  if (!session || Date.now() > session.expiresAt) {
    tokenStore.delete(token);
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.userId = session.userId;
  req.tenantId = session.tenantId;
  next();
}

router.post("/extension/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.status !== "active") {
    res.status(401).json({ error: "Account is not active" });
    return;
  }

  if (user.authProvider === "entra") {
    res.status(401).json({ error: "SSO accounts cannot use extension login" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  tokenStore.set(token, {
    userId: user.id,
    tenantId: user.tenantId,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });

  res.json({ token, userName: user.name, email: user.email });
});

router.post("/extension/push-assets", requireExtensionAuth, async (req: Request, res: Response): Promise<void> => {
  const { contentAssets, imageAssets } = req.body || {};
  const results = { content: { created: 0, skipped: 0 }, images: { created: 0, skipped: 0 } };

  if (contentAssets && Array.isArray(contentAssets)) {
    const existingAssets = await db.select({ url: assetsTable.url })
      .from(assetsTable)
      .where(eq(assetsTable.tenantId, req.tenantId!));
    const existingUrls = new Set(existingAssets.map(a => a.url));

    for (const item of contentAssets) {
      if (!item.url) continue;

      if (existingUrls.has(item.url)) {
        results.content.skipped++;
        continue;
      }

      let categoryId: number | null = null;
      if (item.category) {
        const [cat] = await db.select().from(categoriesTable)
          .where(and(eq(categoriesTable.tenantId, req.tenantId!), eq(categoriesTable.name, item.category)));
        if (cat) {
          categoryId = cat.id;
        }
      }

      await db.insert(assetsTable).values({
        tenantId: req.tenantId!,
        url: item.url,
        title: item.title || null,
        description: item.description || null,
        categoryId,
        active: true,
      });

      existingUrls.add(item.url);
      results.content.created++;
    }
  }

  if (imageAssets && Array.isArray(imageAssets)) {
    for (const item of imageAssets) {
      if (!item.imageUrl) continue;

      const existing = await db.select({ id: brandAssetsTable.id })
        .from(brandAssetsTable)
        .where(and(eq(brandAssetsTable.tenantId, req.tenantId!), eq(brandAssetsTable.imageUrl, item.imageUrl)));

      if (existing.length > 0) {
        results.images.skipped++;
        continue;
      }

      await db.insert(brandAssetsTable).values({
        tenantId: req.tenantId!,
        imageUrl: item.imageUrl,
        title: item.title || null,
        description: item.altText || item.description || null,
        tags: item.tags || null,
      });
      results.images.created++;
    }
  }

  logger.info({ results, userId: req.userId }, "Extension pushed assets");
  res.json({ success: true, results });
});

router.get("/extension/verify", requireExtensionAuth, async (req: Request, res: Response): Promise<void> => {
  const [user] = await db.select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!));
  res.json({ valid: true, userName: user?.name, email: user?.email });
});

export default router;
