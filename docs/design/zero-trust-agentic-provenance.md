<!-- markdownlint-disable MD013 -->

# Zero-Trust Agentic Provenance (ZTAP)

ZTAP turns Savant-Code's existing ECHO governance into a portable, inspectable
proof-of-process artifact. It records what the runtime mechanically observed at
the native write boundary, signs the record with ephemeral per-role keys, binds
later Verifier and Adversary verdicts to the same change hash, and exports an
offline receipt that an auditor can inspect without installing Savant-Code.

ZTAP is a **complete P1 feature**, not a minimal prototype. It includes:

- structured write identity and ECHO law-check capture;
- offline SHA-256, JCS, HKDF, and Ed25519 primitives;
- append-only, hash-only session ledgers;
- signed Verifier and Adversary verdict bindings;
- `off`, `record`, and fail-closed `enforce` modes;
- `/attest` JSON and self-contained HTML export;
- a clean-process validator independent of the product runtime; and
- a read-only, event-sourced Trust Matrix in the CLI.

## What ZTAP proves

A valid receipt provides evidence that:

1. Savant-Code's native executor observed a successful write.
2. The post-write content had a specific SHA-256 hash at receipt creation.
3. The receipt was signed by the session's declared role key.
4. Any recorded Verifier or Adversary verdict was bound to that change hash,
   phase, role, agent identity, and verbatim verdict text.
5. The exported artifact passed deterministic integrity and schema checks.

This is a **mechanically enforced process record**. It does not prove that an
LLM is independent, truthful, conscious, or correct. It does not create a
third-party identity system or a public certificate authority. The session key
is generated in memory and is not an external trust anchor. Anyone who fully
compromises a live session's seed can forge that session's receipts; this
limitation is stated in the JSON and HTML export.

## Architecture

### Write boundary

ZTAP is wired into the native tool executor, where the runtime already knows:

- the resolved project-relative path;
- the native write tool (`write_file`, `str_replace`, or `apply_patch`);
- the successful post-write content;
- the current agent identity and role;
- the current ECHO FSM phase;
- the active FID context; and
- the outcomes of pre-write law checks.

A receipt is created after a successful write. Writes are not held while later
review phases run. The Verifier and Adversary execute after writes land, so a
write-holding design would serialize the ECHO loop and harm interactivity.

The phase-completion hooks are pinned at the spawn boundaries where the final
subagent output is available:

- `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts:137`;
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts:135`.

The main session finalization path flushes provenance in the loop's `finally`
block. This ensures normal completion and error exits both get a finalization
attempt.

### Session keys

At session start, the runtime creates a 32-byte random session seed and keeps it
in memory. It derives one role keypair per session and role using:

```text
HKDF-SHA256(
  ikm  = session seed,
  salt = session id,
  info = "savant-provenance:role:" + role
)
```

The derived role seed feeds Ed25519. Bun's WebCrypto implementation does not
support the required raw-seed import path consistently, so the implementation
uses WebCrypto for HKDF and the named `@noble/ed25519` fallback for deterministic
seed-to-keypair derivation. Public keys are placed in the session manifest.
Private keys and the session seed never enter JSON, JSONL, trace chunks, logs,
or the exported artifacts.

Separate role keys make the Forge/Verifier distinction testable. A complete
receipt cannot satisfy the separation check with only one role key. The
manifest's embedded keys are a verification input, not an external identity
attestation.

### Hash-only append-only ledger

The runtime writes session data below:

```text
.savant/provenance/<sessionId>/
  session.json
  receipts.jsonl
```

The ledger contains hashes and governance metadata, never source content,
prompts, credentials, or private key material. It is append-only and not
regenerated: deleting it destroys the corresponding ephemeral audit history.
Corrections are new records. Export-time validation recomputes the target file's
current hash and classifies an older receipt as `superseded` when the file no
longer matches.

The event stream is separate from the ledger. `provenance_receipt` events are
bounded, deduplicated, and emitted for display in every provenance mode,
including `off`. Signing and ledger persistence are mode-gated; the UI can
therefore show an honest unverified/neutral state without inventing trust.

## Receipt model

A receipt is a JSON object with these principal fields:

| Field | Meaning |
| --- | --- |
| `schema` | Versioned receipt schema identifier |
| `sessionId` | Session boundary for the receipt |
| `seq` | Monotonic sequence number within the session |
| `status` | Lifecycle state: `pending`, `complete`, `superseded`, or `no_verdict` |
| `changeHash` | `sha256:<hex>` hash of post-write content |
| `path` | Project-relative target path |
| `tool` | Native write tool used |
| `fidId` | Resolved active FID or `null` |
| `lawChecks` | Compact law/outcome records, without advisory message bodies |
| `failClosed` | Whether the receipt came from `enforce` mode |
| `writer` | Agent id, role, and FSM phase |
| `timestamp` | Receipt creation time |
| `signatures` | Writer and later role signatures over canonical payloads |
| `verdicts` | Signed verbatim Verifier/Adversary payloads |

Before signing, receipt objects are canonicalized with the in-repository JCS
implementation. Signature `over` fields identify the SHA-256 digest of the
canonical payload that was signed. Validation rejects malformed, unknown, or
incoherent fields rather than silently accepting an ambiguous artifact.

A receipt is considered complete only when its recorded review requirements are
satisfied. A session may honestly contain pending receipts when a phase did not
run or the process ended before a verdict was bound. At session close,
`finalize()` resolves every open `pending` receipt to an honest `no_verdict`
terminal state with a signed system-role close annotation ("no independent
verdict — session closed"), so a receipt can never linger as a permanent
`pending` that reads as broken. Export classification also reports `live`
versus `superseded` based on the current file hash.

## Provenance modes

Configure the mode in `protocol.config.yaml`:

```yaml
provenance:
  mode: 'record'
