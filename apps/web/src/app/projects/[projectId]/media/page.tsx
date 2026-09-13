"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { signOutUser } from "@/lib/auth";
import { useParams } from "next/navigation";

type MediaItem = {
  id: string;
  name: string;
  mimeType: string;
  type: string;
  caption: string | null;
  createdAt: string;
  fileUrl: string;
};

const MEDIA_TYPES = [
  { value: "IMAGE", label: "Image" },
  { value: "FLOOR_PLAN", label: "Floor plan" },
  { value: "BROCHURE", label: "Brochure" },
  { value: "DOCUMENT", label: "Document" },
  { value: "OTHER", label: "Other" },
];

export default function MediaPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState("IMAGE");
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  const loadMedia = useCallback(
    async (user: User | null) => {
      if (!user) {
        window.location.href = "/";
        return;
      }

      try {
        setLoading(true);
        setError("");

        const token = await user.getIdToken();
        const response = await fetch(`/api/projects/${projectId}/media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Could not load media");
        }

        setMedia(data.media);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load media");
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void loadMedia(user);
    });

    return unsubscribe;
  }, [loadMedia]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const user = auth.currentUser;

    if (!user) {
      setError("Please sign in again.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", uploadType);

      const response = await fetch(`/api/projects/${projectId}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not upload media");
      }

      setMedia((current) => [data.media, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload media");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleDelete(mediaId: string) {
    const user = auth.currentUser;

    if (!user) {
      setError("Please sign in again.");
      return;
    }

    setDeletingId(mediaId);
    setError("");

    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/projects/${projectId}/media/${mediaId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not delete media");
      }

      setMedia((current) => current.filter((item) => item.id !== mediaId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete media");
    } finally {
      setDeletingId("");
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
              <div className="text-xs text-slate-400">Media</div>
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
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-cyan-600">
              Project Media
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Media
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Project images, floor plans and brochures your Setu agent can
              share with customers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={uploadType}
              onChange={(event) => setUploadType(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            >
              {MEDIA_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-600 hover:shadow-md">
              <span className="text-lg leading-none">+</span>
              {uploading ? "Uploading..." : "Upload"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-10 text-center text-sm text-slate-500">
            Loading media...
          </div>
        ) : media.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-2xl text-cyan-600">
              ▧
            </div>
            <h3 className="mt-5 text-lg font-bold text-slate-950">
              No media uploaded yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Upload project photos, floor plans or brochures to share with
              prospects.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {media.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex h-40 items-center justify-center bg-slate-100">
                  {item.mimeType.startsWith("image/") ? (
                    <img
                      src={item.fileUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl text-slate-400">📄</span>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                      {item.name}
                    </p>
                  </div>

                  <span className="mt-1 inline-block rounded-full bg-cyan-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">
                    {item.type.replace("_", " ")}
                  </span>

                  {item.caption && (
                    <p className="mt-2 text-xs text-slate-500">
                      {item.caption}
                    </p>
                  )}

                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="mt-3 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {deletingId === item.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
