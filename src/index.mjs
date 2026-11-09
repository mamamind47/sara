// Public API. Zero runtime dependencies: oracles come from the JS engine's Unicode data (regex \p{..})
// and ICU (Intl.Segmenter). No network, no model, no randomness beyond the seeded generator.
import { cases, graphemes, refWidth, hex } from './thai.mjs';
import { WIDTH, TRUNC, SLICE, WRAP, MARKS, AM_EQUIV, GRAPHEME, TRUNC_G, SLICE_G, WRAP_G, UNIT } from './props.mjs';

export { cases as thaiStrings, graphemes, refWidth as cellWidth, hex as codePoints };

// kind -> how to build the property for a given unit
const KINDS = {
  width: { signature: '(s) => number', build: (fn) => WIDTH(fn) },
  'am-equiv': { signature: '(s) => number', build: (fn) => AM_EQUIV(fn) },
  truncate: { signature: '(s, n) => string', build: (fn, unit) => (unit === 'cells' ? TRUNC(fn) : TRUNC_G(fn, UNIT[unit])) },
  slice: { signature: '(s, start, end?) => string', build: (fn, unit) => (unit === 'cells' ? SLICE(fn) : SLICE_G(fn, UNIT[unit])) },
  wrap: { signature: '(s, n) => string', build: (fn, unit) => (unit === 'cells' ? WRAP(fn) : WRAP_G(fn)) },
  marks: { signature: '(s) => string', build: (fn) => MARKS(fn) },
  graphemes: { signature: '(s) => string[]', build: (fn) => GRAPHEME(fn) },
};
export const kinds = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.signature]));
const UNITS = ['cells', 'chars', 'bytes'];

/**
 * Run one property against a function over the seeded Thai corpus.
 * @param {keyof KINDS} kind   which property (see `kinds`)
 * @param {Function} fn         the function under test, adapted to the kind's signature
 * @param {object} [o]
 * @param {'cells'|'chars'|'bytes'} [o.unit='cells']  the length unit the function documents
 * @param {number} [o.seed=1]  generator seed
 * @param {number} [o.n=500]   generated strings (the 15 fixed seed words are always added)
 * @param {number} [o.examples=3]  minimal counterexamples to return
 * @returns {{kind, unit, seed, cases, failed, failedSaraAm, kinds, counterexamples}}
 *   `failed` counts failures on inputs WITHOUT U+0E33 for cell-based properties
 *   (its width is disputed between terminals; use kind 'am-equiv' for it). `failedSaraAm` counts the rest.
 */
export function check(kind, fn, { unit = 'cells', seed = 1, n = 500, examples = 3 } = {}) {
  if (!KINDS[kind]) throw new TypeError(`unknown kind "${kind}"; expected one of ${Object.keys(KINDS).join(', ')}`);
  if (!UNITS.includes(unit)) throw new TypeError(`unknown unit "${unit}"; expected one of ${UNITS.join(', ')}`);
  if (typeof fn !== 'function') throw new TypeError('fn must be a function');
  const prop = KINDS[kind].build(fn, unit);
  const splitAm = unit === 'cells' && ['width', 'truncate', 'slice', 'wrap'].includes(kind);
  const corpus = [...cases(seed, n)];
  const fails = [];
  for (const s of corpus) {
    let r;
    try { r = prop(s); } catch (e) { r = `THREW ${e && e.message}`; }
    if (r) fails.push({ input: s, codepoints: hex(s), violation: r, saraAm: s.includes('ำ') });
  }
  fails.sort((a, b) => [...a.input].length - [...b.input].length);
  const counted = splitAm ? fails.filter((f) => !f.saraAm) : fails;
  const tally = {};
  for (const f of counted) { const k = f.violation.replace(/^(n|k)=\d+: /, '').split(/[:"]/)[0].replace(/\d+/g, '#').trim(); tally[k] = (tally[k] || 0) + 1; }
  return {
    kind, unit, seed, cases: corpus.length,
    // the oracle is ICU's segmentation + the engine's Unicode tables: record them for reproducibility
    env: { node: process.versions.node, icu: process.versions.icu, unicode: process.versions.unicode },
    failed: counted.length, failedSaraAm: splitAm ? fails.length - counted.length : 0,
    kinds: tally, counterexamples: counted.slice(0, examples).map(({ saraAm, ...f }) => f),
  };
}
