import { NextRequest, NextResponse } from "next/server";

import { authorizeProject } from "@/lib/projects/authorize";
import { db } from "@setu/db";

const LEAD_STATUSES = [
  "NEW",
  "ENGAGED",
  "QUALIFYING",
  "QUALIFIED",
  "FOLLOWUP",
  "SITE_VISIT_PROPOSED",
  "SITE_VISIT_SCHEDULED",
  "SITE_VISIT_COMPLETED",
  "HANDED_OFF",
  "LOST",
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; leadId: string }> },
) {
  try {
    const { projectId, leadId } = await params;
    const auth = await authorizeProject(request, projectId);

    if (auth.error) {
      return auth.error;
    }

    const lead = await db.lead.findFirst({
      where: { id: leadId, projectId },
      include: {
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                direction: true,
                type: true,
                text: true,
                createdAt: true,
              },
            },
          },
        },
        siteVisits: {
          orderBy: { startAt: "desc" },
          select: {
            id: true,
            startAt: true,
            endAt: true,
            status: true,
            notes: true,
            calendarEventId: true,
          },
        },
        followups: {
          orderBy: { scheduledAt: "desc" },
          select: {
            id: true,
            scheduledAt: true,
            status: true,
            message: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { ok: false, error: "Lead not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      lead: {
        id: lead.id,
        name: lead.name,
        whatsappNumber: lead.whatsappNumber,
        status: lead.status,
        score: lead.score,
        budget: lead.budget?.toString() ?? null,
        purpose: lead.purpose,
        timeline: lead.timeline,
        preferredLocation: lead.preferredLocation,
        configuration: lead.configuration,
        notes: lead.notes,
        optedOut: lead.optedOut,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
        conversation: lead.conversation
          ? {
              id: lead.conversation.id,
              status: lead.conversation.status,
              lastMessageAt:
                lead.conversation.lastMessageAt?.toISOString() ?? null,
              messages: lead.conversation.messages.map((message) => ({
                id: message.id,
                direction: message.direction,
                type: message.type,
                text: message.text,
                createdAt: message.createdAt.toISOString(),
              })),
            }
          : null,
        siteVisits: lead.siteVisits.map((visit) => ({
          id: visit.id,
          startAt: visit.startAt.toISOString(),
          endAt: visit.endAt.toISOString(),
          status: visit.status,
          notes: visit.notes,
          calendarEventId: visit.calendarEventId,
        })),
        followups: lead.followups.map((followup) => ({
          id: followup.id,
          scheduledAt: followup.scheduledAt.toISOString(),
          status: followup.status,
          message: followup.message,
        })),
      },
    });
  } catch (error) {
    console.error("Lead detail lookup failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load lead" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; leadId: string }> },
) {
  try {
    const { projectId, leadId } = await params;
    const auth = await authorizeProject(request, projectId);

    if (auth.error) {
      return auth.error;
    }

    const existing = await db.lead.findFirst({
      where: { id: leadId, projectId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Lead not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { status, notes } = body as { status?: string; notes?: string };

    if (status !== undefined && !LEAD_STATUSES.includes(status as never)) {
      return NextResponse.json(
        { ok: false, error: "Invalid lead status" },
        { status: 400 },
      );
    }

    const lead = await db.lead.update({
      where: { id: existing.id },
      data: {
        ...(status !== undefined && { status: status as never }),
        ...(notes !== undefined && { notes }),
      },
      select: {
        id: true,
        status: true,
        notes: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      lead: {
        ...lead,
        updatedAt: lead.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Lead update failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not update lead" },
      { status: 500 },
    );
  }
}
