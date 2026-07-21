/**
 * Phase B FORGE step 1 — RESIDUAL 2ND PASS
 * Closes the gap from step 1: camelCase compounds + CodebuffAI brand collapse.
 *
 * New rules on top of the step-1 idempotent base:
 *   A. Brand collapse: CodebuffAI (standalone, not URL) → Savant
 *      URL form `CodebuffAI/codebuff` → `savant0x/savant-code` was already step-1 pass 1.
 *   B. camelCase compound: codebuffFoo → savantFoo
 *      Captures lowercase-`codebuff` + uppercase first letter of the
 *      identifier rest, then maps to `savant` + captured. Without this
 *      rule, \bcodebuff\b would not match (no word boundary between
 *      `codebuff` and `C` of `Client`).
 *
 * Order is critical again:
 *   1. URL literal           (CodebuffAI/codebuff → savant0x/savant-code)
 *   2. Brand collapse        (CodebuffAI standalone → Savant)
 *   3. PascalCase compounds  (idempotent — no-op on already-renamed files)
 *   4. Generic PascalCase    (idempotent)
 *   5. camelCase compound    (NEW)
 *   6. Generic lowercase     (idempotent)
 */

const fs = require('fs');
const path = require('path');

const COMPOUND_RULES = [
  // 1. URL literal
  [/CodebuffAI\/codebuff/g, 'savant0x/savant-code'],

  // 2. Brand collapse (CodebuffAI → Savant, NOT SavantAI — collapses AI brand suffix)
  //    Must run BEFORE PascalCase \bCodebuff\b else SavantAI remains.
  [/\bCodebuffAI\b/g, 'Savant'],

  // 3. PascalCase compound identifiers — idempotent on already-renamed files
  [/\bCodebuffAI\b/g, 'Savant'], // (repeated guard)
  [/\bCodebuffApiClientConfig\b/g, 'SavantApiClientConfig'],
  [/\bCodebuffApiClient\b/g,     'SavantApiClient'],
  [/\bCodebuffApiModule\b/g,     'SavantApiModule'],
  [/\bSavantCodeClientOptions\b/g, 'SavantClientOptions'],
  [/\bCodebuffConfigSchema\b/g,  'SavantConfigSchema'],
  [/\bCodebuffFileSystem\b/g,    'SavantFileSystem'],
  [/\bCodebuffResearchBot\b/g,   'SavantResearchBot'],
  [/\bCodebuffRunPausedError\b/g,'SavantRunPausedError'],
  [/\bCodebuffToolHandlerFunction\b/g, 'SavantToolHandlerFunction'],
  [/\bCodebuffToolMessage\b/g,   'SavantToolMessage'],
  [/\bCodebuffToolOutput\b/g,    'SavantToolOutput'],
  [/\bCodebuffWebApiEnv\b/g,     'SavantWebApiEnv'],
  [/\bSavantCodeClient\b/g,        'SavantClient'],
  [/\bCodebuffConfig\b/g,        'SavantConfig'],
  [/\bCodebuffRunner\b/g,        'SavantRunner'],
  [/\bCodebuffSpawn\b/g,         'SavantSpawn'],
  [/\bCodebuffToolCall\b/g,      'SavantToolCall'],
  [/\bCodebuffMessage\b/g,       'SavantMessage'],

  // 4. Generic PascalCase — runs AFTER all compound rules
  [/\bCodebuff\b/g, 'Savant'],

  // 5. camelCase compound (NEW) — lowercase codebuff + uppercase rest
  [/\bcodebuff([A-Z][A-Za-z]*)\b/g, 'savant$1'],

  // 6. Generic lowercase — runs LAST
  [/\bcodebuff\b/g, 'savant'],
];

function rewrite(file) {
  const orig = fs.readFileSync(file, 'utf8');
  let out = orig;
  for (const [pattern, replacement] of COMPOUND_RULES) {
    out = out.replace(pattern, replacement);
  }
  if (out !== orig) {
    fs.writeFileSync(file, out, 'utf8');
    return { changed: true, delta: out.length - orig.length };
  }
  return { changed: false, delta: 0 };
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: bun rename-step1-residuals.js <file...>');
  process.exit(2);
}

let changedCount = 0;
let totalDelta = 0;
for (const f of files) {
  if (!fs.existsSync(f)) { console.warn(`SKIP (missing): ${f}`); continue; }
  const { changed, delta } = rewrite(f);
  if (changed) {
    changedCount++;
    totalDelta += delta;
    console.log(`MODIFIED: ${f} (delta ${delta >= 0 ? '+' : ''}${delta})`);
  }
}

console.log(`\n=== 2nd-pass Summary: ${changedCount}/${files.length} files modified, ${totalDelta >= 0 ? '+' : ''}${totalDelta} chars ===`);

// Self-check: post-write grep-zero on codebuff
const { execSync } = require('child_process');
let residual = 0;
try {
 const out = execSync(
  `git grep -lE '\\b[Cc]odebuff[A-Za-z]*\\b' ${files.map(f => `"${f.replace(/"/g, '\\"')}"`).join(' ')} 2>/dev/null | wc -l`,
  { encoding: 'utf8' }
 );
 residual = parseInt(out.trim(), 10);
} catch (e) { residual = '? (error)'; }
console.log(`=== Self-check: residual 'codebuff*' file count after run = ${residual} (target: 0) ===`);
