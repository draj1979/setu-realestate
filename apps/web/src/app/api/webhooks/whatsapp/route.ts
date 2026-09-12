import { NextRequest } from "next/server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

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
  try {
    const body = await request.json();

    console.log(
      "WhatsApp webhook received:",
      JSON.stringify(body, null, 2),
    );

    return Response.json({
      ok: true,
    });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);

    return Response.json(
      {
        ok: false,
      },
      {
        status: 400,
      },
    );
  }
}
