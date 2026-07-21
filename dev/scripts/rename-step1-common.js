/**
 * Phase B FORGE step 1 — common/ workspace rebrand
 * Case-preserving regex in OLDER-FIRST order per FID §Approach Principle #5
 *   + Decision 026-B (FREEBUFF_MODE env carve-out — naturally handled by \b word boundary)
 *   + Decision 026-G (API route scrap /api/v1/freebuff/* is in cli/sdk, not common/)
 *
 * Pass order (CRITICAL — earlier passes block later substring false-matches):
 *   1. URL literal    — CodebuffAI/codebuff → savant0x/savant-code
 *   2. Compound PascalCase identifiers (specific > generic)
 *   3. Generic PascalCase \bCodebuff\b → Savant
 *   4. Generic lowercase \bcodebuff\b → savant
 *
 * Each compound pass must precede the generic \bCodebuff\b pass, otherwise
 * word-boundary semantics leave "SavantCode" embedded in compound identifiers
 * (e.g., SavantCodeClient → SavantClient requires explicit pass).
 */
const fs = require('fs');
const path = require('path');

const COMPOUND_RULES = [
  // Order: longest compound first (multi-pass safe — done before generic SavantCode/codebuff)
  [/CodebuffAI\/codebuff/g, 'savant0x/savant-code'],

  // PascalCase compound identifiers
  [/\bCodebuffAI\b/g,            'SavantAI'],
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

  // Generic PascalCase — must run AFTER all compound rules
  [/\bCodebuff\b/g, 'Savant'],

  // Generic lowercase — runs LAST; \b word boundary preserves identifiers like `codebuffai` if any
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
  console.error('Usage: bun rename-step1-common.js <file...>');
  process.exit(2);
}

let changedCount = 0;
let totalDelta = 0;
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.warn(`SKIP (missing): ${f}`);
    continue;
  }
  const { changed, delta } = rewrite(f);
  if (changed) {
    changedCount++;
    totalDelta += delta;
    console.log(`MODIFIED: ${f} (delta ${delta >= 0 ? '+' : ''}${delta})`);
  }
}

console.log(`\n=== Summary: ${changedCount}/${files.length} files modified, ${totalDelta >= 0 ? '+' : ''}${totalDelta} chars total ===`);
