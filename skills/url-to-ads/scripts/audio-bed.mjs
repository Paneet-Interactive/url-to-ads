#!/usr/bin/env node
// audio-bed.mjs — the ad's sound, with no keys and a clean commercial license (URL to Ads by Paneet).
//
//   node audio-bed.mjs build [--hyperframes .] [--storyboard STORYBOARD.md] [--mood M] [--bpm N] [--seed N]
//                            [--media-use <HyperFrames media-use skill dir>]
//
//   · music — synthesized in code by lib/score-synth.mjs (fully owned), written to
//     assets/bgm/score.wav, with a swell + soft hit on every frame cut.
//     Mood: --mood, else the storyboard frontmatter `score:` key, else "warm".
//     Moods: mystic · warm · bright · calm.
//   · SFX — each frame's `- sfx:` list (`name` or `name@offset_s`, comma-separated), taken ONLY
//     from HyperFrames' bundled Pixabay library (Pixabay Content License, commercial use OK).
//     HyperFrames' own SFX engine switches to HeyGen retrieval when a credential exists, so it
//     is not used here.
//   · audio_meta.json — the bgm + sfx entries HyperFrames' assemble-index.mjs mounts.
//
// Run it after HyperFrames' audio step (which, for a silent-marked project, writes nothing)
// and before assemble-index.mjs.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { skillDir } from "./lib/thai-font-faces.mjs";
import { MOODS, encodeWav, renderScore } from "./lib/score-synth.mjs";

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const die = (m) => {
  console.error(`✗ audio-bed: ${m}`);
  process.exit(1);
};
if (argv[0] !== "build") die("usage: audio-bed.mjs build [--hyperframes .] [--storyboard STORYBOARD.md] [--mood M] [--bpm N] [--seed N]");

const dir = resolve(flag("hyperframes", "."));
const sbPath = resolve(flag("storyboard", join(dir, "STORYBOARD.md")));
if (!existsSync(sbPath)) die(`no storyboard at ${sbPath}`);
const sb = readFileSync(sbPath, "utf8");

const front = /^---\n([\s\S]*?)\n---/.exec(sb)?.[1] ?? "";
const frontKey = (k) => new RegExp(`^${k}:\\s*(.+)$`, "m").exec(front)?.[1].trim();
const mood = flag("mood", frontKey("score") ?? "warm");
if (!MOODS[mood]) die(`unknown mood "${mood}" — use one of ${Object.keys(MOODS).join(", ")}`);
const bpm = flag("bpm", null) ? Number(flag("bpm")) : undefined;
const seed = Number(flag("seed", 7));

// Frames in order: number, duration, sfx cues. A frame starts at the sum of the durations
// before it — the same timeline assemble-index.mjs builds.
const frames = [];
let cur = null;
for (const line of sb.split(/\r?\n/)) {
  const h = line.match(/^#{2,3}\s+(?:Frame|Beat|Scene)\s+(\d+)/i);
  if (h) {
    cur = { number: Number(h[1]), duration: NaN, sfx: [] };
    frames.push(cur);
    continue;
  }
  if (!cur) continue;
  const d = line.match(/^\s*-\s*duration\s*:\s*([\d.]+)/i);
  if (d) cur.duration = Number(d[1]);
  const s = line.match(/^\s*-\s*sfx\s*:\s*(.+)$/i);
  if (s)
    cur.sfx = s[1]
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const [name, off] = x.split("@");
        return { name: name.trim(), offset: off ? Number(off) : 0 };
      });
}
if (!frames.length) die("no `## Frame N` sections in the storyboard");
const missing = frames.filter((f) => !Number.isFinite(f.duration));
if (missing.length) die(`frame(s) ${missing.map((f) => f.number).join(", ")} have no duration`);

let t = 0;
const cuts = [];
for (const f of frames) {
  f.start = t;
  cuts.push(t);
  t += f.duration;
}
const total = Number(t.toFixed(3));

// ── music ──
mkdirSync(join(dir, "assets/bgm"), { recursive: true });
const wav = encodeWav(renderScore({ duration: total, cuts, mood, bpm, seed }));
writeFileSync(join(dir, "assets/bgm/score.wav"), wav);

// ── SFX from the bundled Pixabay library only ──
// HyperFrames' media-use skill: --media-use <dir>, else installed next to this skill, else the
// usual agent skill folders (project, then user level).
const mediaUse = [
  flag("media-use", null),
  join(skillDir, "../media-use"),
  ...[".claude/skills", ".agents/skills", ".cursor/skills", ".codex/skills"].flatMap((d) => [
    join(dir, d, "media-use"),
    join(homedir(), d, "media-use"),
  ]),
].find((d) => d && existsSync(join(d, "audio/assets/sfx/manifest.json")));
const libDir = mediaUse ? join(mediaUse, "audio/assets/sfx") : null;
const sfx = [];
const skipped = [];
const wanted = frames.flatMap((f) => f.sfx.map((c) => ({ ...c, frame: f.number })));
if (wanted.length) {
  if (!libDir) die("HyperFrames' bundled SFX library (media-use skill) not found — run § 1 of SKILL.md, or pass --media-use <dir>");
  const manifest = JSON.parse(readFileSync(join(libDir, "manifest.json"), "utf8"));
  mkdirSync(join(dir, "assets/sfx"), { recursive: true });
  for (const cue of wanted) {
    const key = cue.name.replace(/\.mp3$/, "");
    const entry = manifest[key];
    if (!entry) {
      skipped.push(cue.name);
      continue;
    }
    const file = `assets/sfx/${entry.file ?? `${key}.mp3`}`;
    copyFileSync(join(libDir, entry.file ?? `${key}.mp3`), join(dir, file));
    sfx.push({ frame: cue.frame, name: key, file, source: "local", offset_s: cue.offset, duration_s: entry.duration, volume: 0.35 });
  }
}

// Keep any narration HyperFrames' audio step already wrote (English / Kokoro); duck the score under it.
const metaPath = join(dir, "audio_meta.json");
const prior = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : {};
const voices = Array.isArray(prior.voices) ? prior.voices : [];
const meta = {
  ...prior,
  bgm: { path: "assets/bgm/score.wav", volume: voices.length ? 0.12 : 0.8, duration_s: total, source: "procedural" },
  bgm_pending: false,
  voices,
  sfx,
};
writeFileSync(metaPath, JSON.stringify(meta, null, 2));

console.log(
  `✓ audio-bed: ${mood} score ${total}s (${(wav.length / 1e6).toFixed(1)} MB, ${cuts.length - 1} cut accent(s)) → assets/bgm/score.wav · ` +
    `${sfx.length} SFX cue(s) from the bundled Pixabay library` +
    (skipped.length ? ` · not in library, skipped: ${skipped.join(", ")} (names: ${libDir}/manifest.json)` : "") +
    ` → audio_meta.json`,
);
