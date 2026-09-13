"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { signOutUser } from "@/lib/auth";
import { useParams } from "next/navigation";

type Lead = {
  id: string;
  name: string | null;
  whatsappNumber: string;
  status: string;
  score: number;
  budget: string | null;
  purpose: string;
  timeline: string | null;
  preferredLocation: string | null;
  optedOut: boolean;
  updatedAt: string;
  conversation: { status: string; lastMessageAt: string | null } | null;
  latestSiteVisit: { startAt: string; status: string } | null;
};

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "NEW", label: "New" },
  { value: "ENGAGED", label: "Engaged" },
  { value: "QUALIFYING", label: "Qualifying" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "FOLLOWUP", label: "Follow-up" },
  { value: "SITE_VISIT_PROPOSED", label: "Visit proposed" },
  { value: "SITE_VISIT_SCHEDULED", label: "Visit scheduled" },
  { value: "SITE_VISIT_COMPLETED", label: "Visit completed" },
  { value: "HANDED_OFF", label: "Handed off" },
  { value: "LOST", label: "Lost" },
];

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-700",
  ENGAGED: "bg-cyan-50 text-cyan-700",
  QUALIFYING: "bg-cyan-50 text-cyan-700",
  QUALIFIED: "bg-emerald-50 text-emerald-700",
  FOLLOWUP: "bg-amber-50 text-amber-700",
  SITE_VISIT_PROPOSED: "bg-amber-50 text-amber-700",
  SITE_VISIT_SCHEDULED: "bg-blue-50 text-blue-700",
  SITE_VISIT_COMPLETED: "bg-emerald-50 text-emerald-700",
  HANDED_OFF: "bg-purple-50 text-purple-700",
  LOST: "bg-red-50 text-red-700",
};

function formatStatus(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function formatRelativeTime(iso: string | null) {
  if (!iso) return "No activity yet";

  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export default function LeadsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const loadLeads = useCallback(
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
        if (search.trim()) searchParams.set("search", search.trim());

        const response = await fetch(
          `/api/projects/${projectId}/leads?${searchParams.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Could not load leads");
        }

        setLeads(data.leads);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load leads");
      } finally {
        setLoading(false);
      }
    },
    [projectId, statusFilter, search],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void loadLeads(user);
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    void loadLeads(auth.currentUser);
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
              <div className="text-xs text-slate-400">Leads</div>
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
            Prospects
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Leads
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Everyone who has messaged Setu about this project, and where
            they stand.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
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

          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or phone"
              className="w-56 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
            <button
              type="submit"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Search
            </button>
          </form>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-10 text-center text-sm text-slate-500">
            Loading leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-2xl text-cyan-600">
              ♙
            </div>
            <h3 className="mt-5 text-lg font-bold text-slate-950">
              No leads yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Once customers start messaging your WhatsApp number, they will
              show up here.
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Lead</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Score</th>
                    <th className="px-6 py-3">Budget</th>
                    <th className="px-6 py-3">Timeline</th>
                    <th className="px-6 py-3">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => {
                        window.location.href = `/projects/${projectId}/leads/${lead.id}`;
                      }}
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {lead.name || "Unknown"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {lead.whatsappNumber}
                          {lead.optedOut && (
                            <span className="ml-2 text-red-500">
                              Opted out
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                            STATUS_STYLES[lead.status] ??
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {formatStatus(lead.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {lead.score}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {lead.budget
                          ? `₹${Number(lead.budget).toLocaleString("en-IN")}`
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {lead.timeline || "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {formatRelativeTime(
                          lead.conversation?.lastMessageAt ?? null,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
