// `npm test`: the oracles must reject known-wrong implementations (positive controls)
// and accept known-correct ones (negative controls). If any control misbehaves, no result is trustworthy.
import { check, graphemes, cellWidth } from './index.mjs';

const segTrunc = (s, n) => { let o = '', w = 0; for (const g of graphemes(s)) { if (w + cellWidth(g) > n) break; o += g; w += cellWidth(g); } return o; };
const segTruncChars = (s, n) => { let o = ''; for (const g of graphemes(s)) { if (o.length + g.length > n) break; o += g; } return o; };
const segWrap = (s, n) => { const L = ['']; let w = 0; for (const g of graphemes(s)) { const gw = cellWidth(g); if (w + gw > n) { L.push(''); w = 0; } L[L.length - 1] += g; w += gw; } return L.join('\n'); };
const segSlice = (s, a, b = Infinity) => { let o = '', w = 0; for (const g of graphemes(s)) { const gw = cellWidth(g); if (w >= a && w + gw <= b) o += g; w += gw; } return o; };

const CONTROLS = [
  // must FAIL
  ['width', (s) => s.length, {}, 'fail'],
  ['am-equiv', (s) => cellWidth(s.replaceAll('ำ', '')), {}, 'fail'],
  ['truncate', (s, n) => s.slice(0, n), {}, 'fail'],
  ['truncate', (s, n) => s.slice(0, n), { unit: 'chars' }, 'fail'],
  ['truncate', (s, n) => Buffer.from(s).subarray(0, n).toString().replace(/�+$/, ''), { unit: 'bytes' }, 'fail'],
  ['slice', (s, a, b) => s.slice(a, b), {}, 'fail'],
  ['wrap', (s, n) => s.match(new RegExp(`[^]{1,${n}}`, 'g')).join('\n'), {}, 'fail'],
  ['wrap', (s, n) => s.match(new RegExp(`[^]{1,${n}}`, 'g')).join('\n'), { unit: 'chars' }, 'fail'],
  ['marks', (s) => s.replace(/[^\p{L}\p{N}]/gu, ''), {}, 'fail'],
  ['graphemes', (s) => [...s], {}, 'fail'],
  // must PASS
  ['width', cellWidth, {}, 'pass'],
  ['am-equiv', cellWidth, {}, 'pass'],
  ['truncate', segTrunc, {}, 'pass'],
  ['truncate', segTruncChars, { unit: 'chars' }, 'pass'],
  ['slice', segSlice, {}, 'pass'],
  ['wrap', segWrap, {}, 'pass'],
  ['wrap', segWrap, { unit: 'chars' }, 'pass'],
  ['marks', (s) => s, {}, 'pass'],
  ['graphemes', graphemes, {}, 'pass'],
];

let bad = 0;
for (const [kind, fn, o, want] of CONTROLS) {
  const r = check(kind, fn, o);
  const got = r.failed + r.failedSaraAm > 0 ? 'fail' : 'pass';
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'} ${kind.padEnd(9)} ${(o.unit || 'cells').padEnd(5)} expect ${want}  got ${got} (${r.failed}+${r.failedSaraAm}/${r.cases})`);
}
// determinism: same seed -> same corpus and same verdicts
const a = JSON.stringify(check('truncate', (s, n) => s.slice(0, n))), b = JSON.stringify(check('truncate', (s, n) => s.slice(0, n)));
if (a !== b) { bad++; console.log('BAD determinism'); } else console.log('ok  determinism (same seed, same report)');
if (bad) { console.error(`\n${bad} control(s) misbehaved: the oracles are not trustworthy`); process.exit(1); }
console.log('\nall controls behave as expected');
