# Provider live acceptance — 2026-10-03

Authenticated catalog snapshots and complete ID lists:
`provider-catalogs-2026-10-03/README.md`.
HTTP 200 counts: CodeCraft 33, CleanAPIs 33, xKiro 129.
Actual normalization retained 33/33, 33/33, and 129/129 IDs respectively;
xKiro has zero unrouteable IDs. The two compatible chat catalogs expose
no separate output limits; the parser preserves that omission.

The bounded `provider-integration-smoke.ts` uses the installed SDK and
runtime factory, a local JSON-schema ping tool, auto tool choice,
maxRetries 0, maxOutputTokens 96, and a 35-second timeout. Successful
events contain a ping tool call. Errors are summarized with keys redacted.

| Route | Model | Result | Elapsed | Reported usage |
|---|---|---|---|---|
| CodeCraft chat | `gpt-5.6-luna` | Tool call passed | 4,136 ms | 829 input, 400 output, 1,229 total |
| CleanAPIs chat | `gpt-5.6-luna` | Tool call passed | 2,962 ms | 829 input, 337 output, 1,166 total |
| xKiro mapped chat | `mistralai/ministral-14b` | Tool call passed | 1,411 ms | Unreported |
| xKiro mapped Messages | `anthropic/claude-haiku-4.5` | HTTP 403 | 279 ms | Unreported |
| xKiro Messages test override | `mistralai/ministral-14b` | Tool call passed | 1,546 ms | 0 input, 11 output, 11 total |

HTTP 403 explanation: active paid plan or real deposited balance required;
promotional/bonus credits do not apply. The free-model Messages result uses
an explicit factory configuration override. Production maps that Mistral ID
to chat, so the override does not establish mapped Claude entitlement.
Initial named tool-choice smoke attempts were rejected by CodeCraft and
CleanAPIs; final calls use the runtime's supported auto choice.

Live tmux session `provider-integration-20261003`: 2,046 total models,
xKiro filter 129 matches. At 100×28, twenty paced Down events left
Command A Vision selected inside the viewport (showing 17–28).
At 60×24, selected rows and names retained one-line geometry.
CodeCraft, CleanAPIs, and xKiro were configured in `/provider`.
No picker selection changed the active provider or saved model preference.

Automated evidence: common providers 72 pass; related CLI 170 pass;
full SDK unrestricted 577 pass, one POSIX-only skip, zero fail.
All 22 declared gates passed at 2026-10-03T05:48:12.028Z; raw gate results
are preserved in `provider-integration-fid-gates.log`.
