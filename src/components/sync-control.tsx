"use client";

import { Cloud, LogOut, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type SyncStatus =
  "local" | "signed-out" | "loading" | "synced" | "error";

export function SyncControl({
  user,
  status,
}: {
  user: User | null;
  status: SyncStatus;
}) {
  const [open, setOpen] = useState(false),
    [email, setEmail] = useState(""),
    [message, setMessage] = useState(""),
    [submitting, setSubmitting] = useState(false);
  const configured = isSupabaseConfigured();
  const label =
    status === "synced"
      ? "SYNCED"
      : status === "loading"
        ? "SYNCING"
        : status === "error"
          ? "SYNC ERROR"
          : configured
            ? "SIGN IN"
            : "LOCAL";

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseClient();
    if (!client || !email.trim()) return;
    setSubmitting(true);
    setMessage("");
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setSubmitting(false);
    setMessage(
      error
        ? error.message
        : "Check your email for the secure sign-in link, then return here.",
    );
  }

  async function signOut() {
    const client = getSupabaseClient();
    if (!client) return;
    setSubmitting(true);
    const { error } = await client.auth.signOut({ scope: "local" });
    setSubmitting(false);
    setMessage(error ? error.message : "Signed out on this device.");
  }

  return (
    <>
      <button
        type="button"
        className="btn flex items-center gap-2"
        aria-label="Open account and cloud sync"
        onClick={() => setOpen(true)}
      >
        <Cloud size={16} aria-hidden="true" />
        <span className="hidden font-mono text-xs md:inline">{label}</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <section
            className="card w-full max-w-md p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">CLOUD SYNC</p>
                <h2
                  id="sync-title"
                  className="mt-1 text-balance text-xl font-semibold"
                >
                  Continue on any device
                </h2>
              </div>
              <button
                type="button"
                className="btn"
                aria-label="Close cloud sync"
                onClick={() => setOpen(false)}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            {!configured ? (
              <p className="mt-5 text-pretty text-sm text-muted">
                Cloud sync is not configured yet. Progress remains stored on
                this device until Supabase project credentials are added.
              </p>
            ) : user ? (
              <div className="mt-5">
                <p className="text-pretty text-sm text-muted">
                  Signed in as <b className="text-ink">{user.email}</b>.
                  Practice progress syncs automatically after each change.
                </p>
                <div className="mt-4 flex items-center justify-between rounded-md border border-line p-3">
                  <span className="font-mono text-xs">{label}</span>
                  <button
                    type="button"
                    className="btn flex items-center gap-2"
                    disabled={submitting}
                    onClick={signOut}
                  >
                    <LogOut size={15} aria-hidden="true" /> Sign out
                  </button>
                </div>
              </div>
            ) : (
              <form className="mt-5" onSubmit={sendLink}>
                <label className="text-sm font-semibold" htmlFor="sync-email">
                  Email
                </label>
                <input
                  id="sync-email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-2 w-full rounded-md border border-line bg-paper p-3"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
                <button
                  type="submit"
                  className="btn primary mt-3 w-full"
                  disabled={submitting}
                >
                  {submitting ? "Sending link…" : "Email me a sign-in link"}
                </button>
              </form>
            )}
            {message && (
              <p className="mt-3 text-pretty text-sm" role="status">
                {message}
              </p>
            )}
            {status === "error" && (
              <p className="mt-3 text-pretty text-sm text-red-600" role="alert">
                The last cloud sync failed. Local progress is still safe on this
                device and will retry after the next change.
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
