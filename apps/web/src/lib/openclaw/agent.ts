import { buildProjectContext } from "./project-context";
import { retrieveKnowledge } from "../ai/retrieval";

export type RunSetuAgentInput = {
  projectId: string;
  leadId: string;
  agentId: string;
  message: string;
  idempotencyKey: string;
  timeoutMs?: number;
};

export type RunSetuAgentResult = {
  runId: string;
  sessionKey: string;
  text: string;
};

// The OpenClaw Gateway's WebSocket RPC (agent/agent.wait) is unreachable
// from setu-web right now: setu-openclaw's proxy-attribution security
// layer rejects the websocket upgrade specifically (Cloud Run's own
// internal proxying looks self-referential to OpenClaw's anti-spoofing
// guard). This is a known, tracked OpenClaw/Cloud-Run incompatibility —
// see the setu-openclaw-mcp-integration memory note.
//
// Workaround: OpenClaw's OpenAI-compatible /v1/chat/completions endpoint
// runs "the same codepath as `openclaw agent`" but as a plain HTTP POST,
// not a websocket upgrade — it doesn't hit the same attribution check.
// Revert to the WS client (see client.ts, kept intact but unused) once
// OpenClaw's gateway/Cloud-Run interaction is fixed upstream.
const gatewayHttpUrl = (
  process.env.OPENCLAW_GATEWAY_URL ??
  "wss://setu-openclaw-6avtjfpucq-el.a.run.app"
)
  .replace(/^wss:/, "https:")
  .replace(/^ws:/, "http:");

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
};

function buildKnowledgeContext(
  chunks: Awaited<ReturnType<typeof retrieveKnowledge>>,
) {
  if (chunks.length === 0) {
    return "## PROJECT KNOWLEDGE\n\nNo relevant project knowledge was found.";
  }

  return [
    "## PROJECT KNOWLEDGE",
    "",
    ...chunks.map(
      (chunk, index) =>
        `### Knowledge ${index + 1}\n${chunk.content}`,
    ),
  ].join("\n\n");
}

export async function runSetuAgent(
  input: RunSetuAgentInput,
): Promise<RunSetuAgentResult> {
  const timeoutMs = input.timeoutMs ?? 60_000;

  const sessionKey =
    `project:${input.projectId}:lead:${input.leadId}`;

  const [projectContext, knowledge] = await Promise.all([
    buildProjectContext(input.projectId),
    retrieveKnowledge(input.projectId, input.message, 5),
  ]);

  const runtimeContext = [
    projectContext,
    "",
    "## CURRENT CONVERSATION IDENTIFIERS",
    "",
    `Project ID: ${input.projectId}`,
    `Lead ID: ${input.leadId}`,
    "",
    buildKnowledgeContext(knowledge),
  ].join("\n");

  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

  if (!gatewayToken) {
    throw new Error("OPENCLAW_GATEWAY_TOKEN is not configured");
  }

  const response = await fetch(`${gatewayHttpUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gatewayToken}`,
      "Content-Type": "application/json",
      "x-openclaw-session-key": sessionKey,
      "x-openclaw-message-channel": "whatsapp",
    },
    body: JSON.stringify({
      model: `openclaw/${input.agentId}`,
      messages: [
        { role: "system", content: runtimeContext },
        { role: "user", content: input.message },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  // OpenClaw's gateway has been observed OOM-crashing mid-request (see
  // setu-openclaw-mcp-integration memory note); when that happens Cloud
  // Run's front-end returns a plain-text "Service Unavailable" body, not
  // JSON. Read as text first and parse defensively so a crash on OpenClaw's
  // side surfaces as a clean Error here instead of an uncaught
  // JSON.parse SyntaxError that used to escape all the way up and drop the
  // customer's message with no reply at all.
  const rawBody = await response.text();
  let data: ChatCompletionsResponse | { error?: { message?: string; type?: string } };

  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    throw new Error(
      `OpenClaw agent run failed: non-JSON response (HTTP ${response.status}): ${rawBody.slice(0, 200)}`,
    );
  }

  if (!response.ok) {
    const errorMessage =
      "error" in data && data.error?.message
        ? data.error.message
        : `OpenClaw HTTP ${response.status}`;

    throw new Error(`OpenClaw agent run failed: ${errorMessage}`);
  }

  const text = (data as ChatCompletionsResponse).choices?.[0]?.message
    ?.content?.trim();

  if (!text) {
    throw new Error("OpenClaw agent returned no text response");
  }

  return {
    runId: input.idempotencyKey,
    sessionKey,
    text,
  };
}
