<!-- markdownlint-disable MD013 MD024 -->

# FAQ

Answers to the most common questions about Auto Drive, Discord Rich Presence,
and the command names behind them.

---

## Auto Drive

### What is Auto Drive?

Auto Drive turns a one-sentence goal into an approved, fully-specified plan and
then runs that plan to completion autonomously: it clarifies the goal, produces
a pre-build plan, asks for a single operator confirmation, then executes the
decomposed FID backlog in dependency order under the STRICT agent.

### How do I start it?

```text
/auto-drive "fix the flaky login tests"
/auto-drive --spec ./login-spec.md
```

The headless (no-TUI) equivalent is:

```bash
savant-code --auto "fix the flaky login tests"
savant-code --auto "fix the flaky login tests" --spec ./login-spec.md --approve
```

### Is `/auto-drive` the same as `/drive`, `/auto`, and `/autodrive`?

Yes. `/auto-drive` is the canonical name; `/auto`, `/drive`, and `/autodrive`
are hidden aliases that resolve to the exact same handler. Use whichever
spelling you prefer — they all trigger the same feature.

### Is `/auto-drive` the same as `/goal`?

No. They are two different features:

| | `/goal` | `/auto-drive` |
|---|---|---|
| Purpose | Run the agent **until a condition is met** | **Plan and execute a whole feature** to completion |
| Example | `/goal all tests pass` | `/auto-drive "add OAuth login"` |
| Ceremony | None — a durable objective + budget | Full: clarify → plan → approve → FID backlog |
| Approval | Implicit (you typed the objective) | One explicit confirmation (Law 2) |
| Completion | `update_goal` tool verifies the condition | Completion certification over the FID backlog |

Use `/goal` for "keep going until X is true". Use `/auto-drive` for "build this
thing end to end".

### What happens after I confirm the plan?

A `<drive-lock>` directive records the durable drive and strips the interactive
tools (`ask_user`, `suggest_followups`, `end_turn`) for the rest of the run, so
the drive cannot stop to ask you questions. Genuine impasses are routed through
a self-healing ladder instead of interrupting you.

### How do I pause, resume, or stop a drive?

```text
/auto-drive status
/auto-drive pause
/auto-drive resume
/auto-drive stop
```

In the TUI, pressing Esc pauses (first press) and stops (second press) an
active drive.

### How do I know a drive finished successfully?

The drive writes progress into the master FID's `## Run Log` and the completion
report (`dev/exports/auto-drive-report.md`). In headless mode the process exits
`0` only when zero FIDs remain open.

---

## Discord Rich Presence

### What is `/presence`?

`/presence` externalizes your coding activity to Discord Rich Presence: the
active agent (large image), the project basename + model (`details` line), and
the live ECHO phase / activity (`state` line, real-time). The execution mode
(HYBRID/STRICT/SCAFFOLD/ANALYZE) is a hover detail on the mode overlay's
tooltip — the model label is provider-trimmed (`deepseek/deepseek-v4-pro` →
`deepseek-v4-pro`, `nous/meituan/longcat-2.0:free` → `longcat-2.0`) and
`openrouter/free` renders as "OpenRouter Free". The model and the mode are
distinct — never conflated.

### How do I turn it on?

It is already on — presence is **enabled by default**. You only need
`/presence enable` if you previously ran `/presence disable`:

```text
/presence enable
```

`/presence status` shows the current state (`active`, `dormant`, or `disabled`),
and `/presence disable` clears the activity and closes the connection. The
Discord Application client id is hardcoded to the Savant application — there is
no `client <id>` subcommand, and the id cannot be changed.

### What does Discord actually see?

Only sanitized, high-level activity. The privacy layer:

- Broadcasts the project **basename** only (parent directories are discarded).
- Drops tool arguments absolutely.
- Strips the FID kebab title (it may name a vulnerability); only the numeric
  `FID-YYYY-MMDD-NNN` id is sent.
- Masks search queries.

A Zod schema is the last gate — any payload that would leak a path fails closed
to a hardcoded safe payload instead of crashing or leaking.

### Do I need to set anything up in the Discord Developer Portal?

No — the client id is hardcoded to the Savant Discord application, so there is
nothing to configure on your side. The agent/phase image assets are owned and
uploaded under that application; the id is compiled in and cannot be redirected
to a third-party application (which would be a feature-theft vector).

### What if Discord isn't running?

The presence client stays dormant and retries; a mid-session disconnect
degrades silently and never interrupts the agent loop.

---

## Research (web_search / read_docs / deep_research)

### Do web search and docs lookup need an API key?

No. They work **keylessly out of the box**: `web_search` falls back to a free
Qwant + DuckDuckGo port, and `read_docs` builds a self-populating local SQLite
docset cache (`~/.savant-code/docsets/`). `deep_research` inherits whichever
source is active.

### How do I opt into a paid / higher-quality search source?

Run `/research-keys <service>` and paste the key into the masked prompt. The
supported services are Serper, Context7, Parallel, Tavily, Exa, and Firecrawl.
Keys are saved to `credentials.json` and applied at boot; the matching
environment variables (`SERPER_API_KEY`, `CONTEXT7_API_KEY`,
`PARALLEL_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, `FIRECRAWL_API_KEY`) take
precedence for automation.

### Why did `read_docs` used to fail with “backend services are unavailable”?

Research was previously routed through the SavantCode backend, which
short-circuits in direct-provider mode (the default release-binary boot mode).
Research is now decoupled from `DIRECT_PROVIDER` and routed through a local,
swappable adapter, so it works in every mode (FID-2026-0819-002).

### How does `read_docs` stay up to date without a server?

Every docset records `fetched_at` + `version`. A 7-day TTL re-searches before
answering, and keyless version detection (npm / PyPI / crates.io / RubyGems /
proxy.golang.org) pins the query to the current release. A name that resolves in
multiple ecosystems is surfaced for disambiguation; pin it explicitly with
`read_docs({ libraryTitle, ecosystem: "go" })`.

---

## Status & Availability

### Are Auto Drive and Discord Rich Presence fully shipped?

The code and tests are implemented and all repository gates pass, but the two
features are still `verified` (not `closed`) while live smoke tests and
independent review are in flight. See the Auto Drive program FIDs
(`dev/fids/FID-2026-0818-001` master + children `002`–`009`) for the exact
status of each step.
