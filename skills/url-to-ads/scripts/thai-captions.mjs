#!/usr/bin/env node
// thai-captions.mjs — Thai caption layer over HyperFrames' captions.mjs (URL to Ads by Paneet).
//
//   node thai-captions.mjs build [--hyperframes .] [--script SCRIPT.md] [--brands thai-brands.txt] [--max-chars N]
//
// Run right after HyperFrames' `captions.mjs build`. That script groups words on Latin
// punctuation and joins them with spaces, which breaks Thai. This one re-groups the same
// timed words Thai-aware and rewrites HyperFrames' outputs in place:
//   · caption_groups.json             — the new groups
//   · compositions/captions.html      — its `var GROUPS = …;` line, the Thai fonts, and CSS
//     that lets Thai words touch (no inter-word gap) without clipping stacked marks.
// Segmentation: Intl.Segmenter("th") + a brand dictionary (thai-brands.txt, one name per line)
// whose entries are never split. Phrase breaks: a space between two Thai characters, or
// Latin sentence punctuation. Spoken text comes from SCRIPT.md so the original spaces survive.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config, thaiFaces } from "./lib/thai-font-faces.mjs";
import { alignTimings, groupTokens, isThai, segmentThai } from "./lib/thai-text.mjs";

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const die = (m) => {
  console.error(`✗ thai-captions: ${m}`);
  process.exit(1);
};
const r3 = (x) => Number(x.toFixed(3));
const TAIL_PAD = 0.12; // same linger as HyperFrames' captions.mjs
const MARK = "/* url-to-ads:thai-captions */";
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[\w-]+)$/i;

if (argv[0] !== "build") die("usage: thai-captions.mjs build [--hyperframes .] [--script SCRIPT.md] [--brands thai-brands.txt] [--max-chars N]");

const dir = resolve(flag("hyperframes", "."));
const groupsPath = join(dir, "caption_groups.json");
const htmlPath = join(dir, "compositions/captions.html");
const scriptPath = resolve(flag("script", join(dir, "SCRIPT.md")));
const brandsPath = resolve(flag("brands", join(dir, "thai-brands.txt")));
const framePath = join(dir, "frame.md");

if (!existsSync(groupsPath) || !existsSync(htmlPath)) {
  console.log("thai-captions: skipped (HyperFrames captions.mjs wrote no captions — silent film)");
  process.exit(0);
}
const frameMd = existsSync(framePath) ? readFileSync(framePath, "utf8") : "";
const pairMatch = /<!-- url-to-ads:thai-fonts:pair (\{.*?\}) -->/.exec(frameMd);
if (!pairMatch) die("frame.md has no Thai font section — run thai-fonts.mjs apply first");
const pair = JSON.parse(pairMatch[1]);
const pairing = config.presets[pair.preset];

const data = JSON.parse(readFileSync(groupsPath, "utf8"));
const { width: W, height: H } = data;
const maxChars = Number(flag("max-chars", H > W ? 12 : 18));
const brands = existsSync(brandsPath)
  ? readFileSync(brandsPath, "utf8").split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim()).filter(Boolean)
  : [];

