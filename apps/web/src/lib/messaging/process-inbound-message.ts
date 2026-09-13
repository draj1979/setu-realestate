import { db } from "@setu/db";
import {
  getOrCreateConversation,
  saveMessage,
} from "../conversations/service";
import { runSetuAgent } from "../openclaw/agent";

export type ProcessInboundMessageInput = {
  projectId: string;
  whatsappNumber: string;
  message: string;
  waMessageId?: string;
};

export type ProcessInboundMessageResult = {
  leadId: string;
  conversationId: string;
  inboundMessageId: string;
  outboundMessageId: string;
  response: string;
};

const AGENT_FAILURE_FALLBACK =
  "Sorry, I ran into a technical hiccup and couldn't respond right away. " +
  "I'm back now — could you resend your last message, or I'll follow up shortly.";

export async function processInboundMessage(
  input: ProcessInboundMessageInput,
): Promise<ProcessInboundMessageResult> {
  const lead = await db.lead.upsert({
    where: {
      projectId_whatsappNumber: {
        projectId: input.projectId,
        whatsappNumber: input.whatsappNumber,
      },
    },
    create: {
      projectId: input.projectId,
      whatsappNumber: input.whatsappNumber,
    },
    update: {},
  });

  const conversation = await getOrCreateConversation(
    input.projectId,
    lead.id,
  );

  // Meta retries webhook delivery whenever it doesn't get a fast-enough ack
  // (e.g. because OpenClaw was mid-crash and the whole request stalled for
  // 20+ seconds, as happened here). Without this check, the retry hits the
  // unique (conversationId, waMessageId) constraint on Message and crashes
  // with an uncaught Prisma error, again leaving the customer with no
  // reply. Look the message up first so a retry can complete the original
  // request rather than fail a second time.
  const existingInbound = input.waMessageId
    ? await db.message.findUnique({
        where: {
          conversationId_waMessageId: {
            conversationId: conversation.id,
            waMessageId: input.waMessageId,
          },
        },
      })
    : null;

  const inboundMessage =
    existingInbound ??
    (await saveMessage({
      conversationId: conversation.id,
      direction: "INBOUND",
      text: input.message,
      waMessageId: input.waMessageId,
      metadata: {
        source: "setu-inbound-pipeline",
      },
    }));

  if (existingInbound) {
    // This exact inbound message was already recorded. If it was already
    // replied to, this is a pure duplicate delivery — do not run the agent
    // or send a second reply. If no reply exists yet, the first attempt
    // must have crashed before completing, so fall through and retry.
    const existingReply = await db.message.findFirst({
      where: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        metadata: {
          path: ["inReplyToMessageId"],
          equals: inboundMessage.id,
        },
      },
    });

    if (existingReply) {
      return {
        leadId: lead.id,
        conversationId: conversation.id,
        inboundMessageId: inboundMessage.id,
        outboundMessageId: existingReply.id,
        response: existingReply.text ?? "",
      };
    }
  }

  let responseText: string;
  let runId: string | undefined;

  try {
    const agentResult = await runSetuAgent({
      projectId: input.projectId,
      leadId: lead.id,
      agentId: "setu-sales",
      message: input.message,
      idempotencyKey:
        input.waMessageId ?? `setu-inbound-${inboundMessage.id}`,
    });

    responseText = agentResult.text;
    runId = agentResult.runId;
  } catch (error) {
    // Never let an OpenClaw-side failure (crash, timeout, malformed
    // response) leave the customer with total silence — send a plain
    // apology instead, and log loudly so it's visible in monitoring.
    console.error("Setu agent run failed, sending fallback reply:", error);
    responseText = AGENT_FAILURE_FALLBACK;
  }

  const outboundMessage = await saveMessage({
    conversationId: conversation.id,
    direction: "OUTBOUND",
    text: responseText,
    metadata: {
      source: runId ? "openclaw" : "fallback",
      ...(runId && { runId }),
      inReplyToMessageId: inboundMessage.id,
    },
  });

  return {
    leadId: lead.id,
    conversationId: conversation.id,
    inboundMessageId: inboundMessage.id,
    outboundMessageId: outboundMessage.id,
    response: responseText,
  };
}
