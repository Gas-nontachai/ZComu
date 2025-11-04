import type {
  CommentsRow,
  LikesRow,
  PostMediaRow,
  PostsRow,
  ProfilesRow,
} from "@/lib/database.types";

export type ProfileSummary = Pick<
  ProfilesRow,
  "id" | "username" | "display_name" | "avatar_url" | "is_verified"
>;

export type LikeSummary = Pick<
  LikesRow,
  "id" | "user_id" | "reaction_type" | "created_at"
>;

export type FeedComment = CommentsRow & {
  profiles: ProfileSummary | null;
};

export type FeedPost = PostsRow & {
  profiles: ProfileSummary | null;
  post_media: PostMediaRow[];
  likes: LikeSummary[];
  comments: FeedComment[];
  likes_count: number;
  comments_count: number;
  has_liked: boolean;
  is_owner: boolean;
};

export type Attachment = {
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

export type ApiPost = FeedPost;
