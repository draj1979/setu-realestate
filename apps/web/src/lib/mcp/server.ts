import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { buildProjectContext } from "@/lib/openclaw/project-context";
import { bookSiteVisit, cancelSiteVisit, getAvailableCalendarSlots } from "@/lib/calendar/google-calendar";
import { db } from "@setu/db";

export function createSetuMcpServer() {
  const server = new McpServer({
    name: "setu-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "get_project_context",
    {
      description:
        "Get the authoritative project and sales-agent configuration for a Setu real-estate project.",
      inputSchema: {
        projectId: z.string().min(1).describe("Setu project ID"),
      },
    },
    async ({ projectId }) => {
      const context = await buildProjectContext(projectId);

      return {
        content: [
          {
            type: "text",
            text: context,
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_lead",
    {
      description:
        "Get the current sales lead profile and qualification state for a lead belonging to the specified project.",
      inputSchema: {
        projectId: z.string().min(1).describe("Setu project ID"),
        leadId: z.string().min(1).describe("Setu lead ID"),
      },
    },
    async ({ projectId, leadId }) => {
      const lead = await db.lead.findFirst({
        where: {
          id: leadId,
          projectId,
        },
        select: {
          id: true,
          projectId: true,
          whatsappNumber: true,
          name: true,
          configuration: true,
          budget: true,
          purpose: true,
          timeline: true,
          preferredLocation: true,
          score: true,
          status: true,
          notes: true,
          optedOut: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!lead) {
        return {
          content: [
            {
              type: "text",
              text: "Lead not found for this project.",
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ...lead,
                budget: lead.budget?.toString() ?? null,
                createdAt: lead.createdAt.toISOString(),
                updatedAt: lead.updatedAt.toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );


  server.registerTool(
    "get_conversation_history",
    {
      description:
        "Get recent WhatsApp conversation history for a lead belonging to the specified project.",
      inputSchema: {
        projectId: z.string().min(1).describe("Setu project ID"),
        leadId: z.string().min(1).describe("Setu lead ID"),
        limit: z.number().int().min(1).max(50).optional().describe("Maximum messages to return"),
      },
    },
    async ({ projectId, leadId, limit = 20 }) => {
      const conversation = await db.conversation.findFirst({
        where: {
          projectId,
          leadId,
        },
        include: {
          messages: {
            orderBy: {
              createdAt: "desc",
            },
            take: limit,
            select: {
              id: true,
              direction: true,
              type: true,
              text: true,
              createdAt: true,
            },
          },
        },
      });

      if (!conversation) {
        return {
          content: [
            {
              type: "text",
              text: "No conversation history found for this lead.",
            },
          ],
        };
      }

      const messages = [...conversation.messages]
        .reverse()
        .map((message) => ({
          id: message.id,
          direction: message.direction,
          type: message.type,
          text: message.text,
          createdAt: message.createdAt.toISOString(),
        }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                conversationId: conversation.id,
                status: conversation.status,
                messages,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );


  server.registerTool(
    "update_lead",
    {
      description:
        "Update qualification information for a lead belonging to the specified project. Only update information the customer has provided or explicitly confirmed.",
      inputSchema: {
        projectId: z.string().min(1).describe("Setu project ID"),
        leadId: z.string().min(1).describe("Setu lead ID"),
        name: z.string().min(1).optional(),
        configuration: z.string().min(1).optional(),
        budget: z.number().nonnegative().optional(),
        purpose: z.enum(["END_USE", "INVESTMENT", "UNKNOWN"]).optional(),
        timeline: z.string().min(1).optional(),
        preferredLocation: z.string().min(1).optional(),
        notes: z.string().min(1).optional(),
        status: z
          .enum([
            "NEW",
            "ENGAGED",
            "QUALIFYING",
            "QUALIFIED",
            "FOLLOWUP",
            "SITE_VISIT_PROPOSED",
            "SITE_VISIT_SCHEDULED",
            "SITE_VISIT_COMPLETED",
            "HANDED_OFF",
            "LOST",
          ])
          .optional(),
      },
    },
    async ({
      projectId,
      leadId,
      name,
      configuration,
      budget,
      purpose,
      timeline,
      preferredLocation,
      notes,
      status,
    }) => {
      const existingLead = await db.lead.findFirst({
        where: {
          id: leadId,
          projectId,
        },
        select: {
          id: true,
        },
      });

      if (!existingLead) {
        return {
          content: [
            {
              type: "text",
              text: "Lead not found for this project.",
            },
          ],
          isError: true,
        };
      }

      const data = {
        ...(name !== undefined && { name }),
        ...(configuration !== undefined && { configuration }),
        ...(budget !== undefined && { budget }),
        ...(purpose !== undefined && { purpose }),
        ...(timeline !== undefined && { timeline }),
        ...(preferredLocation !== undefined && { preferredLocation }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
      };

      if (Object.keys(data).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No lead fields were provided for update.",
            },
          ],
          isError: true,
        };
      }

      const lead = await db.lead.update({
        where: {
          id: existingLead.id,
        },
        data,
        select: {
          id: true,
          projectId: true,
          name: true,
          configuration: true,
          budget: true,
          purpose: true,
          timeline: true,
          preferredLocation: true,
          score: true,
          status: true,
          notes: true,
          updatedAt: true,
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ...lead,
                budget: lead.budget?.toString() ?? null,
                updatedAt: lead.updatedAt.toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );


  server.registerTool(
    "get_site_visit_slots",
    {
      description:
        "Get available one-hour site visit slots for a project on a specific date. Use this before offering or booking a site visit.",
      inputSchema: {
        projectId: z.string().min(1).describe("Setu project ID"),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Date in YYYY-MM-DD format"),
      },
    },
    async ({ projectId, date }) => {
      const slots = await getAvailableCalendarSlots(projectId, date);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                date,
                timezone: "Asia/Kolkata",
                slots,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );


  server.registerTool(
    "book_site_visit",
    {
      description:
        "Book a site visit for a lead at an available Google Calendar time. Use get_site_visit_slots first and only book a time the customer has explicitly agreed to.",
      inputSchema: {
        projectId: z.string().min(1).describe("Setu project ID"),
        leadId: z.string().min(1).describe("Setu lead ID"),
        startAt: z.string().datetime().describe("Requested start time in ISO 8601 format"),
        endAt: z.string().datetime().describe("Requested end time in ISO 8601 format"),
        notes: z.string().optional().describe("Optional notes for the site visit"),
      },
    },
    async ({ projectId, leadId, startAt, endAt, notes }) => {
      try {
        const booking = await bookSiteVisit({
          projectId,
          leadId,
          startAt,
          endAt,
          notes,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(booking, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text:
                error instanceof Error
                  ? error.message
                  : "Could not book the site visit.",
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "schedule_followup",
    {
      description:
        "Schedule a WhatsApp follow-up message to be sent to a lead at a future time. The exact message text you provide will be sent verbatim when it comes due, so write it as a complete, ready-to-send message. Use this when a customer goes quiet, asks to be contacted later, or after a site visit to check in.",
      inputSchema: {
        projectId: z.string().min(1).describe("Setu project ID"),
        leadId: z.string().min(1).describe("Setu lead ID"),
        scheduledAt: z
          .string()
          .datetime()
          .describe("When to send the follow-up, in ISO 8601 format"),
        message: z
          .string()
          .min(1)
          .describe("The exact WhatsApp message text to send at that time"),
      },
    },
    async ({ projectId, leadId, scheduledAt, message }) => {
      const lead = await db.lead.findFirst({
        where: { id: leadId, projectId },
        select: { id: true },
      });

      if (!lead) {
        return {
          content: [
            { type: "text", text: "Lead not found for this project." },
          ],
          isError: true,
        };
      }

      const followup = await db.followupJob.create({
        data: {
          projectId,
          leadId,
          scheduledAt: new Date(scheduledAt),
          message,
        },
        select: { id: true, scheduledAt: true, status: true },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                followupId: followup.id,
                scheduledAt: followup.scheduledAt.toISOString(),
                status: followup.status,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "cancel_followup",
    {
      description:
        "Cancel a previously scheduled follow-up that is still pending, e.g. because the customer already replied or the plan changed. Has no effect on follow-ups that already sent.",
      inputSchema: {
        projectId: z.string().min(1).describe("Setu project ID"),
        leadId: z.string().min(1).describe("Setu lead ID"),
        followupId: z
          .string()
          .min(1)
          .describe("The followup ID returned by schedule_followup"),
      },
    },
    async ({ projectId, leadId, followupId }) => {
      const followup = await db.followupJob.findFirst({
        where: { id: followupId, projectId, leadId },
        select: { id: true, status: true },
      });

      if (!followup) {
        return {
          content: [{ type: "text", text: "Follow-up not found." }],
          isError: true,
        };
      }

      if (followup.status !== "PENDING") {
        return {
          content: [
            {
              type: "text",
              text: `Follow-up is already ${followup.status.toLowerCase()} and cannot be cancelled.`,
            },
          ],
          isError: true,
        };
      }

      await db.followupJob.update({
        where: { id: followup.id },
        data: { status: "CANCELLED" },
      });

      return {
        content: [
          { type: "text", text: "Follow-up cancelled." },
        ],
      };
    },
  );

  server.registerTool(
    "cancel_site_visit",
    {
      description:
        "Cancel a scheduled or proposed site visit for a lead, and remove it from the builder's Google Calendar. Use this when the customer asks to cancel or reschedule. If you don't know the siteVisitId, omit it and the most recent upcoming visit for the lead will be cancelled.",
      inputSchema: {
        projectId: z.string().min(1).describe("Setu project ID"),
        leadId: z.string().min(1).describe("Setu lead ID"),
        siteVisitId: z
          .string()
          .min(1)
          .optional()
          .describe(
            "The site visit ID to cancel. Omit to cancel the lead's most recent non-cancelled, non-completed visit.",
          ),
      },
    },
    async ({ projectId, leadId, siteVisitId }) => {
      try {
        let resolvedSiteVisitId = siteVisitId;

        if (!resolvedSiteVisitId) {
          const upcoming = await db.siteVisit.findFirst({
            where: {
              projectId,
              leadId,
              status: { notIn: ["CANCELLED", "COMPLETED"] },
            },
            orderBy: { startAt: "desc" },
            select: { id: true },
          });

          if (!upcoming) {
            return {
              content: [
                {
                  type: "text",
                  text: "No upcoming site visit found for this lead.",
                },
              ],
              isError: true,
            };
          }

          resolvedSiteVisitId = upcoming.id;
        }

        const result = await cancelSiteVisit({
          projectId,
          leadId,
          siteVisitId: resolvedSiteVisitId,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text:
                error instanceof Error
                  ? error.message
                  : "Could not cancel the site visit.",
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}
