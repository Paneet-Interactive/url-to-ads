// Shared by thai-fonts.mjs and thai-captions.mjs: the bundled Thai pairing config and the
// @font-face rules for a preset's display + body families (root-relative assets/fonts/ paths).

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const config = JSON.parse(readFileSync(join(skillDir, "thai-fonts.json"), "utf8"));
export const fontsDir = join(skillDir, "fonts");

export const fontFileName = (family, weight) => `${family.replace(/\s+/g, "")}-Thai-${weight}.woff2`;

// [{ family, weight, file, css }] for a pairing, de-duplicated by file.
export function thaiFaces(pairing) {
  const faces = [];
  const seen = new Set();
  for (const { family, weights } of [pairing.display, pairing.body])
    for (const weight of weights) {
      const file = fontFileName(family, weight);
      if (seen.has(file)) continue;
      seen.add(file);
      faces.push({
        family,
        weight,
        file,
        css:
          `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;font-display:block;` +
          `src:url("assets/fonts/${file}") format("woff2");unicode-range:${config.unicodeRange};}`,
      });
    }
  return faces;
}

// The section thai-fonts.mjs appends to frame.md, between these markers.
export const SECTION_START = "<!-- url-to-ads:thai-fonts:start -->";
export const SECTION_END = "<!-- url-to-ads:thai-fonts:end -->";
export function stripThaiSection(md) {
  const s = md.indexOf(SECTION_START);
  const e = md.indexOf(SECTION_END);
  return s >= 0 && e > s ? md.slice(0, s) + md.slice(e + SECTION_END.length + 1) : md;
}

// True when a CSS unicode-range overlaps the Thai block (U+0E01–0E5B).
export function coversThai(range) {
  return range.split(",").some((part) => {
    const m = /U\+([0-9A-F?]+)(?:-([0-9A-F]+))?/i.exec(part.trim());
    if (!m) return false;
    const lo = parseInt(m[1].replace(/\?/g, "0"), 16);
    const hi = m[2] ? parseInt(m[2], 16) : parseInt(m[1].replace(/\?/g, "F"), 16);
    return lo <= 0x0e5b && hi >= 0x0e01;
  });
}

// Families that already have a Thai-covering @font-face in the given CSS/markdown — e.g. the site's
// own Thai font staged by HyperFrames' build-frame. A bundled face with the same family name would
// be a second, competing declaration, so callers skip those.
export function declaredThaiFamilies(text) {
  const out = new Set();
  for (const [, body] of text.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const family = /font-family\s*:\s*["']?([^"';]+)/.exec(body)?.[1]?.trim();
    const range = /unicode-range\s*:\s*([^;]+)/.exec(body)?.[1];
    if (family && range && coversThai(range)) out.add(family.toLowerCase());
  }
  return out;
}
