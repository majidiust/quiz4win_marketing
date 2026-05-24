// End-to-end probe of the wizard's flow:
//   1. presigned PUT a small image
//   2. presigned GET it back (what the preview <Image> will do)
//   3. delete the test object
//
//   node --env-file=.env.local scripts/test-upload-then-display.mjs

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({
  region: process.env.STORAGE_REGION,
  endpoint: process.env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY,
    secretAccessKey: process.env.STORAGE_SECRET_KEY,
  },
  forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const bucket = process.env.STORAGE_BUCKET;
const key = `drafts/_e2e-${Date.now()}.png`;
// 1x1 transparent PNG
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=",
  "base64"
);

const putUrl = await getSignedUrl(
  client,
  new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: "image/png", ACL: "public-read" }),
  { expiresIn: 300 }
);
console.log("PUT URL signed headers:", new URL(putUrl).searchParams.get("X-Amz-SignedHeaders"));
const putRes = await fetch(putUrl, {
  method: "PUT",
  headers: { "Content-Type": "image/png" },
  body: png,
});
console.log("PUT result:", putRes.status, putRes.statusText);
if (!putRes.ok) {
  console.log(await putRes.text());
  process.exit(1);
}

const getUrl = await getSignedUrl(
  client,
  new GetObjectCommand({ Bucket: bucket, Key: key }),
  { expiresIn: 300 }
);
const getRes = await fetch(getUrl);
console.log("GET (signed) result:", getRes.status, "content-type:", getRes.headers.get("content-type"));

// Try without signing — proves whether the bucket is actually public.
const publicUrl = `https://${bucket}.${process.env.STORAGE_REGION}.digitaloceanspaces.com/${key}`;
const publicRes = await fetch(publicUrl);
console.log(`GET (public) ${publicUrl}:`, publicRes.status);

await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
console.log("Cleanup OK.");
