import { db, groundingDocumentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export async function getGroundingContext(tenantId: number): Promise<string> {
  let docs;
  try {
    docs = await db.select({
      name: groundingDocumentsTable.name,
      category: groundingDocumentsTable.category,
      extractedText: groundingDocumentsTable.extractedText,
    })
      .from(groundingDocumentsTable)
      .where(and(
        eq(groundingDocumentsTable.tenantId, tenantId),
        eq(groundingDocumentsTable.isActive, true)
      ));
  } catch {
    return "";
  }

  if (docs.length === 0) return "";

  const categoryLabels: Record<string, string> = {
    brand_voice: "Brand Voice Guidelines",
    messaging_framework: "Messaging Framework",
    marketing_guidelines: "Marketing Guidelines",
    methodology: "Marketing Methodology",
  };

  const sections = docs.map(doc => {
    const label = categoryLabels[doc.category] || doc.category;
    return `--- ${label}: ${doc.name} ---\n${doc.extractedText}`;
  });

  return [
    "=== BRAND & MESSAGING CONTEXT ===",
    "Use the following brand voice, messaging framework, and marketing guidelines to shape the tone, voice, and messaging of all generated content. Adhere to these guidelines closely.",
    "",
    ...sections,
    "=== END BRAND & MESSAGING CONTEXT ===",
  ].join("\n\n");
}
