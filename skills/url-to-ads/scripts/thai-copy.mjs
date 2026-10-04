#!/usr/bin/env node
// thai-copy.mjs — check a silent Thai ad's on-screen copy in STORYBOARD.md (URL to Ads by Paneet).
//
//   node thai-copy.mjs check [--storyboard STORYBOARD.md]
//
// Per frame (`## Frame N …` with `- voiceover:` = the frame's on-screen line, `- duration: Ns`):
//   · visible Thai length against the beat limit in references/thai-ad-copy.md
//     (first frame = hook ≤ 14 · last frame = CTA ≤ 16 · others ≤ 24 per line, lines split by " / ")
//   · duration against max(2.5, 1.0 + visible ÷ 12) seconds
//   · risky claim words (สคบ. / อย.) — reported for review, never auto-removed
// Exit 1 on a length or duration problem. Claim words alone do not fail the check.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { visibleLength } from "./lib/thai-text.mjs";

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const die = (m) => {
  console.error(`✗ thai-copy: ${m}`);
  process.exit(1);
};
if (argv[0] !== "check") die("usage: thai-copy.mjs check [--storyboard STORYBOARD.md]");

const path = resolve(flag("storyboard", "STORYBOARD.md"));
if (!existsSync(path)) die(`no storyboard at ${path}`);

const RISKY = [
  "ที่สุด", "อันดับ 1", "อันดับหนึ่ง", "เบอร์ 1", "100%", "การันตี", "รับประกันผล", "ดีกว่า",
  "รักษา", "หายขาด", "ป้องกันโรค", "ลดน้ำหนัก", "เผาผลาญ", "ลดไขมัน", "ลดเบาหวาน", "ลดความดัน",
  "ต้านมะเร็ง", "ฆ่าเชื้อ", "ลดการอักเสบ", "ขาวใสใน", "เห็นผลใน", "ไม่มีผลข้างเคียง", "ปลอดภัย 100",
];
// A CTA's handle / URL is not copy: drop @handles, URLs, and dotted Latin tokens before counting.
const stripHandles = (s) => s.replace(/@\S+|https?:\/\/\S+|\b[\w-]+(\.[\w-]+)+\S*/g, "");

const frames = [];
let cur = null;
for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
  const h = line.match(/^#{2,3}\s+(?:Frame|Beat|Scene)\s+(\d+)/i);
  if (h) {
    cur = { number: Number(h[1]), copy: null, duration: null };
    frames.push(cur);
    continue;
  }
  if (!cur) continue;
  const m = line.match(/^\s*-\s*(voiceover|vo|voice_over|narration|duration)\s*:\s*(.*)$/i);
  if (!m) continue;
  if (/^duration$/i.test(m[1])) cur.duration = parseFloat(m[2]);
  else cur.copy = m[2].trim().replace(/^["']|["']$/g, "");
}
if (!frames.length) die("no `## Frame N` sections found");

const problems = [];
const review = [];
const rows = [];
frames.forEach((f, i) => {
  const role = i === 0 ? "hook" : i === frames.length - 1 && frames.length > 1 ? "cta" : "body";
  if (!f.copy) {
    problems.push(`frame ${f.number}: no \`- voiceover:\` line — a silent ad needs on-screen copy in every frame`);
    return;
  }
  const lines = f.copy.split(/\s+\/\s+/);
  const lens = lines.map((l) => visibleLength(role === "cta" ? stripHandles(l) : l));
  const limit = role === "hook" ? 14 : role === "cta" ? 16 : 24;
  const total = lines.reduce((n, l) => n + visibleLength(l), 0);
  const need = Math.max(2.5, Number((1 + total / 12).toFixed(1)));
  if (role !== "body" && lines.length > 1) problems.push(`frame ${f.number} (${role}): one line only, got ${lines.length}`);
  if (role === "body" && lines.length > 2) problems.push(`frame ${f.number}: at most 2 lines, got ${lines.length}`);
  lens.forEach((n, k) => {
    if (n > limit) problems.push(`frame ${f.number} (${role}): "${lines[k]}" is ${n} visible chars, limit ${limit}`);
  });
  if (!Number.isFinite(f.duration)) problems.push(`frame ${f.number}: no duration — set ${need}s`);
  else if (f.duration < need) problems.push(`frame ${f.number}: duration ${f.duration}s < ${need}s reading time`);
  for (const w of RISKY) if (f.copy.includes(w)) review.push(`frame ${f.number}: "${w}" — needs proof from the site / regulator approval (references/thai-ad-copy.md § Claims)`);
  rows.push(`  frame ${f.number} ${role.padEnd(4)} ${String(lens.join("+")).padStart(5)} chars · ${f.duration ?? "?"}s (min ${need}s) · ${f.copy}`);
});

console.log(rows.join("\n"));
if (review.length) console.log(`⚠ claims to review with the user:\n  ${review.join("\n  ")}`);
if (problems.length) {
  console.error(`✗ thai-copy check: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ thai-copy check: ${frames.length} frame(s) within length and reading time`);
