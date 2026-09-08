import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { knowledgeBucket } from "@/lib/storage";
import { db } from "@setu/db";
import { generateEmbedding } from "@/lib/ai/embeddings";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { pathToFileURL } from "node:url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  process.cwd() + "/public/pdfjs/pdf.worker.mjs"
).href;

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

function chunkText(text: string): string[] {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    const chunk = normalized.slice(start, end).trim();

    if (chunk) chunks.push(chunk);

    if (end >= normalized.length) break;

    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ projectId: string; documentId: string }>;
  },
) {
  try {
    const { projectId, documentId } = await context.params;

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const token = authorization.slice("Bearer ".length);

    let decodedToken;

    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 },
      );
    }

    const user = await db.user.findUnique({
      where: {
        firebaseUid: decodedToken.uid,
      },
      include: {
        memberships: true,
      },
    });

    if (!user || user.memberships.length === 0) {
      return NextResponse.json(
        { error: "User or organization not found" },
        { status: 403 },
      );
    }

    const organizationId = user.memberships[0].organizationId;

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    const document = await db.document.findFirst({
      where: {
        id: documentId,
        projectId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    if (document.status === "PROCESSING") {
      return NextResponse.json(
        { error: "Document is already being processed" },
        { status: 409 },
      );
    }

    await db.document.update({
      where: { id: document.id },
      data: { status: "PROCESSING" },
    });

    try {
      const [fileBuffer] = await knowledgeBucket
        .file(document.storagePath)
        .download();

      let extractedText = "";

      if (document.mimeType === "application/pdf") {
        const pdf = await pdfjsLib.getDocument({
          data: new Uint8Array(fileBuffer),
          disableWorker: true,
        } as Parameters<typeof pdfjsLib.getDocument>[0]).promise;
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();

          const pageText = content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .trim();

          if (pageText) {
            extractedText += `${pageText}\n\n`;
          }
        }

      } else if (document.mimeType === "text/plain") {
        extractedText = fileBuffer.toString("utf8");
      } else {
        throw new Error(
          `Processing for ${document.mimeType} is not implemented yet`,
        );
      }

      const chunks = chunkText(extractedText);

      if (chunks.length === 0) {
        throw new Error("No readable text was extracted from the document");
      }

      await db.$transaction(async (tx) => {
  await tx.documentChunk.deleteMany({
    where: { documentId: document.id },
  });

  for (const [index, content] of chunks.entries()) {
    const embedding = await generateEmbedding(
      content,
      "RETRIEVAL_DOCUMENT",
    );

    await tx.documentChunk.create({
      data: {
        documentId: document.id,
        chunkIndex: index,
        content,
      },
    });

    const embeddingLiteral = `[${embedding.join(",")}]`;

    await tx.$executeRaw`
      UPDATE "DocumentChunk"
      SET "embedding" = ${embeddingLiteral}::vector
      WHERE "documentId" = ${document.id}
        AND "chunkIndex" = ${index}
    `;
  }

  await tx.document.update({
    where: { id: document.id },
    data: { status: "READY" },
  });
}, { timeout: 30_000 });

      return NextResponse.json({
        ok: true,
        documentId: document.id,
        status: "READY",
        chunks: chunks.length,
        characters: extractedText.length,
      });
    } catch (processingError) {
      console.error("Document processing failed:", processingError);

      await db.document.update({
        where: { id: document.id },
        data: { status: "FAILED" },
      });

      return NextResponse.json(
        {
          error: "Document processing failed",
          details:
            processingError instanceof Error
              ? processingError.message
              : "Unknown processing error",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Document processing request failed:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
