#!/usr/bin/env node
// Usage:
//   node bin/cli.mjs <kind> <module> [--export name] [--unit cells|chars|bytes] [--adapter "(s, n) => fn(s, {length: n})"]
//                    [--seed 1] [--n 500] [--json]
// Examples:
//   node bin/cli.mjs width string-width
//   node bin/cli.mjs truncate lodash.truncate --unit chars --adapter "(s, n) => fn(s, {length: n, omission: ''})"
//   node bin/cli.mjs wrap ./my-wrap.js --export wrapText
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { check, kinds } from '../src/index.mjs';

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(`--${name}`); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const bool = (name) => { const i = args.indexOf(`--${name}`); if (i < 0) return false; args.splice(i, 1); return true; };

const json = bool('json');
const exportName = flag('export', 'default');
const unit = flag('unit', 'cells');
const adapter = flag('adapter', null);
const seed = Number(flag('seed', 1)), n = Number(flag('n', 500));
const [kind, spec] = args;

if (!kind || !spec || !(kind in kinds)) {
  console.error('usage: sara <kind> <module> [--export name] [--unit cells|chars|bytes] [--adapter "<js>"] [--seed 1] [--n 500] [--json]');
  console.error('kinds:'); for (const [k, sig] of Object.entries(kinds)) console.error(`  ${k.padEnd(10)} fn: ${sig}`);
  process.exit(2);
}

// Resolve a local path relative to the caller, otherwise a package from the caller's node_modules.
const local = resolve(process.cwd(), spec);
let url;
if (existsSync(local)) url = pathToFileURL(local).href;
else url = pathToFileURL(createRequire(resolve(process.cwd(), 'package.json')).resolve(spec)).href;
const mod = await import(url);
let fn = exportName === 'default' ? (mod.default ?? mod) : mod[exportName];
if (fn && typeof fn === 'object' && typeof fn.default === 'function') fn = fn.default;
if (typeof fn !== 'function') { console.error(`export "${exportName}" of ${spec} is not a function`); process.exit(2); }
// The adapter is the user's own code, used to fit the function to the kind's signature.
if (adapter) fn = new Function('fn', `return (${adapter});`)(fn);

const r = check(kind, fn, { unit, seed, n });
if (json) { console.log(JSON.stringify(r, null, 1)); process.exit(r.failed ? 1 : 0); }

console.log(`${kind} (${unit}) on ${spec}${exportName !== 'default' ? '#' + exportName : ''}: ${r.failed}/${r.cases} inputs fail` +
  (r.failedSaraAm ? `  (+${r.failedSaraAm} more only on inputs with SARA AM U+0E33: not counted, its cell width is disputed` + (kind === 'width' ? '; run kind am-equiv' : '') + ')' : ''));
console.log(`  [seed ${r.seed}, node ${r.env.node}, ICU ${r.env.icu}, Unicode ${r.env.unicode}]`);
for (const [k, c] of Object.entries(r.kinds)) console.log(`  ${String(c).padStart(4)}  ${k}`);
for (const e of r.counterexamples) console.log(`  e.g. ${JSON.stringify(e.input)}  [${e.codepoints}]\n       ${e.violation}`);
process.exit(r.failed ? 1 : 0);
