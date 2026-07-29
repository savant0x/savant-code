# FreeBuff Session Directive

**Repository:** `savant-code`  
**Products:** Savant-Code (harness) + FreeBuff (agent tooling)

## Directive

If you are a **FreeBuff agent** working on this repository, do **NOT** use `ECHO.md` as your governing protocol.

Use instead:

```
dev/nova/specs/echo-v0.1.2-freebuff.md
```

`ECHO.md` is the ECHO Protocol for the **Savant-Code harness** (multi-agent roster). FreeBuff agents operate under a single-agent adaptation located at `dev/nova/specs/echo-v0.1.2-freebuff.md`.

## Why

- Savant-Code `ECHO.md` assumes a 9-agent roster and harness-bound tooling that FreeBuff agents do not have.
- The FreeBuff ECHO adaptation simplifies the protocol for single-agent operation while keeping the same core laws and perfection loop.
- This directive exists so future FreeBuff sessions bootstrap with the correct protocol without relying on session-by-session instructions.

## Quick Reference

| Context | Governing Protocol |
|---------|-------------------|
| Savant-Code harness agents | `ECHO.md` |
| FreeBuff agent sessions | `dev/nova/specs/echo-v0.1.2-freebuff.md` |

Read the FreeBuff protocol completely before any work session.
