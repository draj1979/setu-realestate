import { knowledgeBucket } from "@/lib/storage";

// Streams a GCS object back as an HTTP response. Used for logos and project
// media — content that needs to render in a plain <img>/<video> src, which
// can't carry an Authorization header, so these are served unauthenticated
// by design (low-sensitivity marketing assets, not customer data).
export async function serveStoredFile(
  storagePath: string,
  mimeType: string,
) {
  const [buffer] = await knowledgeBucket.file(storagePath).download();

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
