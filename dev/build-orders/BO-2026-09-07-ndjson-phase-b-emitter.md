---
title: NDJSON Phase B Emitter — FID-067 v2 delegation transport (child side)
date: 2026-09-07
author: —
status: planning
requested_by: Spencer (via Savant DelegationEngine, FID-067)
consumed_by: (unassigned — any harness session with Orchestrator role)
source_research: FULL SPEC EMBEDDED BELOW (§Frozen Wire Contract, verbatim) — canonical copies live in the Savant repo (C:\Users\spenc\dev\Savant): dev/handoffs/2026-09-03-fid067-phase-b-savant-code-ndjson-emitter.md (ratified handoff, wire contract FROZEN) + dev/fids/FID-2026-07-31-067-bidirectional-streaming.md §Transport Decision. Those paths do NOT resolve inside savant-code; this document is self-contained by design.
fids_emitted: []
---

# BO-2026-09-07-ndjson-phase-b-emitter

## Overview

Implement the **Phase B child-side half** of the ratified FID-067 v2 delegation transport.
The Savant parent (DelegationEngine, Phase A shipped 2026-09-03) already speaks the wire
protocol end-to-end: frame parser, control writer, cooperative cancel with
`cancel_grace_secs` → kill escalation, and a process-level integration suite. The parent
is **live and waiting** — this build order is the only remaining transport work. Without
it, every delegation from Savant runs v1 one-shot (fire-and-forget): no progress, no
questions, no steering.

Scope in one line: when the parent passes `--json` as the final argv before the brief,
tap the existing `handleEvent` seam to emit one NDJSON frame per line on stdout, and read
line-delimited control frames on stdin at step boundaries. Everything else (frame
envelope, event vocabulary, exit-code policy) is already ratified — mirror it, do not
re-design it.

### Non-negotiable constraints

- **The wire contract is FROZEN.** Envelope `{v, type, ts, data}`, `v` = `1`,
  `type ∈ {progress, question, artifact, error}` child→parent; `{cancel, steer}`
  parent→child. Full spec: the source handoff document above. Do not add, rename, or
  re-shape fields; unknown-field tolerance is the compat mechanism, not an invitation.
- **argv-exact activation.** Detection is literal `--json`, not "any arg contains json".
- **No `--json` → byte-identical v1.** The unpiped path must not change by one byte
  (regression-diff against a pre-change run is a closure gate).
- **stdout purity in JSON mode.** stdout carries ONLY frames. Every stray print becomes
  a malformed line on the parent (skipped + logged). All diagnostics stay on stderr in
  both modes.
- **Exactly one `artifact` frame per run.** Its `data.output` is the answer; in JSON mode
  the parent ignores raw stdout as answer text.
- **Tap, don't fork.** The emission point is the existing `handleEvent` callback in
  `cli/src/headless-run.ts` (~line 224). Forward a serialized frame per event IN ADDITION
  to current behavior. Do not branch the event pipeline.
- **Windows-first.** stdio pipes only; no UDS/named-pipe/socket work (that decision was
  scored and rejected on the parent side — see the handoff's Option A/B rejections).

## Research Foundation

- Internal: `cli/src/headless-run.ts` `handleEvent` seam — the ratified emission point;
  every agent-runtime event already flows through it.
- Internal: headless `--print` final-answer write point — the artifact-frame emission
  point (same moment, different output shape in JSON mode).
- Internal: run-loop step boundaries — the stdin control-frame read points.
- External: the parent's ratified behaviors this child can rely on (all already tested
  on the Savant side): concurrent stdout drain (many frames cannot deadlock a full
  pipe), malformed-line/unknown-type skip (never fatal), cancel frame on stdin +
  `cancel_grace_secs` (default 10) cooperative window + kill backstop, `ts` currently
  ignored (emit real epoch-ms anyway).

## Staged Data / Current State

| Item | State |
| --- | --- |
| Parent transport (Savant) | SHIPPED + green (frames.rs parser/builders, engine rewire, `test_ndjson_*` suite, workspace battery 1603/0 at Phase A closure) |
| Child emitter (this repo) | ABSENT — no commit, no CHANGELOG entry, no frame logic in `headless-run.ts` (verified 2026-09-07 on main, all branches) |
| Wire contract | Ratified + frozen in the Savant handoff doc (source of truth) |
| Activation flag contract | Parent emits `--json` immediately before the brief, ndjson profiles only |

