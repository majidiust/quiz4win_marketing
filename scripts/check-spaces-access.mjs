// Quick diagnostic: prove which calls the configured Spaces key can make.
//   node --env-file=.env.local scripts/check-spaces-access.mjs

import {
  S3Client,
  ListBucketsCommand,
  HeadBucketCommand,
  GetBucketCorsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const endpoint = process.env.STORAGE_ENDPOINT;
const region = process.env.STORAGE_REGION || "us-east-1";
const bucket = process.env.STORAGE_BUCKET;
const accessKeyId = process.env.STORAGE_ACCESS_KEY;
const secretAccessKey = process.env.STORAGE_SECRET_KEY;

const client = new S3Client({
  region,
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

async function tryCall(name, fn) {
  try {
    const out = await fn();
    console.log(`OK   ${name}`);
    return out;
  } catch (err) {
    console.log(`FAIL ${name}: ${err.Code || err.name} - ${err.message}`);
    return null;
  }
}

console.log(`Endpoint: ${endpoint} / region ${region} / bucket ${bucket}`);

const list = await tryCall("ListBuckets", () => client.send(new ListBucketsCommand({})));
if (list?.Buckets) {
  console.log("  Visible buckets:", list.Buckets.map((b) => b.Name).join(", "));
}

await tryCall("HeadBucket", () => client.send(new HeadBucketCommand({ Bucket: bucket })));

const cors = await tryCall("GetBucketCors", () =>
  client.send(new GetBucketCorsCommand({ Bucket: bucket }))
);
if (cors?.CORSRules) {
  console.log("  Existing CORS:", JSON.stringify(cors.CORSRules, null, 2));
}

await tryCall("PutObject (drafts/_cors-probe.txt)", () =>
  client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: "drafts/_cors-probe.txt",
      Body: "probe",
      ContentType: "text/plain",
    })
  )
);
