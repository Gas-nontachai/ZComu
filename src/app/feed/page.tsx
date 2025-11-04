"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart, ImageIcon, Lock, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error";
import type {
  CommentsRow,
  PostMediaRow,
  PostsRow,
  ProfilesRow,
  ReactionType,
  Visibility,
} from "@/lib/database.types";
import { cn } from "@/lib/utils";

type ProfileSummary = Pick<
  ProfilesRow,
  "id" | "username" | "display_name" | "avatar_url" | "is_verified"
>;

type FeedComment = CommentsRow & {
  profiles: ProfileSummary | null;
};

type FeedPost = PostsRow & {
  profiles: ProfileSummary | null;
  post_media: PostMediaRow[];
  likes: Array<{
    id: string;
    user_id: string;
    reaction_type: ReactionType | null;
    created_at: string;
  }>;
  comments: FeedComment[];
  likes_count: number;
  comments_count: number;
  has_liked: boolean;
  is_owner: boolean;
};

type Attachment = {
  id: string;
  file: File;
  status: "uploading" | "uploaded" | "error";
  previewUrl: string;
  remote?: {
    file_url: string;
    file_type?: string | null;
    file_size?: number | null;
    storage_bucket?: string | null;
  };
  error?: string;
};

type ApiPost = {
  id: string;
  user_id: string;
  content?: string | null;
  visibility?: Visibility;
  edited?: boolean | null;
  created_at: string;
  updated_at: string;
  profiles?: ProfileSummary | null;
  post_media?: PostMediaRow[] | null;
  likes?: FeedPost["likes"] | null;
  comments?: FeedComment[] | null;
  likes_count?: number;
  comments_count?: number;
  has_liked?: boolean;
};

function timeAgo(date: string) {
  const delta = Date.now() - new Date(date).getTime();
  const seconds = Math.floor(delta / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(seconds) >= secondsInUnit || unit === "second") {
      const value = Math.round(seconds / secondsInUnit);
      return new Intl.RelativeTimeFormat("en", {
        numeric: "auto",
      }).format(value * -1, unit);
    }
  }
  return "just now";
}

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