## Frozen Wire Contract (embedded verbatim from the ratified handoff)

Reproduced in full from the Savant repo's ratified Phase B handoff (2026-09-03) so this
build order is self-contained. If the canonical doc ever diverges from this section,
the divergence itself is a stop-and-escalate: do not resolve it silently.

### Context

FID-067 ratified NDJSON frames over stdio as the v2 delegation transport. The Savant
(parent) half is **implemented and green**: frame parser, control writer,
cooperative-cancel with kill escalation, profile plumbing
(`external_protocol = "ndjson"` + `cancel_grace_secs`), and a full integration suite
(`crates/agent/tests/delegation_pipeline.rs`, `test_ndjson_*`). Until the child ships,
nothing breaks: `text` (v1) remains the default protocol and byte-identical.

### Activation

The parent passes `--json` as the final argument before the brief, **only** for profiles
with `external_protocol = "ndjson"`. The child:

- `--json` present → emit frames on stdout, read control frames on stdin.
- `--json` absent → v1 behavior, byte-identical (stdout is the raw answer).

Detection must be argv-exact (`--json`), not "any arg contains json".

### Emission point

The existing runtime event seam: `handleEvent` in `headless-run.ts` (~line 224) already
observes every agent event. In JSON mode, forward a serialized frame per event **in
addition to** current behavior (logging, TUI suppression — whatever headless mode
already does). Do not fork the event pipeline; tap it.

### Frames (child → parent, stdout, one JSON object per line)

Envelope — strict, exactly these keys, `v` is the wire version the parent speaks
(currently `1`):

```json
{"v":1,"type":"progress","ts":1693760000000,"data":{...}}
{"v":1,"type":"question","ts":...,"data":{"id":"q1","prompt":"...","options":["a","b"]}}
{"v":1,"type":"artifact","ts":...,"data":{"output":"<final answer text>"}}
{"v":1,"type":"error","ts":...,"data":{"message":"<human-readable>"}}
```

Rules:

1. **One frame per line.** JSON-escape newlines inside payloads (`JSON.stringify` does
   this) — a raw newline inside a frame corrupts the channel.
2. `progress.data.kind` maps 1:1 onto the parent's event vocabulary:

   | agent-runtime event | `progress.data` |
   |---|---|
   | tool call start | `{"kind":"tool_call_started","tool":"<name>","iteration":N}` |
   | tool call end | `{"kind":"tool_call_completed","tool":"<name>","success":bool,"duration_ms":N}` |
   | iteration end | `{"kind":"iteration_completed","iteration":N,"tokens_used":N}` |
   | thinking start | `{"kind":"thinking_started","iteration":N}` |
   | thinking end | `{"kind":"thinking_completed","iteration":N,"reasoning":"..."}` |

   Unknown kinds are safe to emit — the parent skips them (forward compat) — but the
   five above are the ratified minimum set.
3. **Exactly one `artifact` frame per run**, emitted when the final answer is known (the
   same point headless `--print` writes stdout today). Its `data.output` replaces "the
   whole stdout is the answer" — in JSON mode the parent treats ONLY this frame as the
   answer.
4. `error` frames are non-fatal diagnostics; the run's failure is still conveyed by
   process exit code. Emit before exiting nonzero.
5. **stdout carries nothing else in JSON mode.** Any stray print (debug, banners)
   becomes a malformed line — the parent skips it, but logs it. Keep all diagnostics on
   stderr (unchanged in both modes).

### Control frames (parent → child, stdin, one JSON object per line)

```json
{"v":1,"type":"cancel"}
{"v":1,"type":"steer","data":{"note":"..."}}
```

Read stdin **line-delimited at step boundaries** (between agent steps — the same places
the run loop already yields). Rules:

- `cancel` → stop taking new steps, flush what exists, exit. Exit code by existing
  run-loop policy (0 is fine — the parent reports cancellation from its own side
  regardless; a nonzero code is also acceptable and is logged as the cooperative exit
  status).
- `steer` → apply `data.note` as steering at the next step boundary (Phase C
  activation; safe to ignore until questions/steering ship, but the parser should
  accept the frame).
