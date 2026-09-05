import { CONDENSED_LAWS, FRAMING } from './content'
import { extractFacts, normalizeCell } from './facts'
import { renderInstructions, renderRefresh } from './renderers'

// =============================================================================
// Validation (bridges the curated wording to the ECHO.md anchors)
// =============================================================================

/** Return a list of validation failures (empty = converged). */
export function validateCondensedCopies(echoMd: string): string[] {
  const failures: string[] = []
  const facts = extractFacts(echoMd)
  const instructions = renderInstructions(facts, '0.0.0')
  const refresh = renderRefresh(facts, '0.0.0')
  const normalizedInstructions = instructions.toLowerCase()
  const normalizedRefresh = refresh.toLowerCase()

  // Law titles + key phrases must anchor to ECHO.md and survive in both copies.
  for (const law of CONDENSED_LAWS) {
    const fact = facts.laws.find((l) => l.number === law.number)
    if (!fact) {
      failures.push(`Law ${law.number} not found in ECHO.md.`)
      continue
    }
    const echoTitle = normalizeCell(fact.title).toLowerCase()
    if (echoTitle !== normalizeCell(law.title).toLowerCase()) {
      failures.push(
        `Law ${law.number} title drifted: ECHO.md "${fact.title}" vs generator "${law.title}".`,
      )
    }
    // Laws 5-15 carry a "Why" column (not a directive), so the key phrase may
    // anchor in the title row itself (e.g. "Build stays clean"). Check both.
    const anchorText = `${fact.title} ${fact.directive}`.toLowerCase()
    if (!anchorText.includes(law.echoDirectiveKey.toLowerCase())) {
      failures.push(
        `Law ${law.number} echoDirectiveKey "${law.echoDirectiveKey}" not found in ECHO.md title/directive "${fact.title} ${fact.directive}".`,
      )
    }
    if (!normalizedInstructions.includes(law.instructionsLine.toLowerCase())) {
      failures.push(
        `Law ${law.number} instructionsLine missing from rendered instructions.`,
      )
    }
    if (!normalizedRefresh.includes(law.refreshLine.toLowerCase())) {
      failures.push(
        `Law ${law.number} refreshLine missing from rendered refresh.`,
      )
    }
  }

  // FSM state names must appear in the copies (case-insensitive; hyphen/underscore).
  const combined = `${normalizedInstructions}\n${normalizedRefresh}`
  for (const state of facts.fsmStates) {
    const folded = state.toLowerCase().replace(/[-_]/g, '')
    if (!combined.replace(/[-_]/g, '').includes(folded)) {
      failures.push(`FSM state "${state}" missing from the condensed copies.`)
    }
  }

  // Circuit-breaker titles must appear in the copies and match ECHO.md.
  for (let i = 0; i < facts.circuitBreakers.length; i++) {
    const echoTitle = normalizeCell(facts.circuitBreakers[i]).toLowerCase()
    if (!normalizedInstructions.includes(echoTitle)) {
      failures.push(
        `Circuit breaker "${facts.circuitBreakers[i]}" missing from the instructions copy.`,
      )
    }
  }

  // Five questions must survive verbatim.
  for (const question of facts.fiveQuestions) {
    const normalized = question.toLowerCase().replace(/\*\*/g, '')
    if (!normalizedInstructions.includes(normalized)) {
      failures.push(
        `Five-question "${question}" missing from the instructions copy.`,
      )
    }
  }

  // FID-lifecycle stages must survive in the refresh.
  for (const stage of facts.fidLifecycleStages) {
    if (!normalizedRefresh.includes(stage.toLowerCase())) {
      failures.push(
        `FID-lifecycle stage "${stage}" missing from the refresh copy.`,
      )
    }
  }

  // Anti-pattern bullets must anchor to ECHO.md titles.
  for (const bullet of FRAMING.antiPatternBullets) {
    const title = normalizeCell(bullet)
      .replace(/^-\s*/, '')
      .replace(/['"]/g, '')
    const anchor = title.split('—')[0].trim().toLowerCase()
    if (
      !facts.antiPatternTitles.some((t) => t.toLowerCase().includes(anchor))
    ) {
      failures.push(`Anti-pattern "${title}" not found in the ECHO.md table.`)
    }
  }

  // Authoring phrases must survive in the instructions copy.
  for (const phrase of facts.authoringPhrases) {
    if (!instructions.includes(phrase)) {
      failures.push(
        `Authoring phrase "${phrase}" missing from the instructions copy.`,
      )
    }
  }

  return failures
}
