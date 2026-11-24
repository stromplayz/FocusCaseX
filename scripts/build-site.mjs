#!/usr/bin/env node
/**
 * Build the marketplace index.html — injects the inline lucide icon data
 * (site/icons.json, generated from lucide-react by the main repo's
 * scripts/extract-lucide-icons.mjs) into site/index.template.html.
 * The output is fully self-contained: no CDN, no external fonts.
 *
 * Usage: node scripts/build-site.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const icons = JSON.parse(readFileSync(join(ROOT, "site", "icons.json"), "utf8"));
const html = readFileSync(join(ROOT, "site", "index.template.html"), "utf8");

if (!html.includes("/*__LUCIDE_ICONS__*/")) {
  throw new Error("template placeholder /*__LUCIDE_ICONS__*/ not found");
}
const out = html.replace("/*__LUCIDE_ICONS__*/ {}", JSON.stringify(icons));
writeFileSync(join(ROOT, "index.html"), out);
console.log(`built index.html — ${Object.keys(icons).length} icons inlined, ${(Buffer.byteLength(out, "utf8") / 1024).toFixed(1)} KB`);
