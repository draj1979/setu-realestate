import { NextRequest, NextResponse } from "next/server";

import { getOAuth2Client } from "@/lib/calendar/google-calendar";
import { db } from "@setu/db";

// `state` carries the projectId the builder was connecting from. This is
// not cryptographically signed — a forged state could only ever link an
// attacker's OWN Google Calendar to someone else's project (Google's own
// OAuth consent still requires the attacker to authorize with their own
// account), not leak the victim's data. Acceptable for now; revisit with
// a signed/short-lived state if this needs hardening later.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const code = searchParams.get("code");
  const projectId = searchParams.get("state");
  const error = searchParams.get("error");

  // Cloud Run terminates TLS/host routing in front of the container, so
  // request.nextUrl.origin resolves to the container's internal bind
  // address (0.0.0.0:8080), not the public domain — hardcode it instead,
  // matching GOOGLE_REDIRECT_URI which must exactly match what's
  // registered with Google and is hardcoded the same way.
  const redirectBase = new URL(
    `/projects/${projectId ?? ""}/calendar`,
    "https://app.gosetu.co",
  );

  if (error) {
    redirectBase.searchParams.set("error", error);
    return NextResponse.redirect(redirectBase);
  }

  if (!code || !projectId) {
    redirectBase.searchParams.set("error", "missing_code_or_project");
    return NextResponse.redirect(redirectBase);
  }

  try {
    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      redirectBase.searchParams.set("error", "project_not_found");
      return NextResponse.redirect(redirectBase);
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      // Google only issues a refresh token on the FIRST consent, or when
      // prompt=consent forces re-consent. Our authorize URL always sends
      // prompt=consent, so this should not normally happen — but if the
      // builder somehow already had an active Setu OAuth grant this exact
      // scope set, Google can skip issuing a new one.
      redirectBase.searchParams.set("error", "no_refresh_token");
      return NextResponse.redirect(redirectBase);
    }

    await db.googleCalendarConnection.upsert({
      where: { projectId },
      create: {
        projectId,
        calendarId: "primary",
        accessTokenRef: tokens.access_token ?? "",
        refreshTokenRef: tokens.refresh_token,
        active: true,
      },
      update: {
        calendarId: "primary",
        accessTokenRef: tokens.access_token ?? "",
        refreshTokenRef: tokens.refresh_token,
        active: true,
      },
    });

    console.log("Google Calendar connected:", { projectId });

    redirectBase.searchParams.set("connected", "true");
    return NextResponse.redirect(redirectBase);
  } catch (err) {
    console.error("Google Calendar OAuth callback failed:", err);

    redirectBase.searchParams.set("error", "connection_failed");
    return NextResponse.redirect(redirectBase);
  }
}
