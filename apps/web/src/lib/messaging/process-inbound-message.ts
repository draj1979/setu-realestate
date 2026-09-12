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

  const inboundMessage = await saveMessage({
    conversationId: conversation.id,
    direction: "INBOUND",
    text: input.message,
    waMessageId: input.waMessageId,
    metadata: {
      source: "setu-inbound-pipeline",
    },
  });

  const agentResult = await runSetuAgent({
    projectId: input.projectId,
    leadId: lead.id,
    agentId: "setu-sales",
    message: input.message,
    idempotencyKey:
      input.waMessageId ??
      `setu-inbound-${inboundMessage.id}`,
  });

  const outboundMessage = await saveMessage({
    conversationId: conversation.id,
    direction: "OUTBOUND",
    text: agentResult.text,
    metadata: {
      source: "openclaw",
      runId: agentResult.runId,
    },
  });

  return {
    leadId: lead.id,
    conversationId: conversation.id,
    inboundMessageId: inboundMessage.id,
    outboundMessageId: outboundMessage.id,
    response: agentResult.text,
  };
}
