import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { db } from "@setu/db";

export async function POST(request: NextRequest) {
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
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      firebaseUid: decodedToken.uid,
      email: decodedToken.email ?? null,
      user: user
        ? {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            memberships: user.memberships.map((membership) => ({
              organizationId: membership.organizationId,
              role: membership.role,
              organizationName: membership.organization.name,
            })),
          }
        : null,
    });
  } catch (error) {
    console.error("Auth session failed:", error);

    return NextResponse.json(
      { ok: false, error: "Authentication failed" },
      { status: 401 },
    );
  }
}
