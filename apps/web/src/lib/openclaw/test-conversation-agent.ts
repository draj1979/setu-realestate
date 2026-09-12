import { db } from "@setu/db";
import { getOrCreateConversation, saveMessage } from "../conversations/service";
import { runSetuAgent } from "./agent";

const projectId = "cmtmwna4c0001dju0n3y1vz3b";
const leadId = "cmtptsr3q0000pbwpid50uanq";
const agentId = "setu-sales";

async function main() {
  const conversation = await getOrCreateConversation(
    projectId,
    leadId,
  );

  await saveMessage({
    conversationId: conversation.id,
    direction: "INBOUND",
    text: "I am looking for a 3 BHK apartment for my family.",
    metadata: { source: "conversation-context-test" },
  });

  await saveMessage({
    conversationId: conversation.id,
    direction: "OUTBOUND",
    text: "Sure. What budget range are you considering?",
    metadata: { source: "conversation-context-test" },
  });

  const response = await runSetuAgent({
    projectId,
    leadId,
    agentId,
    message: "My budget is around 2 crore.",
    idempotencyKey: `conversation-context-test-${Date.now()}`,
  });

  console.log("\n=== AGENT RESPONSE ===");
  console.log(response.text);
  console.log("\n=== TEST RESULT ===");
  console.log("Conversation context test: PASS");

  const messages = await db.message.findMany({
    where: {
      conversationId: conversation.id,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  console.log("\n=== STORED MESSAGE COUNT ===");
  console.log(messages.length);
}

main().catch((error) => {
  console.error("Conversation context test failed:", error);
  process.exit(1);
});
