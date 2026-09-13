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

    const conversations = await db.conversation.findMany({
      where: {
        projectId,
        ...(status ? { status: status as never } : {}),
        ...(search
          ? {
              lead: {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { whatsappNumber: { contains: search } },
                ],
              },
            }
          : {}),
      },
      orderBy: { lastMessageAt: "desc" },
      select: {
        id: true,
        status: true,
        startedAt: true,
        lastMessageAt: true,
        closedAt: true,
        lead: {
          select: {
            id: true,
            name: true,
            whatsappNumber: true,
            status: true,
            optedOut: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            direction: true,
            type: true,
            text: true,
            createdAt: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        status: conversation.status,
        startedAt: conversation.startedAt.toISOString(),
        lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
        closedAt: conversation.closedAt?.toISOString() ?? null,
        messageCount: conversation._count.messages,
        lead: conversation.lead,
        lastMessage: conversation.messages[0]
          ? {
              direction: conversation.messages[0].direction,
              type: conversation.messages[0].type,
              text: conversation.messages[0].text,
              createdAt: conversation.messages[0].createdAt.toISOString(),
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Conversations list failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load conversations" },
      { status: 500 },
    );
  }
}
