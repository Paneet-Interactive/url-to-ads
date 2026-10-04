// thai-text.mjs — Thai caption text: word segmentation with a brand dictionary, timing
// alignment onto TTS word timings, and caption grouping without Latin punctuation.
// Pure functions; no I/O.

const THAI_CHAR = /[ก-๛]/;
// Thai marks that sit above/below a consonant and take no horizontal space.
const COMBINING = /[ัิ-ฺ็-๎]/g;
// Repetition / abbreviation marks that belong to the word before them.
const TRAILING_MARK = /^[ๆฯ]+$/;
const SENT_END = /[.?!,;:—]$/;
const NBSP = " ";

export const isThai = (s) => THAI_CHAR.test(s);
export const visibleLength = (s) => s.replace(/\s/g, "").replace(COMBINING, "").length;
const squash = (s) => s.replace(/[\s ]+/g, "");

let segmenter;
const segment = (s) => {
  segmenter ??= new Intl.Segmenter("th", { granularity: "word" });
  return [...segmenter.segment(s)];
};

// Brand list → match plan. Longest first so "นกโหร ออนไลน์" wins over "นกโหร".
function brandPlan(brands) {
  return [...new Set(brands.map((b) => b.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map((b) => ({ term: b, lower: b.toLowerCase() }));
}

// The whitespace after a token decides how the caption treats it:
//   "none"   — no space (inside a Thai run)
//   "inline" — a space that stays inside the caption line (around numbers / Latin words)
//   "phrase" — a space between two Thai characters: Thai's sentence / phrase break
function breakKind(text, end) {
  if (end >= text.length) return "phrase";
  let j = end;
  while (j < text.length && /\s/.test(text[j])) j++;
  if (j === end) return "none";
  if (j === text.length) return "phrase";
  return isThai(text[end - 1]) && isThai(text[j]) ? "phrase" : "inline";
}

// text → [{ text, brand, brk }]. Brand terms are atomic tokens (never split); everything
// else goes through Intl.Segmenter("th"). Whitespace is consumed into `brk`.
export function segmentThai(text, brands = []) {
  const plan = brandPlan(brands);
  const lower = text.toLowerCase();
  const tokens = [];
  let i = 0;
  let pending = ""; // non-brand text waiting to be segmented
  let pendingStart = 0;

  const flushPending = () => {
    if (!pending) return;
    for (const seg of segment(pending)) {
      const start = pendingStart + seg.index;
      const end = start + seg.segment.length;
      if (/^\s+$/.test(seg.segment)) continue;
      const prev = tokens[tokens.length - 1];
      const attach =
        prev &&
        !prev.brand &&
        prev.brk === "none" &&
        (TRAILING_MARK.test(seg.segment) || (!seg.isWordLike && !/^\s/.test(seg.segment)));
      if (attach) {
        prev.text += seg.segment;
        prev.end = end;
        prev.brk = breakKind(text, end);
      } else tokens.push({ text: seg.segment, brand: false, start, end, brk: breakKind(text, end) });
    }
    pending = "";
  };

  while (i < text.length) {
    const hit = plan.find((p) => lower.startsWith(p.lower, i));
    if (hit) {
      flushPending();
      const end = i + hit.term.length;
      tokens.push({ text: text.slice(i, end), brand: true, start: i, end, brk: breakKind(text, end) });
      i = end;
      continue;
    }
    if (!pending) pendingStart = i;
    pending += text[i];
    i++;
  }
  flushPending();
  return tokens.map(({ text: t, brand, brk }) => ({ text: t, brand, brk }));
}

// Character timeline from TTS word timings: each char gets an even share of its word's span.
function charTimeline(timedWords) {
  const chars = [];
  for (const w of timedWords) {
    const s = squash(String(w.text ?? ""));
    if (!s) continue;
    const step = (w.end - w.start) / s.length;
    for (let k = 0; k < s.length; k++)
      chars.push({ ch: s[k], start: w.start + step * k, end: w.start + step * (k + 1) });
  }
  return chars;
}

// tokens + TTS word timings for the same line → tokens with start/end.
// Exact path: the squashed token text equals the squashed TTS text → char-accurate times.
// Fallback (TTS normalized the text, e.g. "299" spoken as words): times are spread over the
// line's span by character position. `exact` tells the caller which path ran.
export function alignTimings(tokens, timedWords) {
  const chars = charTimeline(timedWords);
  if (!chars.length) return { tokens: [], exact: false };
  const lineText = squash(tokens.map((t) => t.text).join(""));
  const exact = lineText === chars.map((c) => c.ch).join("");
  const t0 = chars[0].start;
  const t1 = chars[chars.length - 1].end;
  const total = lineText.length || 1;
  let pos = 0;
  const out = tokens.map((t) => {
    const len = squash(t.text).length;
    const a = pos;
    const b = pos + len - 1;
    pos += len;
    if (exact) return { ...t, start: chars[a].start, end: chars[b].end };
    return { ...t, start: t0 + ((t1 - t0) * a) / total, end: t0 + ((t1 - t0) * (b + 1)) / total };
  });
  return { tokens: out, exact };
}

// Timed tokens of ONE frame → caption groups. A group closes at a Thai phrase break, a
// Latin sentence-end mark, a silence gap, or when the next token would push it past
// maxChars visible characters. Brand tokens are single tokens, so a group boundary can
// never fall inside one.
export function groupTokens(tokens, { maxChars, silenceGap = 0.18 } = {}) {
  const groups = [];
  let cur = null;
  let len = 0;
  for (const t of tokens) {
    const prev = cur && cur[cur.length - 1];
    const tLen = visibleLength(t.text);
    const gap = prev && t.start - prev.end > silenceGap;
    const full = cur && len + tLen > maxChars;
    if (!cur || gap || full) {
      if (cur) groups.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(t);
    len += tLen;
    if (t.brk === "phrase" || SENT_END.test(t.text)) {
      groups.push(cur);
      cur = null;
    }
  }
  if (cur) groups.push(cur);
  // Display text per word: Thai words touch; an inline space survives as a trailing NBSP
  // (the caption CSS sets the word gap to 0, so this is the only space rendered).
  return groups.map((g) =>
    g.map((t, i) => ({
      ...t,
      display: t.text.replace(/\s/g, NBSP) + (t.brk === "inline" && i < g.length - 1 ? NBSP : ""),
    })),
  );
}
