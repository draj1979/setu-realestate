-- Allow a single WhatsApp phone number to be linked to multiple projects
-- (e.g. one business owner managing several project listings on the same
-- number). Inbound messages are now fanned out to every project sharing a
-- phoneNumberId, so it can no longer be a unique key.

DROP INDEX "WhatsAppChannel_phoneNumberId_key";

CREATE INDEX "WhatsAppChannel_phoneNumberId_idx" ON "WhatsAppChannel"("phoneNumberId");
