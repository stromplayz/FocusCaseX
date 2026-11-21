/**
 * FocusCaseX-Marketplace — repo validator.
 * Fails the run when any JSON file is malformed or when the published
 * registry / core contracts are broken. Run: node .github/scripts/validate.mjs
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const errors = [];
let files = 0;

function fail(msg) {
  errors.push(msg);
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function validateJson(rel) {
  const text = await readFile(path.join(ROOT, rel), "utf8");
  try {
    JSON.parse(text);
    files += 1;
  } catch (err) {
    fail(`${rel}: malformed JSON — ${err.message}`);
  }
}

async function walkJson(dir) {
  let entries;
  try {
    entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) await walkJson(rel);
    else if (entry.name.endsWith(".json")) await validateJson(rel);
  }
}

/* every *.json in the repo must parse */
await walkJson("api");
await walkJson("themes");
await walkJson("plugins");

/* plugin manifests must carry the minimal fields */
const pluginsDir = path.join(ROOT, "plugins");
try {
  for (const entry of await readdir(pluginsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const rel = path.posix.join("plugins", entry.name, "manifest.json");
    let manifest;
    try {
      manifest = JSON.parse(await readFile(path.join(ROOT, rel), "utf8"));
    } catch (err) {
      fail(`${rel}: unreadable manifest — ${err.message}`);
      continue;
    }
    for (const field of ["id", "name", "version", "description", "author"]) {
      if (typeof manifest[field] !== "string" || manifest[field] === "") {
        fail(`${rel}: missing or empty "${field}"`);
      }
    }
  }
} catch {
  /* no plugins dir — fine */
}

/* registry contract */
let registry = null;
try {
  registry = JSON.parse(await readFile(path.join(ROOT, "api", "registry.json"), "utf8"));
  if (registry.schema !== "fcx.market.registry.v1") fail("api/registry.json: schema must be fcx.market.registry.v1");
  if (!Array.isArray(registry.items) || registry.items.length === 0) {
    fail("api/registry.json: items[] must be a non-empty array");
  } else {
    const ids = new Set();
    for (const item of registry.items) {
      const at = `item ${item.id ?? "(no id)"}`;
      for (const field of ["id", "kind", "name", "tagline", "description", "author", "version", "category"]) {
        if (typeof item[field] !== "string" || item[field] === "") fail(`api/registry.json: ${at} missing "${field}"`);
      }
      if (!["capsule", "plugin", "theme", "template"].includes(item.kind)) {
        fail(`api/registry.json: ${at} unknown kind "${item.kind}"`);
      }
      if (!Array.isArray(item.tags)) fail(`api/registry.json: ${at} tags must be an array`);
      if (ids.has(item.id)) fail(`api/registry.json: duplicate id "${item.id}"`);
      ids.add(item.id);
      if (isPlainObject(item.files)) {
        for (const [key, rel] of Object.entries(item.files)) {
          if (typeof rel !== "string" || rel === "") {
            fail(`api/registry.json: ${at} files.${key} must be a non-empty path`);
            continue;
          }
          try {
            await readFile(path.join(ROOT, rel), "utf8");
          } catch {
            fail(`api/registry.json: ${at} files.${key} → "${rel}" does not exist in the repo`);
          }
        }
      }
    }
  }
  if (!isPlainObject(registry.counts)) fail("api/registry.json: counts must be an object");
} catch (err) {
  fail(`api/registry.json: unreadable — ${err.message}`);
}

/* core contract */
try {
  const core = JSON.parse(await readFile(path.join(ROOT, "api", "core.json"), "utf8"));
  if (core.schema !== "fcx.market.core.v1") fail("api/core.json: schema must be fcx.market.core.v1");
  for (const field of ["version", "minAppVersion"]) {
    if (typeof core[field] !== "string" || core[field] === "") fail(`api/core.json: missing "${field}"`);
  }
  if (!isPlainObject(core.flags)) fail("api/core.json: flags must be an object");
  if (core.announcement != null && !isPlainObject(core.announcement)) {
    fail("api/core.json: announcement must be an object or null");
  } else if (isPlainObject(core.announcement)) {
    for (const field of ["id", "title", "body"]) {
      if (typeof core.announcement[field] !== "string" || core.announcement[field] === "") {
        fail(`api/core.json: announcement missing "${field}"`);
      }
    }
  }
  if (registry && typeof registry.coreVersion === "string" && typeof core.version === "string") {
    if (registry.coreVersion !== core.version) {
      fail(`core version mismatch — registry says ${registry.coreVersion}, core.json says ${core.version}`);
    }
  }
} catch (err) {
  fail(`api/core.json: unreadable — ${err.message}`);
}

/* landing page must exist */
try {
  await readFile(path.join(ROOT, "index.html"), "utf8");
} catch {
  fail("index.html: missing — the Pages site needs it");
}

if (errors.length > 0) {
  console.error(`✗ marketplace validation failed (${errors.length} problem${errors.length === 1 ? "" : "s"}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`✓ marketplace validation passed — ${files} JSON files, ${registry ? registry.items.length : 0} registry items`);
