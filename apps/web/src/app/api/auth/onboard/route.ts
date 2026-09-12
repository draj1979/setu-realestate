import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { db } from "@setu/db";

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

    const body = await request.json();

    const displayName = String(body.displayName ?? "").trim();
    const organizationName = String(body.organizationName ?? "").trim();

    if (!displayName || !organizationName) {
      return NextResponse.json(
        {
          ok: false,
          error: "Name and builder/company name are required",
        },
        { status: 400 },
      );
    }

    const existingUser = await db.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (existingUser) {
      return NextResponse.json({
        ok: true,
        created: false,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          displayName: existingUser.displayName,
          memberships: existingUser.memberships.map((membership) => ({
            organizationId: membership.organizationId,
            organizationName: membership.organization.name,
            role: membership.role,
          })),
        },
      });
    }

    const baseSlug = createSlug(organizationName);

    if (!baseSlug) {
      return NextResponse.json(
        { ok: false, error: "Invalid builder/company name" },
        { status: 400 },
      );
    }

    const organization = await db.$transaction(async (tx) => {
      const existingOrganization = await tx.organization.findUnique({
        where: { slug: baseSlug },
      });

      const slug = existingOrganization
        ? `${baseSlug}-${Date.now().toString(36)}`
        : baseSlug;

      const createdOrganization = await tx.organization.create({
        data: {
          name: organizationName,
          slug,
        },
      });

      const user = await tx.user.create({
        data: {
          firebaseUid: decodedToken.uid,
          email: decodedToken.email ?? null,
          phone: decodedToken.phone_number ?? null,
          displayName,
        },
      });

      await tx.organizationMembership.create({
        data: {
          organizationId: createdOrganization.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      return createdOrganization;
    });

    return NextResponse.json({
      ok: true,
      created: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
    });
  } catch (error) {
    console.error("Auth onboarding failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not create builder account" },
      { status: 500 },
    );
  }
}
