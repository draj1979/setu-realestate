import { NextRequest, NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase-admin";
import { knowledgeBucket } from "@/lib/storage";
import { db } from "@setu/db";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024;

async function getAuthorizedProject(
  request: NextRequest,
  projectId: string,
) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("AUTH_REQUIRED");
  }

  const idToken = authorization.slice("Bearer ".length);
  const decodedToken = await adminAuth.verifyIdToken(idToken);

  const user = await db.user.findUnique({
    where: {
      firebaseUid: decodedToken.uid,
    },
    include: {
      memberships: true,
    },
  });

  if (!user || user.memberships.length === 0) {
    throw new Error("BUILDER_NOT_FOUND");
  }

  const organizationId = user.memberships[0].organizationId;

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      organizationId,
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  return project;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;

    await getAuthorizedProject(request, projectId);

    const documents = await db.document.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      documents: documents.map((document) => ({
        ...document,
        sizeBytes: document.sizeBytes?.toString() ?? null,
      })),
    });
  } catch (error) {
    console.error("Document listing failed:", error);

    if (error instanceof Error) {
      if (error.message === "AUTH_REQUIRED") {
        return NextResponse.json(
          { ok: false, error: "Missing authentication token" },
          { status: 401 },
        );
      }

      if (error.message === "BUILDER_NOT_FOUND") {
        return NextResponse.json(
          { ok: false, error: "Builder account not found" },
          { status: 404 },
        );
      }

      if (error.message === "PROJECT_NOT_FOUND") {
        return NextResponse.json(
          { ok: false, error: "Project not found" },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      { ok: false, error: "Could not load documents" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;

    await getAuthorizedProject(request, projectId);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "A file is required" },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Only PDF, DOCX, and TXT files are supported",
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          error: "File size must be 25 MB or less",
        },
        { status: 400 },
      );
    }

    const documentId = crypto.randomUUID();
    const safeFileName = file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );

    const storagePath =
      `projects/${projectId}/knowledge/${documentId}/${safeFileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    await knowledgeBucket.file(storagePath).save(buffer, {
      metadata: {
        contentType: file.type,
      },
      resumable: false,
    });

    const document = await db.document.create({
      data: {
        id: documentId,
        projectId,
        name: file.name,
        storagePath,
        mimeType: file.type,
        sizeBytes: file.size,
        status: "UPLOADED",
      },
    });

    return NextResponse.json({
      ok: true,
      document: {
        id: document.id,
        name: document.name,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes?.toString() ?? null,
        status: document.status,
        createdAt: document.createdAt,
      },
    });
  } catch (error) {
    console.error("Document upload failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not upload document" },
      { status: 500 },
    );
  }
}
