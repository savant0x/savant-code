/**
 * trust-receipt.html template — FID-2026-0813-007 (master D11/D12).
 *
 * Self-contained, offline, zero-network: the bundle is embedded verbatim as a
 * JSON script tag and the inline verifier re-runs every cryptographic check in
 * the auditor's browser. Neon Slate palette, inline CSS only. The page states
 * the convenience-view disclaimer VERBATIM (Nova audit flag #3) and the
 * session-key trust warning (flag #2).
 */
import { INLINE_VERIFIER_SOURCE } from './inline-verifier'
import { HTML_DISCLAIMER, TRUST_WARNING } from './serializer'

import type { AttestBundle } from './serializer'

export function buildAttestHtml(bundle: AttestBundle): string {
  const json = JSON.stringify(bundle)
  const escapeHtml = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const totalReceipts = bundle.sessions.reduce(
    (sum, s) => sum + s.summary.receipts,
    0,
  )
  const totalLive = bundle.sessions.reduce((sum, s) => sum + s.summary.live, 0)
  const totalFailures = bundle.sessions.reduce(
    (sum, s) => sum + s.summary.withFailures,
    0,
  )
  const firstFailing = firstFailingCheck(bundle)

  const sessionBlocks = bundle.sessions
    .map((session) => {
      const rows = session.receipts
        .map((entry) => {
          const statusClass =
            entry.validation.valid && entry.classification === 'live'
              ? 'ok'
              : entry.validation.valid
                ? 'warn'
                : 'bad'
          const statusLabel = entry.validation.valid
            ? entry.classification === 'live'
              ? '✓ verified · live'
              : '✓ verified · superseded'
            : '✗ INVALID'
          return `<tr class="${statusClass}">
  <td>${entry.receipt.seq}</td>
  <td class="mono">${escapeHtml(entry.receipt.path)}</td>
  <td class="mono">${escapeHtml(entry.receipt.changeHash.slice(0, 18))}…</td>
  <td>${escapeHtml(entry.receipt.writer.agentType)}</td>
  <td>${escapeHtml(entry.receipt.fidId ?? '—')}</td>
  <td>${entry.receipt.verdicts.map((v) => escapeHtml(v.phase)).join(', ') || '—'}</td>
  <td>${statusLabel}</td>
</tr>`
        })
        .join('\n')
      const roles = Object.entries(session.manifest.roles)
        .map(
          ([role, pub]) =>
            `<span class="role">${escapeHtml(role)} <code class="mono">${escapeHtml(pub.slice(0, 16))}…</code></span>`,
        )
        .join(' ')
      return `<section class="session">
  <h2>Session <code class="mono">${escapeHtml(session.sessionId)}</code></h2>
  <p class="meta">mode: <strong>${escapeHtml(session.manifest.mode)}</strong> ·
    receipts: ${session.summary.receipts} (${session.summary.live} live,
    ${session.summary.superseded} superseded) · complete:
    ${session.summary.complete} · pending: ${session.summary.pending} ·
    no_verdict: ${session.summary.noVerdict} ·
    failing: ${session.summary.withFailures}</p>
  <p class="meta">roles: ${roles}</p>
  <table>
    <thead><tr><th>#</th><th>path</th><th>hash</th><th>writer</th><th>FID</th><th>verdicts</th><th>status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Trust Receipt — Savant Code</title>
<style>
  :root {
    --bg: #0a0e14; --panel: #10151d; --border: #1e2733;
    --text: #d7e0ea; --muted: #7a8899; --accent: #38e8b8;
    --bad: #ff6b6b; --warn: #f0b429;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 14px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; color: var(--accent); }
  h2 { font-size: 16px; margin: 28px 0 8px; }
  .meta { color: var(--muted); margin: 4px 0; }
  .mono { font-family: inherit; }
  .role { display: inline-block; margin: 2px 8px 2px 0; color: var(--muted); }
  .role code { color: var(--text); }
  .panel { background: var(--panel); border: 1px solid var(--border);
    border-radius: 8px; padding: 14px 16px; margin: 16px 0; }
  .warning { border-left: 3px solid var(--warn); }
  .disclaimer { border-left: 3px solid var(--accent); color: var(--muted); }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--border);
    vertical-align: top; }
  th { color: var(--muted); font-weight: 600; }
  tr.ok td:last-child { color: var(--accent); }
  tr.warn td:last-child { color: var(--warn); }
  tr.bad td:last-child { color: var(--bad); }
  .summary { display: flex; gap: 24px; flex-wrap: wrap; }
  .stat { font-size: 24px; font-weight: 700; }
  .stat small { display: block; font-size: 12px; font-weight: 400; color: var(--muted); }
  button { background: var(--accent); color: #04121d; border: 0; border-radius: 6px;
    padding: 10px 18px; font: inherit; font-weight: 700; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: wait; }
  #reverify-result { margin-top: 12px; white-space: pre-wrap; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Trust Receipt</h1>
  <p class="meta">generated ${escapeHtml(bundle.generatedAt)} · ${escapeHtml(bundle.product)} v${escapeHtml(bundle.version)} · schema ${escapeHtml(bundle.schema)}</p>

  <div class="summary">
    <div class="stat">${totalReceipts}<small>receipts</small></div>
    <div class="stat">${totalLive}<small>live</small></div>
    <div class="stat">${totalReceipts - totalLive}<small>superseded</small></div>
    <div class="stat" style="color:${totalFailures > 0 ? 'var(--bad)' : 'var(--accent)'}">${totalFailures}<small>failing checks</small></div>
  </div>
  ${firstFailing ? `<p class="meta">first failing check: <strong>${escapeHtml(firstFailing)}</strong></p>` : ''}

  <div class="panel disclaimer">${escapeHtml(HTML_DISCLAIMER)}</div>

  <div class="panel warning"><strong>Trust model.</strong> ${escapeHtml(TRUST_WARNING)}</div>

  <div class="panel">
    <p class="meta" style="margin-top:0">Independently re-verify every signature, hash, and chain rule in this browser — no network, no Savant-Code install. Classification (live/superseded) reflects export-time disk state and cannot be recomputed in the browser.</p>
    <button id="reverify" type="button">Run independent verification</button>
    <div id="reverify-result"></div>
  </div>

  ${sessionBlocks}

  <script type="application/json" id="attest-bundle">${json}</script>
  <script>
${INLINE_VERIFIER_SOURCE}
document.getElementById('reverify').addEventListener('click', async function () {
  var btn = this
  var out = document.getElementById('reverify-result')
  btn.disabled = true
  out.textContent = 'Verifying…'
  try {
    var bundle = JSON.parse(document.getElementById('attest-bundle').textContent)
    var result = await verifyTrustReceiptBundle(bundle)
    if (result.ok) {
      out.textContent = '✓ ALL ' + result.receipts.length + ' receipts verified: signatures, hashes, and chain rules hold.'
      out.style.color = 'var(--accent)'
    } else {
      var lines = result.receipts.filter(function (r) { return !r.valid }).map(function (r) {
        return '✗ seq ' + r.seq + ' ' + r.path + ': ' + r.failures.join('; ')
      })
      out.textContent = lines.length + ' receipt(s) failed:\\n' + lines.join('\\n')
      out.style.color = 'var(--bad)'
    }
  } catch (e) {
    out.textContent = 'Verifier error: ' + e.message
    out.style.color = 'var(--bad)'
  } finally {
    btn.disabled = false
  }
})
  </script>
</div>
</body>
</html>`
}

function firstFailingCheck(bundle: AttestBundle): string | null {
  for (const session of bundle.sessions) {
    for (const entry of session.receipts) {
      if (entry.validation.failures.length > 0) {
        return `${entry.receipt.path}: ${entry.validation.failures[0]}`
      }
    }
  }
  return null
}
