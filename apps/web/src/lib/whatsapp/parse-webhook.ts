export type ParsedWhatsAppMessage = {
  phoneNumberId: string;
  whatsappNumber: string;
  customerName?: string;
  waMessageId: string;
  message: string;
};

type WhatsAppWebhookBody = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: {
          phone_number_id?: string;
        };
        contacts?: Array<{
          profile?: {
            name?: string;
          };
          wa_id?: string;
        }>;
        messages?: Array<{
          from?: string;
          id?: string;
          type?: string;
          text?: {
            body?: string;
          };
        }>;
      };
    }>;
  }>;
};

export function parseWhatsAppWebhook(
  body: WhatsAppWebhookBody,
): ParsedWhatsAppMessage | null {
  if (body.object !== "whatsapp_business_account") {
    return null;
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") {
        continue;
      }

      const value = change.value;

      const phoneNumberId =
        value?.metadata?.phone_number_id;

      const contact = value?.contacts?.[0];
      const whatsappNumber =
        contact?.wa_id ?? value?.messages?.[0]?.from;

      const message = value?.messages?.[0];

      if (
        !phoneNumberId ||
        !whatsappNumber ||
        !message?.id ||
        message.type !== "text" ||
        !message.text?.body
      ) {
        continue;
      }

      return {
        phoneNumberId,
        whatsappNumber,
        customerName: contact?.profile?.name,
        waMessageId: message.id,
        message: message.text.body,
      };
    }
  }

  return null;
}
