import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdminSession } from "@/lib/auth-helpers";
import { deleteDealImage, getDealImageBucket, getSignedImageUrl, parseS3Url, uploadDealImage } from "@/lib/s3-presign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const MAX_UPLOAD_BYTES = Number(process.env.DEAL_IMAGE_MAX_BYTES ?? 10 * 1024 * 1024); // default 10MB
const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

const inferExtension = (file: File): string => {
  const name = file.name ?? "";
  const extFromName = name.match(/\.([A-Za-z0-9]+)$/)?.[1];
  if (extFromName) return extFromName.toLowerCase();
  const type = file.type ?? "";
  const extFromType = type.split("/")[1];
  if (extFromType) return extFromType.toLowerCase();
  return "bin";
};

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File is too large" }, { status: 400 });
  }

  if (file.type && !ALLOWED_CONTENT_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = inferExtension(file);
  const key = `deal-cases/${new Date().toISOString().split("T")[0]}-${randomUUID()}.${extension}`;
  const contentType = file.type || "application/octet-stream";

  try {
    const url = await uploadDealImage(key, buffer, contentType);
    const signedUrl = await getSignedImageUrl(url);
    return NextResponse.json({ url, signedUrl });
  } catch (error) {
    console.error("Failed to upload deal case image", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const url = body?.url as string | undefined;
  if (!url) {
    return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
  }

  const parsed = parseS3Url(url);
  if (!parsed) {
    return NextResponse.json({ error: "Not an S3 URL" }, { status: 400 });
  }

  const bucket = getDealImageBucket();
  if (parsed.bucket !== bucket) {
    return NextResponse.json({ error: "URL does not belong to the configured bucket" }, { status: 400 });
  }

  try {
    await deleteDealImage(parsed.key);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete deal case image", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}
