import { NextRequest, NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase-admin";
import { db } from "@setu/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
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

    const { projectId } = await params;

    const user = await db.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      include: { memberships: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "User not found" },
        { status: 404 },
      );
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
      return NextResponse.json(
        { ok: false, error: "Project not found" },
        { status: 404 },
      );
    }

    const connection = await db.googleCalendarConnection.findUnique({
      where: { projectId },
    });

    return NextResponse.json({
      ok: true,
      connected: Boolean(connection?.active),
      calendarId: connection?.calendarId ?? null,
    });
  } catch (error) {
    console.error("Calendar status lookup failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load calendar status" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
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

    const { projectId } = await params;

    const user = await db.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      include: { memberships: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "User not found" },
        { status: 404 },
      );
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
      return NextResponse.json(
        { ok: false, error: "Project not found" },
        { status: 404 },
      );
    }

    // Soft-disconnect: mark inactive rather than deleting, so
    // get_site_visit_slots/book_site_visit stop working immediately but the
    // builder can re-authorize (prompt=consent on the connect flow always
    // requests a fresh refresh token, so a stale one left behind is fine).
    await db.googleCalendarConnection.updateMany({
      where: { projectId },
      data: { active: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Calendar disconnect failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not disconnect calendar" },
      { status: 500 },
    );
  }
}
