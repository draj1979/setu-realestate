"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { signOutUser } from "@/lib/auth";
import { useParams } from "next/navigation";

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  logoStoragePath?: string | null;
};

const STATUS_OPTIONS = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"];

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const loadProject = useCallback(
    async (user: User | null) => {
      if (!user) {
        window.location.href = "/";
        return;
      }

      try {
        setLoading(true);
        setError("");

        const token = await user.getIdToken();
        const response = await fetch(`/api/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Could not load project");
        }

        setProject(data.project);
        setName(data.project.name);
        setDescription(data.project.description ?? "");
        setStatus(data.project.status);
        setLogoUrl(
          data.project.logoStoragePath
            ? `/api/projects/${projectId}/logo?v=${Date.now()}`
            : null,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load project");
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void loadProject(user);
    });

    return unsubscribe;
  }, [loadProject]);

  async function handleSave() {
    const user = auth.currentUser;

    if (!user) {
      setError("Please sign in again.");
      return;
    }

    if (!name.trim()) {
      setError("Project name cannot be empty.");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, description, status }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not update project");
      }

      setProject(data.project);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update project");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const user = auth.currentUser;

    if (!user || !project) {
      setError("Please sign in again.");
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not delete project");
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete project");
      setDeleting(false);
    }
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

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

      const response = await fetch(`/api/projects/${projectId}/logo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

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

    if (!user) {
      setError("Please sign in again.");
      return;
    }

    setUploadingLogo(true);
    setError("");

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/projects/${projectId}/logo`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

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
              <div className="text-xs text-slate-400">Project settings</div>
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

      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold text-slate-950">
          Project Settings
        </h1>
        <p className="mt-2 text-slate-500">
          Basic configuration for this project.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
            Project logo
          </h2>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Project logo"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs text-slate-400">No logo</span>
              )}
            </div>

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
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-xs font-semibold text-slate-500">
            Project name
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />

          <label className="mt-4 block text-xs font-semibold text-slate-500">
            Description
          </label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />

          <label className="mt-4 block text-xs font-semibold text-slate-500">
            Status
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0) + option.slice(1).toLowerCase()}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-xs font-semibold text-slate-500">
            Project slug
          </label>
          <p className="mt-1 text-sm text-slate-500">{project?.slug}</p>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-6 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : saved ? "Saved ✓" : "Save changes"}
          </button>
        </section>

        <section className="mt-6 rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-red-500">
            Danger zone
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Deleting a project permanently removes its leads, conversations,
            site visits and documents. This cannot be undone.
          </p>

          {!showDangerZone ? (
            <button
              onClick={() => setShowDangerZone(true)}
              className="mt-4 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              Delete this project
            </button>
          ) : (
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-500">
                Type the project name (
                <span className="font-mono">{project?.name}</span>) to
                confirm
              </label>
              <input
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                className="mt-1 w-full rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              />

              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => {
                    setShowDangerZone(false);
                    setDeleteConfirmText("");
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirmText !== project?.name}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Permanently delete"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
