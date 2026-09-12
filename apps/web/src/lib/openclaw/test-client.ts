import { openclawClient } from "./client";

async function main() {
  console.log("Starting OpenClaw Gateway client...");

  openclawClient.start();

  await new Promise((resolve) => setTimeout(resolve, 5_000));

  try {
    const run = await openclawClient.request<{
      runId: string;
      acceptedAt?: number;
    }>("agent", {
      agentId: "setu-sales",
      message: "Reply with exactly: SETU AGENT RPC OK",
      sessionKey: "setu-test-session",
      idempotencyKey: `setu-test-${Date.now()}`,
      timeout: 60_000,
    });

    console.log("Agent run:", JSON.stringify(run, null, 2));

    const result = await openclawClient.request(
      "agent.wait",
      {
        runId: run.runId,
        timeoutMs: 60_000,
      },
    );

    console.log("Agent result:", JSON.stringify(result, null, 2));
  } finally {
    await openclawClient.stopAndWait();
  }
}

main().catch((error) => {
  console.error("OpenClaw agent test failed:", error);
  process.exit(1);
});
