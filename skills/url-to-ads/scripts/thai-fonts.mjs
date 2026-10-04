#!/usr/bin/env node
// thai-fonts.mjs — Thai font layer for HyperFrames projects (URL to Ads by Paneet).
//
//   node thai-fonts.mjs apply --preset <name> [--hyperframes .]
//     Run right after HyperFrames' build-frame.mjs. Stages the preset's Thai display + body
//     fonts into assets/fonts/ and appends a Thai typography section (with a ready-to-paste
//     @font-face block) to frame.md. Safe to re-run: the section is replaced, not duplicated.
//
//   node thai-fonts.mjs check [--hyperframes .]
//     Fails (exit 1) if any .html file with Thai text has a font-family stack that does not
//     end in a Thai family declared by an @font-face in the same file — i.e. Thai text that
//     would fall back to whatever font the render machine happens to have.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config, fontsDir, thaiFaces } from "./lib/thai-font-faces.mjs";

const [command, ...argv] = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const die = (m) => {
  console.error(`✗ thai-fonts: ${m}`);
  process.exit(1);
};

const projectDir = resolve(flag("hyperframes", "."));
const THAI = /[ก-๛]/;
const START = "<!-- url-to-ads:thai-fonts:start -->";
const END = "<!-- url-to-ads:thai-fonts:end -->";
const PAIR = "<!-- url-to-ads:thai-fonts:pair "; // machine-readable pairing, read by thai-captions.mjs

if (command === "apply") apply();
else if (command === "check") check();
else die("usage: thai-fonts.mjs apply --preset <name> [--hyperframes .] | check [--hyperframes .]");

function apply() {
  const preset = flag("preset", null);
  if (!preset) die("--preset is required");
  const pairing = config.presets[preset];
  if (!pairing) die(`no Thai pairing for preset "${preset}"\n  available: ${Object.keys(config.presets).join(", ")}`);
  const framePath = join(projectDir, "frame.md");
  if (!existsSync(framePath)) die(`no frame.md in ${projectDir} — run HyperFrames' build-frame.mjs first`);

  const outDir = join(projectDir, "assets/fonts");
  mkdirSync(outDir, { recursive: true });
  const faces = thaiFaces(pairing);
  for (const { file } of faces) {
    const src = join(fontsDir, file);
    if (!existsSync(src)) die(`missing bundled font ${file} — reinstall the url-to-ads skill`);
    copyFileSync(src, join(outDir, file));
  }

  const d = pairing.display.family;
  const b = pairing.body.family;
  const section =
    `${START}\n${PAIR}${JSON.stringify({ preset, display: d, body: b })} -->\n` +
    `## Thai typography (url-to-ads)\n\n` +
    `This project has Thai text. The render machine has no Thai system font, so every Thai glyph ` +
    `must come from the files below (staged in \`assets/fonts/\`). Their \`unicode-range\` covers Thai ` +
    `only, so Latin text keeps the families above.\n\n` +
    `- **Display roles** (display, headline, title, hero, numeral, …): append \`"${d}"\` to the stack — ` +
    `e.g. \`font-family: "<display family>", "${d}", serif;\`\n` +
    `- **Every other role** (body, labels, mono, captions, …): append \`"${b}"\` — ` +
    `e.g. \`font-family: "<body family>", "${b}", sans-serif;\`\n` +
    `- Thai has no uppercase: ignore \`upper: true\` / letter-spacing on Thai strings (tracking breaks ` +
    `stacked vowels and tone marks). Keep line-height ≥ 1.3 on Thai text so marks above and below ` +
    `the line are not clipped.\n` +
    `- Never name any other Thai font (Thonburi, Tahoma, Leelawadee, …) — it does not exist on the render machine.\n\n` +
    `Paste this \`<style>\` into every frame's \`<head>\`/\`<template>\` that shows Thai text:\n\n` +
    "```html\n<style>\n" +
    faces.map((f) => f.css).join("\n") +
    "\n</style>\n```\n\n" +
    `Verify before render: \`node "${fileURLToPath(import.meta.url)}" check --hyperframes .\`\n` +
    `${END}\n`;

  let md = readFileSync(framePath, "utf8");
  const s = md.indexOf(START);
  const e = md.indexOf(END);
  if (s >= 0 && e > s) md = md.slice(0, s) + md.slice(e + END.length + 1);
  md = `${md.replace(/\s*$/, "")}\n\n${section}`;
  writeFileSync(framePath, md);
  console.log(`✓ thai-fonts: ${preset} → display "${d}", body "${b}"; staged ${faces.length} face(s) → assets/fonts/ + section in frame.md`);
}

function check() {
  const thaiFamilies = new Set(
    Object.values(config.presets).flatMap((p) => [p.display.family, p.body.family].map((f) => f.toLowerCase())),
  );
  const files = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", "capture"].includes(ent.name)) continue;
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".html")) files.push(p);
    }
  };
  walk(projectDir);

  const problems = [];
  let checked = 0;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    if (!THAI.test(src)) continue;
    checked++;
    const rel = relative(projectDir, file);
    const declared = new Set();
    // Blank out @font-face blocks (keeping line count) so only real usages remain.
    const body = src.replace(/@font-face\s*\{[^}]*\}/g, (block) => {
      const fam = /font-family\s*:\s*["']?([^"';}]+)/.exec(block);
      if (fam) declared.add(fam[1].trim().toLowerCase());
      return block.replace(/[^\n]/g, " ");
    });
    const thaiDeclared = [...declared].filter((f) => thaiFamilies.has(f));
    if (!thaiDeclared.length) {
      problems.push(`${rel}: has Thai text but no @font-face for a url-to-ads Thai font`);
      continue;
    }
    const usage = /font-family\s*:\s*([^;}"'][^;}]*|["'][^;}]*)/g;
    let m;
    let uses = 0;
    while ((m = usage.exec(body))) {
      const value = m[1].trim();
      if (/^(inherit|initial|unset|revert)$/i.test(value)) continue;
      uses++;
      const stack = value.split(",").map((t) => t.trim().replace(/^["']|["']$/g, "").toLowerCase());
      if (stack.length === 1 && stack[0].startsWith("var(")) continue;
      if (!stack.some((f) => thaiDeclared.includes(f))) {
        const line = body.slice(0, m.index).split("\n").length;
        problems.push(`${rel}:${line}: font-family: ${value} — no Thai family (add one of: ${thaiDeclared.join(", ")})`);
      }
    }
    if (!uses) problems.push(`${rel}: has Thai text but sets no font-family`);
  }

  if (problems.length) {
    console.error(`✗ thai-fonts check: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`✓ thai-fonts check: ${checked} file(s) with Thai text, every font-family stack has a Thai font`);
}
