/**
 * Part 2 of the exported HTML stylesheet (blocks + footer + responsive).
 * See template.ts for the full sheet.
 */
export const EXPORT_CSS_PART_2 = `
  .assistant-prose pre code { background: none; padding: 0; color: var(--code); }
  .assistant-prose a { color: var(--link); }
  .assistant-prose blockquote {
    border-left: 3px solid var(--accent);
    padding-left: 12px;
    margin: 0 0 12px;
    color: var(--fg-2);
    font-style: italic;
  }
  .assistant-prose hr {
    border: none;
    border-top: 1px solid var(--border-soft);
    margin: 12px 0;
  }

  .row-tool, .row-thinking {
    padding: 0;
    cursor: pointer;
  }

  .row-tool summary, .row-thinking summary {
    list-style: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    user-select: none;
  }

  .row-tool summary::-webkit-details-marker,
  .row-thinking summary::-webkit-details-marker { display: none; }

  .row-tool summary::before, .row-thinking summary::before {
    content: '\\25b8';
    color: var(--muted);
    transition: transform 0.15s ease;
  }
  .row-tool[open] summary::before, .row-thinking[open] summary::before {
    transform: rotate(90deg);
  }

  .tool-badge {
    background: var(--tool-badge);
    color: var(--tool-badge-fg);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    padding: 2px 8px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .tool-badge .fa-terminal { font-size: 0.85em; }

  .tool-input {
    color: var(--muted-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tool-body {
    border-top: 1px solid var(--border-soft);
    padding: 12px 16px;
  }

  .tool-output {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--muted-2);
    font-size: 13px;
  }

  .tool-body-empty { color: var(--muted); font-style: italic; }

  .thinking-badge {
    color: var(--accent-light);
    font-style: italic;
    font-size: 12px;
  }

  .thinking-icon { color: var(--accent); font-size: 0.85em; }

  .thinking-body {
    border-top: 1px solid var(--border-soft);
    padding: 12px 16px;
  }

  .thinking-body pre {
    margin: 0;
    white-space: pre-wrap;
    color: var(--reasoning);
    font-style: italic;
    font-size: 13px;
  }

  .tool-block {
    border: 1px solid var(--border);
    background: var(--surface);
    margin: 8px 0;
    padding: 10px 12px;
  }

  .tool-header { margin-bottom: 6px; }

  .tool-block details { margin-top: 6px; }

  .tool-block summary {
    cursor: pointer;
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tool-block summary:hover { color: var(--fg-2); }

  .tool-block pre {
    background: #0d0d12;
    border: 1px solid var(--border);
    padding: 10px;
    overflow-x: auto;
    margin: 6px 0 0;
    color: var(--code);
    font-size: 12px;
  }

  .agent-block {
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    padding: 10px 12px;
    margin: 8px 0;
  }

  .agent-header {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--accent);
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .plan-block {
    border: 1px solid var(--border);
    border-left: 3px solid var(--success);
    padding: 10px 12px;
    margin: 8px 0;
  }

  .plan-header {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--success);
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ask-user-block {
    border: 1px solid var(--border);
    border-left: 3px solid var(--warning);
    padding: 10px 12px;
    margin: 8px 0;
  }

  .ask-user-question { margin-bottom: 8px; }
  .ask-user-question:last-child { margin-bottom: 0; }

  .muted { color: var(--muted); font-size: 0.85em; }

  .attachments {
    margin-top: 8px;
    padding: 8px;
    background: var(--surface-3);
    font-size: 12px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .inline-image {
    max-width: 100%;
    display: block;
    margin-top: 10px;
    border: 1px solid var(--border);
  }

  .footer {
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px dashed var(--border-soft);
    color: var(--muted);
    font-size: 12px;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .footer .brand {
    color: var(--brand);
    font-weight: 700;
  }

  /* FID-2026-0818-006/007: Auto Drive report sections (Run Log + certification) */
  .drive-report {
    margin-top: 40px;
    border-top: 1px solid var(--border-soft);
    padding-top: 16px;
  }

  .drive-report h2 {
    font-size: 15px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--brand);
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 14px;
  }

  .drive-report h3 {
    font-size: 13px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--accent);
    margin: 18px 0 8px;
  }

  .dr-meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px 16px;
    margin: 0 0 12px;
  }

  .dr-meta {
    background: var(--surface-3);
    padding: 8px 10px;
    border: 1px solid var(--border-soft);
  }

  .dr-meta dt {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-bottom: 2px;
  }

  .dr-meta dd { margin: 0; color: var(--fg); font-size: 13px; word-break: break-word; }

  .dr-source { color: var(--muted); font-size: 12px; }
  .dr-file { color: var(--accent-light); font-family: monospace; }

  .dr-runlog {
    margin: 8px 0;
    padding-left: 20px;
    color: var(--fg-2);
    font-family: monospace;
    font-size: 12px;
    line-height: 1.6;
  }

  .dr-runlog li { margin-bottom: 4px; word-break: break-word; }

  .dr-cert {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .dr-cert th {
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    border-bottom: 1px solid var(--border-soft);
    padding: 6px 8px;
  }

  .dr-cert td {
    border-bottom: 1px solid var(--border-soft);
    padding: 6px 8px;
    color: var(--fg-2);
    word-break: break-word;
  }

  .dr-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 2px 8px;
    display: inline-block;
  }

  .dr-pass { background: rgba(46, 204, 113, 0.15); color: var(--success); }
  .dr-fail { background: rgba(231, 76, 60, 0.15); color: var(--error); }
  .dr-gap { background: rgba(241, 196, 15, 0.15); color: var(--warning); }

  .dr-gaps {
    margin: 8px 0;
    padding-left: 20px;
    color: var(--warning);
  }

  .dr-empty { color: var(--muted); font-style: italic; }

  @media (max-width: 600px) {
    .page { padding: 24px 16px 64px; }
    .toolbar { flex-direction: column; align-items: stretch; }
    .toolbar button { justify-content: center; }
  }
`
