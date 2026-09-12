import { NextRequest, NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase-admin";
import { db } from "@setu/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, error: "Missing authentication token" },
        { status: 401 },
      );
    }

    const idToken = authorization.slice("Bearer ".length);
    const decodedToken = await adminAuth.verifyIdToken(idToken);

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
        { ok: false, error: "Builder account not found" },
        { status: 404 },
      );
    }

    const { projectId } = await context.params;
    const organizationId = user.memberships[0].organizationId;

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
    });

    if (!project) {
      return NextResponse.json(
        { ok: false, error: "Project not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      project,
    });
  } catch (error) {
    console.error("Project loading failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load project" },
      { status: 500 },
    );
  }
}
