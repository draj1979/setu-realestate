import {
  getOrCreateConversation,
  saveMessage,
} from "./service";

const projectId = "cmtmwna4c0001dju0n3y1vz3b";
const leadId = "cmtptsr3q0000pbwpid50uanq";

async function main() {
  const conversation = await getOrCreateConversation(
    projectId,
    leadId,
  );

  console.log("Conversation ID:", conversation.id);

  const inbound = await saveMessage({
    conversationId: conversation.id,
    direction: "INBOUND",
    text: "Hi, I am looking for a 3 BHK apartment.",
    metadata: {
      source: "test",
    },
  });

  console.log("Inbound message:", inbound.id);

  const outbound = await saveMessage({
    conversationId: conversation.id,
    direction: "OUTBOUND",
    text: "Sure. What budget range are you considering?",
    metadata: {
      source: "test",
    },
  });

  console.log("Outbound message:", outbound.id);

  console.log("Persistence test: PASS");
}

main().catch((error) => {
  console.error("Conversation persistence test failed:", error);
  process.exit(1);
});
