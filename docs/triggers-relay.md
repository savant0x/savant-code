# Trigger Relay Guide (FID-2026-0824-005, step 4)

Savant Code's webhook triggers bind **loopback only** (`127.0.0.1`,
`gatewayPort + 1`). This is a hard security requirement, not a default: the
hook route accepts authenticated deliveries that get injected into agent runs,
and it must never be directly reachable from a network. External senders
(GitHub, CI systems, cron SaaS) reach the receiver through an explicit relay
you opt into.

## Enabling triggers

```bash
SAVANT_TRIGGERS=1 savant-code server
```

When the flag is set, the server:

- starts the trigger receiver on `gatewayPort + 1` (loopback only),
- starts the cron scheduler (startup resume sweep + 30 s tick),
- exposes trigger management over the gateway (`triggers_*` JSON-RPC
  methods), which the desktop rail panel consumes.

Without the flag none of the above exists — the methods answer
`invalidRequest` and the panel shows the feature as off.

## The loopback hard requirement

The receiver refuses any non-loopback bind at the type level **and** at
runtime (a type-unsafe caller passing `0.0.0.0` gets a thrown error, not a
listening socket). Rationale:

- Deliveries are authenticated with a bearer secret, but the surface is an
  injection point into agent runs — defense in depth says the network
  position itself must be trusted first.
- Relays (below) terminate public traffic and forward to loopback, which
  preserves this invariant: the receiver's socket is never exposed.

Do not work around this with a port-forward or `netsh`/`iptables` rule that
publishes the loopback port. Use a relay.

## Auth headers (every delivery)

```http
Authorization: Bearer <trigger secret>     # svt_... shown once at create
X-Savant-Nonce: <unique-per-request>       # replay guard
X-Savant-Timestamp: <ms since epoch>       # ±5 min window
Content-Type: application/json

{"eventId": "...", "summary": "...", "fields": {...}}
```

Rate limit: 5 deliveries per trigger per 60 s rolling fixed window —
excess answers `429` with `Retry-After`. Webhook retries should back off
on it.

## Relay recipes

### Tailscale Funnel (recommended)

Funnel publishes a loopback service to the public internet via Tailscale's
edge with TLS included.

```bash
# 1. Install + log in (once): https://tailscale.com/download
# 2. Enable Funnel for your tailnet (once, in the admin console or):
tailscale set --funnel=on   # if not already enabled account-wide
# 3. Publish the receiver (assume gateway on 8787 → receiver on 8788):
tailscale funnel --bg 8788
```

Your public endpoint becomes
`https://<machine>.<tailnet>.ts.net/hooks/<triggerId>`. Point senders there;
the stable URL survives restarts (it is derived from your machine name, not
an ephemeral tunnel id).

### cloudflared (Cloudflare Tunnel)

```bash
# 1. Install cloudflared and log in:
cloudflared tunnel login
# 2. Create a named tunnel (once):
cloudflared tunnel create savant-code-triggers
# 3. Route a DNS name you own:
cloudflared tunnel route dns savant-code-triggers triggers.example.com
# 4. Forward to the loopback receiver (config.yml):
#    tunnel: savant-code-triggers
#    credentials-file: /path/to/<tunnel-id>.json
#    ingress:
#      - hostname: triggers.example.com
#        service: http://127.0.0.1:8788
#      - service: http_status:404
cloudflared tunnel run savant-code-triggers
```

Endpoint: `https://triggers.example.com/hooks/<triggerId>`. Stable, TLS,
your own domain.

## ngrok: anti-recommended

ngrok is deliberately **not** documented as a supported relay:

- Free-tier URLs are **ephemeral** — every restart gives senders a new URL,
  which breaks every configured webhook (the FID records this explicitly).
- URL-scoped access controls are paywalled; the free tunnel is effectively
  public-knowledge endpoints on a shared domain.

If you already run ngrok for other work and accept the URL churn, it works
technically (`ngrok http 8788`) — but it is a poor fit for webhook triggers,
which are long-lived configuration.

## App-offline semantics

Deliveries that arrive while the app is not running **queue nowhere** — the
relay cannot reach the loopback socket and the sender sees a connection
error. Retry semantics are the sender's concern (GitHub retries with backoff;
cron senders typically alert). Scheduled triggers are unaffected: the cron
scheduler catches up locally on startup with the run-latest-on-resume policy.
