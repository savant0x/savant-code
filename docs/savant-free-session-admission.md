<!-- markdownlint-disable MD013 -->

# SavantFree Session Admission

This document describes the session-gate errors returned by
`POST /api/v1/chat/completions` for the SavantFree (free) tier. The client maps
these to the `SavantFreeGateErrorCode` union and the
`SAVANT_FREE_GATE_STATUS` table in `cli/src/utils/error-handling.ts`.

The error codes keep their **legacy waiting-room names** for wire
compatibility — they predate the rename from "waiting room" to "session
admission" and are deliberately unchanged so existing clients keep working.

## Contract

| HTTP | `error.code` | Meaning | Client action |
|---|---|---|---|
| 428 | `waiting_room_required` | No session row exists, or the request carried no instance id (the client is not holding a session). | `POST /session` to start a session. |
| 429 | `waiting_room_queued` | Transient admission race — the row was caught mid-admit. | Retry via the normal poll. |
| 409 | `session_superseded` | Another CLI rotated our instance id. | Re-resolve/re-acquire the session instance. |
| 409 | `session_model_mismatch` | The session tier/model no longer matches the request. | Re-establish the session at the current tier/model. |
| 410 | `session_expired` | The active session's `expires_at` has passed. | `POST /session` to start a fresh session. |

## Client detection

`getSavantFreeGateErrorKind(error)` recognizes a gate error only when **both**
the `error.code` and the HTTP `statusCode` match the table above
(`SAVANT_FREE_GATE_STATUS`). A bare `error.code` with a mismatched status is
**not** treated as a gate error — the pair is the contract, not the code alone.
