import { NextRequest, NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase-admin";
import { db } from "@setu/db";

const META_GRAPH_VERSION = "v23.0";
const META_APP_ID = "4464692527110370";

export async function POST(
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
    const body = await request.json();

    const code = String(body.code ?? "").trim();
    const wabaId = String(body.wabaId ?? "").trim();
    const phoneNumberId = String(body.phoneNumberId ?? "").trim();

    if (!code || !wabaId || !phoneNumberId) {
      return NextResponse.json(
        { ok: false, error: "Missing WhatsApp connection details" },
        { status: 400 },
      );
    }

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

    const appSecret = process.env.META_APP_SECRET?.trim();

    if (!appSecret) {
      console.error("META_APP_SECRET is not configured");
      return NextResponse.json(
        { ok: false, error: "Meta integration is not configured" },
        { status: 500 },
      );
    }

    const tokenResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: META_APP_ID,
          client_secret: appSecret,
          grant_type: "authorization_code",
          code,
        }),
        cache: "no-store",
      },
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Meta token exchange failed:", {
        status: tokenResponse.status,
        error: tokenData.error?.message ?? "Unknown Meta error",
        type: tokenData.error?.type,
        code: tokenData.error?.code,
        fbtrace_id: tokenData.error?.fbtrace_id,
      });

      return NextResponse.json(
        { ok: false, error: "Meta authorization failed" },
        { status: 400 },
      );
    }

    const accessToken = String(tokenData.access_token);

    console.log("Meta authorization code exchanged successfully");

    const debugTokenResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/debug_token?${new URLSearchParams(
        {
          input_token: accessToken,
          access_token: `${META_APP_ID}|${appSecret}`,
        },
      )}`,
      { cache: "no-store" },
    );
    const debugTokenData = await debugTokenResponse.json();
    const granularScopes: Array<{
      scope: string;
      target_ids?: string[];
    }> = debugTokenData.data?.granular_scopes ?? [];

    const messagingScope = granularScopes.find(
      (s) => s.scope === "whatsapp_business_messaging",
    );

    // Don't trust the client-supplied phoneNumberId for the authoritative
    // lookup — it can be stale (e.g. a leftover value from a prior signup
    // attempt in the same browser session), and listing phone numbers via
    // the WABA's /phone_numbers edge has proven unreliable right after
    // signup. Instead, read the phone number id straight off the token's
    // own granted scope (whatsapp_business_messaging's target_ids besides
    // the WABA id itself) — that's what Meta says this token can message
    // with — and validate it with a direct node lookup.
    const grantedPhoneNumberId = messagingScope?.target_ids?.find(
      (id) => id !== wabaId,
    );

    console.log("Meta exchanged-token diagnostics:", {
      status: debugTokenResponse.status,
      type: debugTokenData.data?.type,
      appId: debugTokenData.data?.app_id,
      isValid: debugTokenData.data?.is_valid,
      expiresAt: debugTokenData.data?.expires_at,
      scopes: debugTokenData.data?.scopes,
      granularScopesJson: JSON.stringify(granularScopes),
      wabaIdRequested: wabaId,
      phoneNumberIdRequested: phoneNumberId,
      grantedPhoneNumberId,
      error: debugTokenData.data?.error ?? debugTokenData.error,
    });

    if (!grantedPhoneNumberId) {
      console.error(
        "No phone number id found in token's granted scopes for this WABA:",
        { wabaId },
      );

      return NextResponse.json(
        { ok: false, error: "Unable to validate WhatsApp phone number" },
        { status: 400 },
      );
    }

    const phoneResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${grantedPhoneNumberId}?fields=id,display_phone_number,verified_name`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      },
    );

    const phoneData = await phoneResponse.json();

    if (!phoneResponse.ok || String(phoneData.id) !== grantedPhoneNumberId) {
      console.error("Meta phone validation failed:", {
        status: phoneResponse.status,
        error: phoneData.error?.message ?? "Unknown Meta error",
        grantedPhoneNumberId,
      });

      return NextResponse.json(
        { ok: false, error: "Unable to validate WhatsApp phone number" },
        { status: 400 },
      );
    }

    if (grantedPhoneNumberId !== phoneNumberId) {
      console.warn(
        "Client-supplied phoneNumberId did not match token's granted phone number; using the granted one:",
        { phoneNumberIdRequested: phoneNumberId, grantedPhoneNumberId },
      );
    }

    await db.whatsAppChannel.upsert({
      where: { projectId },
      create: {
        projectId,
        phoneNumberId: grantedPhoneNumberId,
        businessAccountId: wabaId,
        displayPhoneNumber: phoneData.display_phone_number ?? null,
        active: true,
      },
      update: {
        phoneNumberId: grantedPhoneNumberId,
        businessAccountId: wabaId,
        displayPhoneNumber: phoneData.display_phone_number ?? null,
        active: true,
      },
    });

    console.log("WhatsApp channel connected:", {
      projectId,
      wabaId,
      phoneNumberId: grantedPhoneNumberId,
    });

    return NextResponse.json({
      ok: true,
      connected: true,
      wabaId,
      phoneNumberId: grantedPhoneNumberId,
      displayPhoneNumber: phoneData.display_phone_number ?? null,
    });
  } catch (error) {
    console.error("WhatsApp connect error:", error);

    return NextResponse.json(
      { ok: false, error: "WhatsApp connection failed" },
      { status: 500 },
    );
  }
}
