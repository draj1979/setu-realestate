import { runSetuAgent } from "./agent";

const projectId = "cmtmwna4c0001dju0n3y1vz3b";
const leadId = "cmtptsr3q0000pbwpid50uanq";

async function main() {
  const first = await runSetuAgent({
    projectId,
    leadId,
    agentId: "setu-sales",
    message: "Hi, I am looking for a 3 BHK apartment.",
    idempotencyKey: `setu-turn-1-${Date.now()}`,
  });

  console.log("\n===== TURN 1 =====");
  console.log("Session:", first.sessionKey);
  console.log("Response:", first.text);

  const second = await runSetuAgent({
    projectId,
    leadId,
    agentId: "setu-sales",
    message: "My budget is around 2 crore.",
    idempotencyKey: `setu-turn-2-${Date.now()}`,
  });

  console.log("\n===== TURN 2 =====");
  console.log("Session:", second.sessionKey);
  console.log("Response:", second.text);

  console.log("\n===== SESSION CHECK =====");
  console.log(
    "Same session:",
    first.sessionKey === second.sessionKey ? "YES" : "NO",
  );
}

main().catch((error) => {
  console.error("Agent continuity test failed:", error);
  process.exit(1);
});
