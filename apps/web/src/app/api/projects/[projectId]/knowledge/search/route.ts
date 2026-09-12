import { NextRequest, NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase-admin";
import { retrieveKnowledge } from "@/lib/ai/retrieval";
import { db } from "@setu/db";

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ projectId: string }>;
  },
) {
  try {
    const { projectId } = await context.params;

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const token = authorization.slice("Bearer ".length);

    let decodedToken;

    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 },
      );
    }

    const user = await db.user.findUnique({
      where: {
        firebaseUid: decodedToken.uid,
      },
      include: {
        memberships: true,
      },
    });

    if (!user || user.memberships.length === 0) {
      return NextResponse.json(
        { error: "User or organization not found" },
        { status: 403 },
      );
    }

    const organizationId = user.memberships[0].organizationId;

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      query?: string;
      limit?: number;
    };

    const query = body.query?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 },
      );
    }

    const limit = Math.min(Math.max(body.limit ?? 5, 1), 10);

    const results = await retrieveKnowledge(
      project.id,
      query,
      limit,
    );

    return NextResponse.json({
      query,
      results,
    });
  } catch (error) {
    console.error("Knowledge search failed:", error);

    return NextResponse.json(
      {
        error: "Knowledge search failed",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
}
