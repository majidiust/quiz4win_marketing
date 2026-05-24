import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";
import crypto from "node:crypto";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: env.storage.region,
    endpoint: env.storage.endpoint || undefined,
    credentials: {
      accessKeyId: env.storage.accessKey,
      secretAccessKey: env.storage.secretKey,
    },
    forcePathStyle: env.storage.forcePathStyle,
  });
  return _client;
}

export function buildStorageKey(prefix: string, originalName: string): string {
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const stamp = Date.now();
  const rand = crypto.randomBytes(4).toString("hex");
  return `${prefix.replace(/^\/+|\/+$/g, "")}/${stamp}-${rand}-${safe}`;
}

export function publicUrlFor(key: string): string {
  const base = env.storage.publicUrl?.replace(/\/+$/, "");
  if (base) return `${base}/${key}`;
  const ep = env.storage.endpoint?.replace(/\/+$/, "");
  return `${ep}/${env.storage.bucket}/${key}`;
}

export async function presignUpload(key: string, contentType: string, expiresIn = 300): Promise<string> {
  const client = getClient();
  const cmd = new PutObjectCommand({
    Bucket: env.storage.bucket,
    Key: key,
    ContentType: contentType,
    ACL: "public-read",
  });
  return getSignedUrl(client, cmd, { expiresIn });
}

export async function presignDownload(key: string, expiresIn = 300): Promise<string> {
  const client = getClient();
  const cmd = new GetObjectCommand({
    Bucket: env.storage.bucket,
    Key: key,
  });
  return getSignedUrl(client, cmd, { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: env.storage.bucket, Key: key }));
}

export async function uploadBuffer(key: string, body: Buffer, contentType: string): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: env.storage.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "public-read",
    })
  );
}

export function storageConfigured(): boolean {
  return Boolean(env.storage.bucket && env.storage.accessKey && env.storage.secretKey);
}
