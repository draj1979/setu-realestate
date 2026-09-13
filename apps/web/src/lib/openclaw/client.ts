import { GatewayClient } from "@openclaw/gateway-client";

const gatewayUrl =
  process.env.OPENCLAW_GATEWAY_URL ?? "wss://setu-openclaw-6avtjfpucq-el.a.run.app";

// setu-openclaw's Cloud Run service requires IAM invoker auth (only
// setu-web's service account is granted roles/run.invoker) — the
// websocket upgrade is rejected with HTTP 403 by Cloud Run's own front
// end before it ever reaches the OpenClaw gateway app unless the request
// carries a Google-signed identity token for this audience.
async function fetchGatewayIdToken(): Promise<string> {
  const audience = gatewayUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth();
  const idTokenClient = await auth.getIdTokenClient(audience);
  const idToken = await idTokenClient.idTokenProvider.fetchIdToken(audience);

  if (!idToken) {
    throw new Error("Unable to obtain Google Cloud identity token for OpenClaw gateway");
  }

  return idToken;
}

// Constructed lazily, on first actual use, rather than at module import
// time. Next.js evaluates route modules during build (page-data
// collection) and this module is transitively imported by several
// routes — an eager throw here for a missing env var would fail the
// entire production build, not just the request that needed OpenClaw.
let client: GatewayClient | undefined;
let clientPromise: Promise<GatewayClient> | undefined;

// Resolves once the gateway handshake actually completes (onHelloOk), or
// rejects on a connect error. A fixed sleep after start() raced the real
// handshake — a Cloud Run cold start of the gateway service can easily
// take longer than a guessed delay, causing "gateway not connected".
let readyPromise: Promise<void> | undefined;

async function getClient(): Promise<GatewayClient> {
  if (client) return client;
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

    if (!gatewayToken) {
      throw new Error("OPENCLAW_GATEWAY_TOKEN is not configured");
    }

    // NOTE: this ID token is fetched once per client instance, not
    // refreshed on later reconnects. It's valid for ~1 hour, which is
    // fine for a Cloud Run instance handling a burst of requests, but a
    // long-lived warm instance reconnecting after expiry would need this
    // revisited (e.g. re-minting the client on auth failure).
    const idToken = await fetchGatewayIdToken();

    let resolveReady: () => void;
    let rejectReady: (err: Error) => void;
    readyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });

    const newClient = new GatewayClient({
      url: gatewayUrl,
      token: gatewayToken,
      edgeAuthHeaders: { Authorization: `Bearer ${idToken}` },
      clientName: "gateway-client",
      clientDisplayName: "Setu",
      clientVersion: "0.1.0",
      onHelloOk: () => resolveReady(),
      onConnectError: (err) => rejectReady(err),
    });

    client = newClient;

    return newClient;
  })();

  return clientPromise;
}

// setu-openclaw's Cloud Run service scales to zero when idle — a cold
// start (config load, auth resolution, HTTP server, channels/sidecars,
// agent model load) has been observed taking ~33s end to end. 15s was
// timing out mid-startup, before the gateway was even listening.
async function ensureConnected(timeoutMs = 60_000): Promise<void> {
  const gatewayClient = await getClient();
  gatewayClient.start();

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("Timed out connecting to OpenClaw gateway")),
      timeoutMs,
    );
  });

  await Promise.race([readyPromise, timeout]);
}

export const openclawClient = {
  ensureConnected,
  request: async <T>(...args: Parameters<GatewayClient["request"]>) =>
    (await getClient()).request<T>(...args),
  stopAndWait: async (...args: Parameters<GatewayClient["stopAndWait"]>) =>
    (await getClient()).stopAndWait(...args),
};
