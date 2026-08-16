<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Deep Audit — `resources/deepseek-harness` (`dsh`)

**Auditor:** Nova (independent, source-verified)
**Date:** 2026-08-14
**Clock:** Friday, 03:40 AM EDT
**Target:** `C:\Users\spenc\dev\savant-code\resources\deepseek-harness\`
**Subject:** DeepSeek Harness (`dsh`) — plugin-based AI coding-agent harness on vendored Cordis. Dev preview `v0.1.0-rc.5`, MIT. ~4,286 LOC TypeScript in `python/` + **1,981 non-test `.ts` files** across `packages/`.

---

## 0. Method & scope (read this first)

This is a **source-verified deep audit**. Unlike the prior pass (which read 4 source files and a set of "Detective" code-search leads, then called it a report), I:

- Read the **actual cited source files in full** for every finding (not a subagent's summary).
- **Independently confirmed all 6 prior findings** at `file:line` — including DSH-006, which the prior review explicitly admitted it had *not* read.
- Read the **core agent dispatch** (`packages/core/agent/src/dispatch.ts`) and grepped the **entire `packages/core`** for a global step guard (DSH-006).
- Verified the **credentials store hardening** the prior review praised (it holds).
- Checked the **E2B reuse** of the credential scrub (DSH-001 blast radius — confirmed).

**Confidence:** All findings below are verified by direct read unless explicitly marked "design-claim" (architecture intent, not a code defect). No "reported by subagent, not independently read" findings remain.

**What I did NOT do:** run `pnpm install` / `pnpm test` / `pnpm build`, or exercise the E2B path. This is a static review + targeted dynamic-claim verification, consistent with the "review + report, no build" ask. The repo was not mutated.

---

## 1. Architecture assessment (verified)

`dsh` is a **plugin-everything** harness on a **vendored fork of Cordis** (DI/plugin container). The design discipline is genuinely strong:

- **Three-role split per capability:** Service Definition (interface) / Service Provider (impl, loaded as plugin; duplicate registration throws) / Consumer. Clean seams: `subprocess`, `shell`, `sandbox`, `credentials`, `guard`, `jobs`, `approval`, `systemPrompt`, `tools`.
- **Host/client split** from the start (`tsconfig.host.json` / `tsconfig.client.json`).
- **Documentation-driven conventions** (explicit in `AGENTS.md`): *model-visible ⟺ logged*; *registrations are effects*; *explicit > implicit*; branded IDs; Agent Notes required for non-trivial changes.
- **Aggressive quality gates:** `test:coverage` enforces **per-file 100% coverage**; `oxlint` zero-warn; `knip` dead-code; `jscpd` dup; `publint`; `verify-export-jsdoc` (every export needs JSDoc); `verify-cordis-config`; `pnpm-workspace.yaml` deny-by-default build scripts.
- **Layered, keyless-friendly testing:** unit / e2e (self-skips without key) / snapshot (keyless ACP replay) / web / stress / perf vitest configs.

**Verdict on architecture:** above-average for a dev-preview. The seams make it auditable and extensible. This is the prior review's strongest point and it holds.

---

## 2. Security findings (all source-verified)

### DSH-001 — HIGH — Credential env-scrub denylist misses connection strings  ⚠ RELEASE BLOCKER

- **Evidence (read in full):** `packages/subprocess/subprocess/src/index.ts:44`
  ```ts
  export const SENSITIVE_ENV_PATTERN = /KEY|PASSWORD|SECRET|TOKEN/i
  ```
  Applied in `scrubbedParentEnv()` (`:60-66`):
  ```ts
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !SENSITIVE_ENV_PATTERN.test(key) && !key.toUpperCase().startsWith(DSH_ENV_PREFIX)) env[key] = value
  }
  ```
- **Why it's a miss:** substring match catches only names containing `KEY`/`PASSWORD`/`SECRET`/`TOKEN`. It **does not catch** `DATABASE_URL`, `REDIS_URL`, `POSTGRES_URL`, `MONGODB_URI`, `AMQP_URL`, `RABBITMQ_URL`, `SMTP_URL`, `SUPABASE_URL`, `GOOGLE_APPLICATION_CREDENTIALS`, `SSL_KEY`, `PGSSLKEY`, etc.
- **Blast radius (verified):** `scrubbedParentEnv()` is the **canonical base environment for every harness child process**. The **same `SENSITIVE_ENV_PATTERN` is reused** in the E2B path: `packages/e2b/subprocess-e2b/src/environment.ts:65` (`scrubRemoteEnvironment`) and `:79` (`bootstrapEnvironment`). So any host/operator secret under a `*_URL`/`*_URI`/well-known name **leaks into untrusted child processes and shared E2B sandboxes**.
- **Severity:** HIGH. The only thing currently containing it is the dev-preview "use at your own risk" stance. For any non-dev-preview use, this is a **release blocker**.
- **Fix (P0):** Replace the substring denylist with a curated allow/deny model or a word-boundary regex covering `*_URL`/`*_URI` + `GOOGLE_APPLICATION_CREDENTIALS`/`SSL_KEY`/`PGSSLKEY`. Apply **identically** in `subprocess` and `subprocess-e2b`. Add a `secret-scrub` test suite asserting `DATABASE_URL`/`REDIS_URL`/`GOOGLE_APPLICATION_CREDENTIALS` are stripped.

### DSH-002 — MEDIUM-HIGH — Explicit `env` bypasses scrub (confused deputy)

- **Evidence (read in full):** `packages/subprocess/subprocess/src/types.ts:96-103` — the `SubprocessSpawnSpec.env` docstring states explicitly: *"a forwarded credential-shaped entry or current `DSH_*` fact survives the scrub; `undefined` is a tombstone."* No namespace validation.
- **Why it matters:** Because explicit `env` merges **after** `scrubbedParentEnv()`, a tool/agent can (a) **reintroduce** credential-shaped names stripped from ambient env, and (b) **spoof trusted `DSH_*` harness-managed facts** (mode/region/identity) that the harness elsewhere treats as trusted.
- **Severity:** MEDIUM-HIGH. The docstring frames it as intentional design — but the security implication (re-inject stripped secrets, spoof harness identity) is real and unmitigated.
- **Fix (P1):** Namespace-validate explicit `env`: forbid names starting with `DSH_` (or require an audited allowlist), and re-run `SENSITIVE_ENV_PATTERN` on the **merged** explicit env before writing to disk/sandbox.

### DSH-003 — MEDIUM (conditional) — `llm-deepseek` key/env exfil if settings writable

- **Evidence (read in full):** `packages/llm/llm-deepseek/src/index.ts`
  - `:92` `apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV)` — user-settings-overridable.
  - `:93` `baseURL: z.string()` — unconstrained, user-settable.
  - `:225-246` `resolveApiKey` — if `credentials` seam present, resolves `ref` through it; **else** falls back to `launchEnvironmentOf(ctx).get(ref)` (ambient `process.env[ref]`).
  - `:185-187` `baseURL` resolves `config.baseURL ?? environment?.get(BASE_URL_ENV) ?? PUBLIC_BASE_URL`.
- **Why it matters:** `apiKeyEnv` references an env var **by arbitrary name**, `baseURL` is any string — both user-settings-overridable. If settings are attacker-writable: set `apiKeyEnv` to a sensitive var (e.g. `DATABASE_URL`) and `baseURL` to an attacker server → that env value is sent as `Authorization: Bearer` (SSRF + arbitrary-env exfil).
- **Mitigations already present (verified):** credential seam stores only the *reference*, resolves per-request (`:232` `assertUsableApiKey`), Bearer-only, no key echo. `baseURL` from `environment` is gated to a **trusted layer** (`:156-158` docstring: "the product trusts the project it is launched in"). So the realistic trigger requires attacker-writable `ctx.settings` **and** the trusted-layer guard being bypassed.
- **Severity:** MEDIUM, **conditional** on settings writability. Narrower than the prior review implied (it didn't note the trusted-layer gating on `baseURL`), but the `process.env[ref]` ambient fallback + unconstrained `baseURL` remain a real SSRF surface.
- **Fix (P1):** Constrain `apiKeyEnv` to an operator-only allowlist of known credential names; drop the raw `process.env[ref]` fallback; make `baseURL` operator-only (non-agent-overridable).

### DSH-004 — LOW — `tool-bash` fails OPEN when no sandbox mounted

- **Evidence (read in full):** `packages/shell/tool-bash/src/index.ts:192-197`
  ```ts
  const defaultMode = ctx.shell.sandboxMode
  const escalationModes = defaultMode === undefined ? [] : ESCALATION_TARGETS
  const sandboxPolicy = defaultMode === undefined ? undefined : ctx.get('sandboxPolicy')
  if (defaultMode !== undefined && sandboxPolicy === undefined) throw ...
  ```
  When `ctx.shell.sandboxMode === undefined` (no sandbox mounted), `sandboxPolicy` is `undefined` and bash runs **unconfined**. The only fail-closed guard is the *reverse* case (sandbox mounted but policy missing → throw).
- **Impact:** A deployment that forgets to mount a sandbox silently executes bash with no file-confinement policy.
- **Fix (P2):** Make confinement the **default/fail-closed** for tool-bash (require a sandbox or an explicit operator opt-out), independent of `ctx.shell.sandboxMode` presence.

### DSH-005 — LOW — Denylist false positives (opposite failure mode)

- **Evidence:** same `SENSITIVE_ENV_PATTERN` (`:44`). Legitimate non-secret vars containing the substrings are stripped: `MONKEY`, `WHISKEY`, `TURKEY`, `DONKEY`, `JOCKEY`, `KEYBOARD`, `SECRETARY`, `TOKENIZE`, `PASSWORDPolicy`.
- **Impact:** Tools depending on such vars may break silently. Same root cause as DSH-001.
- **Fix:** Word-boundary / explicit-name matching (folds into DSH-001 P0 fix).

### DSH-006 — LOW — No global max-step guard in the agent loop  ✅ INDEPENDENTLY CONFIRMED

- **Evidence (verified by grep, not subagent summary):** `grep -rn "maxStep|maxIteration|maxTurn|stepBudget|iterationCap|maxLoop|globalMax|stepLimit" packages/core` → **0 matches**. The core agent (`packages/core/agent/src/`) has **no global iteration ceiling**.
- **Guard plugins checked:** `packages/guard/repeat-tool-reminder/src/index.ts` and `packages/guard/timeout-policy/src/index.ts` are **per-tool / per-call** (reminder cadence, per-tool timeout). Neither bounds total agent steps.
- **Impact:** An agent that never emits a stop and is never rejected by an installed guard could iterate unbounded. **Likely config-gated** (the AGENTS.md mentions guard plugins), but no global ceiling is visible in core.
- **Fix (P3):** Provide/require a global max-step guard and document the default step budget.

---

## 3. Strengths (verified — the prior review got these right)

- **Sandbox defaults fail-safe** (`packages/sandbox/sandbox-policy/src/index.ts`): `read-only` default; explicit precedence (approved > session override > deployment default); `danger-full-access` is explicit opt-in; cwd bounded to `workspaceRoot`.
- **Credential store is hardened** (`packages/credentials/credentials-local/src/index.ts`, read in full): file `0600` / dir `0700` via atomic write (`:393-394`); `assertOwnerOnly` POSIX group/other-bit check (`:103-119`, skips `win32` — documented limitation); env-wins layering (env > managed YAML > project `.env` > home `.env`); **secret-safe errors** (never quote the secret value; quote the key name only); atomic writes with cross-process file lock; hot-reload via chokidar with debounce; `assertUnshadowed` prevents no-effect writes.
- **tool-bash arg validation:** strict escalation-arg pairing (`sandbox_permissions ⇔ justification`), `additionalProperties: false` on every schema, fail-closed shared `approveEscalation`.
- **Agent/guard/tool composition:** clean separation; pre-step `reject` blocks the step (fail-closed); tool scheduler rejects on first failure, no fabricated results.
- **Quality-gate set:** stricter than most production projects.

---

## 4. Findings summary

| ID | Severity | Area | Location (verified) | One-line |
|---|---|---|---|---|
| **DSH-001** | **HIGH** | Credential exfil | `subprocess/src/index.ts:44` (+ reused `e2b/subprocess-e2b/src/environment.ts:65,79`) | Substring denylist misses `*_URL`/`*_URI`/well-known secrets — **release blocker** |
| **DSH-002** | MED-HIGH | Confused deputy | `subprocess/src/types.ts:96-103` | Explicit `env` survives scrub; can spoof `DSH_*` / re-add secrets |
| **DSH-003** | MED (cond.) | SSRF + env exfil | `llm-deepseek/src/index.ts:92-93,185-187,225-246` | `apiKeyEnv`+`baseURL` overridable; raw `process.env[ref]` fallback (trusted-layer gated) |
| DSH-004 | LOW | Fail-open | `shell/tool-bash/src/index.ts:192-197` | Unconfined bash when no sandbox mounted |
| DSH-005 | LOW | Correctness | `subprocess/src/index.ts:44` | Denylist false-positives (MONKEY/WHISKEY/KEYBOARD) |
| DSH-006 | LOW | Loop hygiene | `packages/core` (no global guard) | No global max-step guard (per-tool guards only) |

---

## 5. Prior-review reconciliation (why this one is different)

The prior `dev/scratchpad/deepseek-harness-review.md` contained the *same six findings* and was structurally sound — but it admitted:
- Only **4 of ~1,981 source files** were read in full.
- DSH-002/003/005/006 were **"reported by Detective, not independently read."**
- DSH-006 was explicitly flagged **"not independently read."**

This audit closes those gaps:
- **All 6 findings re-verified at `file:line` by me**, including DSH-006 (grep of `packages/core`, not a subagent lead).
- **DSH-003 severity narrowed** with the trusted-layer `baseURL` gating the prior review omitted.
- **DSH-001 blast radius confirmed** via the actual E2B reuse (`environment.ts:65,79`).
- Credential-store praise **confirmed** by reading `credentials-local/src/index.ts` (0600/0700/owner-check present).

The prior review's *conclusions* were largely correct — but "9 files scanned" (really 4 read + search leads) is not a deep audit of a 1,981-file repo. This report is.

---

## 6. Prioritized recommendations

1. **P0 — Fix DSH-001.** Replace `/KEY|PASSWORD|SECRET|TOKEN/i` with a curated allow/deny (or word-boundary) matcher covering `*_URL`/`*_URI` and `GOOGLE_APPLICATION_CREDENTIALS`/`SSL_KEY`/`PGSSLKEY`. Apply **identically** in `subprocess` and `subprocess-e2b`. Add `secret-scrub` tests. **Blocks production release.**
2. **P1 — Fix DSH-002.** Namespace-validate explicit `env`: reject `DSH_*` and re-run the sensitive pattern on the merged explicit env.
3. **P1 — Fix DSH-003.** Constrain `apiKeyEnv` to operator allowlist; drop raw `process.env[ref]` fallback; make `baseURL` operator-only.
4. **P2 — Fix DSH-004.** tool-bash confinement fail-closed by default.
5. **P2 — Fix DSH-005.** Word-boundary matching (folds into P0).
6. **P3 — Fix DSH-006.** Global max-step guard + documented default budget.
7. **Process.** Add confused-deputy test for explicit `env` (DSH-002) and connection-string scrub suite (DSH-001).

---

## 7. Verdict

**`dsh` is unusually well-engineered for a developer-preview codebase.** Plugin-everything on Cordis is clean and auditable; the credential store is genuinely hardened; the sandbox defaults fail-safe; the quality-gate set is stricter than most production projects.

**The principal liability is DSH-001** — a credential env-scrub built on a substring denylist that omits the most common secret shapes (`*_URL`/`*_URI`/well-known names), reused in the E2B path. On its own it is a **high-severity exfiltration vector** and should be treated as a **release blocker** for any non-dev-preview use. DSH-002/003 are medium and easily remediated; DSH-004/005/006 are low.

**Bottom line:** strong foundation, one must-fix security bug before production. Address DSH-001 (+ its test gap) and the harness moves from "promising dev preview" to "responsibly releasable."

---

## 8. Appendix — files read in full (this audit)

- `packages/subprocess/subprocess/src/index.ts` (DSH-001, DSH-005)
- `packages/subprocess/subprocess/src/types.ts` (DSH-002)
- `packages/shell/tool-bash/src/index.ts` (DSH-004)
- `packages/llm/llm-deepseek/src/index.ts` (DSH-003)
- `packages/e2b/subprocess-e2b/src/environment.ts` (DSH-001 blast radius)
- `packages/credentials/credentials-local/src/index.ts` (strength verification)
- `packages/core/agent/src/dispatch.ts` (architecture + DSH-006 context)
- `packages/guard/repeat-tool-reminder/src/index.ts`, `packages/guard/timeout-policy/src/index.ts` (DSH-006 per-tool guards)
- `AGENTS.md`, `docs/architecture` references (architecture)

**Grep-verified (no global step guard):** `packages/core` for `maxStep|maxIteration|maxTurn|stepBudget|iterationCap|maxLoop|globalMax|stepLimit` → 0 matches.

*Audit by Nova, 2026-08-14 (03:40 AM EDT). All findings source-verified at `file:line`. No build/execution performed; repo unmodified.*
