# Vertical ad layout and polish (9:16 · 1080×1920)

Read this before Step 2 (preset) and Step 4 (visual design) of a `Language: th` ad, and paste the
**Worker rules** block into every frame worker's dispatch context. A silent ad lives or dies on
type and layout: the text is the whole message, on a phone, read in about three seconds.

## Preset choice

- Pick the preset whose **ground** matches the captured site's dominant background: a dark site
  gets a dark-ground preset (`editorial-forest`, `broadside`), a light site a light one. The remap
  keeps the preset's light/dark structure, so a light preset on a dark brand fights the CI.
- Avoid presets whose signature texture the brand does not have (graph-paper grid, scanlines,
  brutalist borders) unless the site uses it.

## One look across the whole ad

- **One ground family.** Every frame uses the same ground (or the same ground plus one lighter
  card surface). Do not alternate dark and light grounds frame by frame; switch only once, at a
  deliberate section change, if at all.
- **One accent.** The brand accent marks one thing per frame (a word, a button, a marker).
- **The mascot / logo is a recurring character**, not a one-off: it appears in the hook and the
  CTA at least, at the same scale and position family.

## Type scale (1080 wide)

| Role                      | Size          | Notes                                             |
| ------------------------- | ------------- | ------------------------------------------------- |
| Hook / hero line          | 120–160 px    | ≤ 2 lines, fills 80–90% of the width              |
| Body line                 | 84–110 px     | ≤ 2 lines                                         |
| Small label               | ≥ 48 px       | Nothing smaller — it is unreadable on a phone     |
| CTA button label          | 64–80 px      | Button ≥ 75% of the width, ≥ 160 px tall          |

Thai line-height 1.3–1.45; never letter-spacing or uppercase on Thai.

## Composition

- **Fill the safe area.** Content spans y ≈ 220–1560. The visual mass sits between 30% and 70% of
  the height — not stacked in the top half with an empty bottom half.
- **One focal element per frame**, ≥ 40% of the canvas (the headline block counts).
- **Left-aligned or centered, consistently.** Pick one for the ad; do not mix per frame.
- **No chrome.** No frame ordinals ("03"), page numbers, hairline rules, grids, or UI labels unless
  the site itself shows them as content.

## Assets

- Without image captioning (`--skip-vision`), the asset names in `asset-descriptions.md` are
  guesses. **Open every image before you assign it a role.** A QR code is not an icon: use it only
  as a QR, at ≥ 360 px, in the CTA frame, held still for ≥ 1.5 s.
- Never draw a third-party logo by hand. If there is no real file, use the word ("LINE").

## Worker rules (paste into every frame worker's dispatch context)

> Vertical ad polish rules (1080×1920): headline 120–160 px, body 84–110 px, nothing under 48 px;
> CTA button ≥ 75% width and ≥ 160 px tall. Content spans y 220–1560 with its mass between 30% and
> 70% of the height — do not leave the bottom half empty. No ordinals, page numbers, grids, or
> decorative hairlines. Thai: underline or strike through Thai text only with CSS
> `text-decoration` (it follows the font's own metrics) — never a positioned div or pseudo-element,
> which lands on the glyphs. Never reveal Thai text with a hard-edged mask or clip (a masked slide
> shows tone marks and upper vowels before their consonants, so marks float alone for a few
> frames); reveal Thai lines with opacity plus a short rise (≤ 40 px), as one piece — never letter
> by letter. Keep ≥ 60 px between any text and the frame edge; break a long Thai line at a phrase
> boundary rather than shrinking it below 120 px.

## Review before render

After `npx hyperframes snapshot`, inspect every snapshot against this list. Snapshot each frame's
held read AND one moment mid-reveal (~0.3 s after a Thai line starts entering). Any hit goes back to
that frame's worker as a numbered fix list; re-snapshot; repeat (at most 3 rounds) until clean.
Render only after a clean round.

1. Any text under 48 px, or a headline under 120 px?
2. Empty bottom half, or content mass outside 30–70% of the height?
3. Ground differs from the previous frame without a planned section change?
4. Any ordinal, grid, hairline, or UI chrome the site does not have?
5. Any line, underline, or mask crossing Thai glyphs, a tone mark / vowel clipped, or (in a mid-reveal
   snapshot) a mark visible without its consonant?
6. An asset used as something it is not (QR as icon, screenshot as logo)?
7. Brand name split across lines?
8. Text touching the frame edge (< 60 px margin)?
