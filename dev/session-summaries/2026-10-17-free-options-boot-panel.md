# 2026-10-17 — Free-options boot panel (FID-2026-1017-005)

## Ask

The boot digest showed a stale free-options value even when a refresh was
available, and the complete payload (223 offers, 146 model ids) was only in a
file the UI never located. Expand the feature through a FID: fresh on boot,
full list accessible, rendered in the traffic-light container, collapsed so it
does not fill the window.

## Diagnosis

`runLaunchDigest` read the cache synchronously (`use-chat-bootstrap.ts:120-121`)
before `mountProviderNotifications`' refresh had run. The digest itself carried
counts and two offer titles; the command carried ten attributed offers and a
bare `free-options.md` filename; only the markdown artifact carried everything.
The artifact write was swallowed inside a `try/catch` whose comment claimed the
command output was already complete.

## Implementation (`33a58d63`)

- `free-options-boot.ts`: 12 h cache threshold (operator ruling), 6 s bounded
  refresh over the existing 5 s fetch timeout, single-flight reuse, STALE /
  unavailable labels, injected clock/readers/verifier.
- `free-options-view.ts`: one derived view for panel, markdown and command.
- `free-options-artifact.ts`: path/`generatedAt`/`fetchedAt`/hash header, body
  hashing, read-back verification (missing/unreadable/path/fetchedAt/hash).
- `free-options-panel.tsx`: `TrafficLightPanel`, collapsed by default, full
  expansion, export truth, copy captures the whole payload.
- `free-options.ts`: `catalogSource`, `persistFreeOptionsArtifact` returns the
  write outcome instead of swallowing it.
- Wiring: single async boot resolve; block dispatch and collapse; command and
  offer renderers take the resolved path. `launch-digest.ts` and its two test
  files retired; their properties moved to the boot matrix and panel suite.

## Verification

- `fid:verify`: 10/10 gates exit 0.
- Six suites: 62 pass / 0 fail / 204 assertions.
- Full CLI suite: 4174 pass / 28 skip / 0 fail.
- Root `bun run typecheck`: exit 0.
- Probe: `PASS — boot freshness, one view and artifact identity held`.
- `quality:report`: PASS. `validate:repository`: PASS.

## Limitation

No live TUI smoke: `tmux` is not installed here, so the repo's tmux suites skip.
The boot path is verified at the resolver/handler boundary and the panel through
a static render; a real terminal boot/expand remains an operator observation.

## Follow-up 14:40 — FID-2026-1017-006 (native boot render)

The operator reported that boot now showed the transcript fallback plus the
serialized block. `debug/cli.jsonl` named the cause: `Text must be created
inside of a text node` raised at `free-options-panel.tsx:25`, i.e. a bare
`{' '}` string child inside `TrafficLightPanel`. The static-markup suite could
not see it because `react-dom/server` does not enforce OpenTUI host rules.

- Fix (`907e04f8`): the spacer is gone; the panel mounts on the reconciler that
  ships.
- New pin: `free-options-panel.render.test.tsx` mounts the panel via
  `@opentui/core/testing` collapsed and expanded, rejects the fallback and the
  raw block JSON. Negative control: 2 fail with `{' '}` restored.
- Real payload exercised: the operator's cached report (146 models / 3 wired
  lanes / 2 not-wired / 1 local / 223 offers, artifact ok) rendered natively at
  120 columns in both states, header and expanded sections present.
- Gates: `fid:verify` 5/5 exit 0; static panel + collapse suites 15 pass / 0
  fail; `learnings:check` PASS; `validate:repository` PASS.
- `LEARNINGS.md` gained one lesson (2 lines of headroom left; the next lesson
  needs the operator-run `bun run learnings:retire`).
