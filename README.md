# SARA: Script-Aware Robustness Assertions

*sara* (สระ) is Thai for "vowel": the marks that most text-handling code gets wrong.

Property-based oracles that find **Thai (complex-script) text-handling bugs** in the functions that measure, cut, wrap and slugify strings: display width, truncate, slice, word-wrap, slug/case conversion and grapheme splitting.

Point it at a function and it does three things:
1. Runs the function on a seeded corpus of orthographically plausible Thai and mixed Thai/Latin strings.
2. Checks each result against oracles taken from the Unicode standard, not from the library under test.
3. Reports minimal counterexamples with their code points.

```
$ npx sara wrap fast-wrap-ansi --export wrapAnsi --adapter "(s, n) => fn(s, n, {hard: true, trim: false})"
wrap (cells) on fast-wrap-ansi#wrapAnsi: 186/515 inputs fail  (+204 more only on inputs with SARA AM U+0E33: not counted, its cell width is disputed)
  [seed 1, node 24.22.1, ICU 78.3, Unicode 17.0]
   186  line starts with orphan mark
  e.g. "พลัง"  [U+0E1E U+0E25 U+0E31 U+0E07]
       n=2: line starts with orphan mark: "ัง"
```

**No AI is involved at run time.** The tool is deterministic JavaScript with **zero runtime dependencies**. Its oracles are:
- ICU extended grapheme clusters (UAX #29) via `Intl.Segmenter`
- the engine's Unicode property tables (`\p{Mn}`, `\p{Me}`, `\p{Cf}`)
- the POSIX `wcwidth` cell model

The same seed always gives the same corpus and the same verdicts.

## Install

Requires Node.js ≥ 20. Tested on Node 24.22.1 (ICU 78.3, Unicode 17.0). No runtime dependencies.

```sh
npm install --save-dev github:mamamind47/sara   # or: git clone, then npm test
npx sara --help
```

## Properties

| kind | function shape | property checked |
|---|---|---|
| `width` | `(s) => number` | equals the `wcwidth` cell count: marks (Mn/Me) and format characters (Cf) are 0, everything else in the corpus is 1 |
| `am-equiv` | `(s) => number` | **model-free**: `width(s)` equals `width(s with ำ → ํา)`, because U+0E33 and U+0E4D U+0E32 render identically |
| `truncate` | `(s, n) => string` | result (minus a trailing `…`/`...`) is a prefix, ends on a grapheme boundary, and, for unit `cells`, fits in `n` cells |
| `slice` | `(s, start, end?) => string` | `slice(s, 0, k)` is a grapheme-aligned prefix (fitting `k` cells for unit `cells`); `slice(s, k)` does not start with an orphan mark |
| `wrap` | `(s, n) => string` | content preserved (ignoring whitespace), no line starts with an orphan mark, and, for unit `cells`, no line wider than `n` (n ∈ {2, 3, 5, 8}) |
| `marks` | `(s) => string` | vowel signs and tone marks are not stripped while their consonants are kept (`DROP_MARK`). Removing all Thai is reported as `DROP_ALL` (transliteration) |
| `graphemes` | `(s) => string[]` | equals ICU's extended grapheme clusters |

### Units
Pass the unit the function documents with `--unit` / `{unit}`:
- `cells`: terminal columns. This is the default and uses the full properties.
- `chars`: UTF-16 code units or code points.
- `bytes`: UTF-8 bytes.

For `chars` and `bytes` only **grapheme integrity** is checked, not the length bound. A byte-based truncator is never blamed for being "too wide".

### SARA AM (U+0E33)
Terminals disagree on whether `ำ` takes one cell (libc `wcwidth`) or none. For cell-based properties, failures on inputs that contain U+0E33 are therefore reported separately (`failedSaraAm`) and are **not** counted. Use `am-equiv` to test U+0E33 handling without choosing a side.

## Use from code

```js
import { check } from 'sara-check';
import cliTruncate from 'cli-truncate';

const r = check('truncate', (s, n) => cliTruncate(s, n), { unit: 'cells' });
// { kind, unit, seed, cases: 515, env: {node, icu, unicode}, failed, failedSaraAm, kinds, counterexamples: [...] }
if (r.failed) console.log(r.counterexamples);
```

Options: `seed` (default 1), `n` generated strings (default 500, plus 15 fixed words taken from real bug reports), and `examples` (default 3).

Other exports:
- `thaiStrings(seed, n)`: the generator
- `graphemes(s)`
- `cellWidth(s)`
- `codePoints(s)`
- `kinds`

## CLI

```
sara <kind> <module> [--export name] [--unit cells|chars|bytes]
                 [--adapter "<js expression using fn>"] [--seed 1] [--n 500] [--json]
```

- `<module>` is a package name, resolved from the current directory, or a path to a local file.
- `--adapter` fits the export to the kind's signature, e.g. `"(s, n) => fn(s, {length: n})"`.

Exit code is 0 when no counted failure was found, 1 when there are failures, and 2 on a usage error.

## Research artifact

SARA was built for the paper *Where the vowels go wrong: a taxonomy of Thai script-level text-handling bugs
and a property-based oracle that finds them* (Badeesorn Sittikong, under review). The corpus of 503 coded
reports, the pre-registered evaluation protocol, the recall and discovery scripts and their results are
archived separately on Zenodo: [DOI]. That archive contains SARA v0.2.0, the version the paper evaluates.

## License
MIT © 2026 Badeesorn Sittikong. See `LICENSE`.

## Limitations
- The generator covers Thai, plus Latin in mixed strings. Lao and other scripts appear only in hand-written probes.
- The oracles target **terminal (cell-grid) semantics**. Proportional-font layout, shaping (GPOS), fonts, collation, input methods and editing are out of scope.
- The verdicts depend on the ICU/Unicode version of the Node.js build, which is recorded in every report.
