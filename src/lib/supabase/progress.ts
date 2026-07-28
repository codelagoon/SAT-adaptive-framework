"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { State } from "@/core/store";

export type SyncedProgress = Omit<State, "localQuestions">;

export function progressFromState(state: State): SyncedProgress {
  const { localQuestions: _localQuestions, ...progress } = state;
  return progress;
}

function isSyncedProgress(value: unknown): value is SyncedProgress {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<SyncedProgress>;
  return Boolean(
    Array.isArray(row.attempts) &&
    Array.isArray(row.sessions) &&
    row.mastery &&
    typeof row.mastery === "object" &&
    row.beliefs &&
    typeof row.beliefs === "object" &&
    row.research &&
    typeof row.research === "object",
  );
}

export async function loadCloudProgress(
  client: SupabaseClient,
  userId: string,
) {
  const { data, error } = await client
    .from("user_progress")
    .select("state, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !isSyncedProgress(data.state)) return null;
  return { state: data.state, updatedAt: String(data.updated_at) };
}

export async function saveCloudProgress(
  client: SupabaseClient,
  userId: string,
  progress: SyncedProgress,
) {
  const updatedAt = new Date().toISOString();
  const { error } = await client
    .from("user_progress")
    .upsert(
      { user_id: userId, state: progress, updated_at: updatedAt },
      { onConflict: "user_id" },
    );
  if (error) throw error;
  return updatedAt;
}
