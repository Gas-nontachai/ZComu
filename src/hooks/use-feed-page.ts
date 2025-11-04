"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error";
import type { Visibility } from "@/lib/database.types";
import type {
  ApiPost,
  Attachment,
  FeedComment,
  FeedPost,
} from "@/types";

function getRandomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function hydratePost(raw: ApiPost, userId: string | null): FeedPost {
  const likes = Array.isArray(raw.likes) ? raw.likes : [];
  const comments = Array.isArray(raw.comments) ? raw.comments : [];
  const likesCount =
    typeof raw.likes_count === "number" ? raw.likes_count : likes.length;
  const commentsCount =
    typeof raw.comments_count === "number"
      ? raw.comments_count
      : comments.length;
  const hasLiked =
    typeof raw.has_liked === "boolean"
      ? raw.has_liked
      : likes.some((like) => like.user_id === userId);

  return {
    ...raw,
    post_media: Array.isArray(raw.post_media) ? raw.post_media : [],
    likes,
    comments,
    likes_count: likesCount,
    comments_count: commentsCount,
    has_liked: hasLiked,
    is_owner: raw.user_id === userId,
  };
}

export function useFeedPage() {
  const router = useRouter();
  const { user, profile, loading: loadingAuth, signOut } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const currentUserId = user?.id ?? null;

  const canPublish = useMemo(
    () =>
      (content.trim().length > 0 ||
        attachments.some((attachment) => attachment.status === "uploaded")) &&
      !isPublishing,
    [attachments, content, isPublishing]
  );

  useEffect(() => {
    if (!loadingAuth && !user) {
      router.replace("/login");
    }
  }, [loadingAuth, router, user]);

  const loadPosts = useCallback(async () => {
    setIsFetching(true);
    setFetchError(null);
    try {
      const response = await apiFetch<{ posts: ApiPost[] }>("/api/posts");
      setPosts(
        (response.posts ?? []).map((post) => hydratePost(post, currentUserId))
      );
    } catch (error: unknown) {
      setFetchError(getErrorMessage(error, "Failed to load posts"));
    } finally {
      setIsFetching(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!loadingAuth) {
      loadPosts();
    }
  }, [loadPosts, loadingAuth]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const newAttachments: Attachment[] = [];

      for (const file of Array.from(files)) {
        const id = getRandomId();
        const previewUrl = URL.createObjectURL(file);
        const attachment: Attachment = {
          id,
          file,
          previewUrl,
          status: "uploading",
        };
        newAttachments.push(attachment);

        try {
          const uploadMeta = await apiFetch<{
            upload_url: string;
            public_url: string | null;
            bucket: string;
            file_url: string;
          }>("/api/storage/upload-url", {
            method: "POST",
            body: JSON.stringify({
              file_name: file.name,
              file_type: file.type,
              file_size: file.size,
              purpose: "post",
            }),
          });

          const uploadResponse = await fetch(uploadMeta.upload_url, {
            method: "PUT",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          });

          if (!uploadResponse.ok) {
            throw new Error("Upload failed");
          }

          attachment.status = "uploaded";
          attachment.remote = {
            file_url: uploadMeta.file_url,
            file_type: file.type,
            file_size: file.size,
            storage_bucket: uploadMeta.bucket,
          };
        } catch (error: unknown) {
          attachment.status = "error";
          attachment.error = getErrorMessage(error, "Upload failed");
        }
      }

      setAttachments((prev) => [...prev, ...newAttachments]);
      event.target.value = "";
    },
    []
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
  }, []);

  const handlePublish = useCallback(async () => {
    setComposerError(null);

    const incomplete = attachments.find(
      (attachment) => attachment.status !== "uploaded"
    );
    if (incomplete) {
      setComposerError("Please wait for all media to finish uploading.");
      return;
    }

    if (!content.trim() && attachments.length === 0) {
      setComposerError("Write something or attach media before posting.");
      return;
    }

    setIsPublishing(true);

    try {
      const response = await apiFetch<{ post: ApiPost }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          content: content.trim(),
          visibility,
          media: attachments
            .filter((attachment) => attachment.remote)
            .map((attachment) => ({
              file_url: attachment.remote!.file_url,
              file_type: attachment.remote!.file_type,
              file_size: attachment.remote!.file_size,
              storage_bucket: attachment.remote!.storage_bucket,
            })),
        }),
      });

      const hydrated = hydratePost(response.post, currentUserId);
      setPosts((prev) => [hydrated, ...prev]);
      setContent("");
      setAttachments([]);
      setVisibility("public");
    } catch (error: unknown) {
      setComposerError(getErrorMessage(error, "Failed to publish post"));
    } finally {
      setIsPublishing(false);
    }
  }, [attachments, content, currentUserId, visibility]);

  const handleToggleLike = useCallback(
    async (postId: string, hasLiked: boolean) => {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                has_liked: !hasLiked,
                likes_count: post.likes_count + (hasLiked ? -1 : 1),
              }
            : post
        )
      );

      try {
        const response = await apiFetch<{
          likes_count: number;
          has_liked: boolean;
          likes: FeedPost["likes"];
        }>(`/api/posts/${postId}/likes`, {
          method: hasLiked ? "DELETE" : "POST",
        });

        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  has_liked: response.has_liked,
                  likes_count: response.likes_count,
                  likes: response.likes,
                }
              : post
          )
        );
      } catch {
        await loadPosts();
      }
    },
    [loadPosts]
  );

  const handleNewComment = useCallback(
    async (postId: string, text: string) => {
      if (!text.trim()) return;
      try {
        const response = await apiFetch<{ comment: FeedComment }>(
          `/api/posts/${postId}/comments`,
          {
            method: "POST",
            body: JSON.stringify({
              text: text.trim(),
            }),
          }
        );

        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  comments: [...post.comments, response.comment],
                  comments_count: post.comments_count + 1,
                }
              : post
          )
        );
      } catch {
        await loadPosts();
      }
    },
    [loadPosts]
  );

  const handleDeletePost = useCallback(
    async (postId: string) => {
      try {
        await apiFetch(`/api/posts/${postId}`, {
          method: "DELETE",
        });
        setPosts((prev) => prev.filter((post) => post.id !== postId));
      } catch (error: unknown) {
        setFetchError(getErrorMessage(error, "Unable to delete post"));
      }
    },
    []
  );

  const goToProfile = useCallback(() => {
    router.push("/profile");
  }, [router]);

  return {
    attachments,
    canPublish,
    composerError,
    content,
    fetchError,
    goToProfile,
    handleDeletePost,
    handleFileSelect,
    handleNewComment,
    handlePublish,
    handleToggleLike,
    isFetching,
    isPublishing,
    loadingAuth,
    posts,
    profile,
    removeAttachment,
    setContent,
    setVisibility,
    signOut,
    user,
    visibility,
  };
}
