// Static audit of every Mongoose model under models/. Catches the
// class of bug we hit with `language` colliding with MongoDB text-index
// stemming overrides, and a few related foot-guns. Run on demand and from
// CI so a new schema cannot reintroduce the same trap.
//
//   node scripts/audit-schemas.mjs
//
// Exit code 0 = clean, 1 = one or more findings.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MODELS_DIR = join(process.cwd(), "models");

// Field names that MongoDB or Mongoose assigns a special meaning to. Using
// any of them as a plain document field invites a future runtime collision.
// Keep the value short and link the explanation in the report.
const RESERVED_FIELDS = {
  language: "MongoDB text-index stemming override (error 17262 on unknown codes)",
  score: "Clashes with $meta: 'textScore' projection when paired with $text search",
  // Mongoose-reserved schema paths that shadow Document methods.
  collection: "Mongoose Document method",
  schema: "Mongoose Document method",
  db: "Mongoose Document method",
  errors: "Mongoose Document property",
  isNew: "Mongoose Document property",
  save: "Mongoose Document method",
  remove: "Mongoose Document method",
  init: "Mongoose Document method",
  on: "Mongoose Document method",
  emit: "Mongoose Document method",
  toObject: "Mongoose Document method",
  toJSON: "Mongoose Document method",
  model: "Mongoose Document method",
};

const findings = [];

function report(file, line, severity, message) {
  findings.push({ file, line, severity, message });
}

function lineOf(source, needle, startIndex = 0) {
  const at = source.indexOf(needle, startIndex);
  if (at < 0) return { line: 0, index: -1 };
  return { line: source.slice(0, at).split("\n").length, index: at };
}

const files = readdirSync(MODELS_DIR)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => join(MODELS_DIR, f));

for (const path of files) {
  const src = readFileSync(path, "utf8");
  const rel = path.replace(`${process.cwd()}/`, "");

  // Find schema field declarations of the form `  fieldName: {`. This is
  // a deliberately shallow heuristic; complex nested schemas are reviewed
  // by hand.
  const fieldRe = /^\s{2,}([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*\{[^}]*type\s*:/gm;
  const declaredFields = new Set();
  let match;
  while ((match = fieldRe.exec(src))) {
    const name = match[1];
    declaredFields.add(name);
    if (RESERVED_FIELDS[name]) {
      const line = src.slice(0, match.index).split("\n").length;
      const sev = name === "language" ? "WARN" : "INFO";
      report(rel, line, sev, `Field '${name}' is reserved: ${RESERVED_FIELDS[name]}`);
    }
  }

  // Text index declarations. They MUST set `language_override` if the
  // schema declares a `language` field today, and SHOULD set it
  // prophylactically in all cases.
  const indexRe = /\.index\(\s*\{[^}]*"text"[^}]*\}\s*(?:,\s*(\{[\s\S]*?\}))?\s*\)/g;
  while ((match = indexRe.exec(src))) {
    const optsBlock = match[1] || "";
    const startLine = src.slice(0, match.index).split("\n").length;
    const hasOverride = /language_override\s*:/.test(optsBlock);
    const hasDefault = /default_language\s*:/.test(optsBlock);
    if (!hasOverride) {
      const sev = declaredFields.has("language") ? "ERROR" : "WARN";
      report(
        rel,
        startLine,
        sev,
        "Text index missing language_override; a document field named 'language' will be misinterpreted as a stemmer hint."
      );
    }
    if (!hasDefault) {
      report(
        rel,
        startLine,
        "INFO",
        "Text index has no default_language; queries against multilingual data will use the 'english' stemmer."
      );
    }
  }
}

// Format and report.
const order = { ERROR: 0, WARN: 1, INFO: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.file.localeCompare(b.file));

if (!findings.length) {
  console.log("Schema audit clean.");
  process.exit(0);
}

let errors = 0;
for (const f of findings) {
  if (f.severity === "ERROR") errors += 1;
  const tag = f.severity.padEnd(5);
  console.log(`${tag} ${f.file}:${f.line}  ${f.message}`);
}

console.log("");
console.log(
  `${findings.length} finding(s): ${findings.filter((f) => f.severity === "ERROR").length} ERROR, ${findings.filter((f) => f.severity === "WARN").length} WARN, ${findings.filter((f) => f.severity === "INFO").length} INFO`
);

process.exit(errors ? 1 : 0);
