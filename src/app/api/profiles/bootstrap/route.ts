import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAccessTokenFromRequest,
  handleRouteError,
} from "@/lib/api-helpers";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

const MIN_USERNAME_LENGTH = 3;

type BootstrapProfilePayload = {
  id?: string;
  email?: string | null;
  metadata?: Record<string, unknown>;
};

function slugifyUsername(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function POST(request: NextRequest) {
  try {
    getAccessTokenFromRequest(request);
    const body = (await request.json()) as BootstrapProfilePayload;
    const { id, email, metadata } = body;

    if (!id) {
      badRequest("User id is required");
    }

    const supabase = createServiceSupabaseClient();

    const usernameCandidates: string[] = [];

    const metadataUsername = [
      "username",
      "preferred_username",
      "user_name",
      "user_metadata",
    ]
      .map((key) => {
        const value = metadata && typeof metadata === "object" ? metadata[key as keyof typeof metadata] : undefined;
        return typeof value === "string" ? value : undefined;
      })
      .find((value): value is string => Boolean(value));

    if (metadataUsername) {
      usernameCandidates.push(metadataUsername);
    }

    const emailPrefix = email?.split("@")[0];
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

    const displayNameCandidates = [
      (metadata as Record<string, unknown>)?.["full_name"],
      (metadata as Record<string, unknown>)?.["name"],
      metadataUsername,
      emailPrefix,
    ]
      .map((value) => (typeof value === "string" ? value.trim() : undefined))
      .filter((value): value is string => Boolean(value));

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
        {
          ignoreDuplicates: true,
          onConflict: "id",
        }
      )
      .select()
      .maybeSingle();

    if (upsertError) {
      throw upsertError;
    }

    const responseProfile = profile ?? {
      id,
      username,
      display_name: displayName,
    };

    return NextResponse.json({ profile: responseProfile });
  } catch (error) {
    return handleRouteError(error);
  }
}
