import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "stream";

// R2 configuration - lazy loaded
function getR2Config() {
  const config = {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL,
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing R2 configuration: ${missing.join(", ")}. Please set the required environment variables.`
    );
  }

  return config as {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl: string;
  };
}

// Lazy-initialized S3 client
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    const config = getR2Config();
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return r2Client;
}

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  );
}

/**
 * Generate a unique key for the image
 */
export function generateImageKey(
  productId: string,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `products/${productId}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Generate a unique key for business registration documents (uploaded before business exists)
 */
export function generateBusinessDocKey(
  userId: string,
  docType: string,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `business-docs/${userId}/${docType}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Get a presigned URL for uploading an image directly to R2
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const config = getR2Config();
  const client = getR2Client();

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
  });

  // URL expires in 10 minutes
  const signedUrl = await getSignedUrl(client, command, { expiresIn: 600 });
  return signedUrl;
}

/**
 * Get the public URL for an uploaded image
 */
export function getPublicUrl(key: string): string {
  const config = getR2Config();
  // Remove trailing slash if present
  const baseUrl = config.publicUrl.replace(/\/$/, "");
  return `${baseUrl}/${key}`;
}

/**
 * Extract R2 object key from a stored public URL (must be our R2 public URL).
 * Returns null if URL is not from our R2 bucket.
 */
export function getKeyFromPublicUrl(url: string): string | null {
  if (!isR2Configured()) return null;
  const config = getR2Config();
  const baseUrl = config.publicUrl.replace(/\/$/, "");
  try {
    const parsed = new URL(url);
    const baseParsed = new URL(baseUrl);
    if (parsed.origin !== baseParsed.origin) return null;
    const path = parsed.pathname.replace(/^\//, "");
    const basePath = baseParsed.pathname.replace(/^\//, "");
    if (basePath && !path.startsWith(basePath)) return null;
    const key = basePath ? path.slice(basePath.length).replace(/^\//, "") : path;
    return key || null;
  } catch {
    return null;
  }
}

/**
 * Delete an image from R2
 */
export async function deleteObject(key: string): Promise<void> {
  const config = getR2Config();
  const client = getR2Client();

  const command = new DeleteObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  await client.send(command);
}

/**
 * Get an object from R2 by key (for streaming to client, e.g. admin document view).
 * Returns body stream and content type.
 */
export async function getObject(key: string): Promise<{
  body: Readable;
  contentType?: string;
}> {
  const config = getR2Config();
  const client = getR2Client();

  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  const response = await client.send(command);
  const body = response.Body;
  if (!body) {
    throw new Error("Object not found or empty");
  }
  return {
    body: body as Readable,
    contentType: response.ContentType ?? undefined,
  };
}

/**
 * Validate that a file is an acceptable image type
 */
export function isValidImageType(contentType: string): boolean {
  const validTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  return validTypes.includes(contentType);
}

/**
 * Allowed MIME types for business registration documents (images + PDF).
 * Shared with client (DocumentUpload) and server (upload-url API) to stay in sync.
 */
export const ALLOWED_DOCUMENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

/**
 * Validate that a file is an acceptable document type (images + PDF) for business registration
 */
export function isValidDocumentType(contentType: string): boolean {
  return (ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(contentType);
}

/**
 * Maximum file size in bytes (5MB)
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Maximum number of images per product
 */
export const MAX_IMAGES_PER_PRODUCT = 5;
