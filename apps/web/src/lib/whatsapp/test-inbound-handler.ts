import { handleWhatsAppInbound } from "./handle-inbound";

const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "1084690724077817",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "919999999999",
              phone_number_id: "1313017431887184",
            },
            contacts: [
              {
                profile: {
                  name: "Setu Test Lead",
                },
                wa_id: "919620594287",
              },
            ],
            messages: [
              {
                from: "919620594287",
                id: `wamid.setu-handler-${Date.now()}`,
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: "text",
                text: {
                  body: "I want to know more about the 3 BHK options.",
                },
              },
            ],
          },
        },
      ],
    },
  ],
};

async function main() {
  const result = await handleWhatsAppInbound(payload);

  console.log("\n=== WHATSAPP INBOUND HANDLER RESULT ===");
  console.log(JSON.stringify(result, null, 2));

  if (!result.handled) {
    throw new Error("WhatsApp message was not handled");
  }

  console.log("\n=== TEST RESULT ===");
  console.log("WhatsApp inbound handler: PASS");
}

main().catch((error) => {
  console.error("WhatsApp inbound handler test failed:", error);
  process.exit(1);
});
