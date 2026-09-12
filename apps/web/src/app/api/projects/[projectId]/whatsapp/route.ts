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

    const channel = await db.whatsAppChannel.findUnique({
      where: { projectId },
    });

    return NextResponse.json({
      ok: true,
      connected: Boolean(channel?.active),
      phoneNumberId: channel?.phoneNumberId ?? null,
      displayPhoneNumber: channel?.displayPhoneNumber ?? null,
    });
  } catch (error) {
    console.error("WhatsApp status lookup failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load WhatsApp status" },
      { status: 500 },
    );
  }
}
