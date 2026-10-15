import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { hudConceptStyles } from './hud-preview-styles'
import { chatThemes } from '../src/utils/theme-system/palette'

import type { CapturedFrame, RGBA } from '@opentui/core'

export interface HudCapture {
  label: string
  frame: CapturedFrame
  text: string
}

const familyPath = join(import.meta.dir, '../../art/icons/cyberpunk')
const svgCache = new Map<string, string>()

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[char]
  })
}

export function originalSvgDataUri(file: string): string {
  if (!/^[a-z0-9-]+\.svg$/.test(file))
    throw new Error(`Invalid SVG name: ${file}`)
  const cached = svgCache.get(file)
  if (cached) return cached
  const source = readFileSync(join(familyPath, file))
  const uri = `data:image/svg+xml;base64,${source.toString('base64')}`
  svgCache.set(file, uri)
  return uri
}

function icon(file: string, className = ''): string {
  const name = escapeHtml(file)
  return `<img data-source="${name}" class="${className}" src="${originalSvgDataUri(file)}" alt="${name.replace('.svg', '').replaceAll('-', ' ')}" draggable="false">`
}

const sections = [
  ['Active agents', 'cmd-agents.svg', '02'],
  ['Session', 'sidebar-session.svg', ''],
  ['Loop', 'sidebar-loop.svg', ''],
  ['Tools', 'activity-tool.svg', '08'],
  ['Files changed', 'obj-file.svg', '+1 / ~2'],
  ['Active FIDs', 'sidebar-fid.svg', '04'],
  ['Trust Matrix', 'sidebar-trust-matrix.svg', '01'],
  ['History', 'sidebar-history.svg', '12'],
] as const

function sectionBody(title: string): string {
  if (title === 'Active agents')
    return `
    <div class="agent">${icon('forge.svg')}<div><b>Forge</b><small>Implementation · synthetic</small></div><span class="state">ACTIVE</span></div>
    <div class="agent">${icon('verifier-bold.svg')}<div><b>Verifier</b><small>Verification · synthetic</small></div><span class="state waiting">WAITING</span></div>`
  if (title === 'Session')
    return `<div class="metric"><span>Cache reuse</span><b>Not reported</b></div><div class="metric"><span>Compactions</span><b>0 · synthetic</b></div>`
  if (title === 'Tools')
    return `<div class="tools-grid">${['tool-read.svg', 'tool-write.svg', 'tool-bash.svg', 'tool-grep.svg', 'tool-test.svg', 'tool-typecheck.svg', 'tool-web.svg', 'tool-diff.svg'].map((file) => icon(file)).join('')}</div><div class="metric"><span>Selected operation</span><b>read_files</b></div>`
  if (title === 'Active FIDs')
    return `<div class="fid-item">${icon('fid.svg')}<div>Sidebar modernization<small>Synthetic record · design review</small></div></div>`
  return `<div class="metric"><span>${escapeHtml(title)} detail</span><b>Synthetic fixture</b></div>`
}

function section(title: string, file: string, count: string): string {
  return `<details class="section" data-section="${escapeHtml(title)}" ${title === 'Active agents' ? 'open' : ''}>
    <summary>${icon(file, 'section-icon')}<span class="section-title">${title}</span><span class="count">${count}</span>${icon('nav-forward.svg', 'section-chevron')}</summary>
    <div class="section-body">${sectionBody(title)}</div></details>`
}

function instruments(): string {
  return `<div class="activity"><div class="activity-heading">${icon('activity-tool.svg')}<div><small>ACTIVITY DETAIL</small><h3>Reading source files</h3></div></div>
    <div class="activity-target">cli/src/components/right-sidebar.tsx</div>
    <div class="instrument-row">${icon('phase-audit.svg')}<span class="key">Phase</span><span class="value phase">ECHO · AUDIT</span></div>
    <div class="instrument-row">${icon('cmd-model.svg')}<span class="key">Model</span><span class="value">synthetic/model</span></div>
    <div class="instrument-row">${icon('run-active.svg')}<span class="key">Mode</span><span class="value">HYBRID · $0.25</span></div>
  </div>`
}

