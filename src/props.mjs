// Properties. Each returns null on pass, or a short string describing the violation.
import { refWidth, boundaries, isMark, thaiMarks, CONS } from './thai.mjs';

const ELLIPSIS = /[…]$|\.\.\.$/;

export const WIDTH = (fn) => (s) => {
  const got = fn(s), want = refWidth(s);
  return got === want ? null : `width ${got} != ${want}`;
};

// truncate(s, n) must return a grapheme-aligned prefix (+ optional ellipsis) that fits in n cells
export const TRUNC = (fn) => (s) => {
  for (let n = 1; n < refWidth(s); n++) {
    const out = fn(s, n), core = out.replace(ELLIPSIS, '');
    if (!s.startsWith(core)) return `n=${n}: not a prefix: "${out}"`;
    if (!boundaries(s).has(core.length)) return `n=${n}: splits a grapheme: "${out}"`;
    if (refWidth(out) > n) return `n=${n}: width ${refWidth(out)} > ${n}: "${out}"`;
  }
  return null;
};

// slice(s, 0, k) by columns: grapheme-aligned prefix that fits in k cells
export const SLICE = (fn) => (s) => {
  for (let k = 1; k < refWidth(s); k++) {
    const out = fn(s, 0, k);
    if (!s.startsWith(out)) return `k=${k}: not a prefix: "${out}"`;
    if (!boundaries(s).has(out.length)) return `k=${k}: splits a grapheme: "${out}"`;
    if (refWidth(out) > k) return `k=${k}: width ${refWidth(out)} > ${k}: "${out}"`;
    const rest = fn(s, k);
    if (rest && isMark([...rest][0])) return `k=${k}: tail starts with orphan mark: "${rest}"`;
  }
  return null;
};

// hard wrap at n columns: no content lost or duplicated, no line over n, no line starting with a mark
export const WRAP = (fn) => (s) => {
  for (const n of [2, 3, 5, 8]) {
    const lines = fn(s, n).split('\n');
    const strip = (x) => x.replace(/\s+/g, '');
    if (strip(lines.join('')) !== strip(s)) return `n=${n}: content changed: ${JSON.stringify(lines)}`;
    for (const l of lines) {
      if (refWidth(l) > n) return `n=${n}: line width ${refWidth(l)} > ${n}: "${l}"`;
      if (l && isMark([...l][0])) return `n=${n}: line starts with orphan mark: "${l}"`;
    }
  }
  return null;
};

// slug / tokenizer must keep Thai text intact. Two failure kinds are kept apart:
// DROP_ALL  = Thai removed entirely (a transliteration-only design choice, reported but not a bug)
// DROP_MARK = consonants kept but vowel/tone marks stripped (corrupts the word: the bug class)
export const MARKS = (fn) => (s) => {
  const out = fn(s);
  const cons = (x) => [...x].filter((c) => CONS.includes(c)).length;
  if (cons(out) === 0 && cons(s) > 0) return `DROP_ALL: "${out}"`;
  if (thaiMarks(out) < thaiMarks(s)) return `DROP_MARK: ${thaiMarks(s)}->${thaiMarks(out)} marks: "${out}"`;
  return null;
};

// Metamorphic, oracle-free: U+0E33 and U+0E4D U+0E32 render identically (NFKC-equivalent),
// so any width function must agree on both, whatever cell model the terminal uses.
export const AM_EQUIV = (fn) => (s) => {
  if (!s.includes('ำ')) return null;
  const alt = s.replaceAll('ำ', 'ํา');
  const a = fn(s), b = fn(alt);
  return a === b ? null : `width(ำ)=${a} but width(ํา)=${b}`;
};

// segmentation must equal ICU extended grapheme clusters (UAX #29)
import { graphemes as icuGraphemes } from './thai.mjs';
export const GRAPHEME = (fn) => (s) => {
  const got = fn(s), want = icuGraphemes(s);
  if (got.join('') !== s) return `content changed: ${JSON.stringify(got)}`;
  if (got.length !== want.length || got.some((g, i) => g !== want[i])) {
    const k = got.findIndex((g, i) => g !== want[i]);
    return `splits ${JSON.stringify(want[k])} as ${JSON.stringify(got.slice(k, k + 2))}`;
  }
  return null;
};

// ---- unit-free grapheme-integrity variants (Amendment 1.2), for byte- and char-based APIs ----
const utf8 = (s) => Buffer.byteLength(s, 'utf8');
export const UNIT = { bytes: utf8, chars: (s) => s.length };

export const TRUNC_G = (fn, unit) => (s) => {
  for (let n = 1; n < unit(s); n++) {
    const out = fn(s, n), core = out.replace(ELLIPSIS, '');
    if (!s.startsWith(core)) return `n=${n}: not a prefix: "${out}"`;
    if (!boundaries(s).has(core.length)) return `n=${n}: splits a grapheme: "${out}"`;
  }
  return null;
};

export const SLICE_G = (fn, unit) => (s) => {
  for (let k = 1; k < unit(s); k++) {
    const out = fn(s, 0, k);
    if (!s.startsWith(out)) return `k=${k}: not a prefix: "${out}"`;
    if (!boundaries(s).has(out.length)) return `k=${k}: splits a grapheme: "${out}"`;
    const rest = fn(s, k);
    if (rest && isMark([...rest][0])) return `k=${k}: tail starts with orphan mark: "${rest}"`;
  }
  return null;
};

export const WRAP_G = (fn) => (s) => {
  for (const n of [2, 3, 5, 8]) {
    const lines = fn(s, n).split('\n');
    const strip = (x) => x.replace(/\s+/g, '');
    if (strip(lines.join('')) !== strip(s)) return `n=${n}: content changed: ${JSON.stringify(lines)}`;
    for (const l of lines) if (l.trimStart() && isMark([...l.trimStart()][0])) return `n=${n}: line starts with orphan mark: "${l}"`;
  }
  return null;
};
