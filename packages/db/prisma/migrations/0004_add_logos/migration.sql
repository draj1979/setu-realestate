-- Add optional company/project logo storage references. Logos are stored
-- in the existing GCS knowledge bucket and streamed back through a
-- dedicated API route rather than made bucket-public, so only the storage
-- path + mime type need to live in Postgres.

ALTER TABLE "Organization" ADD COLUMN "logoStoragePath" TEXT;
ALTER TABLE "Organization" ADD COLUMN "logoMimeType" TEXT;

ALTER TABLE "Project" ADD COLUMN "logoStoragePath" TEXT;
ALTER TABLE "Project" ADD COLUMN "logoMimeType" TEXT;
