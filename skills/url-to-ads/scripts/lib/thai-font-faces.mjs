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
