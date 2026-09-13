// Drop-in addition for wa.staffstream.in's existing Express webhook route.
// Add this near the top of the existing POST /webhook handler, BEFORE (or
// alongside) whatever routing/processing already happens for other agents.
// It does not change behavior for any WABA other than Setu's.

const SETU_WABA_ID = "2581867842261753";
const SETU_WEBHOOK_URL = "https://app.gosetu.co/api/webhooks/whatsapp";

// Fire-and-forget: don't let a slow/failed Setu delivery delay or break
// the ack this server already sends back to Meta, or affect any other
// agent's processing in the same request.
function forwardToSetuIfMatch(body) {
  const wabaId = body?.entry?.[0]?.id;

  if (wabaId !== SETU_WABA_ID) return;

  fetch(SETU_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((error) => {
    console.error("Failed to forward WhatsApp webhook to Setu:", error);
  });
  // Note: uses the global `fetch` available in Node 18+. If this server
  // runs an older Node version, swap in axios/node-fetch instead.
}

// Inside the existing app.post("/webhook", (req, res) => { ... }) handler,
// call this once with the parsed JSON body (req.body if using
// express.json()), then continue with existing logic unchanged:
//
//   app.post("/webhook", (req, res) => {
//     forwardToSetuIfMatch(req.body);
//
//     // ...existing routing/processing for other agents, unchanged...
//
//     res.sendStatus(200);
//   });

module.exports = { forwardToSetuIfMatch, SETU_WABA_ID, SETU_WEBHOOK_URL };
