import { NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAccessTokenFromRequest,
  handleRouteError,
  HttpError,
} from "@/lib/api-helpers";
import { createRouteSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessTokenFromRequest(request);
    const supabase = createRouteSupabaseClient(accessToken);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      throw new HttpError(401, "Unable to resolve current user");
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    return handleRouteError(error);
  }
}

type UpdateProfilePayload = {
  display_name?: string | null;
  username?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
};

export async function PATCH(request: NextRequest) {
  try {
    const accessToken = getAccessTokenFromRequest(request);
    const supabase = createRouteSupabaseClient(accessToken);
    const payload = (await request.json()) as UpdateProfilePayload;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      throw new HttpError(401, "Unable to resolve current user");
    }

    const updates: UpdateProfilePayload = {};

    if (typeof payload.display_name === "string") {
      updates.display_name = payload.display_name.trim();
    }

    if (typeof payload.bio === "string") {
      updates.bio = payload.bio.trim();
    }

    if (typeof payload.avatar_url === "string" || payload.avatar_url === null) {
      updates.avatar_url = payload.avatar_url;
    }

    if (typeof payload.cover_url === "string" || payload.cover_url === null) {
      updates.cover_url = payload.cover_url;
    }

    if (payload.username !== undefined) {
      const username = payload.username?.trim();
      if (!username) {
        badRequest("Username cannot be empty");
      }

      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", user.id)
        .maybeSingle();

      if (existing) {
        throw new HttpError(409, "Username is already taken");
      }

      updates.username = username;
    }

    if (Object.keys(updates).length === 0) {
      badRequest("No valid fields provided");
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
