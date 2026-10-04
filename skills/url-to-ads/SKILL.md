---
name: url-to-ads
description: >
  URL to Ads by Paneet — turn a website URL into a short video ad, with first-class Thai support.
  Use for any request to make an ad, video ad, promo, or short product video from a website URL
  (e.g. "make an ad from this URL", "ทำโฆษณาจากเว็บนี้", "ทำคลิปโฆษณาจากลิงก์นี้"), and whenever
  such a video has Thai on-screen text or Thai captions. Runs on top of HyperFrames, fully offline:
  it routes into HyperFrames' `/product-launch-video` workflow and adds the Thai layer on top.
---

# URL to Ads by Paneet

A thin layer over [HyperFrames](https://github.com/heygen-com/hyperframes) (Apache 2.0).
HyperFrames does the capture, composition, and rendering. This skill routes the request into the
right HyperFrames workflow and applies the Thai layer. It never replaces a HyperFrames step.

## Rules (always apply)

- **No keys, no sign-in.** Never use a route that needs an API key or an account, even if a key is
  present in the environment or the user offers one. HyperFrames' sign-in Preflight does not apply:
  do not recommend signing in and do not run `npx hyperframes auth`. Never use HeyGen TTS, ElevenLabs,
  Gemini TTS, Lyria, HeyGen music retrieval, `npx hyperframes publish`, or cloud / Lambda / Cloud Run
  renders. Always pass `--skip-vision` to `npx hyperframes capture` (its image captioning uses a
  Gemini / OpenRouter key). Skip HyperFrames' `auth status` sign-in step and continue offline.
  Capture, build, and render run on the user's machine only.
- **No branding in the output.** Never add a "Paneet" / "URL to Ads" logo, watermark, end card, or
  credit to the user's video, captions, or metadata.
- **No invented content.** If the URL cannot be captured, follow HyperFrames' hard-stop rule
  (non-zero exit, `ok: false`, or `BLOCKED.md` → stop and report). Do not fill in page content from
  memory or guesswork.
- **Commercial-safe audio only.** Every audio file in the ad must be cleared for commercial use.
  Never generate music with MusicGen (`facebook/musicgen-small`, CC-BY-NC 4.0 — non-commercial),
  even as a fallback. Music comes only from `audio-bed.mjs` (synthesized in code, fully owned);
  SFX only from HyperFrames' bundled Pixabay library (Pixabay Content License). Always set
  `music: none` in `STORYBOARD.md` so HyperFrames never fetches or generates music itself (§ 4).
- **Do not patch HyperFrames.** Thai fixes are added as a layer around it (presets, scripts,
  instructions). If a fix seems to need a change inside HyperFrames, stop and tell the user.

`<skill>` below is the directory that contains this `SKILL.md` (in a Claude Code plugin install,
`${CLAUDE_PLUGIN_ROOT}/skills/url-to-ads`).

## 0. Prerequisites — the skill installs them, the user prepares nothing

Run this at the start of every request (it takes a few seconds when everything is present):

```bash
bash "<skill>/scripts/preflight.sh" check                                         # macOS / Linux
powershell -ExecutionPolicy Bypass -File "<skill>/scripts/preflight.ps1" check   # Windows
```

Each line is `ok <item> …`, `missing <item> <how it installs>`, or `path <dir> …`. Items: `node`
(22+), `ffmpeg` (ffmpeg + ffprobe), `browser` (HyperFrames' headless Chrome). Exit 0 → everything
is present; go to § 1.

For each `missing` line, in this order — `node`, `ffmpeg`, `browser`:

1. Tell the user in one line what is missing and how it will be installed (the text after the item
   name), and ask them to approve that one install. One item per question; never batch them.
2. On approval, run `bash "<skill>/scripts/preflight.sh" install <item>` (Windows:
   `… preflight.ps1 install <item>`). On macOS it uses Homebrew when Homebrew is installed and
   writable by this user; otherwise it installs into `~/.url-to-ads` with no password (Node's
   official tarball, static FFmpeg builds, both checksum-verified) and adds `~/.url-to-ads/bin` to
   `~/.zprofile` and `~/.bash_profile`. Linux uses apt, Windows uses winget, and `browser` uses
   `npx hyperframes browser ensure` everywhere. The script re-checks the item after installing.
3. If the user declines, or an install exits non-zero, stop. Say exactly which item failed and quote
   the failing command and its error output. Do not continue to § 1 with anything missing, and do
   not substitute another install method.

After the last install, run `check` again; continue only on exit 0. If `check` prints a `path`
line, start every shell command for the rest of the session with the `export PATH=…` it gives —
the shell this session started with does not see the new tools yet.

## 1. Make sure HyperFrames is installed

Install or refresh the HyperFrames core set plus the URL workflow (a current install is a no-op):

```bash
npx hyperframes skills update product-launch-video
```

If the HyperFrames CLI is unavailable, use HyperFrames' documented fallback:

```bash
npx skills add heygen-com/hyperframes --skill product-launch-video
```

If the command fails, surface the error and stop. Do not reconstruct the workflow from memory.

## 2. Route into HyperFrames

1. Read `/hyperframes` and follow it as the entry point (project state, usage check, intent
   interview, `BRIEF.md`).
2. When it routes fresh creation, the route is `/product-launch-video` — this skill only handles
   "ad / promo from a URL" requests. Let the HyperFrames interview run as written (sell-or-show,
   angle, length, destination).
3. Detect the language of the ad: if the user writes in Thai, asks for Thai, or the captured site is
   primarily Thai, record `## Language: th` in `BRIEF.md` (under `## Customizations` if that section
   exists). Otherwise record `## Language: en` and the Thai layer below is skipped.
4. Narration: for `Language: en`, narration may use the offline Kokoro voice only — pass
   `--provider kokoro` to `audio.mjs`. For `Language: th` there is no narration (§ 3.3).
5. Continue inside `/product-launch-video`. At each step listed in § 3, apply the Thai layer before
   moving on. § 4 (sound) and § 5 (layout and review) apply to every ad, Thai or not.

## 3. Thai layer (only when `Language: th`)

| Workflow step              | Thai layer                                   | Status      |
| -------------------------- | -------------------------------------------- | ----------- |
| Design spec / frame preset | Thai display + body font for the preset (§ 3.1) | Built    |
| Storyboard / ad copy       | Thai copy guidance and claim rules (§ 3.4)   | Built       |
| Narration (TTS)            | None — on-screen text carries the copy (§ 3.3) | Built     |
| Captions                   | Thai word segmentation + brand-name dictionary (§ 3.2) | Built |

### 3.1 Thai fonts

Every frame preset has a Thai display + body pairing in `<skill>/thai-fonts.json`. The font files
(Thai subset only, SIL OFL 1.1, from `@fontsource`) ship in `<skill>/fonts/` — no Google Fonts fetch.

1. Right after the workflow runs `build-frame.mjs --preset <name>`, run with the same preset:

   ```bash
   node "<skill>/scripts/thai-fonts.mjs" apply --preset <name> --hyperframes .
   ```

   It copies the Thai fonts into `assets/fonts/` and appends a `## Thai typography (url-to-ads)`
   section to `frame.md`. Re-run it whenever `build-frame.mjs` is re-run (that rewrites `frame.md`).
2. Frame workers follow that section: paste its `<style>` block into every frame with Thai text and
   end every `font-family` stack with the Thai display or body family.
3. Before `lint` / render, run:

   ```bash
   node "<skill>/scripts/thai-fonts.mjs" check --hyperframes .
   ```

   A non-zero exit lists each file and line whose Thai text would fall back to a system font. Fix
   them and re-run; do not render until it passes.

### 3.2 Thai captions

Captions need narration word timings, so this step runs only when the project has a voice track
(`audio_meta.json` with words). A Thai ad has no narration (§ 3.3), so it skips this step.

HyperFrames' `captions.mjs` breaks sentences only on Latin punctuation and joins words with
spaces, and `Intl.Segmenter` splits brand names ("นกโหร" → "นก | โหร"). `thai-captions.mjs`
re-groups the same timed words and rewrites `caption_groups.json` + `compositions/captions.html`.

1. When `SCRIPT.md` is locked, write `thai-brands.txt` at the project root: one name per line —
   the brand, product, and people names that appear in the narration, spelled exactly as in
   `SCRIPT.md` (Thai or Latin; multi-word names allowed). These are never split.
2. Right after every `captions.mjs build`, run:

   ```bash
   node "<skill>/scripts/thai-captions.mjs" build --hyperframes .
   ```

   Groups close at a space between Thai words (Thai's sentence break), at Latin sentence marks,
   at a silence gap, or at 18 visible characters (12 on portrait; `--max-chars N` overrides).
   Spaces around numbers and Latin words stay inside the line. It also adds the Thai fonts to
   the caption file.
3. If it reports `approximate timing … in frame(s) N`, the TTS words did not match `SCRIPT.md`
   letter for letter (e.g. a number spoken as words), so highlight timing in those frames is
   spread evenly over the line. Tell the user; it is not an error.

### 3.3 Thai ad without narration

Every Thai voice needs an API key, and the offline Kokoro voice has no Thai, so a Thai ad has no
narration. Never run Kokoro on Thai text — it reads it as gibberish.

1. Mark the project voice-less the HyperFrames way: `music: none` in the `STORYBOARD.md`
   frontmatter and **no `SCRIPT.md`**. Step 3.1 Audio is then a clean skip and captions skip
   themselves. Music and SFX still come from § 4.
2. The on-screen text carries the whole message. Put each frame's line in the storyboard's
   `voiceover` field so frame workers reveal it as the frame's copy; HyperFrames' "never print the
   narration sentence" rule does not apply because nothing is spoken. Keep each line short.
3. Set every frame's `duration` from reading time, since there is no voice to sync to:
   `max(2.5, 1.0 + visible Thai characters ÷ 12)` seconds (marks above/below the line do not count).
   Reveals land on the beat instead of on voice cues. `thai-copy.mjs check` (§ 3.4) computes it.
4. Frame workers read only `_role.md`, their packet, and `frame.md` — not this skill. Add this to
   every worker's dispatch context, verbatim (plus the § 5 worker rules):

   > This is a SILENT Thai ad. There is no narration. The frame's `voiceover` line IS the on-screen
   > copy of this frame (" / " separates lines): render it as visible Thai text — this overrides the
   > "never render the narration sentence" rule, because nothing is spoken. Thai text rules: paste
   > both the frame.md "Font loading" block (if present) and the "Thai typography (url-to-ads)"
   > `@font-face` block; end every font-family stack with the Thai family named there; no
   > letter-spacing or text-transform on Thai; line-height ≥ 1.3 on Thai; wrap brand names in
   > `<span style="white-space:nowrap">`. When done, run
   > `node "<skill>/scripts/thai-fonts.mjs" check --hyperframes .` and fix problems in your file.

### 3.4 Thai ad copy

Before drafting `STORYBOARD.md`, read `<skill>/references/thai-ad-copy.md` (tone, spacing, length
per beat, and the อย. / สคบ. claim rules). After drafting, and again after every copy change, run:

```bash
node "<skill>/scripts/thai-copy.mjs" check --storyboard ./STORYBOARD.md
```

Fix every length or duration problem it reports. For each claim it flags, keep the line only if the
captured site states it, and list those lines for the user in the plan review as theirs to clear.
A product in a banned or strictly regulated category (alcohol, tobacco, gambling, loans) → stop and
ask the user before planning.

## 4. Sound — music and SFX, no keys

1. In the `STORYBOARD.md` frontmatter keep `music: none` and add `score: <mood>` — `mystic`
   (night / spiritual / luxury), `warm` (friendly consumer), `bright` (energetic / promo), or
   `calm` (wellness / premium). Pick from the brand, not at random.
2. In Step 4 (visual design), give each frame an `- sfx:` line where a sound helps — names from the
   bundled library only (`whoosh-short`, `pop`, `sparkle`, `chime`, `click`, `impact-bass-1`, …;
   full list in the media-use skill's `audio/assets/sfx/manifest.json`), optionally `name@seconds`
   to offset from the frame start. One or two cues per frame at most; none on a held read.
3. In Step 5, after HyperFrames' audio step and before `assemble-index.mjs`, run:

   ```bash
   node "<skill>/scripts/audio-bed.mjs" build --hyperframes .
   ```

   It writes `assets/bgm/score.wav` (synthesized, with a swell and soft hit on every cut), copies
   the SFX, and writes `audio_meta.json` (keeping any narration already there and ducking the
   music under it). Re-run it whenever frame durations change.

## 5. Layout and review before render

Read `<skill>/references/vertical-ad-layout.md` before Step 2 (preset choice) and Step 4 (visual
design). Paste its **Worker rules** block into every frame worker's dispatch context. After
`npx hyperframes snapshot`, run its **Review before render** checklist on every snapshot and send
fixes back to the frame workers until a round comes back clean (at most 3 rounds). Do not render
before a clean round, and tell the user about anything still open.

