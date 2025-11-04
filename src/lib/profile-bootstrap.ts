import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProfilesRow } from "./database.types";

const MIN_USERNAME_LENGTH = 3;

type ProfileBootstrapOptions = {
  supabase: SupabaseClient<Database>;
  id: string;
  email?: string | null;
  metadata?: Record<string, unknown> | null;
};

function slugifyUsername(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function extractUsernameCandidate(
  metadata: Record<string, unknown> | null | undefined
) {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const record = metadata as Record<string, unknown>;
  const keys = ["username", "preferred_username", "user_name", "user_metadata"];

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

function extractDisplayNameCandidates(
  metadata: Record<string, unknown> | null | undefined,
  metadataUsername: string | undefined,
  emailPrefix: string | undefined
) {
  const record =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)
      : undefined;

  const candidates = [
    record?.["full_name"],
    record?.["name"],
    metadataUsername,
    emailPrefix,
  ];

  return candidates
    .map((value) => (typeof value === "string" ? value.trim() : undefined))
    .filter((value): value is string => Boolean(value));
}

export async function bootstrapProfile({
  supabase,
  id,
  email,
  metadata,
}: ProfileBootstrapOptions): Promise<ProfilesRow> {
  const usernameCandidates: string[] = [];

  const metadataUsername = extractUsernameCandidate(metadata);
  if (metadataUsername) {
    usernameCandidates.push(metadataUsername);
  }

  const emailPrefix = typeof email === "string" ? email.split("@")[0] : undefined;
  if (emailPrefix) {
    usernameCandidates.push(emailPrefix);
  }

  usernameCandidates.push(`user_${id.slice(0, 8)}`);

  const baseUsername =
    usernameCandidates
      .map((candidate) => slugifyUsername(candidate))
      .find((candidate) => candidate.length >= MIN_USERNAME_LENGTH) ??
    `user_${id.slice(0, 8)}`;

  let username = baseUsername;
  let attempt = 0;

  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data || data.id === id) {
      break;
    }

    attempt += 1;
    if (attempt < 5) {
      username = `${baseUsername}_${attempt}`;
    } else {
      username = `${baseUsername}_${randomUUID().slice(0, 4)}`;
    }
  }

  const displayNameCandidates = extractDisplayNameCandidates(
    metadata,
    metadataUsername,
    emailPrefix
  );

  const displayName =
    displayNameCandidates.find(Boolean) ?? `New user ${username}`;

  const { data: profile, error: upsertError } = await supabase
    .from("profiles")
    .upsert(
      {
        id,
        username,
        display_name: displayName,
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (upsertError) {
    throw upsertError;
  }

  return profile;
}
