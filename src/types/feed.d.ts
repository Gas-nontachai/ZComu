import type {
  CommentsRow,
  PostMediaRow,
  PostsRow,
  ProfilesRow,
  ReactionType,
  Visibility,
} from "@/lib/database.types";

export type ProfileSummary = Pick<
  ProfilesRow,
  "id" | "username" | "display_name" | "avatar_url" | "is_verified"
>;

export type FeedComment = CommentsRow & {
  profiles: ProfileSummary | null;
};

export type FeedPost = PostsRow & {
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

export type ApiPost = {
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
