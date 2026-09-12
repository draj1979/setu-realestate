"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

type DocumentItem = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: string | null;
  status: string;
  createdAt: string;
};

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState("");
  const [error, setError] = useState("");

  const projectId =
    typeof window !== "undefined"
      ? window.location.pathname.split("/")[2]
      : "";

  async function loadDocuments(user: NonNullable<typeof auth.currentUser>) {
    const token = await user.getIdToken();

    const response = await fetch(
      `/api/projects/${projectId}/documents`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ?? "Could not load documents",
      );
    }

    setDocuments(data.documents);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/";
        return;
      }

      try {
        setLoading(true);
        setError("");
        await loadDocuments(user);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load documents",
        );
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function handleUpload(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

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

      const response = await fetch(
        `/api/projects/${projectId}/documents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ?? "Could not upload document",
        );
      }

      setDocuments((current) => [
        data.document,
        ...current,
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not upload document",
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleProcess(documentId: string) {
    const user = auth.currentUser;

    if (!user) {
      setError("Please sign in again.");
      return;
    }

    setProcessingId(documentId);
    setError("");

    try {
      const token = await user.getIdToken();

      const response = await fetch(
        `/api/projects/${projectId}/documents/${documentId}/process`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ?? "Could not process document",
        );
      }

      setDocuments((current) =>
        current.map((document) =>
          document.id === documentId
            ? { ...document, status: data.status }
            : document,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not process document",
      );
    } finally {
      setProcessingId("");
    }
  }

  function formatSize(sizeBytes: string | null) {
    if (!sizeBytes) {
      return "";
    }

    const size = Number(sizeBytes);

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <img
            src="/setu-logo.png"
            alt="Setu"
            className="mx-auto h-14 w-14 object-contain"
          />
          <p className="mt-4 text-sm text-slate-500">
            Loading knowledge...
          </p>
        </div>
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
              <div className="text-lg font-bold text-slate-950">
                Setu
              </div>
              <div className="text-xs text-slate-400">
                Project knowledge
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              window.location.href = `/projects/${projectId}`;
            }}
            className="text-sm font-semibold text-slate-500 hover:text-cyan-600"
          >
            ← Project Workspace
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-cyan-600">
              Project Knowledge
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Knowledge
            </h1>

            <p className="mt-2 max-w-2xl text-slate-600">
              Upload project information that Setu can use when
              answering customer questions.
            </p>
          </div>

          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-600 hover:shadow-md">
            <span className="text-lg leading-none">+</span>
            {uploading ? "Uploading..." : "Upload Document"}
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        <div className="mt-8 rounded-2xl border border-cyan-100 bg-white p-6 shadow-sm">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-xl text-cyan-600">
              ✦
            </div>

            <div>
              <h2 className="font-bold text-slate-950">
                Give Setu the right information
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Upload brochures, floor plans, pricing documents,
                FAQs, specifications, payment plans and other
                project information. PDF, DOCX and TXT files up
                to 25 MB are supported.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="mt-10">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-950">
              Documents
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {documents.length === 0
                ? "No documents uploaded yet."
                : `${documents.length} document${documents.length === 1 ? "" : "s"} uploaded`}
            </p>
          </div>

          {documents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-2xl text-cyan-600">
                ▤
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-950">
                No knowledge documents yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Upload your first project document to start
                building the knowledge base.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="divide-y divide-slate-100">
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold uppercase text-slate-600">
                        {document.mimeType === "application/pdf"
                          ? "PDF"
                          : document.mimeType === "text/plain"
                            ? "TXT"
                            : "DOC"}
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-900">
                          {document.name}
                        </h3>

                        <p className="mt-1 text-xs text-slate-400">
                          {formatSize(document.sizeBytes)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                          document.status === "READY"
                            ? "bg-emerald-50 text-emerald-700"
                            : document.status === "FAILED"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {document.status}
                      </span>

                      {document.status === "UPLOADED" && (
                        <button
                          onClick={() => handleProcess(document.id)}
                          disabled={processingId === document.id}
                          className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {processingId === document.id
                            ? "Processing..."
                            : "Process"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
