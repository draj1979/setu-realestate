"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useParams } from "next/navigation";

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (options: {
        appId: string;
        cookie: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: unknown) => void,
        options: Record<string, unknown>,
      ) => void;
    };
  }
}

const META_APP_ID = "4464692527110370";
const META_CONFIG_ID = "1764176554923601";

export default function WhatsAppPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    displayPhoneNumber: string | null;
    loading: boolean;
  }>({ connected: false, displayPhoneNumber: null, loading: true });

  const signupDataRef = useRef<{
    business_id?: string;
    waba_id?: string;
    phone_number_id?: string;
  }>({});

  const refreshStatus = useCallback(
    async (user: User | null) => {
      if (!user) {
        setConnectionStatus((prev) => ({ ...prev, loading: false }));
        return;
      }

      try {
        const token = await user.getIdToken();
        const result = await fetch(`/api/projects/${projectId}/whatsapp`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await result.json();

        setConnectionStatus({
          connected: Boolean(data?.connected),
          displayPhoneNumber: data?.displayPhoneNumber ?? null,
          loading: false,
        });
      } catch {
        setConnectionStatus((prev) => ({ ...prev, loading: false }));
      }
    },
    [projectId],
  );

  useEffect(() => {
    // auth.currentUser is unreliable on first mount/reload — it's still
    // null until Firebase finishes restoring the persisted session
    // asynchronously. Wait for the auth-state listener instead.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void refreshStatus(user);
    });

    return unsubscribe;
  }, [refreshStatus]);

  useEffect(() => {
    window.addEventListener("message", (event) => {
      try {
        const data =
          typeof event.data === "string"
            ? JSON.parse(event.data)
            : event.data;

        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.event === "FINISH") {
          signupDataRef.current = data.data ?? {};
          console.log("WhatsApp Embedded Signup completed");
        }
      } catch {
        // Ignore non-JSON messages from other sources.
      }
    });

    if (document.getElementById("facebook-jssdk")) return;

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: META_APP_ID,
        cookie: true,
        xfbml: true,
        version: "v23.0",
      });
    };

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-950">
          Connect WhatsApp
        </h1>
        <p className="mt-2 text-slate-500">
          Connect your WhatsApp Business account to this Setu project.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Project: {projectId}
          </p>

          {connectionStatus.connected && (
            <p className="mt-2 text-sm font-medium text-green-700">
              ✓ Connected
              {connectionStatus.displayPhoneNumber
                ? ` — ${connectionStatus.displayPhoneNumber}`
                : ""}
            </p>
          )}

          <button
            type="button"
            disabled={connectionStatus.connected || connectionStatus.loading}
            onClick={() => {
              window.FB?.login(
                (response) => {
                  console.log("Meta Embedded Signup response:", response);

                  void (async () => {

                  const authResponse = (
                    response as {
                      authResponse?: { code?: string };
                    }
                  ).authResponse;

                  if (!authResponse?.code) return;

                  const user = auth.currentUser;
                  if (!user) {
                    console.log("WhatsApp: NO Firebase user");
                    return;
                  }

                  console.log("WhatsApp: Firebase user found");
                  const token = await user.getIdToken();
                  console.log("WhatsApp: Firebase token obtained");

                  console.log("WhatsApp: calling connect API");

                  const result = await fetch(
                    `/api/projects/${projectId}/whatsapp/connect`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({
                        code: authResponse.code,
                        wabaId: signupDataRef.current.waba_id,
                        phoneNumberId: signupDataRef.current.phone_number_id,
                      }),
                    },
                  );

                  const connectData = await result.json();
                  console.log("WhatsApp connection result:", connectData);

                  if (connectData?.ok) {
                    setConnectionStatus({
                      connected: true,
                      displayPhoneNumber:
                        connectData.displayPhoneNumber ?? null,
                      loading: false,
                    });
                  }
                  })();
                },
                {
                  config_id: META_CONFIG_ID,
                  response_type: "code",
                  override_default_response_type: true,
                  extras: {
                    version: "v4",
                  },
                },
              );
            }}
            className={
              connectionStatus.connected
                ? "mt-6 cursor-not-allowed rounded-xl bg-slate-300 px-5 py-3 text-sm font-semibold text-slate-600"
                : "mt-6 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {connectionStatus.connected
              ? "Connected"
              : connectionStatus.loading
                ? "Checking status…"
                : "Connect WhatsApp"}
          </button>
        </div>
      </div>
    </main>
  );
}
