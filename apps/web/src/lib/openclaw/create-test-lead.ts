import { db } from "@setu/db";

const projectId = "cmtmwna4c0001dju0n3y1vz3b";

async function main() {
  const lead = await db.lead.upsert({
    where: {
      projectId_whatsappNumber: {
        projectId,
        whatsappNumber: "919999999999",
      },
    },
    update: {},
    create: {
      projectId,
      whatsappNumber: "919999999999",
      name: "Setu Test Lead",
    },
  });

  console.log("Lead ID:", lead.id);
  console.log("Project ID:", lead.projectId);
  console.log("WhatsApp:", lead.whatsappNumber);
  console.log("Name:", lead.name);
}

main().catch((error) => {
  console.error("Create test lead failed:", error);
  process.exit(1);
});
