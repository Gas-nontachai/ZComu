import { NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAccessTokenFromRequest,
  handleRouteError,
  HttpError,
} from "@/lib/api-helpers";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { bootstrapProfile } from "@/lib/profile-bootstrap";
import type { PostgrestError } from "@supabase/supabase-js";

type BootstrapProfilePayload = {
  id?: string;
  email?: string | null;
  metadata?: Record<string, unknown>;
};
export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

export async function POST(request: NextRequest) {
  try {
    getAccessTokenFromRequest(request);
    const body = (await request.json()) as BootstrapProfilePayload;
    const { id, email, metadata } = body;

    if (!id) {
      badRequest("User id is required");
    }

    let supabase;
    try {
      supabase = createServiceSupabaseClient();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "SUPABASE_SERVICE_ROLE_KEY is not configured"
      ) {
        throw new HttpError(
          500,
          "SUPABASE_SERVICE_ROLE_KEY must be configured to bootstrap profiles"
        );
      }
      throw error;
    }

    const profile = await bootstrapProfile({
      supabase,
      id,
      email,
      metadata:
        metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : null,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as PostgrestError).code === "42501"
    ) {
      return handleRouteError(
        new HttpError(
          500,
          "Failed to bootstrap profile due to Supabase RLS. Configure SUPABASE_SERVICE_ROLE_KEY."
        )
      );
    }
    return handleRouteError(error);
  }
}
