"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error";
import type { ProfilesRow } from "@/lib/database.types";

type EditableProfile = Pick<
  ProfilesRow,
  "display_name" | "username" | "bio" | "avatar_url" | "cover_url"
>;

export default function ProfilePage() {
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

  const uploadImage = async (
    file: File,
    purpose: "avatar" | "cover",
    setUploading: (value: boolean) => void,
    field: keyof EditableProfile
  ) => {
    setUploading(true);
    setStatus(null);
    setError(null);
    try {
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
      setStatus("Image updated successfully.");
    } catch (uploadError: unknown) {
      setError(getErrorMessage(uploadError, "Failed to upload image"));
    } finally {
      setUploading(false);
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

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <div className="relative h-52 bg-slate-900">
            {values.cover_url && (
              <Image
                src={values.cover_url}
                alt="Cover image"
                fill
                sizes="100vw"
                className="object-cover"
              />
            )}
            <label className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-medium text-white shadow transition hover:border-white/30 hover:bg-black/80">
              {coverUploading ? "Uploading…" : "Change cover"}
              <Input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={coverUploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    uploadImage(file, "cover", setCoverUploading, "cover_url");
                    updateField("cover_url", URL.createObjectURL(file));
                  }
                }}
              />
            </label>
          </div>
          <div className="relative px-8 pb-10">
            <div className="-mt-16 flex items-end gap-6">
              <div className="relative">
                <Avatar className="size-32 border-4 border-slate-950">
                  {values.avatar_url ? (
                    <AvatarImage src={values.avatar_url} alt="Avatar" />
                  ) : (
                    <AvatarFallback className="text-2xl">
                      {(profile?.display_name ?? user?.email ?? "U")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <label className="absolute -right-2 bottom-2 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-xs text-white shadow transition hover:border-white/30 hover:bg-black/90">
                  {avatarUploading ? "Uploading…" : "Change"}
                  <Input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={avatarUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        uploadImage(
                          file,
                          "avatar",
                          setAvatarUploading,
                          "avatar_url"
                        );
                        updateField("avatar_url", URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-semibold">
                  {profile?.display_name ?? "Your name"}
                </h1>
                <p className="text-sm text-slate-300">
                  @{profile?.username ?? "username"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSave}
          className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Display name
              </label>
              <Input
                value={values.display_name}
                onChange={(event) => updateField("display_name", event.target.value)}
                placeholder="How should people address you?"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Username
              </label>
              <Input
                value={values.username}
                onChange={(event) => updateField("username", event.target.value)}
                placeholder="Unique handle"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Bio</label>
            <Textarea
              value={values.bio ?? ""}
              onChange={(event) => updateField("bio", event.target.value)}
              rows={4}
              placeholder="Tell the community a little bit about yourself."
            />
          </div>
          {error && (
            <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}
          {status && (
            <p className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              {status}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button type="submit" disabled={!canSave}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
