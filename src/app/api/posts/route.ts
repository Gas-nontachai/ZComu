import { NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAccessTokenFromRequest,
  handleRouteError,
  HttpError,
} from "@/lib/api-helpers";
import { createRouteSupabaseClient } from "@/lib/supabase-server";
import {
  POST_WITH_RELATIONS,
  toFeedPost,
  toFeedPosts,
  type PostWithRelations,
} from "@/lib/post-serializers";
import type { Visibility } from "@/lib/database.types";

const DEFAULT_POST_LIMIT = 20;

type MediaPayload = {
  file_url: string;
  file_type?: string | null;
  file_size?: number | null;
  storage_bucket?: string | null;
};

type CreatePostPayload = {
  content?: string | null;
  visibility?: Visibility;
  media?: MediaPayload[];
};

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
    const currentUserId = user.id;

    const { searchParams } = new URL(request.url);
    const limit =
      Number.parseInt(searchParams.get("limit") ?? "", 10) || DEFAULT_POST_LIMIT;

    const { data, error } = await supabase
      .from("posts")
      .select<PostWithRelations>(POST_WITH_RELATIONS)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      posts: toFeedPosts(data, currentUserId),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getAccessTokenFromRequest(request);
    const supabase = createRouteSupabaseClient(accessToken);
    const payload = (await request.json()) as CreatePostPayload;

    const content = payload.content?.trim();
    const visibility = payload.visibility ?? "public";
    const media = Array.isArray(payload.media) ? payload.media : [];

    if (!content && media.length === 0) {
      badRequest("Post must contain content or media");
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      throw new HttpError(401, "Unable to resolve current user");
    }

    const { data: post, error: insertError } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        content: content ?? null,
        visibility,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    if (media.length > 0) {
      const mediaPayload = media.map((item) => ({
        post_id: post.id,
        file_url: item.file_url,
        file_type: item.file_type ?? null,
        file_size: item.file_size ?? null,
        storage_bucket: item.storage_bucket ?? null,
      }));

      const { error: mediaError } = await supabase
        .from("post_media")
        .insert(mediaPayload);

      if (mediaError) {
        throw mediaError;
      }
    }

    const { data: fullPost, error: fetchError } = await supabase
      .from("posts")
      .select<PostWithRelations>(POST_WITH_RELATIONS)
      .eq("id", post.id)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    return NextResponse.json({
      post: toFeedPost(fullPost, user.id),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
