# Nova Audit Channel

`nova/` is the third-party audit and research exchange channel.

- [`inbox/`](inbox/) — incoming audit responses and active review material
- [`outbox/`](outbox/) — prompts and requests sent for external review
- [`reports/`](reports/) — retained research/report artifacts
- [`specs/`](specs/) — protocol and feature specifications
- `inbox/archive/` and `outbox/archive/` — historical exchanges

Preserve audit messages and specifications as historical records. New active
requests belong at the inbox/outbox roots; completed exchanges move to the
matching archive without rewriting their contents.

An archived Nova message means that the exchange or audit response itself has
been processed. It does **not** by itself mean that the underlying FID is closed,
implemented, or release-ready. A response may be archived while retaining an
explicit `NEEDS-REVIEW` boundary or an operator disposition requirement; the
underlying FID remains governed by its own status, evidence, changelog, and
archive rules.
