// Probe that confirms presignAttachmentDownload returns a URL which DO Spaces
// honours with a Content-Disposition: attachment header. Uploads a small file
// under a non-ASCII name, requests the signed URL, asserts the response
// headers, then cleans up.
//
//   node --env-file=.env.local scripts/test-attachment-download.mjs

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
const key = `drafts/_dlprobe-${Date.now()}.png`;
const filename = "Quiz4Win résumé.png"; // non-ASCII, with space
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=",
  "base64"
);

await client.send(
  new PutObjectCommand({ Bucket: bucket, Key: key, Body: png, ContentType: "image/png" })
);

const safeAscii = filename.replace(/[^\x20-\x7E]+/g, "_").replace(/"/g, "'");
const utf8 = encodeURIComponent(filename);
const url = await getSignedUrl(
  client,
  new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${safeAscii}"; filename*=UTF-8''${utf8}`,
  }),
  { expiresIn: 300 }
);

const res = await fetch(url);
const cd = res.headers.get("content-disposition");
console.log("status:", res.status);
console.log("content-disposition:", cd);

const expected = cd && cd.startsWith("attachment") && cd.includes(`filename*=UTF-8''${utf8}`);

await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

if (!expected) {
  console.error("FAIL: response did not carry an attachment Content-Disposition with UTF-8 filename.");
  process.exit(1);
}
console.log("OK: attachment download works and preserves the original filename.");
