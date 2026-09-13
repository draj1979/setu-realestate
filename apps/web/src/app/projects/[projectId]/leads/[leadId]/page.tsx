"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { signOutUser } from "@/lib/auth";
import { useParams } from "next/navigation";

type Message = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  text: string | null;
  createdAt: string;
};

type SiteVisit = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  notes: string | null;
  calendarEventId: string | null;
};

type Followup = {
  id: string;
  scheduledAt: string;
  status: string;
  message: string | null;
};

type LeadDetail = {
  id: string;
  name: string | null;
  whatsappNumber: string;
  status: string;
  score: number;
  budget: string | null;
  purpose: string;
  timeline: string | null;
  preferredLocation: string | null;
  configuration: string | null;
  notes: string | null;
  optedOut: boolean;
  createdAt: string;
  updatedAt: string;
  conversation: {
    id: string;
    status: string;
    lastMessageAt: string | null;
    messages: Message[];
  } | null;
  siteVisits: SiteVisit[];
  followups: Followup[];
};

const LEAD_STATUSES = [
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
];

function formatStatus(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function LeadDetailPage() {
  const { projectId, leadId } = useParams<{
    projectId: string;
    leadId: string;
  }>();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadLead = useCallback(
    async (user: User | null) => {
      if (!user) {
        window.location.href = "/";
        return;
      }

      try {
        setLoading(true);
        setError("");

        const token = await user.getIdToken();
        const response = await fetch(
          `/api/projects/${projectId}/leads/${leadId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Could not load lead");
        }

        setLead(data.lead);
        setStatusDraft(data.lead.status);
        setNotesDraft(data.lead.notes ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load lead");
      } finally {
        setLoading(false);
      }
    },
    [projectId, leadId],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void loadLead(user);
    });

    return unsubscribe;
  }, [loadLead]);

  async function handleSave() {
    const user = auth.currentUser;

    if (!user) {
      setError("Please sign in again.");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/projects/${projectId}/leads/${leadId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: statusDraft, notes: notesDraft }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not update lead");
      }

      setLead((current) =>
        current
          ? { ...current, status: data.lead.status, notes: data.lead.notes }
          : current,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update lead");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading lead...</p>
      </main>
    );
  }

  if (error && !lead) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <p className="font-medium text-red-600">{error}</p>
          <button
            onClick={() => {
              window.location.href = `/projects/${projectId}/leads`;
            }}
            className="mt-5 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-600"
          >
            Back to Leads
          </button>
        </div>
      </main>
    );
  }

  if (!lead) return null;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <button
            onClick={() => {
              window.location.href = `/projects/${projectId}`;
            }}
            className="flex items-center gap-3"
          >
            <img
              src="/setu-logo.png"
              alt="Setu"
              className="h-10 w-10 object-contain"
            />
            <div className="text-left">
              <div className="text-lg font-bold text-slate-950">Setu</div>
              <div className="text-xs text-slate-400">Lead detail</div>
            </div>
          </button>

          <div className="flex items-center gap-5">
            <button
              onClick={() => {
                window.location.href = `/projects/${projectId}/leads`;
              }}
              className="text-sm font-semibold text-slate-500 hover:text-cyan-600"
            >
              ← Leads
            </button>

            <button
              onClick={async () => {
                try {
                  await signOutUser();
                } finally {
                  window.location.href = "/";
                }
              }}
              className="text-sm font-semibold text-slate-500 hover:text-red-600"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              {lead.name || "Unknown lead"}
            </h1>
            <p className="mt-1 text-slate-500">
              {lead.whatsappNumber}
              {lead.optedOut && (
                <span className="ml-2 font-medium text-red-600">
                  Opted out of messages
                </span>
              )}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                Profile
              </h2>

              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Score</dt>
                  <dd className="font-semibold text-slate-900">
                    {lead.score}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Budget</dt>
                  <dd className="font-semibold text-slate-900">
                    {lead.budget
                      ? `₹${Number(lead.budget).toLocaleString("en-IN")}`
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Purpose</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatStatus(lead.purpose)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Timeline</dt>
                  <dd className="font-semibold text-slate-900">
                    {lead.timeline || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Location</dt>
                  <dd className="text-right font-semibold text-slate-900">
                    {lead.preferredLocation || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Configuration</dt>
                  <dd className="text-right font-semibold text-slate-900">
                    {lead.configuration || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">First contacted</dt>
                  <dd className="text-right font-semibold text-slate-900">
                    {formatDateTime(lead.createdAt)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                Status &amp; notes
              </h2>

              <label className="mt-4 block text-xs font-semibold text-slate-500">
                Status
              </label>
              <select
                value={statusDraft}
                onChange={(event) => setStatusDraft(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                {LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>

              <label className="mt-4 block text-xs font-semibold text-slate-500">
                Notes
              </label>
              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                rows={4}
                placeholder="Internal notes about this lead"
                className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />

              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-4 w-full rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : saved ? "Saved ✓" : "Save changes"}
              </button>
            </section>

            {lead.siteVisits.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                  Site visits
                </h2>
                <ul className="mt-4 space-y-3">
                  {lead.siteVisits.map((visit) => (
                    <li
                      key={visit.id}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm"
                    >
                      <div className="font-semibold text-slate-900">
                        {formatDateTime(visit.startAt)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatStatus(visit.status)}
                      </div>
                      {visit.notes && (
                        <div className="mt-1 text-xs text-slate-500">
                          {visit.notes}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {lead.followups.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                  Follow-ups
                </h2>
                <ul className="mt-4 space-y-3">
                  {lead.followups.map((followup) => (
                    <li
                      key={followup.id}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm"
                    >
                      <div className="font-semibold text-slate-900">
                        {formatDateTime(followup.scheduledAt)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatStatus(followup.status)}
                      </div>
                      {followup.message && (
                        <div className="mt-1 text-xs text-slate-500">
                          {followup.message}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
              Conversation
            </h2>

            {!lead.conversation || lead.conversation.messages.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No messages yet.
              </p>
            ) : (
              <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-2">
                {lead.conversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.direction === "OUTBOUND"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                        message.direction === "OUTBOUND"
                          ? "bg-cyan-500 text-white"
                          : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">
                        {message.text || `[${message.type}]`}
                      </p>
                      <p
                        className={`mt-1 text-[10px] ${
                          message.direction === "OUTBOUND"
                            ? "text-cyan-50"
                            : "text-slate-400"
                        }`}
                      >
                        {formatDateTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
