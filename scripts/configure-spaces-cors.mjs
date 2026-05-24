// Apply CORS rules to the S3-compatible bucket so the dashboard can
// PUT files directly from the browser via presigned URLs.
//
// Run once whenever the allowed origins change:
//   node --env-file=.env.local scripts/configure-spaces-cors.mjs
//
// Required env vars (already used by the app):
//   STORAGE_ENDPOINT, STORAGE_REGION, STORAGE_BUCKET,
//   STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY
//
// Optional:
//   STORAGE_FORCE_PATH_STYLE  ("true" / "false")
//   CORS_ALLOWED_ORIGINS      comma-separated; defaults to the app URL
//                             plus localhost dev origins.

import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";

const endpoint = process.env.STORAGE_ENDPOINT;
const region = process.env.STORAGE_REGION || "us-east-1";
const bucket = process.env.STORAGE_BUCKET;
const accessKeyId = process.env.STORAGE_ACCESS_KEY;
const secretAccessKey = process.env.STORAGE_SECRET_KEY;

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  console.error(
    "Missing storage env vars (STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY)."
  );
  process.exit(1);
}

const defaultOrigins = [
  process.env.NEXT_PUBLIC_APP_URL || "https://marketing.quiz4win.com",
  "http://localhost:3000",
  "http://localhost:5806",
];

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",")
  : defaultOrigins
)
  .map((o) => o.trim())
  .filter(Boolean);

const client = new S3Client({
  region,
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const corsConfig = {
  Bucket: bucket,
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedOrigins: allowedOrigins,
        AllowedMethods: ["GET", "PUT", "POST", "HEAD", "DELETE"],
        AllowedHeaders: ["*"],
        ExposeHeaders: ["ETag", "x-amz-request-id", "x-amz-version-id"],
        MaxAgeSeconds: 3000,
      },
    ],
  },
};

console.log(`Applying CORS to bucket "${bucket}" at ${endpoint}`);
console.log("Allowed origins:");
for (const o of allowedOrigins) console.log("  -", o);

try {
  await client.send(new PutBucketCorsCommand(corsConfig));
  console.log("\nCORS configuration applied.");
} catch (err) {
  console.error("\nFailed to apply CORS:", err.message || err);
  process.exit(1);
}

try {
  const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log("\nActive CORS rules:");
  console.log(JSON.stringify(current.CORSRules, null, 2));
} catch (err) {
  console.warn("Could not read back CORS rules:", err.message || err);
}
