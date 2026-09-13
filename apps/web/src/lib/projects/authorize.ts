import { NextRequest, NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase-admin";
import { db } from "@setu/db";

// Shared "does this Firebase user belong to an organization that owns this
// project" check, used by every project-scoped API route (leads, calendar,
// whatsapp, documents, etc). Returns either the resolved project or a
// ready-to-return NextResponse error.
export async function authorizeProject(
  request: NextRequest,
  projectId: string,
) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Missing authentication token" },
        { status: 401 },
      ),
    } as const;
  }

  const idToken = authorization.slice("Bearer ".length);
  const decodedToken = await adminAuth.verifyIdToken(idToken);

  const user = await db.user.findUnique({
    where: { firebaseUid: decodedToken.uid },
    include: { memberships: true },
  });

  if (!user) {
    return {
      error: NextResponse.json(
        { ok: false, error: "User not found" },
        { status: 404 },
      ),
    } as const;
  }

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      organizationId: {
        in: user.memberships.map((m) => m.organizationId),
      },
    },
  });

  if (!project) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Project not found" },
        { status: 404 },
      ),
    } as const;
  }

  return { project } as const;
}
