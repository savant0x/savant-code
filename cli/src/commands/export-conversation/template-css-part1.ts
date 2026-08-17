/**
 * Part 1 of the exported HTML stylesheet (base layout + rows).
 * See template.ts for the full sheet.
 */
export const EXPORT_CSS_PART_1 = `
  :root {
    /* Savant near-black/cyan palette (theme-system.ts dark) — no navy */
    --bg: #050508;
    --surface: #0a0a0b;
    --surface-2: #0b0b11;
    --surface-3: #1a1a22;
    --border: #20202a;
    --border-soft: #181818;
    --border-user: #26262e;
    --fg: #e4e4e8;
    --fg-2: #a1a1aa;
    --muted: #8f8f99;
    --muted-2: #8f8f99;
    --brand: #18faf9;
    --brand-dim: #18faf933;
    --success: #39ff14;
    --error: #ff2d55;
    --warning: #ff9500;
    /* Accent family — cyan only (no purple accents) */
    --accent: #18faf9;
    --accent-light: #9ffbfa;
    --code: #7ad4d6;
    --link: #7ad4d6;
    --tool-badge: #18faf9;
    --tool-badge-fg: #06282a;
    --reasoning: #8f8f99;
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
    font-size: 14px;
    line-height: 1.6;
  }

  .page {
    position: relative;
    width: 100%;
    padding: 48px 32px 96px;
  }

  .corner {
    position: absolute;
    width: 8px;
    height: 8px;
    background: var(--bg);
    border: 1px solid var(--border);
  }
  .corner-tl { top: 0; left: 0; transform: translate(-4px, -4px); }
  .corner-tr { top: 0; right: 0; transform: translate(4px, -4px); }
  .corner-bl { bottom: 0; left: 0; transform: translate(-4px, 4px); }
  .corner-br { bottom: 0; right: 0; transform: translate(4px, 4px); }

  .brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .logo {
    width: 56px;
    height: 56px;
    display: block;
    filter: drop-shadow(0 0 12px var(--brand-dim));
  }

  .brand-version {
    color: var(--muted);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .header {
    border-bottom: 1px dashed var(--border-soft);
    padding-bottom: 24px;
    margin-bottom: 32px;
  }

  .header h1 {
    font-size: 20px;
    font-weight: 500;
    margin: 0;
    text-align: center;
  }

  .header .brand-tag {
    color: var(--brand);
  }

  .meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px 24px;
    margin: 0;
    font-size: 12px;
    text-align: center;
  }

  .meta dt {
    color: var(--fg-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 2px;
  }

  .meta dd {
    margin: 0;
    color: var(--accent-light);
    word-break: break-all;
  }

  .toolbar {
    display: flex;
    gap: 8px;
    margin-top: 20px;
    justify-content: center;
  }

  .toolbar button {
    font-family: inherit;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: transparent;
    color: var(--fg-2);
    border: 1px solid var(--border);
    border-radius: 0;
    padding: 6px 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: color 0.15s ease, border-color 0.15s ease;
  }

  .toolbar button:hover {
    color: var(--accent-light);
    border-color: var(--accent);
  }

  .transcript {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .row {
    border: 1px solid var(--border-soft);
    background: var(--surface);
    position: relative;
  }

  .copy-btn {
    position: absolute;
    bottom: 8px;
    right: 12px;
    font-family: inherit;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: transparent;
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 0;
    padding: 2px 8px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    z-index: 1;
    transition: color 0.15s ease, border-color 0.15s ease;
  }

  .copy-btn:hover {
    color: var(--brand);
    border-color: var(--brand);
  }

  .row-user {
    padding: 12px 16px;
    border-color: var(--border-user);
    background: #0c0c12;
  }

  .row-error {
    padding: 12px 16px;
    border-color: #2a1515;
    background: #170d0d;
  }

  .row-assistant {
    padding: 12px 16px;
    border-color: var(--border-soft);
  }

  .row-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .row-marker {
    color: var(--accent);
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    line-height: 1;
  }

  .row-logo {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    display: block;
  }

  .row-error .row-marker {
    color: var(--error);
  }

  .row-role {
    display: inline-block;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }

  .row-user .row-role { color: var(--link); }
  .row-error .row-role { color: var(--error); }
  .row-assistant .row-role { color: var(--brand); }

  .assistant-prose p { margin: 0 0 12px; }
  .assistant-prose p:last-child { margin-bottom: 0; }
  .assistant-prose h1, .assistant-prose h2, .assistant-prose h3,
  .assistant-prose h4, .assistant-prose h5, .assistant-prose h6 {
    color: var(--accent);
    margin: 16px 0 8px;
  }
  .assistant-prose ul, .assistant-prose ol { margin: 0 0 12px; padding-left: 22px; }
  .assistant-prose li { margin-bottom: 4px; }
  .assistant-prose code {
    background: #14141c;
    color: var(--code);
    padding: 1px 5px;
    font-size: 0.9em;
  }
  .assistant-prose pre {
    background: #0d0d12;
    border: 1px solid var(--border);
    padding: 12px;
    overflow-x: auto;
    margin: 0 0 12px;
  }
`
