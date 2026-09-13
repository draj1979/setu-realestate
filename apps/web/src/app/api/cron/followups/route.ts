import { NextRequest, NextResponse } from "next/server";

import { db } from "@setu/db";
import { sendWhatsAppText } from "@/lib/whatsapp/send-text";
import { getOrCreateConversation, saveMessage } from "@/lib/conversations/service";

// Cloud Scheduler hits this on a fixed interval (e.g. every 15 minutes) to
// dispatch any follow-ups whose scheduledAt has arrived. This route is on
// the same public setu-web service as the rest of the app (no per-route
// Cloud Run IAM to lean on), so it's gated by its own shared secret instead
// — the same pattern as SETU_MCP_TOKEN. Trimmed on both sides to avoid the
// trailing-newline-in-Secret-Manager bug hit repeatedly elsewhere in this
// project.
const MAX_ATTEMPTS = 3;

function isAuthorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();

  if (!expected) {
    return false;
  }

  const provided =
    request.headers.get("x-cron-secret")?.trim() ??
    request.nextUrl.searchParams.get("secret")?.trim();

  return provided === expected;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "WHATSAPP_ACCESS_TOKEN is not configured" },
      { status: 500 },
    );
  }

  const dueJobs = await db.followupJob.findMany({
    where: {
      status: "PENDING",
      scheduledAt: { lte: new Date() },
    },
    include: {
      lead: { select: { id: true, whatsappNumber: true, optedOut: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 50,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of dueJobs) {
    try {
      if (job.lead.optedOut) {
        await db.followupJob.update({
          where: { id: job.id },
          data: { status: "CANCELLED" },
        });
        skipped += 1;
        continue;
      }

      const channel = await db.whatsAppChannel.findUnique({
        where: { projectId: job.projectId },
      });

      if (!channel?.active) {
        throw new Error("Project has no active WhatsApp channel");
      }

      const message = job.message ?? "Just checking in — are you still interested? Happy to help with any questions.";

      await sendWhatsAppText({
        phoneNumberId: channel.phoneNumberId,
        accessToken,
        to: job.lead.whatsappNumber,
        text: message,
      });

      const conversation = await getOrCreateConversation(
        job.projectId,
        job.leadId,
      );

      await saveMessage({
        conversationId: conversation.id,
        direction: "OUTBOUND",
        text: message,
        metadata: { source: "followup-dispatcher", followupJobId: job.id },
      });

      await db.followupJob.update({
        where: { id: job.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          attempts: job.attempts + 1,
        },
      });

      sent += 1;
    } catch (error) {
      console.error("Follow-up dispatch failed:", { jobId: job.id, error });

      const attempts = job.attempts + 1;

      await db.followupJob.update({
        where: { id: job.id },
        data: {
          attempts,
          status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
        },
      });

      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    processed: dueJobs.length,
    sent,
    failed,
    skipped,
  });
}
