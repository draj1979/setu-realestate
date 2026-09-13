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
    const search = searchParams.get("search")?.trim();

    const leads = await db.lead.findMany({
      where: {
        projectId,
        ...(status ? { status: status as never } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { whatsappNumber: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        whatsappNumber: true,
        status: true,
        score: true,
        budget: true,
        purpose: true,
        timeline: true,
        preferredLocation: true,
        optedOut: true,
        createdAt: true,
        updatedAt: true,
        conversation: {
          select: { lastMessageAt: true, status: true },
        },
        siteVisits: {
          orderBy: { startAt: "desc" },
          take: 1,
          select: { startAt: true, status: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      leads: leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        whatsappNumber: lead.whatsappNumber,
        status: lead.status,
        score: lead.score,
        budget: lead.budget?.toString() ?? null,
        purpose: lead.purpose,
        timeline: lead.timeline,
        preferredLocation: lead.preferredLocation,
        optedOut: lead.optedOut,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
        conversation: lead.conversation
          ? {
              status: lead.conversation.status,
              lastMessageAt:
                lead.conversation.lastMessageAt?.toISOString() ?? null,
            }
          : null,
        latestSiteVisit: lead.siteVisits[0]
          ? {
              startAt: lead.siteVisits[0].startAt.toISOString(),
              status: lead.siteVisits[0].status,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Leads list failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load leads" },
      { status: 500 },
    );
  }
}
