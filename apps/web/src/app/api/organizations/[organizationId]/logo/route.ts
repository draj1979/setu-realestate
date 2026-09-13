import { NextRequest, NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase-admin";
import { knowledgeBucket } from "@/lib/storage";
import { serveStoredFile } from "@/lib/storage/serve-file";
import { db } from "@setu/db";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const MAX_LOGO_SIZE = 5 * 1024 * 1024;

async function resolveEditableMembership(
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

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return {
      error: NextResponse.json(
        { ok: false, error: "Only an owner or admin can change the logo" },
        { status: 403 },
      ),
    } as const;
  }

  return { membership } as const;
}

// GET is intentionally unauthenticated — this is served straight into an
// <img src> which cannot carry an Authorization header. A company logo is
// not sensitive data.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: { logoStoragePath: true, logoMimeType: true },
    });

    if (!organization?.logoStoragePath || !organization.logoMimeType) {
      return NextResponse.json(
        { ok: false, error: "No logo uploaded" },
        { status: 404 },
      );
    }

    return serveStoredFile(
      organization.logoStoragePath,
      organization.logoMimeType,
    );
  } catch (error) {
    console.error("Organization logo fetch failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load logo" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;
    const auth = await resolveEditableMembership(request, organizationId);

    if (auth.error) {
      return auth.error;
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "A file is required" },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Only PNG, JPEG, WEBP or SVG logos are supported" },
        { status: 400 },
      );
    }

    if (file.size > MAX_LOGO_SIZE) {
      return NextResponse.json(
        { ok: false, error: "Logo must be 5 MB or smaller" },
        { status: 400 },
      );
    }

    const storagePath = `organizations/${organizationId}/logo/${crypto.randomUUID()}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await knowledgeBucket.file(storagePath).save(buffer, {
      metadata: { contentType: file.type },
      resumable: false,
    });

    // Best-effort cleanup of the previous logo so old blobs don't pile up.
    const existing = await db.organization.findUnique({
      where: { id: organizationId },
      select: { logoStoragePath: true },
    });

    if (existing?.logoStoragePath) {
      knowledgeBucket
        .file(existing.logoStoragePath)
        .delete({ ignoreNotFound: true })
        .catch(() => {});
    }

    await db.organization.update({
      where: { id: organizationId },
      data: { logoStoragePath: storagePath, logoMimeType: file.type },
    });

    return NextResponse.json({ ok: true, logoUrl: `/api/organizations/${organizationId}/logo?v=${Date.now()}` });
  } catch (error) {
    console.error("Organization logo upload failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not upload logo" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;
    const auth = await resolveEditableMembership(request, organizationId);

    if (auth.error) {
      return auth.error;
    }

    const existing = await db.organization.findUnique({
      where: { id: organizationId },
      select: { logoStoragePath: true },
    });

    if (existing?.logoStoragePath) {
      await knowledgeBucket
        .file(existing.logoStoragePath)
        .delete({ ignoreNotFound: true });
    }

    await db.organization.update({
      where: { id: organizationId },
      data: { logoStoragePath: null, logoMimeType: null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Organization logo removal failed:", error);

    return NextResponse.json(
      { ok: false, error: "Could not remove logo" },
      { status: 500 },
    );
  }
}
