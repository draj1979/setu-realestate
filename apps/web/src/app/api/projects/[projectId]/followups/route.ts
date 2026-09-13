import { NextRequest, NextResponse } from "next/server";

import { authorizeProject } from "@/lib/projects/authorize";
import { db } from "@setu/db";

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

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");

    const followups = await db.followupJob.findMany({
      where: {
        projectId,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { scheduledAt: "desc" },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        message: true,
        attempts: true,
        sentAt: true,
        createdAt: true,
        lead: {
          select: { id: true, name: true, whatsappNumber: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      followups: followups.map((followup) => ({
        id: followup.id,
        scheduledAt: followup.scheduledAt.toISOString(),
        status: followup.status,
        message: followup.message,
        attempts: followup.attempts,
        sentAt: followup.sentAt?.toISOString() ?? null,
        createdAt: followup.createdAt.toISOString(),
        lead: followup.lead,
      })),
    });
  } catch (error) {
    console.error("Follow-ups list failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load follow-ups" },
      { status: 500 },
    );
  }
}
