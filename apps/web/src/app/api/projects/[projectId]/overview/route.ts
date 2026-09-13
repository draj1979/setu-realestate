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

    const [
      leadStatusCounts,
      totalLeads,
      activeConversations,
      pendingFollowups,
      upcomingSiteVisits,
      whatsappChannel,
      calendarConnection,
      agentConfiguration,
      documentCount,
    ] = await Promise.all([
      db.lead.groupBy({
        by: ["status"],
        where: { projectId },
        _count: { _all: true },
      }),
      db.lead.count({ where: { projectId } }),
      db.conversation.count({ where: { projectId, status: "ACTIVE" } }),
      db.followupJob.count({ where: { projectId, status: "PENDING" } }),
      db.siteVisit.findMany({
        where: {
          projectId,
          status: { in: ["PROPOSED", "SCHEDULED"] },
          startAt: { gte: new Date() },
        },
        orderBy: { startAt: "asc" },
        take: 5,
        select: {
          id: true,
          startAt: true,
          status: true,
          lead: { select: { id: true, name: true, whatsappNumber: true } },
        },
      }),
      db.whatsAppChannel.findUnique({ where: { projectId } }),
      db.googleCalendarConnection.findUnique({ where: { projectId } }),
      db.agentConfiguration.findUnique({ where: { projectId } }),
      db.document.count({ where: { projectId } }),
    ]);

    return NextResponse.json({
      ok: true,
      overview: {
        totalLeads,
        leadsByStatus: Object.fromEntries(
          leadStatusCounts.map((row) => [row.status, row._count._all]),
        ),
        activeConversations,
        pendingFollowups,
        documentCount,
        upcomingSiteVisits: upcomingSiteVisits.map((visit) => ({
          id: visit.id,
          startAt: visit.startAt.toISOString(),
          status: visit.status,
          lead: visit.lead,
        })),
        whatsapp: {
          connected: Boolean(whatsappChannel?.active),
          displayPhoneNumber: whatsappChannel?.displayPhoneNumber ?? null,
        },
        calendar: {
          connected: Boolean(calendarConnection?.active),
        },
        agent: {
          configured: Boolean(agentConfiguration),
          status: agentConfiguration?.status ?? null,
          name: agentConfiguration?.name ?? null,
        },
      },
    });
  } catch (error) {
    console.error("Project overview failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load project overview" },
      { status: 500 },
    );
  }
}
