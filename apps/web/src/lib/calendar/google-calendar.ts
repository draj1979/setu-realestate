import { google } from "googleapis";

import { db } from "@setu/db";

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI are required",
    );
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );
}

export async function getGoogleCalendarClient(projectId: string) {
  const connection = await db.googleCalendarConnection.findUnique({
    where: { projectId },
  });

  if (!connection || !connection.active) {
    throw new Error("Google Calendar is not connected for this project");
  }

  const oauth2Client = getOAuth2Client();

  oauth2Client.setCredentials({
    refresh_token: connection.refreshTokenRef,
  });

  return google.calendar({
    version: "v3",
    auth: oauth2Client,
  });
}

export type CalendarSlot = {
  startAt: string;
  endAt: string;
};

export async function getAvailableCalendarSlots(
  projectId: string,
  date: string,
): Promise<CalendarSlot[]> {
  const calendar = await getGoogleCalendarClient(projectId);

  const connection = await db.googleCalendarConnection.findUnique({
    where: { projectId },
  });

  if (!connection || !connection.active) {
    throw new Error("Google Calendar is not connected for this project");
  }

  const dayStart = new Date(`${date}T10:00:00+05:30`);
  const dayEnd = new Date(`${date}T18:00:00+05:30`);

  const freeBusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      items: [{ id: connection.calendarId }],
    },
  });

  const busyPeriods =
    freeBusy.data.calendars?.[connection.calendarId]?.busy ?? [];

  const slots: CalendarSlot[] = [];

  for (
    let start = new Date(dayStart);
    start < dayEnd;
    start = new Date(start.getTime() + 60 * 60 * 1000)
  ) {
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const overlaps = busyPeriods.some((busy) => {
      if (!busy.start || !busy.end) return false;

      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);

      return start < busyEnd && end > busyStart;
    });

    if (!overlaps) {
      slots.push({
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });
    }
  }

  return slots;
}

export type BookSiteVisitInput = {
  projectId: string;
  leadId: string;
  startAt: string;
  endAt: string;
  notes?: string;
};

export async function bookSiteVisit(input: BookSiteVisitInput) {
  const lead = await db.lead.findFirst({
    where: {
      id: input.leadId,
      projectId: input.projectId,
    },
    select: {
      id: true,
      name: true,
      whatsappNumber: true,
    },
  });

  if (!lead) {
    throw new Error("Lead not found for this project");
  }

  const connection = await db.googleCalendarConnection.findUnique({
    where: {
      projectId: input.projectId,
    },
  });

  if (!connection || !connection.active) {
    throw new Error("Google Calendar is not connected for this project");
  }

  const calendar = await getGoogleCalendarClient(input.projectId);

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  if (
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime()) ||
    endAt <= startAt
  ) {
    throw new Error("Invalid site visit time range");
  }

  const freeBusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: startAt.toISOString(),
      timeMax: endAt.toISOString(),
      items: [{ id: connection.calendarId }],
    },
  });

  const busyPeriods =
    freeBusy.data.calendars?.[connection.calendarId]?.busy ?? [];

  const isBusy = busyPeriods.some((busy) => {
    if (!busy.start || !busy.end) return false;

    const busyStart = new Date(busy.start);
    const busyEnd = new Date(busy.end);

    return startAt < busyEnd && endAt > busyStart;
  });

  if (isBusy) {
    throw new Error("The requested site visit slot is no longer available");
  }

  const event = await calendar.events.insert({
    calendarId: connection.calendarId,
    requestBody: {
      summary: `Site Visit - ${lead.name ?? lead.whatsappNumber}`,
      description:
        input.notes ??
        `Setu site visit for lead ${lead.id}. WhatsApp: ${lead.whatsappNumber}`,
      start: {
        dateTime: startAt.toISOString(),
        timeZone: "Asia/Kolkata",
      },
      end: {
        dateTime: endAt.toISOString(),
        timeZone: "Asia/Kolkata",
      },
    },
  });

  if (!event.data.id) {
    throw new Error("Google Calendar did not return an event ID");
  }

  const siteVisit = await db.siteVisit.create({
    data: {
      projectId: input.projectId,
      leadId: input.leadId,
      calendarEventId: event.data.id,
      startAt,
      endAt,
      status: "SCHEDULED",
      notes: input.notes,
    },
  });

  await db.lead.update({
    where: {
      id: input.leadId,
    },
    data: {
      status: "SITE_VISIT_SCHEDULED",
    },
  });

  return {
    siteVisitId: siteVisit.id,
    calendarEventId: event.data.id,
    startAt: siteVisit.startAt.toISOString(),
    endAt: siteVisit.endAt.toISOString(),
    status: siteVisit.status,
  };
}

export type CancelSiteVisitInput = {
  projectId: string;
  leadId: string;
  siteVisitId: string;
};

export async function cancelSiteVisit(input: CancelSiteVisitInput) {
  const siteVisit = await db.siteVisit.findFirst({
    where: {
      id: input.siteVisitId,
      projectId: input.projectId,
      leadId: input.leadId,
    },
  });

  if (!siteVisit) {
    throw new Error("Site visit not found for this lead");
  }

  if (siteVisit.status === "CANCELLED") {
    throw new Error("Site visit is already cancelled");
  }

  if (siteVisit.status === "COMPLETED") {
    throw new Error("Cannot cancel a site visit that already happened");
  }

  // Best-effort: also remove the event from the builder's actual Google
  // Calendar so the slot frees up again for get_site_visit_slots. If the
  // calendar is disconnected or the event was already removed manually,
  // don't block the cancellation on that — the SiteVisit row is the
  // source of truth for Setu's own scheduling logic either way.
  if (siteVisit.calendarEventId) {
    try {
      const calendar = await getGoogleCalendarClient(input.projectId);
      const connection = await db.googleCalendarConnection.findUnique({
        where: { projectId: input.projectId },
      });

      if (connection?.active) {
        await calendar.events.delete({
          calendarId: connection.calendarId,
          eventId: siteVisit.calendarEventId,
        });
      }
    } catch (error) {
      console.error("Could not delete calendar event on cancellation:", error);
    }
  }

  const updated = await db.siteVisit.update({
    where: { id: siteVisit.id },
    data: { status: "CANCELLED" },
  });

  const lead = await db.lead.findUnique({
    where: { id: input.leadId },
    select: { status: true },
  });

  // Only roll the lead status back if it was still reflecting this visit —
  // don't clobber a status the builder/agent has since moved on from.
  if (
    lead &&
    (lead.status === "SITE_VISIT_PROPOSED" ||
      lead.status === "SITE_VISIT_SCHEDULED")
  ) {
    await db.lead.update({
      where: { id: input.leadId },
      data: { status: "QUALIFIED" },
    });
  }

  return {
    siteVisitId: updated.id,
    status: updated.status,
  };
}
