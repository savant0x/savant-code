# Zylo provider live acceptance

Session: 2026-10-17. Implementation record: FID-2026-1017-016.
Contract: <https://console.zyloai.net/docs/#introduction>.

The operator requested text models only. Requests used the corrected `ZYLO_API_KEY`,
loaded through `common/src/env.ts`, with Bearer authentication. No credential value
is retained here. The earlier misspelled variable and rejected key are superseded
by the operator's updated credential.

## Authentication and catalog

| Check | Observed result |
| --- | --- |
| `GET https://api.zyloai.net/v1/validate` | HTTP 200 |
| `GET https://api.zyloai.net/v1/models` | HTTP 200 keyless and authenticated; byte-identical bodies |
| Root fields | `text,image,submodels,version,engine` |
| Main text catalog | 126 rows |
| Positive finite `context_window` | 126 of 126 text rows |
| Missing or invalid text windows | 0 |
| Live `fetchZyloModels(true)` integration | 126 rows; all `zylo/` IDs, positive windows, and plan tags |
| Separate image catalog | 14 rows; excluded by text-only scope |
| Separate custom submodels | 2 rows; not in the main text catalog |

The public catalog is fetched without a key; inference still requires `ZYLO_API_KEY`.
The catalog includes plan metadata and models unavailable to the tested BASIC account.
Its row count is a vendor roster measurement, not a count of working account routes.

## Minimal text inference

Requests used `POST https://api.zyloai.net/v1/chat/completions`, one user message,
`max_new_tokens: 1`, and a bounded timeout. These are direct HTTP observations;
they do not establish model identity.

| Requested model | Observed result |
| --- | --- |
| `deepseek-v4` | HTTP 410; `Upstream request failed` |
| `llama-3.1` | HTTP 402; `paid_model_on_free_plan`; BASIC needs credits or GO |
| `gemma-4` | Request failed after the 45-second bound |
| `nemotron-3.5-lightning` | Request failed after the 20-second bound |
| `nemotron-3-omni` | HTTP 404; `Upstream request failed` |
| `gpt-oss` | HTTP 410; `Upstream request failed` |

Authentication and catalog retrieval pass. A successful live completion remains
unobserved. This limitation is tracked separately as `LIVE-002` in
`dev/tracking/internal-followups.json`; implementation closure does not turn it
into a successful inference or identity result. No plan upgrade was performed.