- Unknown `type` or `v` ≠ 1 → skip the line, keep reading.
- stdin EOF before any frame → treat as "no control input", continue the run (the
  parent may not have opened a control channel).

### Exit codes

Unchanged from v1: 0 = success, nonzero = failure. The parent maps exit code →
`DelegationResult.success` exactly as before; frames shape the *content*, the exit code
still owns the verdict.

### Parent behaviors the child can rely on (already tested on the Savant side)

- Parent drains stdout concurrently — a child that emits many frames cannot deadlock on
  a full pipe.
- Malformed lines and unknown types are skipped, never fatal.
- On cancellation the parent sends `{"v":1,"type":"cancel"}` on stdin, waits
  `cancel_grace_secs` (profile-configurable, default 10) for cooperative exit, then
  kills.
- Parent never reads `ts` (yet); emit real epoch-ms anyway for future use.

### Out of scope for Phase B

- `question` emission and `steer` application (Phase C — parent UI routing first). The
  frame formats above are final; emitting questions early is harmless (parent forwards
  them on the progress channel).

## Phased Build Order

### Phase 1 — Emit (child → parent)

| FID | Title | Scope | Depends On | Acceptance Gates |
| --- | --- | --- | --- | --- |
| 1 | JSON-mode activation + frame module | argv-exact `--json` detection in the headless entry; frame module (types + `JSON.stringify`-per-line emitter honoring the strict envelope; real epoch-ms `ts`) | — | Unit tests: envelope shape, newline escaping inside payloads (embedded newlines/quotes survive as one line), unknown-kind tolerance is a no-op at emit time |
| 2 | `handleEvent` tap → progress frames | Forward per-event frames from the existing seam in JSON mode only; map the ratified minimum five kinds: `tool_call_started`, `tool_call_completed`, `iteration_completed`, `thinking_started`, `thinking_completed` (kind names + payload keys exactly per the handoff table) | 1 | Harness tests: JSON mode yields ≥1 progress frame per qualifying event; non-JSON mode emits zero frames and stdout is byte-identical to pre-change |
| 3 | Artifact + error frames; stdout purity | At the `--print` answer point emit exactly one `artifact` frame (`data.output` = the answer) and suppress the raw stdout write in JSON mode; emit `error` frames (non-fatal diagnostics) before a nonzero exit | 2 | Tests: exactly 1 artifact per run, `artifact.output` == the `--print` answer for the same brief, zero non-frame bytes on stdout in JSON mode, stderr untouched in both modes |

### Phase 2 — Control (parent → child)

| FID | Title | Scope | Depends On | Acceptance Gates |
| --- | --- | --- | --- | --- |
| 4 | stdin control-frame reader | Line-delimited stdin reads at step boundaries; `cancel` → stop new steps, flush, exit (exit code per existing run-loop policy; either 0 or nonzero is acceptable — the parent owns the verdict); `steer` → accept + park (apply-at-boundary is Phase C; parser must accept the frame); unknown `type` or `v ≠ 1` → skip line, keep reading; stdin EOF with no frames → continue the run | 1 | Tests: cancel mid-run exits within the grace window with no frames after the ack; unknown/foreign frames ignored, run continues; EOF-only stdin never blocks the run |

### Phase 3 — Prove (integration + gating)

| FID | Title | Scope | Depends On | Acceptance Gates |
| --- | --- | --- | --- | --- |
| 5 | Handoff test matrix, live | Execute the handoff's 6-case matrix as real-process tests: (1) `--json` happy run ≥1 progress + exactly 1 artifact + exit 0 + artifact==print-answer; (2) no-`--json` byte-identical diff; (3) embedded newline/quote payload survives one line; (4) cancel mid-run within grace; (5) stderr-only diagnostics; (6) unknown control frame ignored | 3, 4 | Full suite green; then a cross-repo smoke: point a Savant ndjson profile at the built CLI and observe progress + artifact + cooperative cancel live (parent-side `test_ndjson_*` already proves the harness — this is the real-child confirmation) |

## Sequencing note for Phase C (Savant-side)

Questions/steering activation (routing `question` frames to the user, answers as stdin
`steer` frames) is **Savant-side Phase C** and is scoped independently there. Phase 1+2
here are sufficient to unblock it; emitting questions early is harmless (the parent
forwards them on its progress channel). No further transport work exists on either side
after this build order completes.
