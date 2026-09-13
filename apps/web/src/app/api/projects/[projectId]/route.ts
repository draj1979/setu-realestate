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

const PROJECT_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;

export async function PATCH(
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
      where: { firebaseUid: decodedToken.uid },
      include: { memberships: true },
    });

    if (!user || user.memberships.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Builder account not found" },
        { status: 404 },
      );
    }

    const { projectId } = await context.params;

    const existing = await db.project.findFirst({
      where: {
        id: projectId,
        organizationId: { in: user.memberships.map((m) => m.organizationId) },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Project not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { name, description, status } = body as {
      name?: string;
      description?: string;
      status?: string;
    };

    if (status !== undefined && !PROJECT_STATUSES.includes(status as never)) {
      return NextResponse.json(
        { ok: false, error: "Invalid project status" },
        { status: 400 },
      );
    }

    if (name !== undefined && !name.trim()) {
      return NextResponse.json(
        { ok: false, error: "Project name cannot be empty" },
        { status: 400 },
      );
    }

    const project = await db.project.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(status !== undefined && { status: status as never }),
      },
    });

    return NextResponse.json({ ok: true, project });
  } catch (error) {
    console.error("Project update failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not update project" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
      where: { firebaseUid: decodedToken.uid },
      include: { memberships: true },
    });

    if (!user || user.memberships.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Builder account not found" },
        { status: 404 },
      );
    }

    const { projectId } = await context.params;

    // Only an owner/admin can delete a project outright — deleting cascades
    // to every lead, conversation, message, site visit and document under
    // it (see onDelete: Cascade in the schema), so this is a genuinely
    // destructive action, not just a status change.
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        organizationId: { in: user.memberships.map((m) => m.organizationId) },
      },
    });

    if (!project) {
      return NextResponse.json(
        { ok: false, error: "Project not found" },
        { status: 404 },
      );
    }

    const ownerMembership = user.memberships.find(
      (m) => m.organizationId === project.organizationId,
    );

    if (
      !ownerMembership ||
      (ownerMembership.role !== "OWNER" && ownerMembership.role !== "ADMIN")
    ) {
      return NextResponse.json(
        { ok: false, error: "Only an owner or admin can delete a project" },
        { status: 403 },
      );
    }

    await db.project.delete({ where: { id: project.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Project deletion failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not delete project" },
      { status: 500 },
    );
  }
}
