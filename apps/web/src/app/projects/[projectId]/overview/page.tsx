"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { signOutUser } from "@/lib/auth";
import { useParams } from "next/navigation";

type Overview = {
  totalLeads: number;
  leadsByStatus: Record<string, number>;
  activeConversations: number;
  pendingFollowups: number;
  documentCount: number;
  upcomingSiteVisits: Array<{
    id: string;
    startAt: string;
    status: string;
    lead: { id: string; name: string | null; whatsappNumber: string };
  }>;
  whatsapp: { connected: boolean; displayPhoneNumber: string | null };
  calendar: { connected: boolean };
  agent: { configured: boolean; status: string | null; name: string | null };
};

function formatStatus(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

export default function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(
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
          `/api/projects/${projectId}/overview`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Could not load project overview");
        }

        setOverview(data.overview);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load project overview",
        );
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void loadOverview(user);
    });

    return unsubscribe;
  }, [loadOverview]);

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
              <div className="text-xs text-slate-400">Overview</div>
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
            Project health
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Overview
          </h1>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-10 text-center text-sm text-slate-500">
            Loading overview...
          </div>
        ) : overview ? (
          <>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total leads" value={overview.totalLeads} />
              <StatCard
                label="Active conversations"
                value={overview.activeConversations}
              />
              <StatCard
                label="Pending follow-ups"
                value={overview.pendingFollowups}
              />
              <StatCard
                label="Knowledge documents"
                value={overview.documentCount}
              />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                  Connections
                </h2>

                <ul className="mt-4 space-y-3 text-sm">
                  <li className="flex items-center justify-between">
                    <span className="text-slate-600">WhatsApp</span>
                    {overview.whatsapp.connected ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Connected
                        {overview.whatsapp.displayPhoneNumber
                          ? ` · ${overview.whatsapp.displayPhoneNumber}`
                          : ""}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                        Not connected
                      </span>
                    )}
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-slate-600">Google Calendar</span>
                    {overview.calendar.connected ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Connected
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                        Not connected
                      </span>
                    )}
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-slate-600">AI Agent</span>
                    {overview.agent.configured ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {formatStatus(overview.agent.status ?? "READY")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                        Not configured
                      </span>
                    )}
                  </li>
                </ul>

                <button
                  onClick={() => {
                    window.location.href = `/projects/${projectId}/leads`;
                  }}
                  className="mt-6 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600"
                >
                  View all leads
                </button>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                  Leads by status
                </h2>

                {Object.keys(overview.leadsByStatus).length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No leads yet.</p>
                ) : (
                  <ul className="mt-4 space-y-2 text-sm">
                    {Object.entries(overview.leadsByStatus).map(
                      ([status, count]) => (
                        <li
                          key={status}
                          className="flex items-center justify-between"
                        >
                          <span className="text-slate-600">
                            {formatStatus(status)}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {count}
                          </span>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                  Upcoming site visits
                </h2>

                {overview.upcomingSiteVisits.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">
                    Nothing scheduled.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {overview.upcomingSiteVisits.map((visit) => (
                      <li key={visit.id}>
                        <button
                          onClick={() => {
                            window.location.href = `/projects/${projectId}/leads/${visit.lead.id}`;
                          }}
                          className="w-full rounded-xl border border-slate-100 bg-slate-50 p-3 text-left text-sm transition hover:border-cyan-200"
                        >
                          <div className="font-semibold text-slate-900">
                            {visit.lead.name || visit.lead.whatsappNumber}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatDateTime(visit.startAt)}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
