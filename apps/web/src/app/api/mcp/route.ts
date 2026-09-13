import { NextRequest } from "next/server";

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { createSetuMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  // Secret Manager values injected as Cloud Run env vars are not trimmed of
  // trailing whitespace/newlines the way shell command substitution or a
  // pasted .env value often is — trim both sides so a stray trailing byte
  // in the stored secret doesn't cause every request to fail auth.
  const expectedToken = process.env.SETU_MCP_TOKEN?.trim();
  const authorization = request.headers.get("authorization")?.trim();

  return Boolean(
    expectedToken && authorization === `Bearer ${expectedToken}`,
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const server = createSetuMcpServer();

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);

  return transport.handleRequest(request);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response("Setu MCP server is running", { status: 200 });
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response(null, { status: 204 });
}
