# Gravity Integration Starter Kit — `savant-free` (ad-supported tier)

> **STATUS: PARKED until 0.0.3 rebrand ships green.**
> Do NOT wire Gravity into the codebase while `codebuff`/`freebuff` strings are still being renamed.
> The rebrand is the gate. After `grep -rE 'CODEBUFF|FREEBUFF|manicode' .` (excl. node_modules + dev/fids archive + brand history) returns 0, THEN execute this kit.

---

## What Gravity is

Gravity (trygravity.ai) is an **AI-native ad network** — contextual sponsored suggestions inside AI chat/assistant/conversational products. It's the revenue engine that makes `savant-free` free. The ad request fires **in parallel** with your LLM call (zero added latency), the SDK renders the ad + auto-logs impressions/clicks, and you earn **CPM (per impression) or CPC (per click)**.

**Architecture fit:**
- `savant-free` (ad-supported, free tier) → Gravity SDK wired in, `codebuff_cli` surface ID retained for attribution.
- `savant-code` (paid tier) → **NO Gravity SDK. No ads.** Clean premium path.

---

## DO-NOT-TOUCH (rebrand scope is separate)

These strings are **wire-protocol / legacy-support identifiers**, NOT branding. They must survive the rebrand untouched OR be re-registered with Gravity under a new ID *after* signup:

| String | Role | Action |
|---|---|---|
| `codebuff_tool_call` | XML tag LLMs output (breaks all tool execution if changed) | KEEP as-is |
| `codebuff_cli` | **Gravity publisher surface identifier** (ad attribution + analytics) | KEEP until registered; then rename to your Gravity-registered surface ID (e.g. `savant-free_cli`) and update dashboard |
| `codebuff_terminal_command` | Activity tracking key | KEEP as-is |
| `manicode` config dir / `.manicodeignore` | Legacy config support | KEEP as-is (rename to `savant` is a separate, non-Gravity decision) |

⚠️ **If you rename `codebuff_cli` before registering with Gravity, ad revenue attribution breaks.** Register first, get your publisher surface ID, then align the string.

---

## Prerequisites (post-0.0.3)

1. 0.0.3 rebrand pushed + green (typecheck ×4, SDK suite, grep-zero on CODEBUFF/FREEBUFF/manicode in active code).
2. Sign up at **app.trygravity.ai/publisher/signup**.
3. Create an AI platform account for `savant-free`.
4. Copy **API key** → save as `GRAVITY_API_KEY` (server env).
5. Copy **Pixel ID** → used in web pixel script.

---

## Step 1 — Install SDK (in `savant-free/` workspace only)

```bash
cd savant-free
npm install @gravity-ai/api @gravity-ai/react
```

Do NOT install in `savant-code` or any shared workspace.

---

## Step 2 — Client context (chat component in `savant-free`)

```ts
import { gravityContext } from '@gravity-ai/api';

const gravity_context = gravityContext({
  sessionId: chatSession.id,       // your conversation ID
  user: { userId: currentUser.id } // your user ID
});
// gravity_context includes device: { ua, timezone, locale, ... }
// SDK adds end-user IP from request headers automatically.

fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ messages, gravity_context }),
});
```

**CRITICAL:** Forward `gravity_context` all the way to the ad request. The `device.ua` + `device.ip` are **required** — requests missing them are rejected with HTTP 400. If your backend calls Gravity without forwarding `device`, the ad request carries your *server's* UA/IP, not the end user's.

---

## Step 3 — Server ad fetch (parallel with LLM stream)

```ts
import { Gravity } from '@gravity-ai/api';

const gravity = new Gravity();  // reads GRAVITY_API_KEY from env

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  const adPromise = gravity.getAds(req, messages, [
    { placement: 'below_response', placement_id: 'main' },
  ]);

  // Stream your LLM response in parallel...
  for await (const token of streamYourLLM(messages)) {
    res.write(`data: ${JSON.stringify({ type: 'chunk', content: token })}\n\n`);
  }

  const { ads } = await adPromise;
  res.write(`data: ${JSON.stringify({ type: 'done', ads })}\n\n`);
  res.end();
});
```

- Never throws — failures return `[]`.
- 3s timeout default (configurable).
- Runs alongside LLM call = zero added latency.

---

## Step 4 — Render ad (React, `savant-free` UI)

```tsx
import { GravityAd } from '@gravity-ai/react';

function ChatResponse({ response, ads }) {
  return (
    <div>
      <p>{response}</p>
      {ads[0] && <GravityAd ad={ads[0]} variant="card" />}
    </div>
  );
}
```

`GravityAd` auto-fires impression tracking (IntersectionObserver) + click attribution. 20+ variants: `card`, `minimal`, `inline`, `spotlight`, `pill`, `banner`, `hyperlink`, etc.

---

## Step 5 — Web pixel (REQUIRED for payouts)

Drop on every `savant-free` page:

```html
<script>
  !function(w,d,t,u,n,a,m){w['GravityPixelObject']=n;w[n]=w[n]||function(){
  (w[n].q=w[n].q||[]).push(arguments)},w[n].l=1*new Date();a=d.createElement(t),
  m=d.getElementsByTagName(t)[0];a.async=1;a.src=u;m.parentNode.insertBefore(a,m)
  }(window,document,'script','https://code.trygravity.ai/gr-pix.js','gravity');
  gravity('init', 'YOUR_PIXEL_ID');
</script>
```

Without the pixel, Gravity can't measure journeys or tie performance to payouts.

---

## Step 6 — Go live

Default `new Gravity()` = **test ads** (safe, no billing). When ready:

```ts
const gravity = new Gravity({ production: true });
```

---

## Going-live checklist (from Gravity docs)

- [ ] `GRAVITY_API_KEY` in server env (not hardcoded).
- [ ] `gravity_context` forwarded client → server → ad request (device signals intact).
- [ ] Pixel installed on all `savant-free` pages.
- [ ] `production: true` set after test-mode verification.
- [ ] `codebuff_cli` surface ID aligned with Gravity dashboard (or re-registered).
- [ ] `savant-code` (paid) has NO Gravity import.
- [ ] Ad slot gracefully hides on empty array (`204 No Content` → `{ ads: [] }`).

---

## Revenue loop (the "agent economy funds itself" model)

```
Gravity ads → savant-free inference paid → savant-free is free
                                    ↓
              you register as Gravity publisher → revenue flows
                                    ↓
         Zero-cost infra + ad-funded free tier + paid premium = funded stack
```

---

## References

- Quickstart: https://docs.trygravity.ai/ai-platforms/quickstart
- Integration guide: https://docs.trygravity.ai/ai-platforms/integration-guide
- Going-live: https://docs.trygravity.ai/ai-platforms/going-live
- Publisher signup: https://app.trygravity.ai/publisher/signup
- SDK: `@gravity-ai/api` (server), `@gravity-ai/react` (client)
- Case study (infra credibility): https://inference.net/case-study/gravity-ads/

---

*Drafted by Nova (2026-07-19) from Gravity's official quickstart + integration docs. Parked pending 0.0.3 rebrand completion.*
