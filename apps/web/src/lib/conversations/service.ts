import { db } from "@setu/db";
import type { Prisma } from "@setu/db";

export async function getOrCreateConversation(
  projectId: string,
  leadId: string,
) {
  const existing = await db.conversation.findUnique({
    where: { leadId },
  });

  if (existing) {
    return existing;
  }

  return db.conversation.create({
    data: {
      projectId,
      leadId,
    },
  });
}

export type SaveMessageInput = {
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  text?: string;
  waMessageId?: string;
  type?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO";
  mediaUrl?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function saveMessage(input: SaveMessageInput) {
  const message = await db.message.create({
    data: {
      conversationId: input.conversationId,
      direction: input.direction,
      type: input.type ?? "TEXT",
      text: input.text,
      waMessageId: input.waMessageId,
      mediaUrl: input.mediaUrl,
      metadata: input.metadata,
    },
  });

  await db.conversation.update({
    where: { id: input.conversationId },
    data: {
      lastMessageAt: message.createdAt,
    },
  });

  return message;
}
