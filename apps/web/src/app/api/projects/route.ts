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

export async function GET(request: NextRequest) {
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

    const organizationId = user.memberships[0].organizationId;

    const projects = await db.project.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      ok: true,
      projects,
    });
  } catch (error) {
    console.error("Project listing failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load projects" },
      { status: 500 },
    );
  }
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

    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Project name is required" },
        { status: 400 },
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
        { ok: false, error: "Builder account not found" },
        { status: 404 },
      );
    }

    const organizationId = user.memberships[0].organizationId;
    const baseSlug = createSlug(name);

    if (!baseSlug) {
      return NextResponse.json(
        { ok: false, error: "Invalid project name" },
        { status: 400 },
      );
    }

    const existingProject = await db.project.findUnique({
      where: {
        organizationId_slug: {
          organizationId,
          slug: baseSlug,
        },
      },
    });

    const slug = existingProject
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug;

    const project = await db.project.create({
      data: {
        organizationId,
        name,
        slug,
        description: description || null,
        status: "DRAFT",
      },
    });

    return NextResponse.json({
      ok: true,
      project,
    });
  } catch (error) {
    console.error("Project creation failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not create project" },
      { status: 500 },
    );
  }
}
