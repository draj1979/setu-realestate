import { NextRequest, NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase-admin";
import { db } from "@setu/db";

async function resolveUser(request: NextRequest) {
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
    include: { memberships: { include: { organization: true } } },
  });

  if (!user) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Builder account not found" },
        { status: 404 },
      ),
    } as const;
  }

  return { user } as const;
}

function serializeUser(user: NonNullable<Awaited<ReturnType<typeof resolveUser>>["user"]>) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
    memberships: user.memberships.map((membership) => ({
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      role: membership.role,
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveUser(request);

    if (resolved.error) {
      return resolved.error;
    }

    return NextResponse.json({ ok: true, user: serializeUser(resolved.user) });
  } catch (error) {
    console.error("Profile lookup failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load profile" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const resolved = await resolveUser(request);

    if (resolved.error) {
      return resolved.error;
    }

    const body = await request.json();
    const { displayName, phone } = body as {
      displayName?: string;
      phone?: string;
    };

    const updated = await db.user.update({
      where: { id: resolved.user.id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(phone !== undefined && { phone: phone || null }),
      },
      include: { memberships: { include: { organization: true } } },
    });

    return NextResponse.json({ ok: true, user: serializeUser(updated) });
  } catch (error) {
    console.error("Profile update failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not update profile" },
      { status: 500 },
    );
  }
}
