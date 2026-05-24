<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Reserved field names in Mongoose schemas

MongoDB and Mongoose assign a special meaning to certain document field names. Using them as plain application fields will eventually blow up at runtime — not at insert, but when the offending value finally arrives.

- `language` — MongoDB text indexes treat it as a per-document stemmer override. Any value the stemmer cannot load (`ar`, `fa`, `tr`, …) makes the write fail with error 17262 "language override unsupported". Every text index on a collection that has, or might one day have, a `language` field MUST be declared with `language_override: "_textLanguage"` and `default_language: "none"`.
- `score` — clashes with `$meta: "textScore"` projections when paired with `$text` search.
- Mongoose-reserved Document paths: `collection`, `schema`, `db`, `errors`, `isNew`, `save`, `remove`, `init`, `on`, `emit`, `toObject`, `toJSON`, `model`. These shadow Document methods and silently break population, hooks, or serialisation.

Run `npm run audit:schemas` after editing anything under `models/`. The audit is also wired so future text indexes declared without `language_override` are flagged.

When you change a text index in a model file, also append the migration entry to `scripts/fix-text-indexes.mjs` so the live database picks up the new options on the next deploy. Mongoose cannot mutate an existing index's options in place; the script drops and recreates.
