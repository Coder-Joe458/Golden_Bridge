import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type ParsedS3Url =
  | {
      bucket: string;
      key: string;
    }
  | null;

const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const hasS3Credentials = Boolean(region && accessKeyId && secretAccessKey);

const s3Client = hasS3Credentials
  ? new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    })
  : null;

const SIGNED_URL_TTL_SECONDS = (() => {
  const raw = process.env.DEAL_IMAGE_SIGNED_URL_TTL ?? process.env.S3_SIGNED_URL_TTL;
  if (!raw) return 3600;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 60 * 60 * 24) : 3600;
})();

const parseS3Url = (input: string): ParsedS3Url => {
  try {
    const url = new URL(input);
    const { hostname, pathname } = url;
    const key = pathname.startsWith("/") ? pathname.slice(1) : pathname;

    // Virtual-hosted-style: bucket.s3.region.amazonaws.com
    const virtualHostMatch = hostname.match(/^(.+)\.s3(?:[.-]([a-z0-9-]+))?\.amazonaws\.com$/i);
    if (virtualHostMatch) {
      return {
        bucket: virtualHostMatch[1],
        key
      };
    }

    // Path-style: s3.region.amazonaws.com/bucket/key or s3.amazonaws.com/bucket/key
    const pathHostMatch = hostname.match(/^s3(?:[.-]([a-z0-9-]+))?\.amazonaws\.com$/i);
    if (pathHostMatch) {
      const [bucket, ...rest] = key.split("/");
      if (!bucket || rest.length === 0) {
        return null;
      }
      return {
        bucket,
        key: rest.join("/")
      };
    }
  } catch {
    return null;
  }

  return null;
};

export const getSignedImageUrl = async (url: string): Promise<string> => {
  if (!s3Client) {
    return url;
  }

  const parsed = parseS3Url(url);
  if (!parsed) {
    return url;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key
    });
    return await getSignedUrl(s3Client, command, { expiresIn: SIGNED_URL_TTL_SECONDS });
  } catch (error) {
    console.error("Failed to presign S3 object", { url, error });
    return url;
  }
};

