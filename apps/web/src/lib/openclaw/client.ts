import { GatewayClient } from "@openclaw/gateway-client";

const gatewayUrl =
  process.env.OPENCLAW_GATEWAY_URL ?? "wss://setu-openclaw-6avtjfpucq-el.a.run.app";

const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

if (!gatewayToken) {
  throw new Error("OPENCLAW_GATEWAY_TOKEN is not configured");
}

export const openclawClient = new GatewayClient({
  url: gatewayUrl,
  token: gatewayToken,
  clientName: "gateway-client",
  clientDisplayName: "Setu",
  clientVersion: "0.1.0",
});
