# Learning Agenda (FID-2026-0824-012 S3-A)

> Auto-refreshed at session end from dev/experiences/raw-traces.jsonl.
> 1-3 active high-leverage capabilities/anti-patterns; ≤ 50 lines.

- [x] **code_search** — Failed to execute ripgrep: ENOENT: no such file or directory, uv_spawn 'C:/Users/spenc/dev/savant-co
      recurrences: 13 (total 13) — FID-2026-0918-007 authored+implemented
      (PATH fallback + workspace-correct remediation), receipt stamped
      (G2-pending)

- [ ] **str_replace** — tool result contains an error
      recurrences: 12 (total 14) — promote via FID when resolved+verified

- [ ] **str_replace** — No change to the file
      recurrences: 5 (total 5) — promote via FID when resolved+verified

- [x] **EHEL circular block** — Law 3 gate holds a file unverified while the
      only typecheck repair lives in a file the gate won't let you write
      (interlocked multi-file batch edited in the wrong order); required two
      operator turn-ends to unlock on 2026-09-18.
      recurrences: 2 (total 2) — FID-2026-0918-005 authored+implemented
      (two-part target/other-dirty rule), receipt stamped (G2-pending)

- [x] **FID verification-contract gap** — a FID's Verification section named
      a runtime test that was never written; the loop still granted `verified`.
      Caught only by the Adversary, not by any gate.
      recurrences: 1 (total 1) — FID-2026-0918-006 authored+implemented
      (machine-checkable contract sweep), receipt stamped (G2-pending)
