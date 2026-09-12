import { db } from "@setu/db";
import { execFileSync } from "node:child_process";

const chunkId = "cmtn2n5yo00009vu08dw4cub6";

const rows = await db.$queryRaw<
  { id: string; content: string }[]
>`SELECT id, content FROM "DocumentChunk" WHERE id = ${chunkId}`;

if (rows.length === 0) {
  throw new Error("Chunk not found");
}

const content = rows[0].content;

const token = execFileSync(
  "gcloud",
  ["auth", "print-access-token"],
  { encoding: "utf8" },
).trim();

const response = await fetch(
  "https://asia-south1-aiplatform.googleapis.com/v1/projects/setu-realestate/locations/asia-south1/publishers/google/models/gemini-embedding-001:predict",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [
        {
          content,
          task_type: "RETRIEVAL_DOCUMENT",
        },
      ],
      parameters: {
        outputDimensionality: 768,
      },
    }),
  },
);

if (!response.ok) {
  throw new Error(
    `Embedding API failed: ${response.status} ${await response.text()}`,
  );
}

const data = await response.json();
const embedding = data.predictions[0].embeddings.values;

if (!Array.isArray(embedding) || embedding.length !== 768) {
  throw new Error("Expected a 768-dimensional embedding");
}

const vector = `[${embedding.join(",")}]`;

await db.$executeRaw`
  UPDATE "DocumentChunk"
  SET embedding = ${vector}::vector
  WHERE id = ${chunkId}
`;

console.log("Chunk:", chunkId);
console.log("Embedding dimensions:", embedding.length);
console.log("Embedding stored successfully");
