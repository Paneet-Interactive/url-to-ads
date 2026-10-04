import assert from "node:assert/strict";
import test from "node:test";
import { coversThai, declaredThaiFamilies, stripThaiSection, SECTION_END, SECTION_START } from "./lib/thai-font-faces.mjs";

test("coversThai matches ranges that overlap U+0E01–0E5B", () => {
  assert.equal(coversThai("U+02D7, U+0303, U+0331, U+0E01-0E5B, U+200C-200D"), true);
  assert.equal(coversThai("U+0000-FFFF"), true);
  assert.equal(coversThai("U+0E??"), true);
  assert.equal(coversThai("U+0E2D"), true);
  assert.equal(coversThai("U+0000-00FF, U+0131, U+2000-206F"), false);
  assert.equal(coversThai("U+0E5C-0E7F"), false);
});

test("declaredThaiFamilies finds only families with a Thai-covering face", () => {
  const md = `
@font-face{font-family:'Maitree';font-weight:400;src:url("a.woff2");unicode-range:U+0E01-0E5B, U+200C-200D;}
@font-face{font-family:'Maitree';font-weight:400;src:url("b.woff2");unicode-range:U+0000-00FF;}
@font-face{font-family:"Inter";src:url("c.woff2");unicode-range:U+0000-00FF;}
@font-face{font-family:"Bebas Neue";src:url("d.woff2");}`;
  assert.deepEqual([...declaredThaiFamilies(md)], ["maitree"]);
});

test("stripThaiSection removes only our own appended section", () => {
  const ours = `${SECTION_START}\n@font-face{font-family:"Kanit";unicode-range:U+0E01-0E5B;}\n${SECTION_END}\n`;
  const md = `# frame\n\nbrand\n\n${ours}`;
  assert.equal(stripThaiSection(md), "# frame\n\nbrand\n\n");
  assert.equal(declaredThaiFamilies(stripThaiSection(md)).size, 0);
});
