import { buildProjectContext } from "./project-context";

const projectId = "cmtmwna4c0001dju0n3y1vz3b";

async function main() {
  const context = await buildProjectContext(projectId);

  console.log("----- PROJECT CONTEXT -----");
  console.log(context);
}

main().catch((error) => {
  console.error("Project context test failed:", error);
  process.exit(1);
});
