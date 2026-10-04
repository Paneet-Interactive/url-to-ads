import assert from "node:assert/strict";
import test from "node:test";
import { alignTimings, groupTokens, segmentThai, visibleLength } from "./lib/thai-text.mjs";

const texts = (tokens) => tokens.map((t) => t.text);

test("Intl.Segmenter alone splits the brand; the dictionary keeps it whole", () => {
  assert.deepEqual(texts(segmentThai("นกโหรบอกดวง")).slice(0, 2), ["นก", "โหร"]);
  assert.deepEqual(texts(segmentThai("นกโหรบอกดวง", ["นกโหร"])), ["นกโหร", "บอก", "ดวง"]);
});

test("brand match is case-insensitive for Latin and may contain spaces", () => {
  const t = segmentThai("ใช้ paneet Interactive ทุกวัน", ["Paneet Interactive"]);
  assert.deepEqual(texts(t), ["ใช้", "paneet Interactive", "ทุก", "วัน"]);
  assert.equal(t[1].brand, true);
});

test("space between Thai characters is a phrase break; space around numbers/Latin is inline", () => {
  const t = segmentThai("ราคา 299 บาท ลดพิเศษ");
  assert.deepEqual(
    t.map((x) => [x.text, x.brk]),
    [["ราคา", "inline"], ["299", "inline"], ["บาท", "phrase"], ["ลด", "none"], ["พิเศษ", "phrase"]],
  );
});

test("mai yamok and punctuation stay on the word before them", () => {
  assert.deepEqual(texts(segmentThai("ไปเที่ยวกันเถอะๆ!")), ["ไป", "เที่ยว", "กัน", "เถอะๆ!"]);
});

test("exact alignment maps TTS timings onto Thai tokens by character", () => {
  const tokens = segmentThai("นกโหรบอก", ["นกโหร"]);
  // TTS returned two chunks with different boundaries from ours
  const words = [
    { text: "นกโห", start: 0, end: 0.4 },
    { text: "รบอก", start: 0.4, end: 0.8 },
  ];
  const { tokens: out, exact } = alignTimings(tokens, words);
  assert.equal(exact, true);
  assert.deepEqual(out.map((t) => [t.text, t.start, Number(t.end.toFixed(3))]), [["นกโหร", 0, 0.5], ["บอก", 0.5, 0.8]]);
});

test("mismatched TTS text falls back to proportional timing over the line span", () => {
  const { tokens, exact } = alignTimings(segmentThai("ราคา 299 บาท"), [
    { text: "ราคา", start: 1, end: 1.5 },
    { text: "สองร้อยเก้าสิบเก้า", start: 1.5, end: 2.5 },
    { text: "บาท", start: 2.5, end: 3 },
  ]);
  assert.equal(exact, false);
  assert.equal(tokens[0].start, 1);
  assert.equal(tokens.at(-1).end, 3);
});

const timed = (text, brands, perChar = 0.05) => {
  const tokens = segmentThai(text, brands);
  let t = 0;
  return tokens.map((x) => {
    const start = t;
    t += x.text.length * perChar;
    return { ...x, start, end: t };
  });
};

test("groups close at Thai phrase breaks without any Latin punctuation", () => {
  const g = groupTokens(timed("สวัสดีครับ วันนี้มีโปรพิเศษ"), { maxChars: 40 });
  assert.deepEqual(g.map((x) => x.map((w) => w.display).join("")), ["สวัสดีครับ", "วันนี้มีโปรพิเศษ"]);
});

test("long phrases split by visible length, never inside a brand name", () => {
  const text = "ดูดวงรายวันกับนกโหรแม่นทุกวันทุกเวลา";
  for (let max = 4; max <= 20; max++) {
    const g = groupTokens(timed(text, ["นกโหร"]), { maxChars: max });
    const flat = g.flat();
    assert.ok(flat.some((w) => w.text === "นกโหร" && w.brand), `brand whole at maxChars=${max}`);
    assert.equal(flat.map((w) => w.text).join(""), text);
  }
});

test("inline spaces render as NBSP inside a group, Thai words touch", () => {
  const g = groupTokens(timed("ราคา 299 บาท"), { maxChars: 40 });
  assert.equal(g.length, 1);
  assert.equal(g[0].map((w) => w.display).join(""), "ราคา 299 บาท");
});

test("visibleLength ignores marks above/below the line", () => {
  assert.equal(visibleLength("ที่"), 1);
  assert.equal(visibleLength("น้ำ"), 2);
});
