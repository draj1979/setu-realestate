"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
};

const sections = [
  {
    name: "Overview",
    description: "Project health and activity",
    icon: "⌂",
  },
  {
    name: "Knowledge",
    description: "Brochures, FAQs and documents",
    icon: "▤",
  },
  {
    name: "Media",
    description: "Project images and videos",
    icon: "▧",
  },
  {
    name: "AI Agent",
    description: "Configure your Setu agent",
    icon: "✦",
  },
  {
    name: "WhatsApp",
    description: "Connect your WhatsApp number",
    icon: "◉",
  },
  {
    name: "Calendar",
    description: "Site visit scheduling",
    icon: "□",
  },
  {
    name: "Leads",
    description: "Manage your prospects",
    icon: "♙",
  },
  {
    name: "Conversations",
    description: "WhatsApp conversations",
    icon: "☷",
  },
  {
    name: "Follow-ups",
    description: "Scheduled customer follow-ups",
    icon: "◷",
  },
  {
    name: "Settings",
    description: "Project configuration",
    icon: "⚙",
  },
];

export default function ProjectPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/";
        return;
      }

      try {
        const pathParts = window.location.pathname.split("/");
        const projectId = pathParts[pathParts.length - 1];

        if (!projectId) {
          throw new Error("Project not found");
        }

        const token = await user.getIdToken();

        const response = await fetch(
          `/api/projects/${projectId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(
            data.error ?? "Could not load project",
          );
        }

        setProject(data.project);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load project",
        );
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <img
            src="/setu-logo.png"
            alt="Setu"
            className="mx-auto h-16 w-16 object-contain"
          />
          <p className="mt-4 text-sm text-slate-500">
            Loading project...
          </p>
        </div>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <p className="font-medium text-red-600">
            {error || "Project not found"}
          </p>

          <button
            onClick={() => {
              window.location.href = "/dashboard";
            }}
            className="mt-5 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-600"
          >
            Back to Dashboard
          </button>
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
              <div className="text-lg font-bold text-slate-950">
                Setu
              </div>
              <div className="text-xs text-slate-400">
                Builder workspace
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              window.location.href = "/dashboard";
            }}
            className="text-sm font-semibold text-slate-500 hover:text-cyan-600"
          >
            ← All Projects
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                {project.name}
              </h1>

              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {project.status}
              </span>
            </div>

            <p className="mt-2 text-slate-500">
              {project.description ||
                "Configure your AI-powered customer engagement experience."}
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <button
              key={section.name}
              onClick={() => {
                if (section.name === "Knowledge") {
                  window.location.href = `/projects/${project.id}/knowledge`;
                }

                if (section.name === "WhatsApp") {
                  window.location.href = `/projects/${project.id}/whatsapp`;
                }
              }}
              className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-lg font-bold text-cyan-600">
                  {section.icon}
                </div>

                <span className="text-slate-300 transition group-hover:text-cyan-500">
                  →
                </span>
              </div>

              <h2 className="mt-5 text-base font-bold text-slate-950">
                {section.name}
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                {section.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
