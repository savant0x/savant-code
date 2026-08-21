/**
 * Part 2b of the exported HTML stylesheet (Auto Drive report sections and
 * the responsive media query). See template.ts for the full sheet.
 */
export const EXPORT_CSS_PART_2_B = `  /* FID-2026-0818-006/007: Auto Drive report sections (Run Log + certification) */
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
