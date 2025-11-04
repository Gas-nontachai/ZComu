import { NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAccessTokenFromRequest,
  handleRouteError,
  HttpError,
} from "@/lib/api-helpers";
import { createRouteSupabaseClient } from "@/lib/supabase-server";
import type { Visibility } from "@/lib/database.types";

type MediaPayload = {
  id?: string;
  file_url: string;
  file_type?: string | null;
  file_size?: number | null;
  storage_bucket?: string | null;
};

type UpdatePostPayload = {
  content?: string | null;
  visibility?: Visibility;
  media?: MediaPayload[];
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
      .from("posts")
      .select(
        `
        id,
        user_id,
        content,
        visibility,
        edited,
        created_at,
        updated_at,
        profiles:profiles!posts_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        ),
        post_media (
          id,
          file_url,
          file_type,
          file_size,
          storage_bucket,
          created_at
        ),
        likes (
          id,
          user_id,
          reaction_type,
          created_at
        ),
        comments (
          id,
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
        )
      `
      )
      .eq("id", postId)
      .single();

    if (error) {
      throw error;
    }

    const likes = Array.isArray(data.likes) ? data.likes : [];
    const comments = Array.isArray(data.comments) ? data.comments : [];

    return NextResponse.json({
      post: {
        ...data,
        likes_count: likes.length,
        comments_count: comments.length,
        has_liked: likes.some((like) => like.user_id === user.id),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const accessToken = getAccessTokenFromRequest(request);
    const supabase = createRouteSupabaseClient(accessToken);
    const { postId } = params;
    const payload = (await request.json()) as UpdatePostPayload;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      throw new HttpError(401, "Unable to resolve current user");
    }

    const content =
      payload.content !== undefined ? payload.content?.trim() ?? "" : undefined;

    const media = Array.isArray(payload.media) ? payload.media : undefined;

    if (content !== undefined) {
      const hasContent = content.length > 0;
      if (!hasContent && (!media || media.length === 0)) {
        badRequest("Post cannot be empty");
      }
    } else if (!media || media.length === 0) {
      badRequest("Post must include content or media");
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (content !== undefined) {
      updates.content = content.length > 0 ? content : null;
      updates.edited = true;
    }

    if (payload.visibility) {
      updates.visibility = payload.visibility;
    }

    const { error: updateError } = await supabase
      .from("posts")
      .update(updates)
      .eq("id", postId)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    if (media) {
      const { data: existingMedia, error: existingMediaError } = await supabase
        .from("post_media")
        .select("id")
        .eq("post_id", postId);

      if (existingMediaError) {
        throw existingMediaError;
      }

      const mediaIdsToKeep = new Set(
        media
          .map((item) => item.id)
          .filter((id): id is string => Boolean(id))
      );

      const mediaIdsToDelete =
        existingMedia?.filter((item) => !mediaIdsToKeep.has(item.id)) ?? [];

      if (mediaIdsToDelete.length > 0) {
        const { error: deleteRemovedError } = await supabase
          .from("post_media")
          .delete()
          .in(
            "id",
            mediaIdsToDelete.map((item) => item.id)
          );

        if (deleteRemovedError) {
          throw deleteRemovedError;
        }
      }

      const newMedia = media.filter((item) => !item.id);

      if (newMedia.length > 0) {
        const createPayload = newMedia.map((item) => ({
          post_id: postId,
          file_url: item.file_url,
          file_type: item.file_type ?? null,
          file_size: item.file_size ?? null,
          storage_bucket: item.storage_bucket ?? null,
        }));

        const { error: insertMediaError } = await supabase
          .from("post_media")
          .insert(createPayload);

        if (insertMediaError) {
          throw insertMediaError;
        }
      }
    }

    const { data: refreshed, error: fetchError } = await supabase
      .from("posts")
      .select(
        `
        id,
        user_id,
        content,
        visibility,
        edited,
        created_at,
        updated_at,
        profiles:profiles!posts_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        ),
        post_media (
          id,
          file_url,
          file_type,
          file_size,
          storage_bucket,
          created_at
        ),
        likes (
          id,
          user_id,
          reaction_type,
          created_at
        ),
        comments (
          id,
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
        )
      `
      )
      .eq("id", postId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const likes = Array.isArray(refreshed.likes) ? refreshed.likes : [];
    const comments = Array.isArray(refreshed.comments) ? refreshed.comments : [];

    return NextResponse.json({
      post: {
        ...refreshed,
        likes_count: likes.length,
        comments_count: comments.length,
        has_liked: likes.some((like) => like.user_id === user.id),
      },
    });
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
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