// SCRIPT.md → Map(frame → spoken text). Same shape HyperFrames' audio.mjs reads:
// `## … (Frame N)` opens a line, `**key:**` rows are metadata, the indented block is spoken.
const scriptText = new Map();
if (existsSync(scriptPath)) {
  let frame = null;
  for (const line of readFileSync(scriptPath, "utf8").split(/\r?\n/)) {
    const h = line.match(/^#{2,3}\s+.*?\(frame\s+(\d+)\)/i);
    if (h) {
      frame = Number(h[1]);
      continue;
    }
    if (frame == null || /^\s*\*\*/.test(line)) continue;
    const m = line.match(/^(?: {4,}|\t)(.+)$/);
    if (m) scriptText.set(frame, (scriptText.has(frame) ? `${scriptText.get(frame)} ` : "") + m[1].trim());
  }
}

// HyperFrames' words, back in per-frame order (they are absolute-timed already).
const byFrame = new Map();
for (const g of data.groups)
  for (const w of g.words) {
    if (!byFrame.has(g.frame)) byFrame.set(g.frame, []);
    byFrame.get(g.frame).push(w);
  }

const rebuilt = [];
const approx = [];
for (const [frame, words] of [...byFrame].sort((a, b) => a[0] - b[0])) {
  words.sort((a, b) => a.start - b.start);
  const text =
    scriptText.get(frame) ??
    words.reduce((s, w, i) => (i && !(isThai(s.at(-1)) && isThai(w.text[0])) ? `${s} ${w.text}` : s + w.text), "");
  const { tokens, exact } = alignTimings(segmentThai(text, brands), words);
  if (!exact) approx.push(frame);
  for (const g of groupTokens(tokens, { maxChars })) rebuilt.push({ frame, words: g });
}

const groups = rebuilt.map((g, gi) => {
  const first = g.words[0];
  const last = g.words[g.words.length - 1];
  const next = rebuilt[gi + 1];
  let end = r3(last.end + TAIL_PAD);
  if (next && next.words[0].start < end) end = r3(next.words[0].start);
  return {
    id: `caption-group-${gi}`,
    frame: g.frame,
    start: r3(first.start),
    end,
    text: g.words.map((w) => w.display).join(""),
    words: g.words.map((w, wi) => ({
      id: `caption-word-${gi}-${wi}`,
      text: w.display,
      start: r3(w.start),
      end: r3(w.end),
      ...(w.brand ? { brand: true } : {}),
    })),
  };
});

writeFileSync(groupsPath, JSON.stringify({ ...data, groups }, null, 2));

// ── captions.html ──
let html = readFileSync(htmlPath, "utf8");
const groupsLine = /var GROUPS = .*;$/m;
if (!groupsLine.test(html)) die("compositions/captions.html has no `var GROUPS = …;` line — HyperFrames output changed");
const json = JSON.stringify(groups).replace(/</g, "\\u003c");
html = html.replace(groupsLine, () => `var GROUPS = ${json};`);
// The built-in pill (no preset skin) appends a space to every word; Thai words must touch.
html = html.replace('s.textContent = w.text + " ";', "s.textContent = w.text;");

if (!html.includes(MARK)) {
  // Which Thai family each caption stack gets: the display partner when the stack leads with a
  // family frame.md uses for a display-type role (display / headline / title / hero / numeral),
  // else the body partner.
  const latinDisplay = new Set();
  for (const m of frameMd.matchAll(/^\s+([\w-]+):\s*\{[^}]*fontFamily:\s*"([^"]+)"/gm))
    if (/display|headline|title|hero|numeral/.test(m[1])) latinDisplay.add(m[2].toLowerCase());
  const thaiNames = new Set([pairing.display.family, pairing.body.family].map((f) => f.toLowerCase()));
  html = html.replace(/(@font-face\s*\{[^}]*\})|font-family(\s*):(\s*)([^;}<]+)/g, (m, face, s1, s2, value) => {
    if (face) return m;
    const stack = value.trim().split(",").map((t) => t.trim());
    const names = stack.map((t) => t.replace(/^["']|["']$/g, "").toLowerCase());
    if (names.some((n) => thaiNames.has(n)) || names[0].startsWith("var(") || /^(inherit|initial|unset)$/.test(names[0])) return m;
    const thai = latinDisplay.has(names[0]) ? pairing.display.family : pairing.body.family;
    const at = names.findIndex((n) => GENERIC.test(n));
    stack.splice(at < 0 ? stack.length : at, 0, `"${thai}"`);
    return `font-family${s1}:${s2}${stack.join(", ")}`;
  });
  const css =
    `<style>\n${MARK}\n` +
    thaiFaces(pairing).map((f) => f.css).join("\n") +
    `\n.caption-line, .caption-group { column-gap: 0 !important; word-spacing: normal !important; }\n` +
    `.caption-word { letter-spacing: 0 !important; padding-left: 0 !important; padding-right: 0 !important; }\n` +
    `.caption-line, .caption-group { line-height: 1.45 !important; }\n</style>\n`;
  html = html.replace(/<\/template>\s*$/, `${css}</template>\n`);
}
writeFileSync(htmlPath, html);

const brandWords = groups.flatMap((g) => g.words.filter((w) => w.brand)).length;
console.log(
  `✓ thai-captions: ${groups.length} group(s) (max ${maxChars} chars) · ${brands.length} brand term(s), ${brandWords} occurrence(s) kept whole` +
    (approx.length ? ` · approximate timing (TTS text ≠ SCRIPT.md) in frame(s) ${approx.join(", ")}` : ""),
);
