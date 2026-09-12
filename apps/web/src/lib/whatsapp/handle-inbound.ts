import { db } from "@setu/db";
import { processInboundMessage } from "../messaging/process-inbound-message";
import { sendWhatsAppText } from "./send-text";
import { parseWhatsAppWebhook } from "./parse-webhook";

export async function handleWhatsAppInbound(
  body: unknown,
) {
  const parsed = parseWhatsAppWebhook(body as Parameters<
    typeof parseWhatsAppWebhook
  >[0]);

  if (!parsed) {
    return {
      handled: false,
      reason: "unsupported_or_invalid_message",
    };
  }

  // A single WhatsApp number can be linked to more than one project (e.g.
  // one business owner managing several project listings on the same
  // number). Record the inbound message against every linked project, but
  // only send one actual WhatsApp reply back — the customer should never
  // see multiple bot replies to a single message. The oldest-linked
  // (first-connected) channel is treated as primary for that reply.
  const channels = await db.whatsAppChannel.findMany({
    where: {
      phoneNumberId: parsed.phoneNumberId,
      active: true,
    },
    include: {
      project: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (channels.length === 0) {
    throw new Error(
      `WhatsApp channel not configured: ${parsed.phoneNumberId}`,
    );
  }

  const results = await Promise.all(
    channels.map((channel) =>
      processInboundMessage({
        projectId: channel.projectId,
        whatsappNumber: parsed.whatsappNumber,
        message: parsed.message,
        waMessageId: parsed.waMessageId,
      }),
    ),
  );

  const [primaryChannel] = channels;
  const [primaryResult] = results;

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error(
      "WHATSAPP_ACCESS_TOKEN is not configured",
    );
  }

  const sent = await sendWhatsAppText({
    phoneNumberId: parsed.phoneNumberId,
    accessToken,
    to: parsed.whatsappNumber,
    text: primaryResult.response,
  });

  return {
    handled: true,
    projectId: primaryChannel.projectId,
    projectIds: channels.map((channel) => channel.projectId),
    leadId: primaryResult.leadId,
    conversationId: primaryResult.conversationId,
    inboundMessageId: primaryResult.inboundMessageId,
    outboundMessageId: primaryResult.outboundMessageId,
    whatsappMessageId: sent.messageId,
    response: primaryResult.response,
  };
}
