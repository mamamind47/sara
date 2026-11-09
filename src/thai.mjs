// Thai script model: character classes, seeded generator, and reference oracles.
// Ground truth comes from Unicode properties (UCD via V8 regex) and ICU (Intl.Segmenter),
// never from the library under test.

export const CONS = [...'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ'];
export const LEAD = [...'เแโใไ'];                 // prepended vowels (Lo, spacing, written BEFORE the consonant)
export const ABOVE = ['ั', 'ิ', 'ี', 'ึ', 'ื', '็']; // Mn
export const BELOW = ['ุ', 'ู', 'ฺ'];                                // Mn
export const TONE = ['่', '้', '๊', '๋'];                       // Mn
export const FOLLOW = ['ะ', 'า', 'ๅ'];                               // Lo, spacing
export const SARA_AM = 'ำ';               // Lo, Grapheme_Cluster_Break=SpacingMark
export const SARA_AM_DECOMP = 'ํา';  // NIKHAHIT + SARA AA (NFKC form)

// mulberry32: small deterministic PRNG so every counterexample is reproducible from its seed
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];

// One orthographically plausible syllable. Stacking order follows Thai spelling:
// [lead] C [above|below] [tone] [follow|SARA AM] [final C]
export function syllable(r, { decomposedAm = false } = {}) {
  let s = '';
  if (r() < 0.25) s += pick(r, LEAD);
  s += pick(r, CONS);
  const v = r();
  if (v < 0.35) s += pick(r, ABOVE); else if (v < 0.5) s += pick(r, BELOW);
  if (r() < 0.45) s += pick(r, TONE);
  const f = r();
  if (f < 0.15) s += decomposedAm ? SARA_AM_DECOMP : SARA_AM;
  else if (f < 0.35) s += pick(r, FOLLOW);
  if (r() < 0.4) s += pick(r, CONS);
  return s;
}

// Hand-picked words that triggered real bugs in the issue corpus
export const SEEDS = ['น้ำ', 'คำ', 'ที่', 'สวัสดี', 'กำลัง', 'พลัง', 'ปฏัก', 'ติดตั้ง', 'เก่ง', 'รู้แล้วอยู่',
  'ไม้เอก', 'สำคัญ', 'ประเทศไทย', 'โอนเงิน', 'ทำไม'];

export function* cases(seed, n) {
  const r = rng(seed);
  for (const s of SEEDS) yield s;
  for (let i = 0; i < n; i++) {
    const k = 1 + Math.floor(r() * 6);
    let s = '';
    for (let j = 0; j < k; j++) s += syllable(r);
    if (r() < 0.2) s = 'ab ' + s;          // mixed script: Latin first (pdfme bug class)
    if (r() < 0.2) s = s + ' x' + syllable(r);
    yield s;
  }
}

// ---------- oracles ----------
const seg = new Intl.Segmenter('th', { granularity: 'grapheme' });
export const graphemes = (s) => [...seg.segment(s)].map((x) => x.segment);

// Terminal cell model (wcwidth / POSIX): nonspacing & enclosing marks and format chars are 0,
// everything else in our alphabet (ASCII, Thai Lo incl. SARA AM) is 1. Our generator emits
// no East-Asian-wide characters, so this is exact for every generated input.
export function refWidth(s) {
  let w = 0;
  for (const ch of s) w += /[\p{Mn}\p{Me}\p{Cf}]/u.test(ch) ? 0 : 1;
  return w;
}

export const isMark = (ch) => /[\p{Mn}\p{Me}]/u.test(ch);
// grapheme-boundary set, in UTF-16 offsets
export function boundaries(s) {
  const b = new Set([0]); let o = 0;
  for (const g of graphemes(s)) { o += g.length; b.add(o); }
  return b;
}
export const thaiMarks = (s) => [...s].filter((c) => /[ัิ-ฺ็-๎]/.test(c)).length;
export const hex = (s) => [...s].map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
