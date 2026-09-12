import { sendWhatsAppText } from "./send-text";

async function main() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const to = process.env.WHATSAPP_TEST_TO;

  if (!phoneNumberId || !accessToken || !to) {
    throw new Error(
      "Set WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN and WHATSAPP_TEST_TO",
    );
  }

  const result = await sendWhatsAppText({
    phoneNumberId,
    accessToken,
    to,
    text: "Setu WhatsApp integration test.",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("WhatsApp send test failed:", error);
  process.exit(1);
});
