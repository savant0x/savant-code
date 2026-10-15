<!-- markdownlint-disable MD013 -->

# Logging & Event Ingest

This document describes Savant-Code's unified logging stream: the normalized
record shape, the client → server ingest path, the server sink, and the
privacy/consent controls. The canonical types and wire schemas live in
`common/src/types/contracts/logs.ts` and `common/src/schemas/logs.ts`.

## One stream for logs and events

Logs and analytics events are the **same thing**. A `LogRow` is the
provider-agnostic record shape; an "event" is just a log row with the `event`
field populated. Both flow through one stream, so operational logs and product
analytics are queryable together.

```text
LogRow {
  id                 UUID for this row
  timestamp          event time (becomes the sink's `_time`)
  level              'debug' | 'info' | 'warn' | 'error' | 'fatal'
  source             'server' | 'cli' | 'browser'
  service?           emitting service, e.g. 'web' | 'agent-runtime' | 'cli'
  env                deploy environment: 'dev' | 'test' | 'prod'
  event?             analytics/operational event name when applicable
  message?           human-readable message
  user_id?           stamped by the server from auth
  client_session_id? correlation id for a CLI/browser session
  client_request_id? correlation id for a single request
  fingerprint_id?    dedup/grouping id
  data?              structured payload (serialized to a single string on ingest)
}
```

## Ingest path

Clients POST a **batch** of records to `/api/logs`
(`common/src/schemas/logs.ts`). The server stamps `source`, `env`, `user_id`
(from auth), and a received-at `timestamp` if the client omitted them, then
enqueues into the Axiom logs sink. No `user_id` is trusted from the wire — it
is always server-derived.

### Ingest caps

The schema enforces caps to bound per-row storage and protect the path from
abuse:

| Constant | Value | Purpose |
|---|---|---|
| `MAX_LOG_RECORDS_PER_BATCH` | 500 | rows per `POST /api/logs` |
| `MAX_LOG_MESSAGE_LENGTH` | 4,000 | chars per `message` |
| `MAX_LOG_DATA_BYTES` | 64,000 | serialized `data` payload |
| `MAX_LOG_BODY_BYTES` | 1,000,000 | raw body, enforced via `Content-Length` **before** parsing |

`MAX_LOG_BODY_BYTES` is checked on the `Content-Length` header prior to any
body read (`isLogBodyTooLarge`) so an unauthenticated client cannot force the
server to buffer a huge request.

## Client shipper

The CLI mirrors its logs/events to the server sink via
`cli/src/utils/log-shipper.ts`. It runs **alongside** PostHog — it does not
replace it — and is fully best-effort: batched, fire-and-forget, never throws,
and never logs through the app logger (which would recurse).

- **Batching:** 50 records or 10s, whichever first; buffer capped at 1,000.
- **Enable/disable:** `SAVANT_CODE_SHIP_LOGS=true|false`; defaults to **on**
  outside dev/test/CI.
- **Anonymous pre-auth:** batches ship with or without an auth token. Without
  one the server accepts them anonymously (rate-limited, `user_id=null`) so
  pre-auth events such as `app_launched` still reach Axiom.
- **Consent withdrawal:** `clearClientLogs()` discards the buffer and bumps a
  consent generation; any in-flight flush checks the generation before opening
  the network request, so a withdrawn batch is dropped.
- **Flush on exit:** `beforeExit`/`SIGTERM`/`SIGINT` trigger a final flush.

## Privacy

Records carry correlation ids (`client_session_id`, `client_request_id`,
`fingerprint_id`) rather than personal data in the `message`/`data` fields.
Sensitive-key substrings are redacted before emission (see the logger
sanitizer). See [`docs/privacy.md`](privacy.md) for the full data-collection
policy and consent model.
