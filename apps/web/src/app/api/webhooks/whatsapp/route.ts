import { NextRequest } from "next/server";

import { handleWhatsAppInbound } from "@/lib/whatsapp/handle-inbound";

// Secret Manager values injected as Cloud Run env vars aren't trimmed of
// trailing whitespace the way shell command substitution often is — this
// has bitten every other secret we've wired up so far (see
// META_APP_SECRET, SETU_MCP_TOKEN), so trim proactively.
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

// The Meta app's webhook Subscriptions entry is shared across multiple
// agents/WABAs, not just Setu's — it used to point at staffstream's own
// server, which handled all of them. Now that it points here, anything
// that isn't Setu's own WABA must be relayed on to staffstream so those
// other agents keep working. Never drop or silently swallow that traffic.
const SETU_WABA_ID = "2581867842261753";
const STAFFSTREAM_WEBHOOK_URL = "https://wa.staffstream.in/webhook";

type WebhookEntry = { id?: string };

function getEntries(body: unknown): WebhookEntry[] {
  if (
    typeof body === "object" &&
    body !== null &&
    "entry" in body &&
    Array.isArray((body as { entry: unknown }).entry)
  ) {
    return (body as { entry: WebhookEntry[] }).entry;
  }

  return [];
}

function forwardToStaffstream(body: unknown) {
  fetch(STAFFSTREAM_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((error) => {
    console.error("Failed to forward WhatsApp webhook to staffstream:", error);
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    VERIFY_TOKEN &&
    token === VERIFY_TOKEN &&
    challenge
  ) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return new Response("Forbidden", {
    status: 403,
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    console.error("WhatsApp webhook error: invalid JSON body", error);

    return Response.json({ ok: false }, { status: 400 });
  }

  console.log("WhatsApp webhook received:", JSON.stringify(body, null, 2));

  const entries = getEntries(body);
  const setuEntries = entries.filter((entry) => entry?.id === SETU_WABA_ID);
  const otherEntries = entries.filter((entry) => entry?.id !== SETU_WABA_ID);

  if (entries.length === 0) {
    // Unrecognized shape — preserve prior behavior (everything went to
    // staffstream) rather than risk silently dropping some other agent's
    // traffic we don't know how to parse.
    console.warn(
      "WhatsApp webhook: no recognizable entries, forwarding as-is to staffstream",
    );
    forwardToStaffstream(body);
  } else {
    if (otherEntries.length > 0) {
      forwardToStaffstream({ ...(body as object), entry: otherEntries });
    }

    if (setuEntries.length > 0) {
      try {
        const result = await handleWhatsAppInbound({
          ...(body as object),
          entry: setuEntries,
        });
        console.log("WhatsApp webhook processed:", result);
      } catch (error) {
        // Always ack 200 so Meta doesn't retry-storm a message we already
        // recorded but failed to reply to (e.g. a transient Meta Send API
        // error) — the failure is still fully visible in these logs.
        console.error("WhatsApp webhook processing failed:", error);
      }
    }
  }

  return Response.json({ ok: true });
}
