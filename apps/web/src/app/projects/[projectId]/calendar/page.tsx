"use client";

import { useCallback, useEffect, useState } from "react";

import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { signOutUser } from "@/lib/auth";
import { useParams, useSearchParams } from "next/navigation";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const GOOGLE_REDIRECT_URI = "https://app.gosetu.co/api/auth/google/callback";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export default function CalendarPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();

  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    calendarId: string | null;
    loading: boolean;
  }>({ connected: false, calendarId: null, loading: true });
  const [statusError, setStatusError] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);

  const refreshStatus = useCallback(
    async (user: User | null) => {
      if (!user) {
        setConnectionStatus((prev) => ({ ...prev, loading: false }));
        return;
      }

      try {
        const token = await user.getIdToken();
        const result = await fetch(`/api/projects/${projectId}/calendar`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await result.json();

        if (!result.ok || !data.ok) {
          throw new Error(data?.error ?? "Could not load calendar status");
        }

        setConnectionStatus({
          connected: Boolean(data?.connected),
          calendarId: data?.calendarId ?? null,
          loading: false,
        });
      } catch (err) {
        setConnectionStatus((prev) => ({ ...prev, loading: false }));
        setStatusError(
          err instanceof Error
            ? err.message
            : "Could not load calendar status",
        );
      }
    },
    [projectId],
  );

  async function handleDisconnect() {
    const user = auth.currentUser;

    if (!user) {
      setStatusError("Please sign in again.");
      return;
    }

    setDisconnecting(true);
    setStatusError("");

    try {
      const token = await user.getIdToken();
      const result = await fetch(`/api/projects/${projectId}/calendar`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await result.json();

      if (!result.ok || !data.ok) {
        throw new Error(data?.error ?? "Could not disconnect calendar");
      }

      setConnectionStatus({
        connected: false,
        calendarId: null,
        loading: false,
      });
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : "Could not disconnect calendar",
      );
    } finally {
      setDisconnecting(false);
    }
  }

  useEffect(() => {
    // auth.currentUser is unreliable on first mount/reload — it's still
    // null until Firebase finishes restoring the persisted session
    // asynchronously. Wait for the auth-state listener instead (same fix
    // applied to the WhatsApp connect page for the same reason).
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void refreshStatus(user);
    });

    return unsubscribe;
  }, [refreshStatus]);

  const oauthError = searchParams.get("error");
  const justConnected = searchParams.get("connected") === "true";

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
              <div className="text-xs text-slate-400">Calendar</div>
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

      <div className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-bold text-slate-950">
          Connect Google Calendar
        </h1>
        <p className="mt-2 text-slate-500">
          Connect your Google Calendar so Setu can check your availability
          and book site visits directly.
        </p>

        {statusError && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {statusError}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Project: {projectId}</p>

          {connectionStatus.connected && (
            <p className="mt-2 text-sm font-medium text-green-700">
              ✓ Connected
              {connectionStatus.calendarId
                ? ` — ${connectionStatus.calendarId}`
                : ""}
            </p>
          )}

          {justConnected && !connectionStatus.connected && (
            <p className="mt-2 text-sm font-medium text-green-700">
              ✓ Google Calendar connected successfully
            </p>
          )}

          {oauthError && (
            <p className="mt-2 text-sm font-medium text-red-600">
              Could not connect Google Calendar ({oauthError}). Please try
              again.
            </p>
          )}

          <button
            type="button"
            disabled={connectionStatus.connected || connectionStatus.loading}
            onClick={() => {
              const authorizeUrl = new URL(
                "https://accounts.google.com/o/oauth2/v2/auth",
              );

              authorizeUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
              authorizeUrl.searchParams.set(
                "redirect_uri",
                GOOGLE_REDIRECT_URI,
              );
              authorizeUrl.searchParams.set("response_type", "code");
              authorizeUrl.searchParams.set("scope", GOOGLE_SCOPES);
              authorizeUrl.searchParams.set("access_type", "offline");
              authorizeUrl.searchParams.set("prompt", "consent");
              authorizeUrl.searchParams.set("state", projectId);

              window.location.href = authorizeUrl.toString();
            }}
            className={
              connectionStatus.connected
                ? "mt-6 cursor-not-allowed rounded-xl bg-slate-300 px-5 py-3 text-sm font-semibold text-slate-600"
                : "mt-6 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {connectionStatus.connected
              ? "Connected"
              : connectionStatus.loading
                ? "Checking status…"
                : "Connect Google Calendar"}
          </button>

          {connectionStatus.connected && (
            <button
              type="button"
              disabled={disconnecting}
              onClick={handleDisconnect}
              className="mt-3 ml-3 rounded-xl border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
