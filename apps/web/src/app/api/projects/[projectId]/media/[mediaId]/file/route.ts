import { NextRequest, NextResponse } from "next/server";

import { serveStoredFile } from "@/lib/storage/serve-file";
import { db } from "@setu/db";

// Unauthenticated on purpose — rendered directly into <img>/<a> tags which
// cannot carry an Authorization header. Project media (renders/floor plans/
// brochures) is marketing content, not sensitive customer data.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; mediaId: string }> },
) {
  try {
    const { projectId, mediaId } = await params;

    const media = await db.projectMedia.findFirst({
      where: { id: mediaId, projectId },
      select: { storagePath: true, mimeType: true },
    });

    if (!media) {
      return NextResponse.json(
        { ok: false, error: "Media not found" },
        { status: 404 },
      );
    }

    return serveStoredFile(media.storagePath, media.mimeType);
  } catch (error) {
    console.error("Media file fetch failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load media" },
      { status: 500 },
    );
  }
}
