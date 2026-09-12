-- A single inbound WhatsApp message can now be recorded once per project
-- when a phone number is shared across multiple projects (see
-- 0002_relax_phone_number_unique). Scope waMessageId uniqueness to the
-- conversation instead of globally, so it still dedupes retried webhook
-- deliveries within one project's conversation without blocking the same
-- WhatsApp message from being recorded in a different project's
-- conversation.

DROP INDEX "Message_waMessageId_key";

CREATE UNIQUE INDEX "Message_conversationId_waMessageId_key" ON "Message"("conversationId", "waMessageId");