function sidebar(): string {
  const rail = sections
    .map(
      ([title, file]) =>
        `<button class="rail-item" data-reveal="${title}" title="Open ${title}">${icon(file)}<span>${title === 'Active agents' ? 'Agents' : title}</span></button>`,
    )
    .join('')
  return `<aside class="sidebar" aria-label="Sidebar design prototype">
    <header class="masthead">${icon('logo-s.svg', 'brand-icon')}<div class="brand-copy"><div class="brand-title">SAVANT</div><div class="brand-subtitle">ONE MIND. A THOUSAND FACES.</div></div>
    <button class="fold-button" aria-label="Fold sidebar" aria-expanded="true">${icon('nav-forward.svg')}</button></header>
    <div class="sidebar-main">${instruments()}${sections.map(([title, file, count]) => section(title, file, count)).join('')}</div>
    <nav class="rail-items" aria-label="Folded sidebar navigation">${rail}</nav>
    <footer class="sidebar-footer"><div class="context-top">${icon('motif-chip.svg')}<span>Context window</span><strong>70%</strong></div><div class="meter" aria-label="Synthetic context usage 70 percent">${'<span></span>'.repeat(20)}</div><div class="footer-meta"><span>70 / 100 · catalog · synthetic</span><span>v0.0.35</span></div><div class="rail-context">70%<br><small>synthetic</small></div></footer>
  </aside>`
}

function transcript(): string {
  return `<main class="transcript"><div class="conversation-head">${icon('obj-folder.svg')}<span>PROJECT / DESIGN REVIEW</span></div>
    <div class="prompt">Modernize the sidebar with my actual cyberpunk icons. Keep folding and the traffic lights.</div>
    <div><div class="message-head">${icon('orchestrator.svg')}<div><b>Savant</b><small>Visual study · synthetic conversation</small></div></div><p class="message-body">Your original artwork leads the composition. Icon silhouettes, circuit traces, color layers and glow are preserved—not translated into terminal blocks.</p></div>
    <div class="tool-panel"><div class="tool-title">${icon('tool-bash.svg')}<b>TERMINAL</b><div class="traffic" aria-label="Preserved green yellow red traffic lights"><i></i><i></i><i></i></div></div>
    <div class="terminal-body"><div class="command"><em>$</em> bun test src/example.test.ts</div><div class="terminal-meta"><span>${icon('obj-folder.svg')}/synthetic/project</span><span>${icon('obj-clock.svg')}30s timeout</span></div>
    <pre class="output">Synthetic output for design comparison only.
No command or model inference is running.</pre><div class="terminal-footer"><span>✓ Illustrative success state</span><button class="quiet-button copy-example">Copy example</button></div></div></div>
    <p class="review-note">Design mockup—not a terminal screenshot. The artwork here comes directly from art/icons/cyberpunk/*.svg. Cursor delivery still requires a faithful pixel-graphics path.</p>
    <div class="composer">Message Savant… <span class="label">DESIGN FIXTURE</span></div></main>`
}

const concepts = [
  {
    id: 'circuit',
    title: '01 / Circuit Command Deck',
    subtitle: 'Angular · directional · instrument-led',
    description:
      'Circuit seams, a strong activity spine and precise section rhythm. Your icons sit directly in the information architecture—not on a decorative shelf.',
  },
  {
    id: 'observatory',
    title: '02 / Neon Observatory',
    subtitle: 'Emblematic · spacious · luminous',
    description:
      'A larger S identity, centered activity emblem and airy role rows. A more dramatic composition that gives detailed artwork generous breathing room.',
  },
  {
    id: 'matrix',
    title: '03 / Mission Control',
    subtitle: 'Modular · structured · operational',
    description:
      'A stack of deliberately framed operational modules. Larger controls and distinct expanded states give this version a tactile command-console character.',
  },
] as const

const interactionScript = `
const tabs=[...document.querySelectorAll('.tab')];
for(const tab of tabs)tab.addEventListener('click',()=>{for(const item of tabs)item.setAttribute('aria-selected',String(item===tab));for(const panel of document.querySelectorAll('.concept'))panel.hidden=panel.id!==tab.dataset.target;});
for(const side of document.querySelectorAll('.sidebar')){
 const fold=side.querySelector('.fold-button');
 const setFold=(value)=>{side.classList.toggle('folded',value);fold.setAttribute('aria-expanded',String(!value));fold.setAttribute('aria-label',value?'Unfold sidebar':'Fold sidebar');};
 fold.addEventListener('click',()=>setFold(!side.classList.contains('folded')));
 for(const button of side.querySelectorAll('[data-reveal]'))button.addEventListener('click',()=>{setFold(false);const section=[...side.querySelectorAll('details')].find(item=>item.dataset.section===button.dataset.reveal);if(section){section.open=true;section.querySelector('summary').focus();}});
}
for(const button of document.querySelectorAll('.copy-example'))button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText('$ bun test src/example.test.ts\\n\\nSynthetic output for design comparison only.');button.textContent='Copied';}catch{button.textContent='Clipboard unavailable';}});
`

