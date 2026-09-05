#!/usr/bin/env bun
/**
 * Condensed protocol-copy generator (FID-2026-0810-003).
 *
 * Single source of truth for the two condensed protocol copies:
 *
 *   1. `ECHO_PROTOCOL_INSTRUCTIONS` (common/src/constants/agents.ts) — the
 *      full instructions block injected into every harness agent prompt.
 *   2. `buildProtocolRefreshSummary()` (packages/agent-runtime/src/echo/
 *      protocol-summary.ts) — the compact 15-turn refresh.
 *
 * Source-of-truth model (recorded in the FID header):
 *   - `ECHO.md` provides the canonical titles/structure: the 15 law titles +
 *     directives, the 6 FSM state names, the 5 circuit-breaker titles, the 5
 *     questions, the 6 FID-lifecycle stages, and the anti-pattern titles.
 *   - This module hosts the generator-authored condensed wording (curated
 *     directive lines + harness framing with no ECHO.md home: FSM phase
 *     gating, session directives, the no-signature policy, double-audit
 *     wording).
 *   - Validation bridges the two: every curated line is checked against its
 *     ECHO.md anchor, so edits to ECHO.md fail fast until the generator
 *     table is updated in the same commit.
 *
 * The single-agent protocol document is deliberately absent (see the
 * harness-boundary gate in generate-protocol-bundle.ts): it belongs to a
 * third-party harness for outside agents, not the savant-code product.
 *
 * FID-2026-0819-005 Loop 302: split into `protocol-copies/` modules
 * (facts / content / renderers / validation); this file is a re-export
 * facade so all consumers keep their specifiers.
 */

export * from './protocol-copies/facts'
export * from './protocol-copies/content'
export * from './protocol-copies/renderers'
export * from './protocol-copies/validation'
