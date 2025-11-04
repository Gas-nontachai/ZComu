"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error";
import type { ProfilesRow } from "@/lib/database.types";

export type EditableProfile = Pick<
  ProfilesRow,
  "display_name" | "username" | "bio" | "avatar_url" | "cover_url"
>;

export function useProfilePage() {
  const { profile, refreshProfile, user } = useAuth();
  const [values, setValues] = useState<EditableProfile>({
    display_name: "",
    username: "",
    bio: "",
    avatar_url: null,
    cover_url: null,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setValues({
        display_name: profile.display_name ?? "",
        username: profile.username ?? "",
        bio: profile.bio ?? "",
        avatar_url: profile.avatar_url,
        cover_url: profile.cover_url,
      });
    }
  }, [profile]);

  const updateField = (
    field: keyof EditableProfile,
    value: EditableProfile[keyof EditableProfile]
  ) => {
    setValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const performUpload = async (
    file: File,
    purpose: "avatar" | "cover",
    field: keyof EditableProfile
  ) => {
    const meta = await apiFetch<{
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
        purpose,
      }),
    });

    const uploadResponse = await fetch(meta.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error("Upload failed");
    }

    const fileUrl = meta.file_url ?? meta.public_url ?? null;
    await apiFetch("/api/profiles/me", {
      method: "PATCH",
      body: JSON.stringify({
        [field]: fileUrl,
      }),
    });

    await refreshProfile();
  };

  const handleAvatarChange = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    updateField("avatar_url", previewUrl);
    setAvatarUploading(true);
    setStatus(null);
    setError(null);
    try {
      await performUpload(file, "avatar", "avatar_url");
      setStatus("Image updated successfully.");
    } catch (uploadError: unknown) {
      setError(getErrorMessage(uploadError, "Failed to upload image"));
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleCoverChange = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    updateField("cover_url", previewUrl);
    setCoverUploading(true);
    setStatus(null);
    setError(null);
    try {
      await performUpload(file, "cover", "cover_url");
      setStatus("Image updated successfully.");
    } catch (uploadError: unknown) {
      setError(getErrorMessage(uploadError, "Failed to upload image"));
    } finally {
      setCoverUploading(false);
    }
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setError(null);
    setSaving(true);
    try {
      await apiFetch<{ profile: ProfilesRow }>("/api/profiles/me", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: values.display_name,
          username: values.username,
          bio: values.bio,
          avatar_url: values.avatar_url,
          cover_url: values.cover_url,
        }),
      });
      await refreshProfile();
      setStatus("Profile updated successfully.");
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, "Failed to save profile"));
    } finally {
      setSaving(false);
    }
  };

  const canSave =
    values.display_name.trim().length > 0 &&
    values.username.trim().length > 0 &&
    !saving;

  return {
    avatarUploading,
    canSave,
    coverUploading,
    error,
    handleAvatarChange,
    handleCoverChange,
    handleSave,
    profile,
    saving,
    status,
    updateField,
    user,
    values,
  };
}
