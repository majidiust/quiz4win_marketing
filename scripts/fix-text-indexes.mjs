// Idempotent migration: rebuild every text index in the database so the
// per-document `language` stemming override never collides with our app
// fields. Runs the same drop+create pass for every collection listed below.
//
// Why: MongoDB text indexes interpret a document field literally named
// `language` as the stemmer override and reject codes the stemmer cannot
// load (error 17262 "language override unsupported: ar"). We always want
// language_override to point at a field that never exists so any future
// addition of a `language` field stays inert.
//
//   node --env-file=.env.local scripts/fix-text-indexes.mjs
//
// Safe to re-run: drops the existing text index on each collection (if any)
// and recreates it with the canonical options.

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

// Keep this list in sync with models/*.ts text index declarations.
const TEXT_INDEXES = [
  {
    collection: "quiz4win_marketing_content",
    name: "content_text_index",
    fields: { title: "text", caption: "text", campaignName: "text" },
  },
  {
    collection: "quiz4win_marketing_projects",
    name: "project_text_index",
    fields: { projectName: "text", description: "text" },
  },
];

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

let touched = 0;
for (const spec of TEXT_INDEXES) {
  const coll = db.collection(spec.collection);
  const indexes = await coll.indexes();
  const existing = indexes.find((i) => Object.values(i.key || {}).some((v) => v === "text"));
  if (existing) {
    console.log(`[${spec.collection}] dropping ${existing.name}`);
    await coll.dropIndex(existing.name);
  } else {
    console.log(`[${spec.collection}] no existing text index`);
  }
  console.log(`[${spec.collection}] creating ${spec.name}`);
  await coll.createIndex(spec.fields, {
    name: spec.name,
    default_language: "none",
    language_override: "_textLanguage",
  });
  touched += 1;
}

await client.close();
console.log(`Done. Rebuilt ${touched} text index(es).`);
