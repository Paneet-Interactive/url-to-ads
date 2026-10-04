# Thai ad copy — on-screen text for a silent ad

Read this before writing `STORYBOARD.md` for a `Language: th` ad. The ad has no narration
(SKILL.md § 3.3), so the on-screen lines are the whole message.

## Source rule

Every claim, number, price, and promise comes from the captured site
(`capture/extracted/`) or from the user. Do not invent a discount, a statistic, a review, a
"best seller" badge, or a deadline. If the site has no offer, the ad has no offer.

## Tone

- Write Thai the way Thai brands write ads, not translated English. Short noun phrases and verbs
  beat full sentences: `ดูดวงแม่น ทุกเช้า` not `เราให้บริการดูดวงที่แม่นยำทุกเช้า`.
- Match the site's own register. A playful brand can use casual words (`ปัง`, `โดนใจ`); a clinic,
  bank, or B2B site stays plain and polite.
- No polite particles on screen (`ครับ` / `ค่ะ` / `นะคะ`) — they belong to speech.
- Common loanwords in Thai script are fine (`โปร`, `ฟรี`, `ออนไลน์`, `แอด LINE`). Keep the brand
  name exactly as the site spells it, Thai or Latin.
- Prices: Arabic digits with `บาท` or `.-` (`299 บาท`, `฿299`). Thai digits only if the brand uses them.
- One idea per frame. If a line needs a comma, it is two frames.

## Spacing and line breaks

- In Thai, a space marks a phrase break, not a word break. Put a space only where a reader would
  pause: `ราคาพิเศษ 299 บาท` · `สมัครง่าย ใช้ได้ทันที`.
- Wrap every brand or product name in `<span style="white-space:nowrap">…</span>` in frame HTML.
  The browser's Thai line breaker can split an unknown name across lines (`นก` / `โหร`).
- Thai has no uppercase. Ignore a preset's `upper: true` and letter-spacing on Thai lines.

## Length per beat

Count **visible** characters: Thai marks above or below the line (`ั ิ ี ึ ื ุ ู ็ ่ ้ ๊ ๋ ์`) do
not count. `thai-copy.mjs check` counts them for you.

| Beat                    | Visible characters | Example                         |
| ----------------------- | ------------------ | ------------------------------- |
| Hook (first frame)      | ≤ 14               | `ดวงวันนี้ ว่าไง?`                 |
| Problem / desire        | ≤ 20               | `อยากรู้ดวงก่อนออกจากบ้าน`         |
| Product / proof / offer | ≤ 24 per line, ≤ 2 lines | `แอด LINE รับดวงฟรี ทุกเช้า`   |
| CTA (last frame)        | ≤ 16 + the handle / URL | `แอดเลย` + `@nokhora`        |

Frame duration (no voice to sync to): `max(2.5, 1.0 + visible characters ÷ 12)` seconds. A 15-second
ad holds about 4–5 frames; a 30-second ad about 7–9.

## Claims: อย. and สคบ.

Thai advertising law is enforced by the Office of the Consumer Protection Board (สคบ.) and, for
health products, the Food and Drug Administration (อย.). This section is a reminder, not legal
advice. When a rule below applies, tell the user in the plan which lines carry a regulated claim
and that they are responsible for clearing them before the ad runs.

**Every product (สคบ., Consumer Protection Act B.E. 2522):** no false or exaggerated statements and
nothing that misleads about the product. Superlatives and guarantees need proof the user can show:
`ที่สุด`, `อันดับ 1`, `ดีกว่า…`, `100%`, `การันตี`, `ถูกที่สุด`. Keep them only if the site states them
with a source; otherwise drop them.

**Food and supplements (อย.):** no claim that a food or supplement treats, cures, or prevents a
disease, and no weight-loss or body-change promise (`ลดน้ำหนัก`, `เผาผลาญไขมัน`, `หายขาด`, `ลดเบาหวาน`).
Health-related food advertising may need prior approval from อย.; if the site shows an approval
number for advertising, keep it on screen as the site does.

**Cosmetics (อย., Cosmetic Act B.E. 2558):** a cosmetic may not claim a drug effect — no `รักษา`
(treat), `หายขาด`, `ลดการอักเสบ`, `ฆ่าเชื้อ`, and no fixed-time results (`ขาวใสใน 7 วัน`).

**Drugs, medical devices, clinics:** advertising generally needs prior approval from อย. Do not
write new benefit claims; use only the site's wording and flag the frame to the user.

**Stop and ask the user** before making an ad for alcohol, tobacco / e-cigarettes, gambling, or
loans — these categories have bans or strict format rules in Thai law.

`thai-copy.mjs check` flags common risky words. A clean check does not mean the copy is legal; it
only means none of the listed words appear.
