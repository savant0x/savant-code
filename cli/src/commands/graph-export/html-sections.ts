import { buildGraphAudioDataScript } from './audio'
import { CHARACTER_LOGO_DATA_URI } from './character'
import { GRAPH_ICON_SPRITE } from './graph-icons'
import { UNIVERSE_APP_SCRIPT } from './universe-app-script'
import { UNIVERSE_CSS } from './universe-css'
import { SIGMA_JS } from '../../constants/sigma'
import { escapeHtml } from '../export-conversation/format'

import type { GraphExport } from '@savant-code/knowledge-graph'

/**
 * Code Universe HTML shell (FID-2026-0809-011 Phase B-2). Extracted verbatim
 * from template.ts — byte-identical artifact preserved. buildAmbientSpaceMarkup
 * generates the decorative star field; assembleUniverseShell embeds the graph
 * payload, docs block, audio registry, Sigma, and the app script.
 */
function buildAmbientSpaceMarkup(): string {
  const stars = Array.from({ length: 88 }, (_, index) => {
    const x = (index * 47 + 13) % 100
    const y = (index * 83 + 7) % 100
    const size = 1 + ((index * 19) % 9) / 4
    const delay = -((index * 37) % 9000)
    const duration = 4200 + ((index * 71) % 7600)
    const driftX = ((index * 29) % 90) - 45
    const driftY = ((index * 43) % 70) - 35
    const hue = index % 7 === 0 ? 'magenta' : index % 5 === 0 ? 'blue' : 'cyan'
    return `<i class="space-star ${hue}" style="--x:${x}%;--y:${y}%;--size:${size}px;--delay:${delay}ms;--duration:${duration}ms;--drift-x:${driftX}px;--drift-y:${driftY}px"></i>`
  }).join('')
  const cometVectors = [
    { x: 360, y: 92 },
    { x: 290, y: -128 },
    { x: 430, y: 54 },
    { x: 320, y: 156 },
    { x: 390, y: -72 },
    { x: 250, y: 118 },
  ]
  const shootingStars = cometVectors
    .map((vector, index) => {
      const x = 8 + ((index * 61) % 82)
      const y = 7 + ((index * 43) % 58)
      const delay = -((index * 2300) % 12000)
      const angle = (Math.atan2(vector.y, vector.x) * 180) / Math.PI
      const tail = 68 + (index % 4) * 16
      return `<i class="shooting-star ${index % 2 ? 'magenta' : 'cyan'}" style="--x:${x}%;--y:${y}%;--travel-x:${vector.x}px;--travel-y:${vector.y}px;--angle:${angle}deg;--tail:${tail}px;--delay:${delay}ms"></i>`
    })
    .join('')
  return `<div class="space-stars" aria-hidden="true">${stars}${shootingStars}</div>`
}

