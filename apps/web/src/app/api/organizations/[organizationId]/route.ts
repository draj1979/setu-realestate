import { NextRequest, NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase-admin";
import { db } from "@setu/db";

async function resolveMembership(
  request: NextRequest,
  organizationId: string,
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

  const membership = user?.memberships.find(
    (m) => m.organizationId === organizationId,
  );

  if (!user || !membership) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Organization not found" },
        { status: 404 },
      ),
    } as const;
  }

  return { membership } as const;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;
    const resolved = await resolveMembership(request, organizationId);

    if (resolved.error) {
      return resolved.error;
    }

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      include: {
        memberships: {
          include: { user: true },
          orderBy: { createdAt: "asc" },
        },
        projects: { select: { id: true } },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { ok: false, error: "Organization not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        hasLogo: Boolean(organization.logoStoragePath),
        createdAt: organization.createdAt.toISOString(),
        projectCount: organization.projects.length,
        currentUserRole: resolved.membership.role,
        members: organization.memberships.map((membership) => ({
          id: membership.id,
          role: membership.role,
          userId: membership.userId,
          name: membership.user.displayName,
          email: membership.user.email,
          joinedAt: membership.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Organization lookup failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load organization" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;
    const resolved = await resolveMembership(request, organizationId);

    if (resolved.error) {
      return resolved.error;
    }

    if (
      resolved.membership.role !== "OWNER" &&
      resolved.membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { ok: false, error: "Only an owner or admin can update organization settings" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { name } = body as { name?: string };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { ok: false, error: "Organization name is required" },
        { status: 400 },
      );
    }

    const organization = await db.organization.update({
      where: { id: organizationId },
      data: { name: name.trim() },
      select: { id: true, name: true, slug: true },
    });

    return NextResponse.json({ ok: true, organization });
  } catch (error) {
    console.error("Organization update failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not update organization" },
      { status: 500 },
    );
  }
}
