import { NextRequest, NextResponse } from "next/server";
import {
  getAccessTokenFromRequest,
  handleRouteError,
  HttpError,
} from "@/lib/api-helpers";
import {
  createRouteSupabaseClient,
  type RouteSupabaseClient,
} from "@/lib/supabase-server";
import type { ReactionType } from "@/lib/database.types";

type LikePayload = {
  reaction_type?: ReactionType;
};

async function fetchLikesSnapshot(
  supabase: RouteSupabaseClient,
  postId: string,
  currentUserId: string
) {
  const { data, error } = await supabase
    .from("likes")
    .select("id, user_id, reaction_type, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const likes = data ?? [];

  return {
    likes,
    likes_count: likes.length,
    has_liked: likes.some((like) => like.user_id === currentUserId),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const accessToken = getAccessTokenFromRequest(request);
    const supabase = createRouteSupabaseClient(accessToken);
    const { postId } = params;
    const payload = (await request.json()) as LikePayload | null;
    const reactionType: ReactionType = payload?.reaction_type ?? "like";

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      throw new HttpError(401, "Unable to resolve current user");
    }

    const { error: upsertError } = await supabase
      .from("likes")
      .upsert(
        {
          post_id: postId,
          user_id: user.id,
          reaction_type: reactionType,
        },
        {
          onConflict: "post_id,user_id",
        }
      );

    if (upsertError) {
      throw upsertError;
    }

    const snapshot = await fetchLikesSnapshot(supabase, postId, user.id);

    return NextResponse.json(snapshot);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
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

    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    const snapshot = await fetchLikesSnapshot(supabase, postId, user.id);

    return NextResponse.json(snapshot);
  } catch (error) {
    return handleRouteError(error);
  }
}
