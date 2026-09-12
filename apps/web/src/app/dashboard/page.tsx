"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

type Organization = {
  id: string;
  name: string;
  role: string;
};

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
};

export default function DashboardPage() {
  const [organization, setOrganization] =
    useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState("");

  async function getToken() {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Please sign in again.");
    }

    return user.getIdToken();
  }

  async function loadDashboard() {
    const token = await getToken();

    const sessionResponse = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const sessionData = await sessionResponse.json();

    if (
      !sessionResponse.ok ||
      !sessionData.ok ||
      !sessionData.user
    ) {
      throw new Error("Could not load your Setu account");
    }

    const membership = sessionData.user.memberships?.[0];

    if (!membership) {
      throw new Error("No builder organization found");
    }

    setOrganization({
      id: membership.organizationId,
      name: membership.organizationName,
      role: membership.role,
    });

    const projectsResponse = await fetch("/api/projects", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const projectsData = await projectsResponse.json();

    if (!projectsResponse.ok || !projectsData.ok) {
      throw new Error(
        projectsData.error ?? "Could not load projects",
      );
    }

    setProjects(projectsData.projects);
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
        await loadDashboard();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load dashboard",
        );
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function handleCreateProject(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!projectName.trim()) {
      setError("Please enter a project name.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const token = await getToken();

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ?? "Could not create project",
        );
      }

      setProjects((current) => [data.project, ...current]);
      setProjectName("");
      setProjectDescription("");
      setShowCreateForm(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create project",
      );
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <img
              src="/setu-logo.png"
              alt="Setu"
              className="mx-auto h-16 w-16 object-contain"
            />
            <p className="mt-4 text-sm font-medium text-slate-600">
              Loading your workspace...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error && !organization) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <p className="font-medium text-red-600">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <img
              src="/setu-logo.png"
              alt="Setu"
              className="h-11 w-11 object-contain"
            />

            <div>
              <div className="text-lg font-bold tracking-tight text-slate-950">
                Setu
              </div>
              <div className="text-xs text-slate-500">
                AI customer engagement for builders
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold text-slate-800">
                {organization?.name}
              </div>
              <div className="text-xs uppercase tracking-wide text-slate-400">
                {organization?.role}
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-700">
              {organization?.name?.charAt(0).toUpperCase() ?? "B"}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-cyan-600">
              Workspace
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Dashboard
            </h1>

            <p className="mt-2 max-w-2xl text-slate-600">
              Manage your real-estate projects and AI customer
              engagement agents from one place.
            </p>
          </div>

          <button
            onClick={() => {
              setError("");
              setShowCreateForm((current) => !current);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-600 hover:shadow-md"
          >
            <span className="text-lg leading-none">+</span>
            Create Project
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {showCreateForm && (
          <div className="mt-8 rounded-2xl border border-cyan-100 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-950">
                Create a new project
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Add a property project that you want Setu to manage.
              </p>
            </div>

            <form
              onSubmit={handleCreateProject}
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="projectName"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Project name
                </label>

                <input
                  id="projectName"
                  value={projectName}
                  onChange={(event) =>
                    setProjectName(event.target.value)
                  }
                  placeholder="e.g. Prestige Lakeside Habitat"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="projectDescription"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Description
                  <span className="ml-1 font-normal text-slate-400">
                    optional
                  </span>
                </label>

                <textarea
                  id="projectDescription"
                  value={projectDescription}
                  onChange={(event) =>
                    setProjectDescription(event.target.value)
                  }
                  placeholder="Brief description of the project"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setProjectName("");
                    setProjectDescription("");
                    setError("");
                  }}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        )}

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Projects
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {projects.length === 0
                  ? "Create your first project to get started."
                  : `${projects.length} project${projects.length === 1 ? "" : "s"} in your workspace`}
              </p>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50">
                <img
                  src="/setu-logo.png"
                  alt=""
                  className="h-12 w-12 object-contain"
                />
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-950">
                No projects yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Create your first property project and start
                configuring its AI customer engagement agent.
              </p>

              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-6 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-600"
              >
                Create your first project
              </button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <article
                  key={project.id}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50">
                      <img
                        src="/setu-logo.png"
                        alt=""
                        className="h-9 w-9 object-contain"
                      />
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        project.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-bold text-slate-950">
                    {project.name}
                  </h3>

                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">
                    {project.description ||
                      "No project description added yet."}
                  </p>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-xs text-slate-400">
                      {project.slug}
                    </span>

                    <button
                      onClick={() => {
                        window.location.href = `/projects/${project.id}`;
                      }}
                      className="text-sm font-semibold text-cyan-600 transition group-hover:text-cyan-700"
                    >
                      Configure →
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
