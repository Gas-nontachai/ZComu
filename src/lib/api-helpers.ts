import { NextRequest, NextResponse } from "next/server";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getAccessTokenFromRequest(request: NextRequest): string {
  const header =
    request.headers.get("authorization") ??
    request.headers.get("Authorization") ??
    "";

  if (!header.startsWith("Bearer ")) {
    throw new HttpError(401, "Authorization header is required");
  }

  return header.slice(7);
}

export function badRequest(message: string) {
  throw new HttpError(400, message);
}

export function handleRouteError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }

  console.error(error);
  return NextResponse.json(
    { error: "Something went wrong" },
    { status: 500 }
  );
}
