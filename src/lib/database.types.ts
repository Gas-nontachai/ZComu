export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Visibility = "public" | "friends" | "private";
export type ReactionType = "like" | "love" | "haha" | "sad";
export type StoragePurpose = "avatar" | "cover" | "post" | "other";

export interface ProfilesRow {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_verified: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ProfilesInsert {
  id: string;
  username?: string | null;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  is_verified?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProfilesUpdate {
  username?: string | null;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  is_verified?: boolean | null;
  updated_at?: string;
}

export interface PostsRow {
  id: string;
  user_id: string;
  content: string | null;
  visibility: Visibility;
  edited: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface PostsInsert {
  id?: string;
  user_id: string;
  content?: string | null;
  visibility?: Visibility;
  edited?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export interface PostsUpdate {
  content?: string | null;
  visibility?: Visibility;
  edited?: boolean | null;
  updated_at?: string;
}

export interface PostMediaRow {
  id: string;
  post_id: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  storage_bucket: string | null;
  created_at: string;
}

export interface PostMediaInsert {
  id?: string;
  post_id: string;
  file_url: string;
  file_type?: string | null;
  file_size?: number | null;
  storage_bucket?: string | null;
  created_at?: string;
}

export interface PostMediaUpdate {
  file_url?: string;
  file_type?: string | null;
  file_size?: number | null;
  storage_bucket?: string | null;
}

export interface CommentsRow {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  parent_id: string | null;
  created_at: string;
}

export interface CommentsInsert {
  id?: string;
  post_id: string;
  user_id: string;
  text: string;
  parent_id?: string | null;
  created_at?: string;
}

export interface CommentsUpdate {
  text?: string;
  parent_id?: string | null;
}

export interface LikesRow {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: string | null;
  created_at: string;
}

export interface LikesInsert {
  id?: string;
  post_id: string;
  user_id: string;
  reaction_type?: string | null;
  created_at?: string;
}

export interface LikesUpdate {
  reaction_type?: ReactionType | null;
}

export interface StorageFilesRow {
  id: string;
  user_id: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  bucket_name: string | null;
  purpose: StoragePurpose;
  created_at: string;
}

export interface StorageFilesInsert {
  id?: string;
  user_id: string;
  file_url: string;
  file_type?: string | null;
  file_size?: number | null;
  bucket_name?: string | null;
  purpose?: StoragePurpose;
  created_at?: string;
}

export interface StorageFilesUpdate {
  file_url?: string;
  file_type?: string | null;
  file_size?: number | null;
  bucket_name?: string | null;
  purpose?: StoragePurpose;
}

export interface ActivitiesRow {
  id: string;
  actor_id: string | null;
  target_id: string | null;
  action: string;
  metadata: Json | null;
  created_at: string;
}

export interface ActivitiesInsert {
  id?: string;
  actor_id?: string | null;
  target_id?: string | null;
  action: string;
  metadata?: Json | null;
  created_at?: string;
}

export interface ActivitiesUpdate {
  actor_id?: string | null;
  target_id?: string | null;
  action?: string;
  metadata?: Json | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfilesRow;
        Insert: ProfilesInsert;
        Update: ProfilesUpdate;
      };
      posts: {
        Row: PostsRow;
        Insert: PostsInsert;
        Update: PostsUpdate;
      };
      post_media: {
        Row: PostMediaRow;
        Insert: PostMediaInsert;
        Update: PostMediaUpdate;
      };
      comments: {
        Row: CommentsRow;
        Insert: CommentsInsert;
        Update: CommentsUpdate;
      };
      likes: {
        Row: LikesRow;
        Insert: LikesInsert;
        Update: LikesUpdate;
      };
      storage_files: {
        Row: StorageFilesRow;
        Insert: StorageFilesInsert;
        Update: StorageFilesUpdate;
      };
      activities: {
        Row: ActivitiesRow;
        Insert: ActivitiesInsert;
        Update: ActivitiesUpdate;
      };
    };
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
    CompositeTypes: Record<string, unknown>;
  };
}

