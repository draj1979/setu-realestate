"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { signOutUser } from "@/lib/auth";
import { useParams } from "next/navigation";

type ConversationListItem = {
  id: string;
  status: "ACTIVE" | "CLOSED" | "HANDED_OFF";
  startedAt: string;
  lastMessageAt: string | null;
  closedAt: string | null;
  messageCount: number;
  lead: {
    id: string;
    name: string | null;
    whatsappNumber: string;
    status: string;
    optedOut: boolean;
  };
  lastMessage: {
    direction: "INBOUND" | "OUTBOUND";
    type: string;
    text: string | null;
    createdAt: string;
  } | null;
};

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "HANDED_OFF", label: "Handed off" },
  { value: "CLOSED", label: "Closed" },
];

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  HANDED_OFF: "bg-purple-50 text-purple-700",
  CLOSED: "bg-slate-100 text-slate-600",
};

function formatStatus(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function formatRelativeTime(iso: string | null) {
  if (!iso) return "No messages yet";

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

function previewText(message: ConversationListItem["lastMessage"]) {
  if (!message) return "No messages yet";

  const prefix = message.direction === "OUTBOUND" ? "Setu: " : "";
  const body = message.text || `[${message.type.toLowerCase()}]`;

  return `${prefix}${body}`;
}

export default function ConversationsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [conversations, setConversations] = useState<ConversationListItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const loadConversations = useCallback(
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
          `/api/projects/${projectId}/conversations?${searchParams.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Could not load conversations");
        }

        setConversations(data.conversations);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load conversations",
        );
      } finally {
        setLoading(false);
      }
    },
    [projectId, statusFilter, search],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void loadConversations(user);
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    void loadConversations(auth.currentUser);
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
              <div className="text-xs text-slate-400">Conversations</div>
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
            WhatsApp
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Conversations
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Every WhatsApp conversation Setu is having on this project, most
            recently active first.
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
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-2xl text-cyan-600">
              ☷
            </div>
            <h3 className="mt-5 text-lg font-bold text-slate-950">
              No conversations yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Once a customer messages your WhatsApp number, the
              conversation will show up here.
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => {
                    window.location.href = `/projects/${projectId}/leads/${conversation.lead.id}`;
                  }}
                  className="flex w-full flex-col gap-2 px-6 py-5 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-slate-900">
                        {conversation.lead.name || "Unknown"}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_STYLES[conversation.status] ??
                          "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {formatStatus(conversation.status)}
                      </span>
                      {conversation.lead.optedOut && (
                        <span className="text-xs font-medium text-red-500">
                          Opted out
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      {conversation.lead.whatsappNumber}
                    </p>

                    <p className="mt-2 truncate text-sm text-slate-600">
                      {previewText(conversation.lastMessage)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-400">
                    <span>{formatRelativeTime(conversation.lastMessageAt)}</span>
                    <span>
                      {conversation.messageCount} message
                      {conversation.messageCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
