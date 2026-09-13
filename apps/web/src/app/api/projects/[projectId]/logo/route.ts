import { NextRequest, NextResponse } from "next/server";

import { authorizeProject } from "@/lib/projects/authorize";
import { knowledgeBucket } from "@/lib/storage";
import { serveStoredFile } from "@/lib/storage/serve-file";
import { db } from "@setu/db";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const MAX_LOGO_SIZE = 5 * 1024 * 1024;

// GET is intentionally unauthenticated — served straight into an <img src>.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { logoStoragePath: true, logoMimeType: true },
    });

    if (!project?.logoStoragePath || !project.logoMimeType) {
      return NextResponse.json(
        { ok: false, error: "No logo uploaded" },
        { status: 404 },
      );
    }

    return serveStoredFile(project.logoStoragePath, project.logoMimeType);
  } catch (error) {
    console.error("Project logo fetch failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load logo" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const auth = await authorizeProject(request, projectId);

    if (auth.error) {
      return auth.error;
    }

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
        { ok: false, error: "Only PNG, JPEG, WEBP or SVG logos are supported" },
        { status: 400 },
      );
    }

    if (file.size > MAX_LOGO_SIZE) {
      return NextResponse.json(
        { ok: false, error: "Logo must be 5 MB or smaller" },
        { status: 400 },
      );
    }

    const storagePath = `projects/${projectId}/logo/${crypto.randomUUID()}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await knowledgeBucket.file(storagePath).save(buffer, {
      metadata: { contentType: file.type },
      resumable: false,
    });

    const existing = await db.project.findUnique({
      where: { id: projectId },
      select: { logoStoragePath: true },
    });

    if (existing?.logoStoragePath) {
      knowledgeBucket
        .file(existing.logoStoragePath)
        .delete({ ignoreNotFound: true })
        .catch(() => {});
    }

    await db.project.update({
      where: { id: projectId },
      data: { logoStoragePath: storagePath, logoMimeType: file.type },
    });

    return NextResponse.json({
      ok: true,
      logoUrl: `/api/projects/${projectId}/logo?v=${Date.now()}`,
    });
  } catch (error) {
    console.error("Project logo upload failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not upload logo" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const auth = await authorizeProject(request, projectId);

    if (auth.error) {
      return auth.error;
    }

    const existing = await db.project.findUnique({
      where: { id: projectId },
      select: { logoStoragePath: true },
    });

    if (existing?.logoStoragePath) {
      await knowledgeBucket
        .file(existing.logoStoragePath)
        .delete({ ignoreNotFound: true });
    }

    await db.project.update({
      where: { id: projectId },
      data: { logoStoragePath: null, logoMimeType: null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Project logo removal failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not remove logo" },
      { status: 500 },
    );
  }
}
