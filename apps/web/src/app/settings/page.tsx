"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { signOutUser } from "@/lib/auth";

type Organization = {
  id: string;
  name: string;
  slug: string;
  hasLogo: boolean;
  createdAt: string;
  projectCount: number;
  currentUserRole: string;
  members: Array<{
    id: string;
    role: string;
    userId: string;
    name: string | null;
    email: string | null;
    joinedAt: string;
  }>;
};

export default function BuilderSettingsPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const loadOrganization = useCallback(async (user: User | null) => {
    if (!user) {
      window.location.href = "/";
      return;
    }

    try {
      setLoading(true);
      setError("");

      const token = await user.getIdToken();

      const sessionResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const sessionData = await sessionResponse.json();

      const organizationId = sessionData?.user?.memberships?.[0]?.organizationId;

      if (!sessionResponse.ok || !sessionData.ok || !organizationId) {
        throw new Error("Could not resolve your organization");
      }

      const response = await fetch(`/api/organizations/${organizationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not load organization");
      }

      setOrganization(data.organization);
      setNameDraft(data.organization.name);
      setLogoUrl(
        data.organization.hasLogo
          ? `/api/organizations/${organizationId}/logo?v=${Date.now()}`
          : null,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load organization",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void loadOrganization(user);
    });

    return unsubscribe;
  }, [loadOrganization]);

  async function handleSave() {
    const user = auth.currentUser;

    if (!user || !organization) {
      setError("Please sign in again.");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: nameDraft }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not update organization");
      }

      setOrganization((current) =>
        current ? { ...current, name: data.organization.name } : current,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update organization",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !organization) return;

    const user = auth.currentUser;

    if (!user) {
      setError("Please sign in again.");
      return;
    }

    setUploadingLogo(true);
    setError("");

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/organizations/${organization.id}/logo`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not upload logo");
      }

      setLogoUrl(data.logoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload logo");
    } finally {
      setUploadingLogo(false);
      event.target.value = "";
    }
  }

  async function handleLogoRemove() {
    const user = auth.currentUser;

    if (!user || !organization) {
      setError("Please sign in again.");
      return;
    }

    setUploadingLogo(true);
    setError("");

    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/organizations/${organization.id}/logo`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not remove logo");
      }

      setLogoUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove logo");
    } finally {
      setUploadingLogo(false);
    }
  }

  const canEdit =
    organization?.currentUserRole === "OWNER" ||
    organization?.currentUserRole === "ADMIN";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading settings...</p>
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
              <div className="text-xs text-slate-400">Builder settings</div>
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
        <h1 className="text-2xl font-bold text-slate-950">
          Builder Settings
        </h1>
        <p className="mt-2 text-slate-500">
          Manage your organization and see who's on your team.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {organization && (
          <>
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                Organization
              </h2>

              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Company logo"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">No logo</span>
                  )}
                </div>

                {canEdit && (
                  <div className="flex gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                      {uploadingLogo ? "Uploading..." : "Upload logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                        className="hidden"
                      />
                    </label>

                    {logoUrl && (
                      <button
                        onClick={handleLogoRemove}
                        disabled={uploadingLogo}
                        className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>

              <label className="mt-6 block text-xs font-semibold text-slate-500">
                Name
              </label>
              <input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                disabled={!canEdit}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              />

              <label className="mt-4 block text-xs font-semibold text-slate-500">
                Workspace ID
              </label>
              <p className="mt-1 text-sm text-slate-500">
                {organization.slug}
              </p>

              <p className="mt-4 text-xs text-slate-400">
                {organization.projectCount} project
                {organization.projectCount === 1 ? "" : "s"}
              </p>

              {canEdit ? (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="mt-6 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : saved ? "Saved ✓" : "Save changes"}
                </button>
              ) : (
                <p className="mt-4 text-xs text-slate-400">
                  Only an owner or admin can change organization settings.
                </p>
              )}
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                Team
              </h2>

              <ul className="mt-4 divide-y divide-slate-100">
                {organization.members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {member.name || member.email || "Unknown"}
                      </p>
                      {member.email && (
                        <p className="text-xs text-slate-400">
                          {member.email}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
                      {member.role}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
