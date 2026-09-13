import { NextRequest, NextResponse } from "next/server";

import { authorizeProject } from "@/lib/projects/authorize";
import { knowledgeBucket } from "@/lib/storage";
import { db } from "@setu/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; mediaId: string }> },
) {
  try {
    const { projectId, mediaId } = await params;
    const auth = await authorizeProject(request, projectId);

    if (auth.error) {
      return auth.error;
    }

    const media = await db.projectMedia.findFirst({
      where: { id: mediaId, projectId },
    });

    if (!media) {
      return NextResponse.json(
        { ok: false, error: "Media not found" },
        { status: 404 },
      );
    }

    await knowledgeBucket
      .file(media.storagePath)
      .delete({ ignoreNotFound: true });

    await db.projectMedia.delete({ where: { id: media.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Media deletion failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not delete media" },
      { status: 500 },
    );
  }
}
