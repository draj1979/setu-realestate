const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

type EmbeddingTaskType =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY";

type EmbeddingResponse = {
  embeddings?: {
    values?: number[];
  };
};

async function getAccessToken(): Promise<string> {
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();

  if (!token) {
    throw new Error("Unable to obtain Google Cloud access token");
  }

  return token;
}

export async function generateEmbedding(
  text: string,
  taskType: EmbeddingTaskType,
): Promise<number[]> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? "setu-realestate";
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";

  if (!text.trim()) {
    throw new Error("Cannot generate an embedding for empty text");
  }

  const accessToken = await getAccessToken();

  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/` +
    `${projectId}/locations/${location}/publishers/google/models/` +
    `${EMBEDDING_MODEL}:predict`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [
        {
          task_type: taskType,
          content: text,
        },
      ],
      parameters: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Embedding API failed (${response.status}): ${details}`,
    );
  }

  const data = (await response.json()) as {
    predictions?: EmbeddingResponse[];
  };

  const values = data.predictions?.[0]?.embeddings?.values;

  if (!values || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Invalid embedding response: expected ${EMBEDDING_DIMENSIONS} dimensions`,
    );
  }

  return values;
}
