# URL to Ads by Paneet

Turn a website URL into a short video ad — with first-class Thai support — from inside your own AI
coding agent. Free, no login, no account, no API keys. Everything runs on your machine.

URL to Ads by Paneet is a skill pack built on top of [HyperFrames](https://github.com/heygen-com/hyperframes)
(Apache 2.0). HyperFrames captures the site and renders HTML to MP4; this pack routes "make an ad
from this URL" requests into it and adds what Thai ads need: Thai fonts for every frame preset, Thai
caption segmentation, Thai ad-copy rules, vertical-ad layout rules, and a key-free sound bed.

## What you get

- A 9:16 (or 16:9 / 1:1) MP4 ad built from the site's real screenshots, colours, fonts, and logo.
- On-screen Thai copy in fonts that ship with the pack — never a random system fallback.
- Music synthesized in code for each ad, plus sound effects from a commercially licensed library.
- No branding of ours anywhere in your video.

Thai ads have **no voice-over**: every Thai text-to-speech voice we know of needs an API key or
has a non-commercial license, and this pack uses neither. The on-screen text carries the message.

## Install

In a terminal, with [Claude Code](https://code.claude.com) installed:

```bash
claude plugin marketplace add Paneet-Interactive/url-to-ads
claude plugin install url-to-ads@paneet-interactive
```

Then start Claude Code and ask your agent for an ad (see **Use**). Nothing else to set up: Node.js,
FFmpeg, HyperFrames, and its headless Chrome — the skill installs these for you on first run,
asking before each install.

**Codex or Cursor** — these install through the [`skills`](https://www.npmjs.com/package/skills)
CLI, which runs on Node.js:

```bash
npx skills add Paneet-Interactive/url-to-ads -a codex    # or: -a cursor
```

## Use

Ask your agent, in Thai or English:

```
ทำโฆษณาจากเว็บนี้ https://example.co.th
make a 15-second vertical ad from https://example.com
```

The agent captures the site, proposes the story, builds each frame, reviews snapshots, and renders
`renders/video.mp4` in a new project folder. You approve the plan and the final preview along the way.

## Keys and accounts

None. The pack forbids every route that needs a key or a sign-in, even if one is set on your
machine: HeyGen voices and music, ElevenLabs, Gemini TTS, Lyria, image captioning during capture,
hosted publishing, and cloud rendering. Nothing is sent to any server of ours — there is none.

## Audio licensing

| Route                      | Source                                                        | License                                                                                         |
| -------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Music                      | Synthesized per ad by `scripts/lib/score-synth.mjs` (oscillators, Karplus-Strong strings, filtered noise) | No third-party material — the output is yours                                                   |
| Sound effects              | HyperFrames' bundled 21-file library, sourced from Pixabay     | [Pixabay Content License](https://pixabay.com/service/license-summary/) — commercial use allowed, no attribution required |
| Voice-over, Thai           | None                                                          | —                                                                                               |
| Voice-over, English (optional) | Kokoro-82M, run locally by HyperFrames                    | Apache 2.0 per its model card — **not re-verified by us; check before commercial use**         |
| Not used                   | MusicGen (`facebook/musicgen-small`)                          | CC-BY-NC 4.0 (non-commercial) — excluded                                                        |
| Not used                   | HeyGen music library, Lyria                                   | Need an account or key — excluded                                                               |

## Fonts

Thai fonts ship in `skills/url-to-ads/fonts/` (Thai subset only), all under the SIL Open Font
License 1.1, from [Fontsource](https://fontsource.org): Anuphan, Bai Jamjuree, Chonburi,
IBM Plex Sans Thai, Kanit, Maitree, Mali, Mitr, Noto Serif Thai, Prompt, Sarabun, Taviraj, Trirong.
License texts are in `skills/url-to-ads/fonts/licenses/`. When the captured site ships its own Thai
font, the ad uses that first.

## What is verified and what is not

Tested on macOS (Apple Silicon), Node 25, HyperFrames 0.8.115, on 4 October 2026.

**Verified**

- Thai fonts: every one of the 13 HyperFrames frame presets renders Thai glyphs from the bundled
  font (checked per glyph in headless Chrome), with stacked vowels and tone marks intact.
- `thai-fonts.mjs check` catches Thai text that would fall back to a system font.
- Thai captions: word segmentation with a brand dictionary (brand names never split), phrase
  breaks without Latin punctuation, and timing alignment — 10 unit tests; applied to all 13
  caption skins with the font check passing, and rendered for one skin plus the default style.
- Thai ad-copy check: length per beat, reading-time durations, and flagged claim words.
- Sound bed: all four moods render to WAV, and the music and SFX reach the final MP4 (AAC stereo).
- End to end on https://nokhora.com/ (Thai site): capture → 5-frame 9:16 ad → MP4 with music
  and SFX, after two review rounds. HyperFrames `lint` 0 errors, `check` passed.
- Install into Claude Code from the public repository with no credentials:
  `npx skills add Paneet-Interactive/url-to-ads -a claude-code`.
- Plugin packaging: `claude plugin validate --strict` passes for the marketplace and the plugin,
  and `claude plugin marketplace add` + `claude plugin install url-to-ads@paneet-interactive`
  installs it (tested from a local checkout, in a separate Claude config).
- First-run prerequisites on a simulated clean Mac (empty home folder, only system folders on
  `PATH`, Homebrew not used): `preflight.sh` installed Node 22.23.3, FFmpeg 6.0 and HyperFrames'
  Chrome with no password, then HyperFrames install, capture of https://nokhora.com/, sound bed,
  assembly, lint (0 errors) and render produced an MP4 with AAC audio, using only those tools. The
  frames were reused from the earlier run, not written again by an agent.

**Not verified**

- A real clean macOS user account end to end: plugin install from GitHub, the agent's first run
  (approving each install), and one Thai ad — including what the user has to click or type there.
- `preflight.sh` with Homebrew on macOS, on Linux (apt), and `preflight.ps1` on Windows (winget).
- Installing and running in **Codex** and **Cursor**.
- The agent picking this skill on its own from a plain request (the E2E run followed the skill
  step by step in Claude Code).
- How the music sounds to a listener — it was checked by level and spectrogram only.
- Thai captions with a real voice track (no key-free Thai voice exists to produce one).
- The English Kokoro voice-over path with the sound bed (tested with a stand-in voice entry only).
- The อย. / สคบ. claim rules in `references/thai-ad-copy.md` against the current regulations —
  they are a reminder, not legal advice.
- Windows and Linux.

## Known limits

- On a Mac without a Homebrew it can write to, the skill installs Node and FFmpeg into
  `~/.url-to-ads` (no password) and adds that folder to your shell profile.
- The optional English voice-over (Kokoro) needs Python with `kokoro-onnx` and `soundfile`; the
  skill does not install these.
- Thai ads have no voice-over (see above).
- Without image captioning, asset names from the capture are guesses; the skill tells the agent
  to open every image before using it.
- HyperFrames' brand remap can collapse a site's display and body fonts into one family.

## Repository layout

```
.claude-plugin/                Claude Code plugin + marketplace manifests (the repo is the plugin)
skills/url-to-ads/
  SKILL.md                     routing, rules, and the Thai layer the agent follows
  thai-fonts.json              Thai display + body pairing per frame preset
  fonts/                       bundled Thai font files + licenses
  references/                  Thai ad-copy rules, vertical ad layout + review checklist
  scripts/                     preflight (.sh / .ps1) · thai-fonts · thai-captions · thai-copy ·
                               audio-bed (+ lib/)
scripts/sync-fonts.mjs         maintainer: refresh fonts/ from @fontsource (npm install first)
docs/decisions/                decision briefs
```

Run the unit tests with `node --test "skills/url-to-ads/scripts/*.test.mjs"`.

## License

Apache License 2.0 — see `LICENSE` and `NOTICE`. Copyright 2026 Paneet Interactive. The license
grants no rights to the Paneet name or marks. Bundled Thai fonts stay under the SIL Open Font
License 1.1.

## Credits

Built on [HyperFrames](https://github.com/heygen-com/hyperframes) by HeyGen, Apache License 2.0.
Made by Paneet Interactive.
