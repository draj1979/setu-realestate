import { db } from "@setu/db";

export async function buildProjectContext(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      agentConfiguration: true,
    },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const agent = project.agentConfiguration;

  return [
    "## CURRENT SETU PROJECT CONTEXT",
    "",
    `Project name: ${project.name}`,
    `Project description: ${project.description ?? "Not provided"}`,
    `Project status: ${project.status}`,
    "",
    "## SALES AGENT CONFIGURATION",
    "",
    `Agent name: ${agent?.name ?? "Setu Sales Agent"}`,
    `Role: ${agent?.role ?? "Real-estate sales assistant"}`,
    `Communication style: ${agent?.vibe ?? "Natural, warm, concise and helpful"}`,
    `Primary goal: ${agent?.goal ?? "Understand the customer's requirement and help them take the next appropriate step"}`,
    "",
    "## BUSINESS RULES",
    "",
    agent?.businessRules ?? "No additional business rules have been configured.",
    "",
    "Use the project information above together with the project knowledge retrieved by Setu.",
    "The project context is authoritative. Do not invent information that is not present.",
  ].join("\n");
}
