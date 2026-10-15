# FID: Provider API-key update path (/provider `<name>` update)

**Filename:** `FID-2026-0907-009-provider-key-update.md`
**ID:** FID-2026-0907-009
**Severity:** high
**Status:** closed
**Created:** 2026-09-07
**YAGNI-Compliance:** Verified
**Related:** FID-2026-0804-001 (provider key management); FID-2026-0809-001
(unified provider registry); FID-2026-0907-001 (picker focus loss — compounding
symptom on the installed v0.0.29)

---

## Summary

A saved-and-enabled provider can sit in a state where the CLI reports its key
missing while offering no way to (re)enter it. Both provider-selection surfaces
(`/provider <name>` and the `/provider` picker) short-circuit via
`activateConfiguredProvider()` when a key source exists — "existing configured
key will be used; no key entry is needed" — so a typo'd, stale, or lost key can
never be replaced from the UI. Add an explicit update subcommand:
`/provider <name> update` force-enters the masked key prompt with replace
semantics regardless of configured state, and the short-circuit message gains
the replace hint.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Commit/State:** working tree at v0.0.30 prep (uncommitted); installed
  binary on this machine is v0.0.29 (prod config dir `~/.savant-code`)
- **Evidence (all read 0-EOF or grepped this session, tool output pasted in
  session):**
  - Installed copy ground truth: `~/.savant-code/settings.json` →
    `activeProvider: "tokenharbor"` (persisted selection = "enabled");
    `~/.savant-code/credentials.json` providerApiKeys = NOUS + OPENROUTER
    only — **no key for the selected family state** (names only; no key
    values read or printed, Law 12).
  - `cli/src/utils/provider-setup.ts:95-115` — `activateConfiguredProvider()`
    checks only "key exists?", never "user wants to replace"; returns true →
    callers skip the key prompt entirely.
  - `cli/src/commands/defs/model-provider-commands.ts:109-121` —
    `/provider <name>` configured branch: "existing configured key will be
    used; no key entry is needed" → return. No update path.
  - `cli/src/chat/use-chat-pickers.ts:178-188` — identical picker branch.
  - `cli/src/utils/provider-key-store.ts:119-171` — `saveProviderApiKey()`
    already overwrites the stored entry (map spread) and handles env
    precedence (`hasShellKey` guard); persistence layer needs no change.
  - `cli/src/utils/keyboard-actions.ts:87-96` + `input-modes.ts` —
    providerSetup `blockKeyboardExit: false`: Escape exits the mode BEFORE
    any save path (Enter is the only save trigger) — cancel semantics exist
    already.
  - `cli/src/commands/router/route-key-setup.ts` — shared save handler;
    empty key → "cannot be empty" and stays in mode; catch → guidance, never
    echoes the secret.

## Detailed Description

### Problem

Once a provider has ANY key source (shell env var or stored key), there is no
UI path to replace it. A user whose key was revoked, typo'd, or never entered
(their installed copy selected a provider whose key is absent) is instructed
to "run /provider `<name>`" — which then refuses the prompt with "existing
configured key will be used". Dead end. The only recourse is hand-editing
`credentials.json`.

### Expected Behavior

- `/provider <name> update` → always enters the masked providerSetup prompt
  with replace messaging, even (especially) when a key exists; Enter saves
  (overwrites the stored entry via the existing `saveProviderApiKey`), Escape
  cancels with the current key untouched.
- `/provider <name>` (no subcommand) → behavior unchanged: instant switch
  when configured (speed for the common case), key prompt when not.
- Both "existing configured key will be used" messages (command + picker)
  gain: "To replace the key, run /provider `<name>` update."

### Root Cause

`activateConfiguredProvider()` (introduced FID-2026-0804-001 era, regrouped
FID-2026-0809-001) optimized the common "switch to an already-working
provider" path and never received a replace affordance. The installed v0.0.29
additionally compounds the symptom with the archived FID-2026-0907-001 picker
focus bug (fixed in this tree, ships v0.0.30).

## Impact Assessment

### Affected Components

- `cli/src/commands/defs/model-provider-commands.ts` (arg parse: update
  subcommand; hint message)
- `cli/src/chat/use-chat-pickers.ts` (hint message only)
- `cli/src/commands/__tests__/router-provider-update.test.ts` (new)
- No SDK / registry / persistence changes.

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: interactive surface change; key persistence mechanics untouched
- [ ] Low

## Proposed Solution

### Approach

Operator-selected (ask_user 2026-09-07): explicit `update` subcommand;
providers only (`/research-keys` same-gap follow-up deliberately out of
scope). Parse `args` as `<name>` or `<name> update` inside the existing
`provider` command handler — `parseCommandInput` already delivers the full
args string (`router-utils.ts:88`); the handler owns token interpretation
(same pattern as existing multi-word handling elsewhere in commands).

### Steps

1. [x] **RED:** `router-provider-update.test.ts` — pins: (a) update with a
       configured provider still enters providerSetup mode (not the
       short-circuit); (b) plain `/provider nous` short-circuit message now
       contains the replace hint; (c) key entered in update-mode overwrites
       the stored key in credentials.json (old key gone); (d) unknown
       provider + update still errors with the provider list; (e) update on
       an unconfigured provider also enters the prompt (harmless; same UX).
2. [x] **GREEN:** subcommand parse + forced prompt entry + hints (both
       surfaces).
3. [x] **VERIFY:** typecheck cli; new suite + sibling suites
       (router-provider-setup, provider-setup, picker-focus);
       eslint/prettier on touched files; `fid:verify --write`;
       `validate:repository`.

## Implementation Verification

> Recorded at implementation — RED evidence first, then gate outputs.

**RED (before GREEN, pasted):**

