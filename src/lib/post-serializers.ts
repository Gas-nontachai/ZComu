import type {
  CommentsRow,
  LikesRow,
  PostMediaRow,
  PostsRow,
  ProfilesRow,
} from "@/lib/database.types";
import type { FeedComment, FeedPost, LikeSummary, ProfileSummary } from "@/types";

export const POST_WITH_RELATIONS = `
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
    post_id,
    user_id,
    text,
    parent_id,
    created_at,
    profiles:profiles!comments_user_id_fkey (
      id,
      username,
      display_name,
      avatar_url,
      is_verified
    )
  )
`;

type PostRow = PostsRow;
type ProfileRow = ProfilesRow;

type RawComment = CommentsRow & {
  profiles: Pick<ProfileRow, "id" | "username" | "display_name" | "avatar_url" | "is_verified"> | null;
};

type RawPost = PostRow & {
  profiles: Pick<ProfileRow, "id" | "username" | "display_name" | "avatar_url" | "is_verified"> | null;
  post_media: PostMediaRow[] | null;
  likes: Array<Pick<LikesRow, "id" | "user_id" | "reaction_type" | "created_at">> | null;
  comments: RawComment[] | null;
};

export type CommentWithProfile = RawComment;
export type PostWithRelations = RawPost;

function normalizeProfile(
  profile: RawPost["profiles"] | RawComment["profiles"]
): ProfileSummary | null {
  if (!profile) return null;
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    is_verified: profile.is_verified,
  };
}

function normalizeLikes(
  likes: RawPost["likes"]
): LikeSummary[] {
  if (!Array.isArray(likes)) {
    return [];
  }

  return likes.map((like) => ({
    id: like.id,
    user_id: like.user_id,
    reaction_type: like.reaction_type,
    created_at: like.created_at,
  }));
}

function normalizeComments(comments: RawPost["comments"]): FeedComment[] {
  if (!Array.isArray(comments)) {
    return [];
  }

  return comments.map((comment) => ({
    ...comment,
    profiles: normalizeProfile(comment.profiles),
  }));
}

export function toFeedPost(raw: RawPost, currentUserId: string): FeedPost {
  const postMedia = Array.isArray(raw.post_media) ? raw.post_media : [];
  const likes = normalizeLikes(raw.likes);
  const comments = normalizeComments(raw.comments);

  return {
    ...raw,
    profiles: normalizeProfile(raw.profiles),
    post_media: postMedia,
    likes,
    comments,
    likes_count: likes.length,
    comments_count: comments.length,
    has_liked: likes.some((like) => like.user_id === currentUserId),
    is_owner: raw.user_id === currentUserId,
  };
}

export function toFeedPosts(rawPosts: RawPost[] | null | undefined, currentUserId: string): FeedPost[] {
  if (!Array.isArray(rawPosts)) {
    return [];
  }

  return rawPosts.map((post) => toFeedPost(post, currentUserId));
}

export function toFeedComment(raw: RawComment): FeedComment {
  return {
    ...raw,
    profiles: normalizeProfile(raw.profiles),
  };
}
