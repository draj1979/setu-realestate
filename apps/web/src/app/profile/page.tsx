"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { signOutUser } from "@/lib/auth";

type Profile = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  createdAt: string;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    role: string;
  }>;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      window.location.href = "/";
      return;
    }

    try {
      setLoading(true);
      setError("");

      const token = await user.getIdToken();
      const response = await fetch("/api/auth/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not load profile");
      }

      setProfile(data.user);
      setDisplayName(data.user.displayName ?? "");
      setPhone(data.user.phone ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void loadProfile(user);
    });

    return unsubscribe;
  }, [loadProfile]);

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
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName, phone }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not update profile");
      }

      setProfile(data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading profile...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <button
            onClick={() => {
              window.location.href = "/dashboard";
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
              <div className="text-xs text-slate-400">My profile</div>
            </div>
          </button>

          <div className="flex items-center gap-5">
            <button
              onClick={() => {
                window.location.href = "/dashboard";
              }}
              className="text-sm font-semibold text-slate-500 hover:text-cyan-600"
            >
              ← Dashboard
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

      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold text-slate-950">My Profile</h1>
        <p className="mt-2 text-slate-500">
          Your personal Setu account details.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-xs font-semibold text-slate-500">
            Email
          </label>
          <p className="mt-1 text-sm text-slate-700">
            {profile?.email ?? "—"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Managed by your sign-in provider and cannot be changed here.
          </p>

          <label className="mt-6 block text-xs font-semibold text-slate-500">
            Name
          </label>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />

          <label className="mt-4 block text-xs font-semibold text-slate-500">
            Phone
          </label>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="e.g. +91 98765 43210"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-6 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : saved ? "Saved ✓" : "Save changes"}
          </button>
        </section>

        {profile && profile.memberships.length > 0 && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
              Organizations
            </h2>

            <ul className="mt-4 space-y-3">
              {profile.memberships.map((membership) => (
                <li
                  key={membership.organizationId}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm font-semibold text-slate-800">
                    {membership.organizationName}
                  </span>
                  <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
                    {membership.role}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
