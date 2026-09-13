import { NextRequest, NextResponse } from "next/server";

import { authorizeProject } from "@/lib/projects/authorize";
import { db } from "@setu/db";

// Builder-facing control over a scheduled follow-up: cancel it outright, or
// reschedule its time/message while it's still pending. Sent/failed/
// cancelled follow-ups are historical and cannot be edited.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; followupId: string }> },
) {
  try {
    const { projectId, followupId } = await params;
    const auth = await authorizeProject(request, projectId);

    if (auth.error) {
      return auth.error;
    }

    const existing = await db.followupJob.findFirst({
      where: { id: followupId, projectId },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Follow-up not found" },
        { status: 404 },
      );
    }

    if (existing.status !== "PENDING") {
      return NextResponse.json(
        {
          ok: false,
          error: `Follow-up is already ${existing.status.toLowerCase()} and cannot be changed`,
        },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { action, scheduledAt, message } = body as {
      action?: "cancel" | "reschedule";
      scheduledAt?: string;
      message?: string;
    };

    if (action === "cancel") {
      const followup = await db.followupJob.update({
        where: { id: existing.id },
        data: { status: "CANCELLED" },
        select: { id: true, status: true },
      });

      return NextResponse.json({ ok: true, followup });
    }

    if (action === "reschedule") {
      if (!scheduledAt) {
        return NextResponse.json(
          { ok: false, error: "scheduledAt is required to reschedule" },
          { status: 400 },
        );
      }

      const followup = await db.followupJob.update({
        where: { id: existing.id },
        data: {
          scheduledAt: new Date(scheduledAt),
          ...(message !== undefined && { message }),
        },
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          message: true,
        },
      });

      return NextResponse.json({
        ok: true,
        followup: {
          ...followup,
          scheduledAt: followup.scheduledAt.toISOString(),
        },
      });
    }

    return NextResponse.json(
      { ok: false, error: "Unknown action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Follow-up update failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not update follow-up" },
      { status: 500 },
    );
  }
}
