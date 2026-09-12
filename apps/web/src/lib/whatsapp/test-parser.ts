import { parseWhatsAppWebhook } from "./parse-webhook";

const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "TEST_WABA_ID",
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
                id: "wamid.test-setu-001",
                timestamp: "1788740000",
                type: "text",
                text: {
                  body: "Hi, I am looking for a 3 BHK apartment.",
                },
              },
            ],
          },
        },
      ],
    },
  ],
};

const result = parseWhatsAppWebhook(payload);

console.log("\n=== PARSED MESSAGE ===");
console.log(JSON.stringify(result, null, 2));

if (!result) {
  throw new Error("Parser returned null");
}

if (result.phoneNumberId !== "1313017431887184") {
  throw new Error("Incorrect phone number ID");
}

if (result.whatsappNumber !== "919620594287") {
  throw new Error("Incorrect WhatsApp number");
}

if (result.customerName !== "Setu Test Lead") {
  throw new Error("Incorrect customer name");
}

if (result.waMessageId !== "wamid.test-setu-001") {
  throw new Error("Incorrect WhatsApp message ID");
}

if (result.message !== "Hi, I am looking for a 3 BHK apartment.") {
  throw new Error("Incorrect message text");
}

console.log("\n=== TEST RESULT ===");
console.log("WhatsApp parser test: PASS");