export default function FeedPage() {
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

  const canPublish =
    (content.trim().length > 0 || attachments.some((a) => a.status === "uploaded")) &&
    !isPublishing;

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

    const incomplete = attachments.find((attachment) => attachment.status !== "uploaded");
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

  const visibilityIcon = useMemo(() => {
    switch (visibility) {
      case "friends":
        return <Users className="size-4" />;
      case "private":
        return <Lock className="size-4" />;
      default:
        return (
          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" className="opacity-20" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        );
    }
  }, [visibility]);

  if (loadingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-sm text-slate-300">Loading your workspace…</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/5 bg-black/30 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold">Community feed</h1>
            <p className="text-xs text-slate-400">
              Authenticated as {profile?.display_name ?? profile?.username}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => router.push("/profile")}
            >
              Profile
            </Button>
            <Button variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start gap-4">
            <Avatar className="size-12">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt="avatar" />
              ) : (
                <AvatarFallback>
                  {(profile?.display_name ?? "You").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex-1 space-y-4">
              <Textarea
                placeholder="Share something with your network..."
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={4}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-200 transition hover:border-white/30 hover:bg-white/10">
                    <ImageIcon className="size-4" />
                    <span>Add media</span>
                    <Input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                  <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-200">
                    {visibilityIcon}
                    <select
                      value={visibility}
                      onChange={(event) =>
                        setVisibility(event.target.value as Visibility)
                      }
                      className="bg-transparent text-sm outline-none"
                    >
                      <option value="public">Public</option>
                      <option value="friends">Friends</option>
                      <option value="private">Only me</option>
                    </select>
                  </div>
                </div>
                <Button
                  onClick={handlePublish}
                  disabled={!canPublish}
                  className="min-w-32"
                >
                  {isPublishing ? "Publishing…" : "Publish"}
                </Button>
              </div>
              {composerError && (
                <p className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {composerError}
                </p>
              )}
              {attachments.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative overflow-hidden rounded-xl border border-white/10"
                    >
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.id)}
                        className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs text-slate-100"
                      >
                        Remove
                      </button>
                      {attachment.file.type.startsWith("image/") ? (
                        <Image
                          src={attachment.previewUrl}
                          alt={attachment.file.name}
                          width={400}
                          height={280}
                          className="h-60 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-40 items-center justify-center bg-black/40">
                          <p className="text-sm text-slate-200">
                            {attachment.file.name}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t border-white/5 bg-black/40 px-3 py-2 text-xs text-slate-200">
                        <span>{attachment.file.type || "Unknown"}</span>
                        <span>
                          {attachment.status === "uploading" && "Uploading…"}
                          {attachment.status === "error" && (
                            <span className="text-rose-300">
                              {attachment.error ?? "Error"}
                            </span>
                          )}
                          {attachment.status === "uploaded" && "Ready"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </article>

        {fetchError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {fetchError}
          </div>
        )}

        <section className="space-y-4">
          {isFetching ? (
            <p className="text-sm text-slate-300">Loading recent posts…</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-slate-300">
              No posts yet. Be the first to share something!
            </p>
          ) : (
            posts.map((post) => (
              <article
                key={post.id}
                className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6"
              >
                <header className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {post.profiles?.avatar_url ? (
                        <AvatarImage
                          src={post.profiles.avatar_url}
                          alt={post.profiles.username ?? "user"}
                        />
                      ) : (
                        <AvatarFallback>
                          {(post.profiles?.display_name ??
                            post.profiles?.username ??
                            "U"
                          )
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">
                        {post.profiles?.display_name ??
                          post.profiles?.username ??
                          "Anonymous"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {timeAgo(post.created_at)}
                      </p>
                    </div>
                  </div>
                  {post.is_owner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePost(post.id)}
                      className="text-xs text-rose-200 hover:text-rose-100"
                    >
                      Delete
                    </Button>
                  )}
                </header>
                <div className="space-y-3 text-sm leading-relaxed text-slate-100">
                  {post.content && <p>{post.content}</p>}
                  {post.post_media.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {post.post_media.map((media) => (
                        <div
                          key={media.id}
                          className="overflow-hidden rounded-xl border border-white/10"
                        >
                          {media.file_type?.startsWith("image/") ? (
                            <Image
                              src={media.file_url}
                              alt="post media"
                              width={400}
                              height={280}
                              className="h-64 w-full object-cover"
                            />
                          ) : (
                            <video
                              controls
                              className="h-64 w-full object-cover"
                              src={media.file_url}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <footer className="flex flex-col gap-4">
                  <div className="flex items-center gap-4 text-sm text-slate-300">
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleLike(post.id, post.has_liked)
                      }
                      className={cn(
                        "flex items-center gap-2 rounded-full border border-white/5 px-3 py-1.5 transition hover:border-white/20 hover:bg-white/10",
                        post.has_liked && "border-emerald-500/40 bg-emerald-500/10"
                      )}
                    >
                      <Heart
                        className={cn(
                          "size-4",
                          post.has_liked ? "fill-emerald-400 text-emerald-400" : ""
                        )}
                      />
                      <span>{post.likes_count}</span>
                    </button>
                    <div className="flex items-center gap-2 rounded-full border border-white/5 px-3 py-1.5">
                      <MessageCircle className="size-4" />
                      <span>{post.comments_count}</span>
                    </div>
                  </div>
                  <CommentComposer
                    postId={post.id}
                    comments={post.comments}
                    onComment={handleNewComment}
                  />
                </footer>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}

function CommentComposer({
  postId,
  comments,
  onComment,
}: {
  postId: string;
  comments: FeedComment[];
  onComment: (postId: string, text: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim()) return;
    setSubmitting(true);
    try {
      await onComment(postId, value);
      setValue("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex items-start gap-3">
        <Textarea
          placeholder="Add a comment…"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={2}
        />
        <Button type="submit" disabled={!value.trim() || submitting}>
          {submitting ? "Sending…" : "Send"}
        </Button>
      </form>
      {comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  {comment.profiles?.display_name ??
                    comment.profiles?.username ??
                    "Anonymous"}
                </span>
                <time>{timeAgo(comment.created_at)}</time>
              </div>
              <p className="mt-2 whitespace-pre-line text-slate-100">
                {comment.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
