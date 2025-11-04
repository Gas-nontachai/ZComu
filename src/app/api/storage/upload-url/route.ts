import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAccessTokenFromRequest,
  handleRouteError,
  HttpError,
} from "@/lib/api-helpers";
import {
  createRouteSupabaseClient,
  createServiceSupabaseClient,
} from "@/lib/supabase-server";
import type { StoragePurpose } from "@/lib/database.types";

type UploadUrlPayload = {
  file_name?: string;
  bucket_name?: string;
  file_size?: number;
  file_type?: string | null;
  purpose?: StoragePurpose;
  is_public?: boolean;
};

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getAccessTokenFromRequest(request);
    const userClient = createRouteSupabaseClient(accessToken);
    const serviceClient = createServiceSupabaseClient();
    const payload = (await request.json()) as UploadUrlPayload;

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(accessToken);

    if (userError || !user) {
      throw new HttpError(401, "Unable to resolve current user");
    }

    const fileName = payload.file_name?.trim();
    if (!fileName) {
      badRequest("file_name is required");
    }

    const bucketName = payload.bucket_name ?? "public";
    const sanitizedFileName = sanitizeFileName(fileName);
    const filePath = `${user.id}/${Date.now()}-${randomUUID()}-${sanitizedFileName}`;

    const { data: signedUrl, error: signedUrlError } =
      await serviceClient.storage
        .from(bucketName)
        .createSignedUploadUrl(filePath);

    if (signedUrlError || !signedUrl) {
      throw signedUrlError ?? new Error("Unable to create signed upload url");
    }

    const { data: publicUrl } = serviceClient.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    const fallbackUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;
    const fileUrl = publicUrl?.publicUrl ?? fallbackUrl;

    const { error: storageInsertError } = await serviceClient
      .from("storage_files")
      .insert({
        user_id: user.id,
        file_url: fileUrl,
        file_type: payload.file_type ?? null,
        file_size: payload.file_size ?? null,
        bucket_name: bucketName,
        purpose: payload.purpose ?? "other",
      });

    if (storageInsertError) {
      throw storageInsertError;
    }

    return NextResponse.json({
      path: filePath,
      upload_url: signedUrl.signedUrl,
      token: signedUrl.token,
      bucket: bucketName,
      public_url: publicUrl?.publicUrl ?? null,
      file_url: fileUrl,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
