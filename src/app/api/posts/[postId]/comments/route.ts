import { NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAccessTokenFromRequest,
  handleRouteError,
  HttpError,
} from "@/lib/api-helpers";
import { createRouteSupabaseClient } from "@/lib/supabase-server";

type CreateCommentPayload = {
  text?: string;
  parent_id?: string | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const accessToken = getAccessTokenFromRequest(request);
    const supabase = createRouteSupabaseClient(accessToken);
    const { postId } = params;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      throw new HttpError(401, "Unable to resolve current user");
    }

    const { data, error } = await supabase
      .from("comments")
      .select(
        `
        id,
        post_id,
        user_id,
        text,
        parent_id,
        created_at,
        profiles:profiles!comments_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ comments: data ?? [] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const accessToken = getAccessTokenFromRequest(request);
    const supabase = createRouteSupabaseClient(accessToken);
    const { postId } = params;
    const payload = (await request.json()) as CreateCommentPayload;

    const text = payload.text?.trim();

    if (!text) {
      badRequest("Comment text is required");
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      throw new HttpError(401, "Unable to resolve current user");
    }

    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: postId,
        user_id: user.id,
        text,
        parent_id: payload.parent_id ?? null,
      })
      .select(
        `
        id,
        post_id,
        user_id,
        text,
        parent_id,
        created_at,
        profiles:profiles!comments_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ comment: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