```text
bun test src/commands/__tests__/router-provider-update.test.ts
 1 pass / 4 fail / 8 expect() calls
 (the 4 update-path pins failed; the unknown-provider pin passed —
  the existing error branch already handled it)
```

**Mid-flight incident, honestly recorded:** the suite's first two runs
wrote the sentinel key into the REAL dev config dir
(`~/.savant-code-dev/credentials.json`) — the harness set
`SAVANT_CODE_CONFIG_DIR=tempDir` BEFORE a managed-env loop that deleted
the same variable, so every save fell through to the real dir. Production
code was correct; the failing replace pin failed because the write never
reached tempDir. Remediation: ordering fixed (delete-then-set, the sibling
suite's pattern), sentinel excised with the six pre-existing keys preserved
(bash output pasted in session), re-run confirmed no further pollution.
**Residual disclosure:** the dev settings.json `activeProvider` was also
overwritten (now `tokenrouter`); the pre-test value was never snapshotted
and cannot be restored — prod copy untouched.

**GREEN + gates (pasted):**

```text
bun test router-provider-update.test.ts            → 5 pass / 0 fail
bun test update + setup + provider-setup + picker-focus + gateway
                                                   → 37 pass / 0 fail
bun run typecheck (cli)                            → exit 0
eslint 2 touched files --max-warnings 0           → exit 0
prettier --check 2 touched files                   → clean (after --write)
line counts: commands 202, pickers 264, suite 156  (all ≤ 300)
```

**Stale-receipt follow-up (same session):** the first post-stamp
`validate:repository` flagged this receipt stale — root-caused to
FID-2026-0907-010 (fingerprint off-by-one: first stamps were born stale),
not to any edit of this document; after that fix the original fingerprint
validated as stamped (probe pasted in FID-010). Receipt re-stamped after
this note.

### Code Verification Evidence

- [x] All declared gates pass with pasted tool output (above + receipt)
- [x] Production call-graph: the update path rides the existing `provider`
      command handler (command-registry route, `routeUserPrompt` → command
      dispatch) and `saveProviderApiKey` persistence; the hint strings are
      rendered by both live surfaces (command + picker)
- [x] FID status reflects the actual implementation state (`closed`)

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/commands/__tests__/router-provider-update.test.ts
- gate: test cli/src/commands/__tests__/router-provider-setup.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts

### Verification Receipt

- fingerprint: sha256:f4a1302c2d372d445269b82f9562356d08885f72fc8e68df345488783c3e2c01
- verified: 2026-09-08T18:20:32.479Z
- typecheck cli: exit 0
- test cli/src/commands/__tests__/router-provider-update.test.ts: exit 0
- test cli/src/commands/__tests__/router-provider-setup.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED (2026-09-07)

- Cataloged above; root causes verified on disk + installed machine state.
- **ADVERSARIAL pre-check:** "Why not always re-prompt on select?" → operator
  chose explicit subcommand (keeps instant switching; Escape-in-prompt adds
  friction to every switch). "Why not a picker keybinding?" → most code,
  least discoverable without docs; deferred.
- **CHANGE DELTA:** initial authoring.

### Missed Questions

1. *What about a provider whose key exists ONLY as a shell env var?* →
   `/provider <name> update` still enters the prompt; the saved key is
   stored but the shell var keeps precedence (existing `hasShellKey`
   contract, provider-key-store.ts — unchanged by design; the message says
   so explicitly).
2. *Does `update` collide with any provider name?* → No registry id is
   `update`; the token is only stripped when it is the LAST of 2+ tokens
   (`nous update extra` → provider `nous update extra` → unknown, pinned).
3. *Picker parity?* → The picker keeps instant-switch on configured
   providers (one keystroke) and its message now teaches the update
   command — full picker re-prompt was rejected by operator choice.
4. *`/research-keys` mirror?* → Deliberately out of scope (operator);
   same-gap follow-up recorded for a future FID if wanted.

## Resolution

- **Fixed Date:** 2026-09-07
- **Fix Description:** `/provider <name> update` subcommand in the
  `provider` command handler (model-provider-commands.ts): a trailing
  `update` token is stripped before name resolution and forces the masked
  providerSetup prompt with replace messaging ("Enter the new API key
  below to replace the stored key… Press Escape to cancel and keep the
  current key") — Enter saves via the existing `saveProviderApiKey`
  (overwrites the stored entry; env-var precedence unchanged), Escape
  exits without saving (pre-existing keyboard-actions contract). Both
configured-branch messages (command + picker in use-chat-pickers.ts)
  gained: "To replace the key, run /provider `<name>` update."
- **Tests Added:** `cli/src/commands/__tests__/router-provider-update.test.ts`
  (5 tests): update-forces-prompt when configured; plain-select keeps
  short-circuit + carries the hint; entered key replaces the stored key on
  disk; unknown provider + update still errors with the provider list;
  update on unconfigured provider also enters the prompt.
- **Verification Evidence:** RED 1 pass / 4 fail pasted in Implementation
  Verification; GREEN 5/0 + sibling battery 37/0; typecheck cli exit 0;
  eslint + prettier clean; receipt machine-stamped below.
- **Archived:** 2026-09-08 (operator closure directive). The recorded
  dev-build live smoke (Escape-cancel + replace flow) carries as a
  never-claimed-passed operator boundary per the 2026-09-06 ground-truth
  closure ruling (live boundaries are not closure preconditions); the
  5/0 suite pins the prompt-forcing and on-disk replace semantics
  mechanically. Receipt re-stamped at the archived path with gates
  re-run live.

## Lessons Learned

- A "convenience short-circuit" (skip the prompt when configured) silently
  becomes a lock-out when the stored credential goes bad — every skip path
  needs an explicit undo/replace affordance, or the docs must point at one.