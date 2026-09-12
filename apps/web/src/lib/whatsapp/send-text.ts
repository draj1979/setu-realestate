type WhatsAppSendResponse = {
  messaging_product?: string;
  contacts?: Array<{
    input?: string;
    wa_id?: string;
  }>;
  messages?: Array<{
    id?: string;
  }>;
};

export async function sendWhatsAppText(input: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}) {
  const url =
    `https://graph.facebook.com/v25.0/${input.phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "text",
      text: {
        preview_url: false,
        body: input.text,
      },
    }),
  });

  const data = (await response.json()) as
    | WhatsAppSendResponse
    | {
        error?: {
          message?: string;
          type?: string;
          code?: number;
          error_data?: unknown;
        };
      };

  if (!response.ok) {
    const errorMessage =
      "error" in data && data.error?.message
        ? data.error.message
        : `WhatsApp API request failed with HTTP ${response.status}`;

    throw new Error(errorMessage);
  }

  const messageId =
    "messages" in data
      ? data.messages?.[0]?.id
      : undefined;

  if (!messageId) {
    throw new Error("WhatsApp API returned no message ID");
  }

  return {
    messageId,
    response: data,
  };
}
