# FreeBuff ECHO Protocol

**For FreeBuff agent sessions on this repository, this file is the protocol marker.**

The full FreeBuff ECHO protocol is maintained at:

```text
dev/nova/specs/echo-v0.1.2-freebuff.md
```

Its machine-readable configuration is `freebuff.protocol` in
`protocol.config.yaml` (`version: 0.1.2-freebuff`, `strict_mode: true`).
Read that file completely before any work session. Do not use `ECHO.md` (Savant-Code harness protocol) for FreeBuff
agent governance.

See `FREEREADME.md` for the full session directive.

## Signing Policy

Agents sign every authored/modified document (FIDs, session summaries, CHANGELOG entries, knowledge files) as
**`Savant`** only — never as `Buffy`, `FreeBuff`, or any other product/harness name. See "Document Signing &
Attribution" in `dev/nova/specs/echo-v0.1.2-freebuff.md`.
