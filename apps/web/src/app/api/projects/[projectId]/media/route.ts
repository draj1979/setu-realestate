import { NextRequest, NextResponse } from "next/server";

import { authorizeProject } from "@/lib/projects/authorize";
import { knowledgeBucket } from "@/lib/storage";
import { db } from "@setu/db";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

const MAX_MEDIA_SIZE = 15 * 1024 * 1024;
const MEDIA_TYPES = ["IMAGE", "FLOOR_PLAN", "BROCHURE", "DOCUMENT", "OTHER"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const auth = await authorizeProject(request, projectId);

    if (auth.error) {
      return auth.error;
    }

    const media = await db.projectMedia.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        mimeType: true,
        type: true,
        caption: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      media: media.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        fileUrl: `/api/projects/${projectId}/media/${item.id}/file`,
      })),
    });
  } catch (error) {
    console.error("Media list failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load media" },
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
    const type = formData.get("type");
    const caption = formData.get("caption");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "A file is required" },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Only PNG, JPEG, WEBP images or PDFs are supported" },
        { status: 400 },
      );
    }

    if (file.size > MAX_MEDIA_SIZE) {
      return NextResponse.json(
        { ok: false, error: "File must be 15 MB or smaller" },
        { status: 400 },
      );
    }

    const resolvedType =
      typeof type === "string" && MEDIA_TYPES.includes(type) ? type : "OTHER";

    const mediaId = crypto.randomUUID();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `projects/${projectId}/media/${mediaId}/${safeFileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    await knowledgeBucket.file(storagePath).save(buffer, {
      metadata: { contentType: file.type },
      resumable: false,
    });

    const media = await db.projectMedia.create({
      data: {
        id: mediaId,
        projectId,
        name: file.name,
        storagePath,
        mimeType: file.type,
        type: resolvedType as never,
        caption: typeof caption === "string" && caption ? caption : null,
      },
    });

    return NextResponse.json({
      ok: true,
      media: {
        id: media.id,
        name: media.name,
        mimeType: media.mimeType,
        type: media.type,
        caption: media.caption,
        createdAt: media.createdAt.toISOString(),
        fileUrl: `/api/projects/${projectId}/media/${media.id}/file`,
      },
    });
  } catch (error) {
    console.error("Media upload failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not upload media" },
      { status: 500 },
    );
  }
}