```

| Mode | Behavior |
| --- | --- |
| `off` | Emits display events but does not sign or persist receipts |
| `record` | Default; signs and appends receipts without blocking normal writes |
| `enforce` | Signs and persists with fail-closed pre-write behavior when provenance cannot complete |

`record` is intended to preserve interactivity. Ledger I/O is asynchronous and
bounded. A persistence failure is surfaced as a visible provenance problem but
does not retroactively fail the successful write. `enforce` is appropriate when
a project prefers an explicit availability failure over an unreceipted write.

## `/attest`

Use `/attest` to export the current project's session receipts. The command
writes two related artifacts:

```text
trust-receipt.json
trust-receipt.html
```

The JSON artifact is authoritative and is suitable for scripts, archival, and
independent review. It includes the whitelisted public manifest, receipts,
verdicts, signature results, current-file classifications, and summary counts.
It does not contain source content or private key material.

The HTML artifact is a convenience view. It embeds the JSON and a self-contained
JavaScript verifier that re-canonicalizes payloads, checks signatures, and
recomputes current-file hashes. It has no CDN, network, Savant-Code runtime, or
project checkout requirement. The page displays this exact boundary:

> This HTML is a convenience view; `trust-receipt.json` is the authoritative
> artifact.

An auditor should preserve the JSON and, for high-assurance review, run the
scriptable validator or independently reproduce the JCS and signature checks.
The export also warns that receipt trust rests on the session's memory-only
session seed: compromise of that seed compromises all receipts in that session.

## Clean-process verification

FID-008 adds an independent validator in
`cli/src/commands/attest/clean-process/` (re-exported from the
`cli/src/commands/attest/clean-process-validator.ts` barrel). It intentionally
does not import the shared Savant receipt validator — every submodule uses
only Node/Bun built-ins. Its audit tests prove that:

- pristine JSON and HTML fixtures agree;
- superseded receipts are classified consistently;
- changed receipt values fail validation;
- unknown fields fail closed; and
- the validator remains usable without a Savant-Code runtime import.

This does not make the two implementations mathematically independent, but it
reduces the risk that a shared product bug causes both the exporter and the
validator to report the same false result. The adversarial suite and explicit
pristine negative controls provide additional coverage.

## Trust Matrix

The Trust Matrix is a live CLI visualization, not a control plane. Runtime
provenance events travel through the existing response-chunk/event path into the
chat store. The reducer keeps an event history and derives conservative display
state from signed event metadata.

The matrix may:

- show a pending (`awaiting audit`), complete, superseded, pass, fail,
  `no_verdict` (terminal, resolved at session close), or neutral state;
- distinguish audit and adversarial phases;
- deduplicate repeated sequence numbers; and
- display an unverified/neutral state when cryptographic provenance is off.

The matrix may not:

- call a write or terminal tool;
- mutate files or receipt state;
- authorize a write;
- replace the Verifier or Adversary; or
- turn unsigned or synthetic text into a passing verdict.

Static tests scan the overlay module for tool/control imports and dynamic
imports. Behavioral tests subscribe before events arrive and confirm the event
reducer preserves fidelity without granting authority.

## Security and privacy boundaries

ZTAP is deliberately hash-only at rest. The following are excluded from the
ledger and exports:

- post-write file content;
- prompts and model context;
- credentials and provider keys;
- session seed and private Ed25519 keys; and
- arbitrary advisory message bodies from law checks.

Verdict text is retained and signed verbatim because it is the evidence being
attested. If a verdict contains sensitive information, it cannot be edited in
place without breaking its signature; the correct response is a new verdict or
an operational change to what is permitted in verdict text.

The session key is ephemeral rather than externally anchored. A receipt can
prove internal consistency and tamper evidence relative to its manifest, but
not who controlled the original process. Cross-session attribution, public key
infrastructure, scorecards, escrowed execution, and economic settlement are
future scope, not hidden promises of this feature.

## Verification evidence

The implementation was verified on Bun 1.3.14 with:

- root workspace typecheck: passed;
- root workspace tests: passed;
- ESLint with `--max-warnings 0`: passed;
- Prettier check: passed;
- tracker suite: 30/30;
- crypto suite: 21/21;
- provenance, mode, and attack suite: 23/23;
- `/attest` suite: 11/11;
- clean-process suite: 4/4; and
- Trust Matrix fidelity and zero-control suite: 6/6.

The repository-wide Markdownlint command still reports unrelated long lines in
the pre-existing `docs/design/Agent-Steering Teacher Architecture.md`. The ZTAP
document and FID records use the repository's documented line-length suppression
where needed; that unrelated document was not rewritten as part of ZTAP.

## Implementation map

| Area | Primary files |
| --- | --- |
| Crypto | `common/src/crypto/` and `common/src/crypto/__tests__/` |
| Shared provenance | `common/src/provenance/`, `common/src/types/provenance.ts` |
| Runtime ledger | `packages/agent-runtime/src/provenance/` |
| Native interception | `packages/agent-runtime/src/tools/tool-executor/native.ts` |
| Verdict hooks | `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts` and `spawn-agent-inline.ts` |
| Export | `cli/src/commands/attest.ts` and `cli/src/commands/attest/` |
| Clean-process audit | `cli/src/commands/attest/clean-process/` (barrel `clean-process-validator.ts`) |
| Trust Matrix | `cli/src/components/savant-ui/echo/trust-matrix.tsx` and chat-store event handling |
| Configuration | `protocol.config.yaml` and CLI/SDK run configuration |

ZTAP is implemented and ships in v0.0.25. Its Nova implementation sign-off is
recorded at `dev/nova/inbox/2026-08-13-fid-2026-0813-001-ztap-implementation-signoff-response.md`.
