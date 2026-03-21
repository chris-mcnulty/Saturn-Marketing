import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, groundingDocumentsTable } from "@workspace/db";
import {
  CreateGroundingDocBody,
  GetGroundingDocParams,
  UpdateGroundingDocParams,
  UpdateGroundingDocBody,
  DeleteGroundingDocParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import multer from "multer";
import mammoth from "mammoth";
import { logger } from "../lib/logger";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "text/markdown",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

async function extractTextFromFile(buffer: Buffer, mimetype: string, originalName: string): Promise<{ text: string; fileType: string }> {
  if (mimetype === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    const text = result.text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return { text, fileType: "pdf" };
  }

  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mimetype === "application/msword") {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return { text, fileType: "docx" };
  }

  const text = buffer.toString("utf-8").trim();
  const ext = originalName.toLowerCase().endsWith(".md") ? "markdown" : "text";
  return { text, fileType: ext };
}

const router: IRouter = Router();

router.get("/grounding-docs", requireAuth, async (req, res): Promise<void> => {
  const docs = await db.select()
    .from(groundingDocumentsTable)
    .where(eq(groundingDocumentsTable.tenantId, req.tenantId!))
    .orderBy(groundingDocumentsTable.createdAt);

  res.json(docs);
});

router.get("/grounding-docs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetGroundingDocParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db.select()
    .from(groundingDocumentsTable)
    .where(and(
      eq(groundingDocumentsTable.id, params.data.id),
      eq(groundingDocumentsTable.tenantId, req.tenantId!)
    ));

  if (!doc) {
    res.status(404).json({ error: "Grounding document not found" });
    return;
  }

  res.json(doc);
});

router.post("/grounding-docs", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateGroundingDocBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, description, category, content, fileType, originalFileName } = parsed.data;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  const [doc] = await db.insert(groundingDocumentsTable).values({
    tenantId: req.tenantId!,
    name,
    description: description || null,
    category,
    fileType: fileType || null,
    originalFileName: originalFileName || null,
    extractedText: content,
    wordCount,
    isActive: true,
  }).returning();

  res.status(201).json(doc);
});

router.post("/grounding-docs/upload", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const name = (req.body.name as string) || req.file.originalname.replace(/\.[^.]+$/, "");
    const description = (req.body.description as string) || null;
    const category = (req.body.category as string) || "brand_voice";

    const { text, fileType } = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);

    if (!text || text.length < 10) {
      res.status(400).json({ error: "Could not extract meaningful text from the file. The file may be empty, image-only, or in an unsupported format." });
      return;
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;

    const [doc] = await db.insert(groundingDocumentsTable).values({
      tenantId: req.tenantId!,
      name,
      description,
      category,
      fileType,
      originalFileName: req.file.originalname,
      extractedText: text,
      wordCount,
      isActive: true,
    }).returning();

    res.status(201).json(doc);
  } catch (err: any) {
    logger.error({ err }, "Grounding doc upload failed");
    res.status(400).json({ error: err.message || "Failed to process uploaded file" });
  }
});

router.patch("/grounding-docs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateGroundingDocParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGroundingDocBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [doc] = await db.update(groundingDocumentsTable)
    .set(parsed.data)
    .where(and(
      eq(groundingDocumentsTable.id, params.data.id),
      eq(groundingDocumentsTable.tenantId, req.tenantId!)
    ))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Grounding document not found" });
    return;
  }

  res.json(doc);
});

router.delete("/grounding-docs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteGroundingDocParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(groundingDocumentsTable)
    .where(and(
      eq(groundingDocumentsTable.id, params.data.id),
      eq(groundingDocumentsTable.tenantId, req.tenantId!)
    ))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Grounding document not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
