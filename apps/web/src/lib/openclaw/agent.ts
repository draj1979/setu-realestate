import { openclawClient } from "./client";
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

type AgentRunResponse = {
  runId: string;
  sessionKey?: string;
  status: string;
};

type AgentWaitResponse = {
  runId: string;
  status: string;
  terminalReply?: {
    disposition?: string;
    text?: string;
  };
  stopReason?: string;
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
    buildKnowledgeContext(knowledge),
  ].join("\n");

  openclawClient.start();

  await new Promise((resolve) => setTimeout(resolve, 1_000));

  const run = await openclawClient.request<AgentRunResponse>("agent", {
    agentId: input.agentId,
    message: input.message,
    sessionKey,
    idempotencyKey: input.idempotencyKey,
    timeout: timeoutMs,
    extraSystemPrompt: runtimeContext,
  });

  if (!run.runId) {
    throw new Error("OpenClaw did not return a runId");
  }

  const result = await openclawClient.request<AgentWaitResponse>(
    "agent.wait",
    {
      runId: run.runId,
      timeoutMs,
    },
  );

  if (result.status !== "ok") {
    throw new Error(
      `OpenClaw agent run failed: ${result.status}${
        result.stopReason ? ` (${result.stopReason})` : ""
      }`,
    );
  }

  const text = result.terminalReply?.text?.trim();

  if (!text) {
    throw new Error("OpenClaw agent returned no text response");
  }

  return {
    runId: run.runId,
    sessionKey: run.sessionKey ?? sessionKey,
    text,
  };
}
