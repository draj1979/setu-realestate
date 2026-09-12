import { Storage } from "@google-cloud/storage";

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "setu-realestate",
});

const bucketName =
  process.env.SETU_KNOWLEDGE_BUCKET ??
  "setu-realestate-knowledge";

export const knowledgeBucket = storage.bucket(bucketName);
export { bucketName };
