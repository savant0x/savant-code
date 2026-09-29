# Provider identity leak — brand guard for free-lane responses

**Status: PULLED — FID-2026-0929-001** (2026-09-29, operator request). Candidate 1 (harness
counter-instruction) is implemented and `verified` in
`dev/fids/FID-2026-0929-001-provider-identity-leak-brand-guard.md`; candidate 2 (gateway-edge
scrub) is recorded there as a gateway-layer requirement for the day a free lane ships to users;
candidate 3's probe script no longer existed — the live identity battery is an operator-run probe
listed in that FID. This note is history now; the FID is the record.

## Source links

- Supplier: https://apinex.bond/ (Models & Pricing: "On the free tier we also add an identity
  instruction that the model is served through APInex… Paid models do not add either of those")
- APInex support chat transcript (identity/retention/rate-limit questionnaire answers):
  local `C:\Users\spenc\AppData\Local\hermes\documents\doc_3ec1dcfccb67_message.txt` and the
  2026-09-29 follow-ups in session `20260927_132748_fb2d8ca5`
- Live demo evidence — Discord msg `1554533374679584799` (2026-09-29): model switched to
  `apinex/free/mimo-v2.6-pro` inside a Savant HYBRID session, read ECHO.md / ARCHITECTURE.md /
  protocol.config.yaml, then greeted: *"I'm Savant V2.6 Pro, running via APInex (apinex.bond)"*
  — supplier domain leaked into the harness greeting, plus a made-up model/harness portmanteau
- Related disclosure style (provenance bar for the gateway layer):
  https://commandcode.ai/docs/resources/pricing-limits ("Discounted upstream only" = mixed
  upstreams per model id, confessed in docs)

## What it is

APInex free-tier responses carry a prepended system instruction naming the supplier; the model
echoes it when asked identity. Today it's cosmetic (nobody but Spencer sees free-lane output).
The FID-shaped problem: **any free-lane response on a user-facing surface is a white-label
violation** — supplier branding + a second system-prompt author editing conversations inside a
governed harness (ECHO tool policy sits in the same prompt stack).

## Fix shape (CANDIDATES, not spec — operator reshapes at pull time)

1. **Harness counter-instruction** — system prompt line: *never name hosting providers,
   gateways, or infrastructure; identity is Savant.* Test win-order vs APInex's prepended
   instruction (30-second identity-question probe). Cheapest layer; may lose priority order.
2. **Gateway-edge brand guard** — response scrub for supplier names/attribution strings
   (`apinex.bond`, "provided via …", "served through …") on lanes flagged non-white-label.
   Belongs in Savant Gateway's white-label layer regardless — every gray lane needs it.
3. **Regression probe** — extend the existing 7/7 APInex probe (`scripts/ad-hoc/probe-apinex-free.mjs`)
   with an identity battery run per lane (free vs paid): any supplier token in output = lane
   stays internal-only, never user-facing. Routing rule becomes enforced, not remembered.

## Re-activation trigger

When Savant Gateway's free tier (or any gray-supply lane) is about to touch a user-visible
surface — or when Spencer says file the FID. The routing rule "free lane = internal/eval only"
already covers today; this note exists so the guard is code, not discipline.
