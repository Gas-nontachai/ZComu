import { supabase } from "./supabase";

export async function apiFetch<TResponse = unknown>(
  input: RequestInfo,
  init: RequestInit = {}
): Promise<TResponse> {
  const headers = new Headers(init.headers ?? {});

  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  const contentType = response.headers.get("content-type") ?? "";
  let payload: unknown = null;

  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    const text = await response.text();
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    let message = response.statusText || "Unknown error";

    if (payload && typeof payload === "object") {
      if ("error" in payload && typeof payload.error === "string") {
        message = payload.error;
      } else if ("message" in payload && typeof payload.message === "string") {
        message = payload.message;
      }
    } else if (typeof payload === "string" && payload.trim().length > 0) {
      message = payload;
    }

    throw new Error(message);
  }

  return payload as TResponse;
}
