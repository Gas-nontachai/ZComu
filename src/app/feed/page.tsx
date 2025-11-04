"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Heart, ImageIcon, Lock, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import type { Visibility } from "@/lib/database.types";
import type { FeedComment } from "@/types";
import { cn } from "@/lib/utils";
import { useFeedPage } from "@/hooks/use-feed-page";

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

export default function FeedPage() {
  const {
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
  } = useFeedPage();

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
            <Button variant="ghost" onClick={goToProfile}>
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
                          alt={post.profiles.display_name ?? "avatar"}
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
                        post.has_liked &&
                          "border-emerald-500/40 bg-emerald-500/10"
                      )}
                    >
                      <Heart
                        className={cn(
                          "size-4",
                          post.has_liked
                            ? "fill-emerald-400 text-emerald-400"
                            : ""
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
