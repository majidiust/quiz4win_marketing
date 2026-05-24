// One-shot migration: rebuild the Content text index so its
// `language_override` no longer collides with our app's `language` field
// (ISO 639 targeting code). The default override caused inserts/updates
// with `language: "ar"` to fail with "language override unsupported: ar".
//
//   node --env-file=.env.local scripts/fix-content-text-index.mjs

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db();
const coll = db.collection("quiz4win_marketing_content");

const indexes = await coll.indexes();
const textIndex = indexes.find((i) =>
  Object.values(i.key || {}).some((v) => v === "text")
);

if (textIndex) {
  console.log(`Dropping existing text index: ${textIndex.name}`);
  await coll.dropIndex(textIndex.name);
} else {
  console.log("No existing text index found.");
}

console.log("Creating new text index with language_override: _textLanguage");
await coll.createIndex(
  { title: "text", caption: "text", campaignName: "text" },
  {
    name: "content_text_index",
    default_language: "none",
    language_override: "_textLanguage",
  }
);

const after = await coll.indexes();
const ours = after.find((i) => i.name === "content_text_index");
console.log("Active text index:", JSON.stringify(ours, null, 2));

await client.close();
console.log("Done. Documents with language: 'ar' (and any other ISO code) will now insert.");
