import { db } from "@setu/db";

import { generateEmbedding } from "./embeddings";

export type RetrievedChunk = {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  metadata: unknown;
  similarity: number;
};

export async function retrieveKnowledge(
  projectId: string,
  query: string,
  limit = 5,
): Promise<RetrievedChunk[]> {
  const embedding = await generateEmbedding(
    query,
    "RETRIEVAL_QUERY",
  );

  const embeddingLiteral = `[${embedding.join(",")}]`;

  const results = await db.$queryRaw<RetrievedChunk[]>`
    SELECT
      dc."id",
      dc."documentId",
      dc."chunkIndex",
      dc."content",
      dc."metadata",
      1 - (dc."embedding" <=> ${embeddingLiteral}::vector) AS "similarity"
    FROM "DocumentChunk" dc
    INNER JOIN "Document" d
      ON d."id" = dc."documentId"
    WHERE d."projectId" = ${projectId}
      AND dc."embedding" IS NOT NULL
    ORDER BY dc."embedding" <=> ${embeddingLiteral}::vector
    LIMIT ${limit}
  `;

  return results;
}
