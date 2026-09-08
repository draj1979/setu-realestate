"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/auth";

export default function Home() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        window.location.href = "/dashboard";
      }
    });

    return unsubscribe;
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userCredential =
        mode === "signin"
          ? await signInWithEmail(email, password)
          : await signUpWithEmail(email, password);

      if (mode === "signup") {
        const idToken = await userCredential.user.getIdToken();

        const response = await fetch("/api/auth/onboard", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            displayName,
            organizationName,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Could not create builder account");
        }
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-2">
          <section className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="text-3xl font-bold tracking-tight">Setu</div>
              <p className="mt-3 text-sm font-medium text-cyan-300">
                AI sales assistant for real-estate builders
              </p>
            </div>

            <div>
              <h1 className="text-4xl font-semibold leading-tight">
                Turn every WhatsApp conversation into a sales opportunity.
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
                Setu helps builders respond to prospects, qualify leads and
                keep conversations moving 24×7.
              </p>
            </div>

            <p className="text-sm text-slate-400">
              One intelligent assistant. Every project.
            </p>
          </section>

          <section className="p-8 sm:p-12">
            <div className="mx-auto max-w-md">
              <div className="mb-8 lg:hidden">
                <div className="text-3xl font-bold text-slate-950">Setu</div>
                <p className="mt-2 text-sm text-cyan-600">
                  AI sales assistant for real-estate builders
                </p>
              </div>

              <h2 className="text-2xl font-semibold text-slate-950">
                {mode === "signin"
                  ? "Welcome back"
                  : "Create your builder account"}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {mode === "signin"
                  ? "Sign in to manage your projects and AI sales assistant."
                  : "Start managing your projects with Setu."}
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                {mode === "signup" && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Your name
                      </label>
                      <input
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                        placeholder="Dharam Tiwari"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Builder / company name
                      </label>
                      <input
                        required
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                        placeholder="ABC Developers"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                    placeholder="you@company.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    required
                    type="password"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Please wait..."
                    : mode === "signin"
                      ? "Sign in"
                      : "Create account"}
                </button>
              </form>

              <div className="mt-8 text-center text-sm text-slate-500">
                {mode === "signin"
                  ? "Don't have a Setu account?"
                  : "Already have a Setu account?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin");
                    setError("");
                  }}
                  className="font-semibold text-cyan-600 hover:text-cyan-700"
                >
                  {mode === "signin" ? "Create one" : "Sign in"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