function color(value: RGBA): string {
  const [r, g, b] = value.toInts()
  return `rgb(${r},${g},${b})`
}

function rejectedEvidence(captures: HudCapture[]): string {
  if (!captures.length) return ''
  const rows = captures[0].frame.lines
    .map((line) =>
      line.spans
        .map(
          (span) =>
            `<span style="color:${color(span.fg)};background:${color(span.bg)}">${escapeHtml(span.text)}</span>`,
        )
        .join(''),
    )
    .join('\n')
  return `<details class="review-bottom"><summary>Rejected block-rendering evidence — not a design candidate</summary><p>The earlier native character-span captures lost recognizable artwork. Preserved here only as evidence of why that path was rejected.</p><pre style="overflow:auto">${rows}</pre></details>`
}

export function renderHudReport(captures: HudCapture[]): string {
  const theme = chatThemes.dark
  const variables = [
    'primary',
    'secondary',
    'background',
    'foreground',
    'muted',
    'border',
    'surface',
    'surfaceHover',
    'success',
    'warning',
    'error',
  ]
    .map((key) => {
      const value = theme[key as keyof typeof theme]
      if (typeof value !== 'string')
        throw new Error(`Invalid theme token ${key}`)
      return `--${key}:${value}`
    })
    .join(';')
  const assets = [
    'logo-s.svg',
    'orchestrator.svg',
    'forge.svg',
    'verifier-bold.svg',
    'activity-tool.svg',
    'sidebar-fid.svg',
    'sidebar-loop.svg',
    'sidebar-history.svg',
    'tool-bash.svg',
  ]
  const palette = JSON.parse(
    readFileSync(join(familyPath, 'manifest.json'), 'utf8'),
  ).palette as Record<string, string>
  const identity = ['cyan', 'magenta', 'blue']
    .map((key) => `--${key}:${palette[key]}`)
    .join(';')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Savant — original SVG sidebar concepts</title><style>:root{${variables};${identity}}${hudConceptStyles}</style></head><body><div class="review">
    <header class="review-head"><div><div class="eyebrow">SAVANT / VISUAL DESIGN STUDIES</div><h1>Your artwork. Three different command decks.</h1><p>Original cyberpunk SVGs, unmodified. Switch concepts, fold the sidebar, expand sections. All activity and numerical values are synthetic.</p></div><div class="evidence"><strong>ASSET-FAITHFUL DESIGN MOCKUPS</strong>Not OpenTUI screenshots or a promise of Cursor graphics support. No production sidebar has been replaced.</div></header>
    <nav class="tabs" aria-label="Design concepts">${concepts.map((concept, index) => `<button class="tab" aria-selected="${index === 0}" data-target="${concept.id}"><b>${concept.title}</b><small>${concept.subtitle}</small></button>`).join('')}</nav>
    ${concepts.map((concept, index) => `<section id="${concept.id}" class="concept ${concept.id}" ${index ? 'hidden' : ''}><div class="concept-intro"><p>${concept.description}</p><span class="label">ORIGINAL SVG / INTERACTIVE CONCEPT</span></div><div class="scene">${transcript()}${sidebar()}</div></section>`).join('')}
    <div class="asset-strip">${assets.map((file) => icon(file)).join('')}<p>These are your source assets—not re-creations.<br>Every embedded SVG decodes byte-for-byte to its original file.</p></div>
    <details class="review-bottom"><summary>Inspect the actual source artwork used in these studies</summary><div class="gallery">${[...svgCache.keys()].map((file) => `<figure>${icon(file)}<figcaption>${file}</figcaption></figure>`).join('')}</div></details>
    ${rejectedEvidence(captures)}<p class="review-bottom">Layout topology, folding, status ownership and terminal traffic lights stay. Widths, icon footprints and row heights are design choices—not inherited constraints.</p>
    </div><script>${interactionScript}</script></body></html>`
}
