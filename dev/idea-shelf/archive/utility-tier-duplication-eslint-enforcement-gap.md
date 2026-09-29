<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Utility-Tier Duplication — ESLint Enforcement Gap — Idea-Shelf Report

**Logged:** 2026-09-28
**Status:** ✅ RESOLVED same day — promoted to FID-2026-0928-009 by the operator within hours ("i'm going to have my agent address the duplication issues"). Closed + archived 2026-09-28: sweep consolidated the primitives (17 shim copies deleted; genuinely-different predicates renamed, not merged), the `no-duplicate-shared-primitive` ESLint rule + `shared-primitives.json` registry shipped live in the pre-push leg, and its first full run caught 7 stragglers this report's greps missed. The gate part worked exactly as drafted in the fix-shape table.
**Source (verify + link — MANDATORY per standing rule):**

- The spark (why this matters industry-wide): https://www.ssp.sh/brain/the-problem-is-not-the-ai-code-but-nobody-knows-anything-anymore/
- Spec-first ≠ spec-anchored failure analysis (Fowler): https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
- Hooks as deterministic guardrails (industry state of the art, "critical few" ceiling): https://ranthebuilder.cloud/blog/agentic-coding-hooks-deterministic-ai-guardrails/
- ESLint-as-AI-guardrails pattern (prior art for the fix shape): https://medium.com/@albro/eslint-as-ai-guardrails-the-rules-that-make-ai-code-readable-8899c7134346
- Comparison context (openclaw 1,200-agent parallel fan-out discussion): local — session chat 2026-09-28
- Repo under audit: C:/Users/spenc/dev/savant-code/ (public: https://github.com/savant0x/savant-code)
- Cross-reference audit subject (Hermes, same signature): C:/Users/spenc/AppData/Local/hermes/hermes-agent/

## What it is / triage

The ECHO governance chain enforces architecture-tier discipline hard (mega-files gutted
v0.0.29, quality ratchet at 0 violations, typecheck/lint/md pre-push gates). But the
**utility tier** — small shared primitives — has the same duplication failure that agent
codebases develop everywhere: each fresh context re-invents local helpers instead of
importing the one that exists. The laws exist ("Always check for existing code before
creating new", "One function, one truth") but nothing mechanical fires when they're
violated in mid-file utility code.

### Scan evidence (2026-09-28, 2,069 source files / ~245K lines, workspaces scoped, node_modules/resources/dist excluded)

**Clean (the governance working):**

- 0 TODO/FIXME/HACK markers across the whole tree
- No mega-files: largest logic file is 920 lines (a logo constant); working set < 300
- Vendored reference apps correctly fenced under resources/

**Duplicated primitives (the gap):**

| Symbol | Defs | Where | Notes |
|---|---|---|---|
| asOptionalNumber | 9 | cli/src/utils/openrouter-models/ (one per provider shim) | Each provider harvested in its own fresh session — duplication by fan-out-of-context |
| asOptionalString | 8 | same directory | Same story |
| isRecord | 5 | cli ×2, common ×1, llm-providers, sdk | common/ already exports one — cross-workspace re-invention |
| sleep | 7 | cli, common ×2, savant-free, agent-runtime | common/util/promise.ts owns this |
| sha256 | 5 | cli, common, agent-runtime, design-systems ×2 | incl. 2 in design-systems alone |
| withTimeout | 3 | cli, common/mcp/utils.ts, **common/util/promise.ts** | Two canonical homes inside the same workspace |
| truncateSingleLine | 4 | spread | Minor |
| isJSONObject | 4 | spread | Minor |
| makeAgentState, toolDisplayName, statusLabel, formatTimestamp, safeStringify, escapeHtml | 3 each | spread | Tail of the same class |

**Pattern reading:** duplication concentrates where (a) provider-harvest fan-out gave every
session its own context, and (b) helpers are small enough that "just write one inline" is
locally rational. common/ HAS the utilities (promise.ts, etc.) — the miss is that no gate
refuses a local re-declaration of an exported symbol. Same signature found in Hermes
(positive_int ×13, fail ×13) — disciplined at reviewed boundaries, patchwork in the
hundred tiny helpers nobody reviews. ECHO's architecture-tier gates contain it ~10×
better; it still reaches the utility tier.

## Proposed fix shape (one FID, all parts already exist in-house)

| # | Part | Mechanism | Precedent in-repo |
|---|---|---|---|
| 1 | Custom ESLint rule (echo/) | Ban local top-level declarations of SHARED_PRIMITIVE names (isRecord, asOptional*, sha256*, withTimeout, sleep, formatTimestamp, safeStringify, escapeHtml, ...) outside their canonical home; auto-fix = import from common/ | echo-eslint-governance skill — custom rules already authored |
| 2 | Registry of canonical homes | Small JSON/const map: symbol → owning module (common/util/promise.ts etc.), rule reads it; adding a canonical export registers it | protocol.config.yaml precedent for declaring governance data |
| 3 | Wire into pre-push chain | eslint --max-warnings 0 already runs pre-push; new rule enters with it automatically | .githooks/pre-push exists |
| 4 | One-time consolidation sweep | Move the 9+8 provider guards into a shared module openrouter-models imports; dedupe withTimeout (pick promise.ts, mcp/utils re-exports); promote common isRecord | Forge-tier work, trivial under FID |
| 5 | Harvest-gate note | Free-compute provider shims spawn with the rule active — every future harvest inherits reuse enforcement, can't repeat this one | EHEL executor-level precedent |

## Explicitly NOT portable / not to copy

- Don't import Hermes code — different language/license (Python, its own terms). Its scan
  was evidence only.
- ESLint guardrails article is MIT/blog — concepts only, no code copy.

## Re-activation trigger

- Next release-planning board session where a quality-governance FID slot opens → pull this.
- Or: when any new provider is added to openrouter-models/ and someone copies a shim's
  helpers again (the failure will recur until Part 1 exists).
- Or: if ECHO/savant-free public surface expands — utility-tier duplication is exactly what
  external auditors will find first, since it's invisible to the architecture-tier chain.

## License note

Repo is Apache-2.0; report cites public URLs only. No vendored code involved.

Final notes from Spencer (dev) - this issue has slipped through the gaps with echo somehow, im not sure if its from echo single agent or echo.md within the harness. We need more data before we change anything