export function assembleUniverseShell(params: {
  brandName: string
  version: string
  graph: GraphExport
  graphJson: string
  docsPayload: string
}): string {
  const { brandName, version, graph, graphJson, docsPayload } = params
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(brandName)} Universe</title>
<style>${UNIVERSE_CSS}</style>
</head>
<body>
<div class="universe-shell">
  ${buildAmbientSpaceMarkup()}
  <header class="universe-header">
    <div class="brand-lockup">
      <img class="logo" src="${CHARACTER_LOGO_DATA_URI}" alt="${escapeHtml(brandName)}">
      <div><div class="eyebrow">OFFLINE CODE INTELLIGENCE</div><h1>${escapeHtml(brandName)} <span>CODE UNIVERSE</span></h1></div>
    </div>
    <div class="universe-stats">
      <b>${graph.meta.files}</b><span>FILES</span><b>${graph.universe.regions.length}</b><span>SYSTEMS</span><b>${graph.meta.edges}</b><span>EDGES</span>
    </div>
    <form class="universe-search" onsubmit="searchUniverse(event)">
      <input id="universe-search-input" type="search" placeholder="Search path or system" aria-label="Search code universe" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="search-results" autocomplete="off">
      <button type="submit">⌕</button>
      <div id="search-results" class="search-results hidden" role="listbox" aria-label="Search results"></div>
    </form>
    <div class="universe-actions">
      <button type="button" onclick="resetUniverse(); playSound('travel')">◎ Universe</button>
      <button type="button" onclick="fitUniverse(); playSound('travel')">⌗ Fit space</button>
      <button type="button" onclick="toggleMotion()">◌ Motion</button>
      <button id="sound-control" type="button" aria-expanded="false" aria-label="Sound effects settings" onclick="toggleSoundPanel(event)">♫ SFX</button>
      <div id="sound-panel" class="sound-panel hidden" role="dialog" aria-label="Sound effects settings">
        <button id="sound-toggle" type="button" aria-pressed="false" onclick="toggleSound(event)">SFX LOCKED</button>
        <label for="sound-volume">VOLUME <input id="sound-volume" type="range" min="0" max="1" step="0.05" value="0.4" oninput="setSoundVolume(this.value)"></label>
        <span id="sound-status" aria-live="polite">Interact to unlock</span>
      </div>
    </div>
  </header>
  <main class="universe-main">
    <section class="viewport-wrap">
      <div id="sigma-container" class="sigma-container"></div>
      <canvas id="planet-effects" class="planet-effects" aria-hidden="true"></canvas>
      <div id="graph-loading" class="graph-loading"><span></span> INITIALIZING UNIVERSE</div>
      <div id="state-pill" class="state-pill">UNIVERSE / MACRO</div>
      <div id="universe-tooltip" class="universe-tooltip" role="tooltip" aria-hidden="true" aria-live="polite" aria-atomic="true">
        <div class="universe-tooltip-kind"></div>
        <strong class="universe-tooltip-title"></strong>
        <code class="universe-tooltip-path"></code>
        <div class="universe-tooltip-meta"></div>
      </div>
      <section id="center-focus" class="center-focus hidden" aria-live="polite" aria-label="Selected universe object">
        <div class="window-controls" role="group" aria-label="Window controls">
          <button class="window-btn window-btn-min" type="button" onclick="windowMinimize(this)" aria-label="Minimize panel" title="Minimize">—</button>
          <button class="window-btn window-btn-max" type="button" onclick="windowMaximize(this)" aria-label="Maximize panel" title="Maximize">□</button>
          <button class="window-btn window-btn-close" type="button" onclick="windowClose(this)" aria-label="Close panel" title="Close">×</button>
        </div>
        <div id="center-focus-actions" class="center-focus-actions" role="group" aria-label="Document actions"></div>
        <div class="window-title-bar" role="button" tabindex="0" aria-label="Drag to move panel" onpointerdown="windowDragStart(this, event)" onpointermove="windowDragMove(event)" onpointerup="windowDragEnd(event)" onpointercancel="windowDragEnd(event)" onclick="windowTitleBarClick(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();windowTitleBarClick(this)}"></div>
        <div class="center-focus-grid"></div>
        <div id="center-browser" class="center-browser"></div>
      </section>
      <div class="legend">
        <span><i class="legend-dot system"></i> SYSTEM</span><span><i class="legend-dot star"></i> FILE</span><span><i class="legend-line"></i> CORRIDOR</span>
      </div>
      <div id="graph-fallback" class="graph-fallback hidden"></div>
    </section>
    <aside id="graph-sidebar" class="graph-sidebar hidden" aria-label="Code Universe details">
      <div class="window-controls" role="group" aria-label="Window controls">
        <button class="window-btn window-btn-min" type="button" onclick="windowMinimize(this)" aria-label="Minimize panel" title="Minimize">—</button>
        <button class="window-btn window-btn-max" type="button" onclick="windowMaximize(this)" aria-label="Maximize panel" title="Maximize">□</button>
        <button class="window-btn window-btn-close" type="button" onclick="windowClose(this)" aria-label="Close panel" title="Close">×</button>
      </div>
      <div class="window-title-bar" role="button" tabindex="0" aria-label="Drag to move panel" onpointerdown="windowDragStart(this, event)" onpointermove="windowDragMove(event)" onpointerup="windowDragEnd(event)" onpointercancel="windowDragEnd(event)" onclick="windowTitleBarClick(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();windowTitleBarClick(this)}"></div>
      <div class="eyebrow" id="sidebar-kind">SELECTED OBJECT</div>
      <h2 id="sidebar-title">—</h2>
      <code id="sidebar-path">—</code>
      <button class="copy-path" type="button" onclick="copySelectedPath()">COPY FULL PATH</button>
      <div class="sidebar-metrics" id="sidebar-metrics"></div>
      <h3>CONNECTIONS</h3><ul id="sidebar-connections"></ul>
      <pre id="sidebar-preview">No preview (previews are opt-in at export time).</pre>
    </aside>
    <nav class="region-nav" aria-label="Systems">
      <div class="region-nav-head">
        <div class="eyebrow">SYSTEMS / REGIONS</div>
        <div class="region-nav-actions">
          <button type="button" onclick="collapseAllRegions()" title="Collapse all systems">▾ ALL</button>
          <button type="button" onclick="expandAllRegions()" title="Expand all systems">▸ ALL</button>
        </div>
      </div>
      <div id="region-list" tabindex="0" aria-label="Systems list"></div>
    </nav>
  </main>
  <footer class="universe-footer"><span>${escapeHtml(brandName)} · v${escapeHtml(version.replace(/^v/i, ''))}</span><span id="graph-status">Drag through the universe · select a system to enter its orbit</span><span>SELF-CONTAINED / FILE://</span></footer>
</div>
${GRAPH_ICON_SPRITE}
<script type="application/json" id="savant-graph-data">${graphJson}</script>
<script type="text/plain" id="savant-docs-payload">${docsPayload}</script>
${buildGraphAudioDataScript()}
<script>${SIGMA_JS}</script>
<script>${UNIVERSE_APP_SCRIPT}</script>
</body>
</html>`
}
