// End-to-end check that a presigned PUT works against the bucket.
//   node --env-file=.env.local scripts/test-presigned-put.mjs
//
// Generates a presigned URL using the same options the app uses, then PUTs
// a small payload to it from Node (bypassing CORS, which only affects
// browsers). If this succeeds, the signature/checksum config is correct.

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.STORAGE_ENDPOINT;
const region = process.env.STORAGE_REGION || "us-east-1";
const bucket = process.env.STORAGE_BUCKET;

const client = new S3Client({
  region,
  endpoint,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY,
    secretAccessKey: process.env.STORAGE_SECRET_KEY,
  },
  forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const key = `drafts/_signing-probe-${Date.now()}.txt`;
const contentType = "text/plain";

const url = await getSignedUrl(
  client,
  new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ACL: "public-read",
  }),
  { expiresIn: 300 }
);

const hasChecksum = url.includes("x-amz-checksum-") || url.includes("x-amz-sdk-checksum-algorithm");
console.log("Presigned URL generated.");
console.log("  contains checksum params?", hasChecksum ? "YES (bug still present)" : "no");
console.log("  signed headers:", new URL(url).searchParams.get("X-Amz-SignedHeaders"));

const res = await fetch(url, {
  method: "PUT",
  headers: { "Content-Type": contentType },
  body: "presign-probe",
});

console.log("PUT status:", res.status, res.statusText);
if (!res.ok) {
  console.log("  body:", (await res.text()).slice(0, 400));
  process.exit(1);
}

await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
console.log("Cleanup OK. Presigned uploads work end-to-end (server-side).");
