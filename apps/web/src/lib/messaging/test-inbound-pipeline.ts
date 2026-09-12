import { db } from "@setu/db";
import { processInboundMessage } from "./process-inbound-message";

const projectId = "cmtmwna4c0001dju0n3y1vz3b";
const whatsappNumber = "919999999999";

async function main() {
  const result = await processInboundMessage({
    projectId,
    whatsappNumber,
    message: "I am looking for a 3 BHK. My budget is around 2 crore.",
    waMessageId: `test-wa-${Date.now()}`,
  });

  console.log("\n=== PIPELINE RESULT ===");
  console.log(JSON.stringify(result, null, 2));

  const conversation = await db.conversation.findUnique({
    where: {
      id: result.conversationId,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  console.log("\n=== CONVERSATION ===");
  console.log("Conversation ID:", conversation?.id);
  console.log("Message count:", conversation?.messages.length);

  for (const message of conversation?.messages ?? []) {
    console.log(
      `${message.direction}: ${message.text}`,
    );
  }

  console.log("\n=== TEST RESULT ===");
  console.log("Inbound pipeline test: PASS");
}

main().catch((error) => {
  console.error("Inbound pipeline test failed:", error);
  process.exit(1);
});
