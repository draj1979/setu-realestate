"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { signOutUser } from "@/lib/auth";
import { useParams } from "next/navigation";

type Followup = {
  id: string;
  scheduledAt: string;
  status: "PENDING" | "SENT" | "CANCELLED" | "FAILED";
  message: string | null;
  attempts: number;
  sentAt: string | null;
  createdAt: string;
  lead: { id: string; name: string | null; whatsappNumber: string };
};

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "SENT", label: "Sent" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  SENT: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function FollowupsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cancellingId, setCancellingId] = useState("");

  const loadFollowups = useCallback(
    async (user: User | null) => {
      if (!user) {
        window.location.href = "/";
        return;
      }

      try {
        setLoading(true);
        setError("");

        const token = await user.getIdToken();
        const searchParams = new URLSearchParams();

        if (statusFilter) searchParams.set("status", statusFilter);

        const response = await fetch(
          `/api/projects/${projectId}/followups?${searchParams.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Could not load follow-ups");
        }

        setFollowups(data.followups);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load follow-ups",
        );
      } finally {
        setLoading(false);
      }
    },
    [projectId, statusFilter],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void loadFollowups(user);
    });

    return unsubscribe;
  }, [loadFollowups]);

  async function handleCancel(followupId: string) {
    const user = auth.currentUser;

    if (!user) {
      setError("Please sign in again.");
      return;
    }

    setCancellingId(followupId);
    setError("");

    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/projects/${projectId}/followups/${followupId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "cancel" }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not cancel follow-up");
      }

      setFollowups((current) =>
        current.map((followup) =>
          followup.id === followupId
            ? { ...followup, status: "CANCELLED" }
            : followup,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not cancel follow-up",
      );
    } finally {
      setCancellingId("");
    }
  }

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
              <div className="text-xs text-slate-400">Follow-ups</div>
            </div>
          </button>

          <div className="flex items-center gap-5">
            <button
              onClick={() => {
                window.location.href = `/projects/${projectId}`;
              }}
              className="text-sm font-semibold text-slate-500 hover:text-cyan-600"
            >
              ← Project Workspace
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

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-600">
            Automation
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Follow-ups
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            WhatsApp nudges your Setu agent has scheduled to send later —
            when a customer goes quiet or asks to be contacted after a few
            days.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                statusFilter === filter.value
                  ? "bg-slate-950 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-cyan-300"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-10 text-center text-sm text-slate-500">
            Loading follow-ups...
          </div>
        ) : followups.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-2xl text-cyan-600">
              ◷
            </div>
            <h3 className="mt-5 text-lg font-bold text-slate-950">
              No follow-ups scheduled
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Your Setu agent schedules a follow-up automatically when a
              conversation needs a nudge later. They will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {followups.map((followup) => (
                <div
                  key={followup.id}
                  className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => {
                          window.location.href = `/projects/${projectId}/leads/${followup.lead.id}`;
                        }}
                        className="font-semibold text-slate-900 hover:text-cyan-600"
                      >
                        {followup.lead.name || followup.lead.whatsappNumber}
                      </button>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_STYLES[followup.status]
                        }`}
                      >
                        {followup.status.charAt(0) +
                          followup.status.slice(1).toLowerCase()}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      Scheduled for {formatDateTime(followup.scheduledAt)}
                      {followup.status === "SENT" &&
                        ` · sent ${formatDateTime(followup.sentAt)}`}
                      {followup.status === "FAILED" &&
                        ` · ${followup.attempts} attempt${followup.attempts === 1 ? "" : "s"} failed`}
                    </p>

                    {followup.message && (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {followup.message}
                      </p>
                    )}
                  </div>

                  {followup.status === "PENDING" && (
                    <button
                      onClick={() => handleCancel(followup.id)}
                      disabled={cancellingId === followup.id}
                      className="shrink-0 rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cancellingId === followup.id
                        ? "Cancelling..."
                        : "Cancel"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
