# Savant-Free Rebrand — Outside-Service Migration Roadmap

**Date:** 2026-07-19  
**Scope:** External services, dashboards, and backend contracts that still reference the old `freebuff` brand.  
**Goal:** Complete the clean break from `freebuff` to `savant-free` / `SavantFree` without breaking attribution, analytics, or backend contracts.

---

## 1. Reddit Conversions API

| Item | Current (old) | Target | Location |
|---|---|---|---|
| Partner slug | `FREEBUFF` | `SAVANT_FREE` | `common/src/reddit-capi.ts` |

### What you need
- Access to the **Reddit Ads** account that owns pixel `a2_j6o59svbxzzn`.
- Admin or Advertiser role on the Reddit Ads account.
- Reddit Events Manager access for the pixel.

### Steps
1. Log in to [Reddit Ads](https://ads.reddit.com) → Events Manager.
2. Locate pixel `a2_j6o59svbxzzn`.
3. Either:
   - Update the existing conversion event partner name from `FREEBUFF` to `SAVANT_FREE`, or
   - Create a new partner entry for `SAVANT_FREE` and migrate the conversion events to it.
4. Update the code in `common/src/reddit-capi.ts`:
   ```ts
   partner: 'SAVANT_FREE',
   ```
5. Deploy and send a test conversion event; verify in Events Manager that it is attributed to `SAVANT_FREE`.

### Risk if not updated
- Conversions will be rejected or mis-attributed, breaking Reddit ad attribution and ROAS reporting.

---

## 2. Gravity Index (Ad Attribution Surfaces)

| Item | Current (old) | Target | Location |
|---|---|---|---|
| Surface ID — chat | `freebuff_chat` | `savant_free_chat` | `packages/agent-runtime/src/tools/handlers/tool/gravity-index.ts` |
| Surface ID — web | `freebuff_web` | `savant_free_web` | `packages/agent-runtime/src/tools/handlers/tool/gravity-index.ts` |

### What you need
- Access to the **Gravity AI** dashboard/account that receives these surface IDs.
- Admin or Editor role to register/update surface IDs.

### Steps
1. Log in to the Gravity dashboard.
2. Register the new surface IDs `savant_free_chat` and `savant_free_web`.
3. Map them to the same campaigns/payouts previously tied to `freebuff_chat` and `freebuff_web`.
4. Update the code:
   ```ts
   if (agentTemplate.id === 'base-chat') return 'savant_free_chat'
   if (agentTemplate.id.startsWith('base2-free')) return 'savant_free_web'
   ```
5. Verify clicks/conversions are attributed correctly under the new surface IDs.

### Risk if not updated
- Gravity will not recognize the new surface IDs; ad clicks/conversions will not be attributed, and revenue reporting will drop.

---

## 3. Telemetry / Analytics Event Names

| Item | Current (old) | Target | Location |
|---|---|---|---|
| Update-failed event | `cli.update_freebuff_failed` | `cli.update_savant_free_failed` | `cli/src/__tests__/release/wrapper-safety.test.ts`, `savant-free/cli/release` wrapper config |

### What you need
- Access to **PostHog** (and/or Axiom) project where these events are ingested.
- Admin or Data Management role to rename/create event definitions.

### Steps
1. In PostHog, create a new event definition `cli.update_savant_free_failed`.
2. Optionally set up a transformation/alias from the old event to the new one during the transition.
3. Update the wrapper config and test expectation.
4. Verify events appear under the new name in PostHog.

### Risk if not updated
- Low immediate risk; the event will simply continue to appear as `cli.update_freebuff_failed` in dashboards. The rebrand will be incomplete.

---

## 4. Backend Chat-Completions Contract Field

| Item | Current (old) | Target | Location |
|---|---|---|---|
| Instance ID field | `freebuff_instance_id` | `savant_free_instance_id` | `common/src/types/contracts/llm.ts`, `sdk/src/run.ts`, `cli/src/hooks/use-send-message.ts` |

### What you need
- Access to the **SavantCode backend** (chat-completions API) to accept the new field.
- Ability to deploy a backend change or add a backward-compatible alias.

### Steps
1. Update the backend to accept `savant_free_instance_id` in the request body / `savant_code_metadata`.
2. Either:
   - Replace the old field entirely, or
   - Accept both `freebuff_instance_id` and `savant_free_instance_id` during a transition period.
3. Update the three source locations to send `savant_free_instance_id`.
4. Run backend integration tests.

### Risk if not updated
- The backend may ignore or reject the new field, breaking savant-free session routing and rate-limit attribution.

---

## 5. Environment Variables

| Item | Current (old) | Target | Location |
|---|---|---|---|
| Free-mode toggle | `FREEBUFF_MODE` | `SAVANT_FREE_MODE` | `cli/src/types/env.ts`, `cli/src/utils/env.ts`, consumers |
| Free web URL | `FREEBUFF_WEB_URL` | `SAVANT_FREE_WEB_URL` | `cli/src/types/env.ts`, `cli/src/utils/env.ts`, consumers |
| Next.js public app URL | `NEXT_PUBLIC_FREEBUFF_APP_URL` | `NEXT_PUBLIC_SAVANT_FREE_APP_URL` | `common/src/env-schema.ts`, `cli/src/login/constants.ts`, `.env` files |

### What you need
- Access to deployment environments:
  - Vercel / Next.js dashboard for `NEXT_PUBLIC_*` vars.
  - GitHub Actions / CI secrets if env vars are set there.
  - Local `.env.local` files for developers.

### Steps
1. Add the new env vars alongside the old ones in every environment.
2. Deploy the code that reads the new names.
3. Remove the old env vars after confirming the new ones work.
4. Update `.env.example` and developer docs.

### Risk if not updated
- The app will fail to start or will point to the wrong URLs/services if the new env vars are missing.

---

## 6. Summary Checklist

| # | Service | Action Owner | Account/Access Needed | Status |
|---|---|---|---|---|
| 1 | Reddit Ads | Marketing/Ads | Reddit Ads admin | Not started |
| 2 | Gravity AI | Growth/Ads | Gravity dashboard admin | Not started |
| 3 | PostHog/Axiom | Data/Engineering | PostHog admin | Not started |
| 4 | SavantCode backend | Backend engineering | Backend deploy access | Not started |
| 5 | Deployment env vars | DevOps/Engineering | Vercel/CI secrets access | Not started |

---

## Notes

- The code currently keeps the **old external identifiers** to avoid breaking live integrations while this roadmap is executed.
- Internal identifiers (constants, types, function names, settings keys) have already been renamed to `savantFree` / `SAVANT_FREE` / `SavantFree`.
- Do **not** bulk-rename external identifiers with scripts; update them only after the corresponding dashboard/backend has been updated and verified.
