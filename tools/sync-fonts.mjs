#!/usr/bin/env node
// sync-fonts.mjs — maintainer tool. Copies the Thai-subset WOFF2 files that
// skills/url-to-ads/thai-fonts.json needs from tools/node_modules/@fontsource/* into
// skills/url-to-ads/fonts/, plus each family's OFL license. The skill ships these
// files so a user's install works offline and never fetches Google Fonts.
//
// Lives in tools/ with its own package.json so the repo root (the Claude Code plugin) has none:
// a root package.json makes the plugin installer run npm install for every user.
//
//   cd tools && npm install && npm run sync-fonts

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(toolsDir, "..");
const skillDir = join(root, "skills/url-to-ads");
const config = JSON.parse(readFileSync(join(skillDir, "thai-fonts.json"), "utf8"));
const outDir = join(skillDir, "fonts");

const slug = (family) => family.toLowerCase().replace(/\s+/g, "-");
const fileName = (family, weight) => `${family.replace(/\s+/g, "")}-Thai-${weight}.woff2`;

// family → set of weights across every preset and role
const need = new Map();
for (const roles of Object.values(config.presets))
  for (const { family, weights } of Object.values(roles)) {
    if (!need.has(family)) need.set(family, new Set());
    for (const w of weights) need.get(family).add(w);
  }

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "licenses"), { recursive: true });

let count = 0;
for (const [family, weights] of need) {
  const pkg = join(toolsDir, "node_modules/@fontsource", slug(family));
  if (!existsSync(pkg)) throw new Error(`missing @fontsource/${slug(family)} — run npm install`);
  const ranges = JSON.parse(readFileSync(join(pkg, "unicode.json"), "utf8"));
  if (ranges.thai !== config.unicodeRange)
    throw new Error(`${family}: thai unicode-range differs from thai-fonts.json`);
  for (const w of [...weights].sort()) {
    const src = join(pkg, "files", `${slug(family)}-thai-${w}-normal.woff2`);
    if (!existsSync(src)) throw new Error(`${family} has no Thai weight ${w}`);
    copyFileSync(src, join(outDir, fileName(family, w)));
    count++;
  }
  copyFileSync(join(pkg, "LICENSE"), join(outDir, "licenses", `${family.replace(/\s+/g, "")}-OFL.txt`));
}

console.log(`synced ${count} Thai font file(s) for ${need.size} families → ${outDir}`);
console.log(readdirSync(outDir).filter((f) => f.endsWith(".woff2")).join("\n"));
