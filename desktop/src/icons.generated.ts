/**
 * GENERATED FILE — do not edit by hand.
 *
 * Source of truth: art/icons/cyberpunk/ (manifest v3.0.0).
 * Regenerate from the repo root: bun cli/scripts/generate-savant-icons.ts
 *
 * FID-2026-1009-004 Phase 3: inline-SVG strings + the manifest palette for
 * the Tauri (DOM-native) renderer. SVG only — no PNG rasters, no runtime
 * asset reads.
 */

export const SAVANT_ICON_SVG = {
  /** Savant Logo (identity-mark): One Mind. A Thousand Faces. — magenta core with ten radiating cyan circuit facets, HUD bracket frame, scanline accents */
  ICON_Logo: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="SAVANT — One Mind. A Thousand Faces."
>
  <!-- SAVANT // CYBERDECK — identity core -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="glow-strong" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="3.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- THE ONE MIND: core consciousness node -->
  <circle cx="32" cy="32" r="6.5" fill="#ff2bd6" filter="url(#glow-strong)" />
  <circle cx="32" cy="32" r="3" fill="#ffffff" opacity="0.95" />

  <!-- THE THOUSAND FACES: radiating identity facets, cyan circuit traces -->
  <g stroke="#18faf9" stroke-width="2.5" stroke-linecap="round">
    <!-- 10 facets at 30-degree intervals: the faces of the one mind -->
    <path d="M32 21.5 L32 12" />
    <path d="M40.25 23.75 L46.5 16.5" />
    <path d="M44.25 29.75 L53 28" />
    <path d="M44.25 34.25 L53 36" />
    <path d="M40.25 40.25 L46.5 47.5" />
    <path d="M32 42.5 L32 52" />
    <path d="M23.75 40.25 L17.5 47.5" />
    <path d="M19.75 34.25 L11 36" />
    <path d="M19.75 29.75 L11 28" />
    <path d="M23.75 23.75 L17.5 16.5" />
  </g>

  <!-- terminal node dots: each facet terminates in a face -->
  <g fill="#18faf9">
    <circle cx="32" cy="12" r="2" />
    <circle cx="46.5" cy="16.5" r="2" />
    <circle cx="53" cy="28" r="2" />
    <circle cx="53" cy="36" r="2" />
    <circle cx="46.5" cy="47.5" r="2" />
    <circle cx="32" cy="52" r="2" />
    <circle cx="17.5" cy="47.5" r="2" />
    <circle cx="11" cy="36" r="2" />
    <circle cx="11" cy="28" r="2" />
    <circle cx="17.5" cy="16.5" r="2" />
  </g>

  <!-- HUD bracket ring: the cyberdeck frame -->
  <g stroke="#4fa8ff" stroke-width="1.5" opacity="0.7">
    <path d="M20 8 L12 8 L12 16" fill="none" />
    <path d="M44 8 L52 8 L52 16" fill="none" />
    <path d="M52 44 L52 52 L44 52" fill="none" />
    <path d="M20 52 L12 52 L12 44" fill="none" />
  </g>

  <!-- scanline accents -->
  <g stroke="#4fa8ff" stroke-width="0.75" opacity="0.35">
    <path d="M8 30 L14 30" />
    <path d="M50 34 L56 34" />
  </g>
</svg>`,
  /** Savant S-Monogram (identity-mark): The S as a circuit trace — 90-degree elbows, terminal nodes at entry/exit, the core dot at center */
  ICON_LogoS: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="SAVANT wordmark glyph — S with circuit tail"
>
  <!-- SAVANT // CYBERDECK — the S-monogram: minimal identity mark -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- The S: single stroke, circuit-trace elbows (90-degree angles, not curves) -->
  <path
    d="M44 14 L24 14 L24 30 L40 34 L40 46 L20 46"
    stroke="#18faf9"
    stroke-width="4"
    stroke-linecap="round"
    stroke-linejoin="miter"
    filter="url(#glow)"
  />

  <!-- terminal nodes: entry and exit of the S-trace -->
  <circle cx="44" cy="14" r="2.5" fill="#ff2bd6" />
  <circle cx="20" cy="46" r="2.5" fill="#ff2bd6" />

  <!-- core dot: the one mind at the S's center -->
  <circle cx="32" cy="32" r="2" fill="#ff2bd6" filter="url(#glow)" />

  <!-- HUD bracket accents -->
  <g stroke="#4fa8ff" stroke-width="1.5" opacity="0.6">
    <path d="M10 10 L10 6 L16 6" fill="none" />
    <path d="M48 58 L54 58 L54 54" fill="none" />
  </g>
</svg>`,
  /** Orchestrator (echo-agent): Protocol enforcement — hexagonal hub with six radiating circuit spokes and terminal nodes */
  ICON_Orchestrator: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Orchestrator — ECHO agent role: protocol enforcement hub"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- radiating circuit spokes -->
  <g stroke="#18faf9" stroke-width="2" stroke-linecap="round">
    <path d="M32 16 L32 6" />
    <path d="M46 24 L55 19" />
    <path d="M46 40 L55 45" />
    <path d="M32 48 L32 58" />
    <path d="M18 40 L9 45" />
    <path d="M18 24 L9 19" />
  </g>
  <!-- terminal nodes -->
  <g fill="#ff2bd6">
    <circle cx="32" cy="6" r="2" />
    <circle cx="55" cy="19" r="2" />
    <circle cx="55" cy="45" r="2" />
    <circle cx="32" cy="58" r="2" />
    <circle cx="9" cy="45" r="2" />
    <circle cx="9" cy="19" r="2" />
  </g>
  <!-- outer dashed ring -->
  <circle
    cx="32"
    cy="32"
    r="22"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-dasharray="3 4"
    opacity="0.6"
  />
  <!-- hexagonal hub -->
  <polygon
    points="32,16 46,24 46,40 32,48 18,40 18,24"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- core -->
  <circle cx="32" cy="32" r="4" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Detective (echo-agent): Codebase analysis — magnifier with scanline lens and circuit handle */
  ICON_Detective: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Detective — ECHO agent role: codebase analysis scanner"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- lens -->
  <circle cx="27" cy="27" r="15" stroke="#18faf9" stroke-width="3" />
  <!-- scanlines inside the lens -->
  <g stroke="#ff2bd6" stroke-width="1.5" stroke-linecap="round">
    <path d="M20 24 L34 24" />
    <path d="M20 28 L34 28" />
    <path d="M20 32 L30 32" />
  </g>
  <!-- circuit handle: diagonal trace, 90-degree elbow, terminal node -->
  <path
    d="M38 38 L46 46 L53 46"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle cx="55.5" cy="46" r="2.5" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Forge (echo-agent): Code implementation — anvil, hammer and circuit sparks */
  ICON_Forge: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Forge — ECHO agent role: code implementation"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- anvil: horn left, top block, waist, base -->
  <path
    d="M10 28 L26 28 L26 22 L54 22 L54 30 L40 30 L40 34 L48 34 L48 42 L16 42 L16 34 L24 34 L24 28 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- hammer head -->
  <polygon
    points="46,2 54,10 46,18 38,10"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- hammer handle striking the anvil face -->
  <path
    d="M46 18 L42 24"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- sparks: zigzag circuit traces with terminal nodes -->
  <g
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M18 21 L14 15 L18 9" />
    <path d="M26 21 L26 13" />
    <path d="M32 21 L36 15 L32 9" />
  </g>
  <g fill="#ff2bd6" filter="url(#glow)">
    <circle cx="18" cy="7" r="1.5" />
    <circle cx="26" cy="11" r="1.5" />
    <circle cx="32" cy="7" r="1.5" />
  </g>
</svg>`,
  /** Verifier (echo-agent): Double-audit validation — shield with circuit check */
  ICON_Verifier: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Verifier — ECHO agent role: double-audit validation shield"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- shield -->
  <path
    d="M32 8 L50 15 L50 31 C50 43 42 51 32 56 C22 51 14 43 14 31 L14 15 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- inner shield detail -->
  <path
    d="M32 14 L44 19.5 L44 31 C44 40.5 38 46.5 32 50 C26 46.5 20 40.5 20 31 L20 19.5 Z"
    stroke="#4fa8ff"
    stroke-width="1.5"
    opacity="0.7"
  />
  <!-- circuit check with terminal nodes -->
  <path
    d="M22 33 L29 39 L43 23"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
  <g fill="#ff2bd6">
    <circle cx="22" cy="33" r="2" />
    <circle cx="43" cy="23" r="2" />
  </g>
</svg>`,
  /** Recorder (echo-agent): FID lifecycle management — document with folded corner and elbow traces */
  ICON_Recorder: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Recorder — ECHO agent role: FID lifecycle management"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- document with folded corner -->
  <path
    d="M18 10 L40 10 L52 22 L52 54 L18 54 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <path
    d="M40 10 L40 22 L52 22"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- recorded circuit traces: 90-degree elbows with terminal nodes -->
  <g
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M24 29 L34 29 L38 33" />
    <path d="M24 36 L44 36" />
    <path d="M24 43 L32 43 L36 47" />
    <path d="M24 50 L40 50" />
  </g>
  <g fill="#ff2bd6">
    <circle cx="40" cy="33" r="1.8" />
    <circle cx="46" cy="36" r="1.8" />
    <circle cx="38" cy="47" r="1.8" />
    <circle cx="42" cy="50" r="1.8" />
  </g>
</svg>`,
  /** Thinker (echo-agent): Sequential logic engine — neural mesh with via diamonds */
  ICON_Thinker: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Thinker — ECHO agent role: sequential logic engine"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- synapses: five spokes from the core to satellite nodes -->
  <g stroke="#18faf9" stroke-width="2" stroke-linecap="round">
    <path d="M32 32 L32 16" />
    <path d="M32 32 L47 27" />
    <path d="M32 32 L41 45" />
    <path d="M32 32 L23 45" />
    <path d="M32 32 L17 27" />
  </g>
  <!-- via diamonds at each spoke midpoint -->
  <g fill="#ff2bd6">
    <polygon points="32,22.2 33.8,24 32,25.8 30.2,24" />
    <polygon points="39.5,27.7 41.3,29.5 39.5,31.3 37.7,29.5" />
    <polygon points="36.5,36.7 38.3,38.5 36.5,40.3 34.7,38.5" />
    <polygon points="27.5,36.7 29.3,38.5 27.5,40.3 25.7,38.5" />
    <polygon points="24.5,27.7 26.3,29.5 24.5,31.3 22.7,29.5" />
  </g>
  <!-- outer dashed ring -->
  <circle
    cx="32"
    cy="32"
    r="21"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-dasharray="3 4"
    opacity="0.5"
  />
  <!-- satellite nodes -->
  <g fill="#18faf9">
    <circle cx="32" cy="16" r="2.5" />
    <circle cx="47" cy="27" r="2.5" />
    <circle cx="41" cy="45" r="2.5" />
    <circle cx="23" cy="45" r="2.5" />
    <circle cx="17" cy="27" r="2.5" />
  </g>
  <!-- core -->
  <circle cx="32" cy="32" r="3.5" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Scout (echo-agent): Contextual exploration — radar with sweep beam and contacts */
  ICON_Scout: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Scout — ECHO agent role: contextual exploration radar"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- range rings -->
  <g stroke="#18faf9" stroke-width="2">
    <path d="M25 46 A7 7 0 0 0 39 46" />
    <path d="M20 46 A12 12 0 0 0 44 46" />
  </g>
  <!-- sweep beam -->
  <polygon points="32,46 49,27 53,33" fill="#ff2bd6" opacity="0.18" />
  <path
    d="M32 46 L49 27"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- contacts -->
  <circle cx="40" cy="38" r="2" fill="#ff2bd6" filter="url(#glow)" />
  <circle cx="26" cy="36" r="1.5" fill="#18faf9" />
  <!-- pivot -->
  <circle cx="32" cy="46" r="2" fill="#18faf9" />
  <!-- dish -->
  <path
    d="M18 46 A14 14 0 0 1 46 46"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- pedestal -->
  <g stroke="#18faf9" stroke-linecap="round">
    <path d="M18 46 L22 55" stroke-width="2.5" />
    <path d="M46 46 L42 55" stroke-width="2.5" />
    <path d="M19 57 L45 57" stroke-width="3" />
  </g>
</svg>`,
  /** Researcher (echo-agent): External verification — flask with neon liquid and rising bubbles */
  ICON_Researcher: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Researcher — ECHO agent role: external verification flask"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- flask: neck, shoulder, cone body -->
  <path
    d="M28 8 L36 8 L36 21 L49 46 L15 46 L28 21 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- neon liquid -->
  <polygon points="22,38 42,38 47,46 17,46" fill="#18faf9" opacity="0.12" />
  <path
    d="M22 38 L42 38"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- rising bubbles -->
  <g fill="#18faf9">
    <circle cx="28" cy="42" r="1.5" />
    <circle cx="36" cy="40" r="2" />
    <circle cx="40" cy="44" r="1" />
  </g>
  <!-- circuit trace off the flask base -->
  <path
    d="M32 46 L32 52 L37 52"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle cx="39.5" cy="52" r="1.8" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Scribe (echo-agent): Documentation synthesis — pen nib with writing traces */
  ICON_Scribe: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Scribe — ECHO agent role: documentation synthesis"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- pen nib -->
  <polygon
    points="32,8 43,21 38,38 32,46 26,38 21,21"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
    fill="#18faf9"
    fill-opacity="0.08"
  />
  <!-- nib slit and breather hole -->
  <path
    d="M32 19 L32 32"
    stroke="#18faf9"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <circle cx="32" cy="23" r="1.5" fill="#ff2bd6" />
  <!-- writing traces -->
  <path
    d="M14 52 L34 52 L38 56"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle cx="40" cy="56" r="1.8" fill="#ff2bd6" />
  <path
    d="M14 58 L46 58"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
  />
  <circle cx="48" cy="58" r="1.8" fill="#ff2bd6" />
  <path
    d="M20 62 L40 62"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
    opacity="0.6"
  />
</svg>`,
  /** Adversary (echo-agent): Meta-verification override — crossed blades with chromatic glitch layer */
  ICON_Adversary: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Adversary — ECHO agent role: meta-verification override, glitch blades"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- chromatic glitch layer: offset copies of both blades -->
  <g stroke="#ff2bd6" stroke-width="2" opacity="0.45" stroke-linejoin="round">
    <polygon points="14,46 18,50 46,18 42,14" />
    <polygon points="50,50 54,54 26,22 22,18" />
  </g>
  <!-- crossed blades -->
  <g stroke="#18faf9" stroke-width="3" stroke-linejoin="round">
    <polygon points="16,48 20,52 48,20 44,16" />
    <polygon points="48,48 52,52 24,20 20,16" />
  </g>
  <!-- crossing core -->
  <circle cx="32" cy="32" r="3" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Detective Crosshair (variation-mark): Analysis scanner, crosshair variant */
  ICON_DetectiveCrosshair: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Detective crosshair — analysis scanner, crosshair variant"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- lens -->
  <circle cx="27" cy="27" r="15" stroke="#18faf9" stroke-width="3" />
  <!-- crosshair ticks inside the lens -->
  <g stroke="#ff2bd6" stroke-width="1.5" stroke-linecap="round">
    <path d="M27 17 L27 22" />
    <path d="M27 32 L27 37" />
    <path d="M17 27 L22 27" />
    <path d="M32 27 L37 27" />
  </g>
  <!-- circuit handle: diagonal trace, 90-degree elbow, terminal node -->
  <path
    d="M38 38 L46 46 L53 46"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle cx="55.5" cy="46" r="2.5" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Loop Minimal (variation-mark): The ECHO fix/verify cycle, minimal variant */
  ICON_LoopMinimal: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Loop minimal — the ECHO fix/verify cycle, minimal variant"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- 270-degree cycle arc -->
  <path
    d="M32 12 A20 20 0 1 1 12 32"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- arrowhead at the arc terminus -->
  <polygon points="8,26 16,26 12,34" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Orchestrator Solid (variation-mark): Protocol enforcement hub, solid variant */
  ICON_OrchestratorSolid: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Orchestrator solid — protocol enforcement hub, solid variant"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- radiating circuit spokes -->
  <g stroke="#18faf9" stroke-width="2" stroke-linecap="round">
    <path d="M32 16 L32 6" />
    <path d="M46 24 L55 19" />
    <path d="M46 40 L55 45" />
    <path d="M32 48 L32 58" />
    <path d="M18 40 L9 45" />
    <path d="M18 24 L9 19" />
  </g>
  <!-- terminal nodes -->
  <g fill="#ff2bd6">
    <circle cx="32" cy="6" r="2.5" />
    <circle cx="55" cy="19" r="2.5" />
    <circle cx="55" cy="45" r="2.5" />
    <circle cx="32" cy="58" r="2.5" />
    <circle cx="9" cy="45" r="2.5" />
    <circle cx="9" cy="19" r="2.5" />
  </g>
  <!-- outer dashed ring -->
  <circle
    cx="32"
    cy="32"
    r="22"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-dasharray="3 4"
    opacity="0.6"
  />
  <!-- hexagonal hub, solid fill -->
  <polygon
    points="32,16 46,24 46,40 32,48 18,40 18,24"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
    fill="#18faf9"
    fill-opacity="0.15"
  />
  <!-- core -->
  <circle cx="32" cy="32" r="6" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Scope Crosshair (variation-mark): Target reticle, crosshair variant */
  ICON_ScopeCrosshair: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Scope crosshair — target reticle, crosshair variant"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- reticle ring -->
  <circle cx="32" cy="32" r="16" stroke="#18faf9" stroke-width="3" />
  <!-- crosshair ticks -->
  <g stroke="#18faf9" stroke-width="3" stroke-linecap="round">
    <path d="M32 6 L32 14" />
    <path d="M32 50 L32 58" />
    <path d="M6 32 L14 32" />
    <path d="M50 32 L58 32" />
  </g>
  <!-- center dot -->
  <circle cx="32" cy="32" r="3" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Verifier Bold (variation-mark): Double-audit validation shield, bold variant */
  ICON_VerifierBold: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Verifier bold — double-audit validation shield, bold variant"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- shield -->
  <path
    d="M32 8 L50 15 L50 31 C50 43 42 51 32 56 C22 51 14 43 14 31 L14 15 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- bold circuit check with terminal nodes -->
  <path
    d="M22 33 L29 39 L43 23"
    stroke="#ff2bd6"
    stroke-width="4"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
  <g fill="#ff2bd6">
    <circle cx="22" cy="33" r="2.5" />
    <circle cx="43" cy="23" r="2.5" />
  </g>
</svg>`,
  /** FID (protocol-mark): Feature Implementation Document — folded-corner document, code lines and phase dots */
  ICON_Fid: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="FID — Feature Implementation Document"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- document with folded corner -->
  <path
    d="M18 10 L40 10 L52 22 L52 54 L18 54 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <path
    d="M40 10 L40 22 L52 22"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- code lines: the middle one is the active line -->
  <g stroke-linecap="round">
    <path d="M24 30 L40 30" stroke="#18faf9" stroke-width="2" />
    <path
      d="M24 36 L46 36"
      stroke="#ff2bd6"
      stroke-width="2"
      filter="url(#glow)"
    />
    <path d="M24 42 L36 42" stroke="#18faf9" stroke-width="2" />
  </g>
  <!-- perfection-loop phase dots: idle, active, audit, complete -->
  <circle cx="26" cy="49" r="1.6" stroke="#18faf9" stroke-width="1.5" />
  <circle cx="32" cy="49" r="1.6" fill="#ff2bd6" />
  <circle cx="38" cy="49" r="1.6" fill="#4fa8ff" />
  <circle cx="44" cy="49" r="1.6" fill="#18faf9" />
</svg>`,
  /** Perfection Loop (protocol-mark): The fix/verify cycle — 270-degree arc, arrowhead and four phase nodes */
  ICON_Loop: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Perfection Loop — the ECHO fix/verify cycle"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- 270-degree cycle arc -->
  <path
    d="M32 12 A20 20 0 1 1 12 32"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- arrowhead at the arc terminus -->
  <polygon points="8,26 16,26 12,34" fill="#ff2bd6" filter="url(#glow)" />
  <!-- phase nodes on the arc -->
  <g>
    <circle cx="52" cy="32" r="2.5" fill="#18faf9" />
    <circle cx="46" cy="46" r="2.5" fill="#ff2bd6" />
    <circle cx="32" cy="52" r="2.5" fill="#4fa8ff" />
    <circle cx="18" cy="46" r="2.5" fill="#18faf9" />
  </g>
  <!-- loop core -->
  <polygon
    points="32,26 38,32 32,38 26,32"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
</svg>`,
  /** Law (protocol-mark): The ECHO protocol laws — gavel with impact ticks */
  ICON_Law: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Law — the ECHO protocol laws"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- gavel head -->
  <rect
    x="22"
    y="12"
    width="16"
    height="16"
    rx="3"
    transform="rotate(45 30 20)"
    stroke="#18faf9"
    stroke-width="3"
  />
  <!-- head band -->
  <rect
    x="26.5"
    y="16.5"
    width="7"
    height="7"
    rx="1.5"
    transform="rotate(45 30 20)"
    stroke="#4fa8ff"
    stroke-width="1.5"
    opacity="0.7"
  />
  <!-- handle with circuit elbow and terminal node -->
  <path
    d="M30 31 L43 43 L49 43"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle cx="51.5" cy="43" r="2" fill="#ff2bd6" filter="url(#glow)" />
  <!-- impact ticks radiating from the striking face -->
  <g stroke="#ff2bd6" stroke-width="2" stroke-linecap="round">
    <path d="M14 14 L10 10" />
    <path d="M13 20 L7 20" />
    <path d="M14 26 L10 30" />
  </g>
</svg>`,
  /** Audit (protocol-mark): Double-audit — HUD brackets, circuit check and scanline sweep */
  ICON_Audit: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Audit — double-audit verification"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- HUD corner brackets -->
  <g
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M10 18 L10 10 L18 10" />
    <path d="M46 10 L54 10 L54 18" />
    <path d="M54 46 L54 54 L46 54" />
    <path d="M18 54 L10 54 L10 46" />
  </g>
  <!-- verification check with terminal nodes -->
  <path
    d="M22 33 L29 39 L43 23"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
  <g fill="#ff2bd6">
    <circle cx="22" cy="33" r="2" />
    <circle cx="43" cy="23" r="2" />
  </g>
  <!-- scanline sweep -->
  <path
    d="M16 47 L48 47"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-dasharray="4 3"
    opacity="0.5"
  />
</svg>`,
  /** Scope (protocol-mark): Target reticle — dual rings, crosshair ticks and cardinal nodes */
  ICON_Scope: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Scope — target reticle"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- outer and inner rings -->
  <circle cx="32" cy="32" r="20" stroke="#18faf9" stroke-width="3" />
  <circle
    cx="32"
    cy="32"
    r="13"
    stroke="#4fa8ff"
    stroke-width="1.5"
    opacity="0.6"
  />
  <!-- crosshair ticks -->
  <g stroke="#18faf9" stroke-width="3" stroke-linecap="round">
    <path d="M32 6 L32 14" />
    <path d="M32 50 L32 58" />
    <path d="M6 32 L14 32" />
    <path d="M50 32 L58 32" />
  </g>
  <!-- cardinal ring nodes -->
  <g fill="#4fa8ff">
    <circle cx="32" cy="12" r="1.5" />
    <circle cx="52" cy="32" r="1.5" />
    <circle cx="32" cy="52" r="1.5" />
    <circle cx="12" cy="32" r="1.5" />
  </g>
  <!-- center dot -->
  <circle cx="32" cy="32" r="3" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** IDLE (phase-mark): Hollow core, dim frame — present, not active */
  ICON_PhaseIdle: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Phase: idle — the seat doesn't ask permission"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- idle: hollow core, dim frame — present, not active -->
  <circle
    cx="32"
    cy="32"
    r="16"
    stroke="#4fa8ff"
    stroke-width="2.5"
    opacity="0.8"
  />
  <circle
    cx="32"
    cy="32"
    r="7"
    stroke="#18faf9"
    stroke-width="2"
    opacity="0.5"
  />
  <!-- resting node -->
  <circle cx="32" cy="32" r="2" fill="#4fa8ff" opacity="0.7" />
  <!-- HUD tick -->
  <path d="M14 20 L10 16" stroke="#4fa8ff" stroke-width="1.5" opacity="0.5" />
</svg>`,
  /** RED (phase-mark): Investigating the codebase */
  ICON_PhaseRed: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="RED phase — investigating the codebase"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- code document under investigation -->
  <path
    d="M30 12 L46 12 L56 22 L56 54 L30 54 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <g stroke="#4fa8ff" stroke-width="1.5" stroke-linecap="round">
    <path d="M36 30 L48 30" />
    <path d="M36 36 L52 36" />
    <path d="M36 42 L44 42" />
  </g>
  <!-- investigator lens overlapping the document corner -->
  <circle cx="26" cy="40" r="10" stroke="#18faf9" stroke-width="3" />
  <path
    d="M21 36 L31 36"
    stroke="#ff2bd6"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M33 47 L41 55"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <circle cx="43.5" cy="57.5" r="2.5" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** GREEN (phase-mark): Implementing fixes */
  ICON_PhaseGreen: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="GREEN phase — implementing fixes"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- code brackets being written -->
  <g
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M24 20 L14 32 L24 44" />
    <path d="M40 20 L50 32 L40 44" />
  </g>
  <path
    d="M34 16 L30 48"
    stroke="#4fa8ff"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- terminal nodes at the bracket tips -->
  <g fill="#ff2bd6">
    <circle cx="14" cy="32" r="2" />
    <circle cx="50" cy="32" r="2" />
  </g>
</svg>`,
  /** AUDIT (phase-mark): Scanner examining the core — magnifier with scanline, circuit handle */
  ICON_PhaseAudit: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Phase: audit — verification in progress"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- audit: the scanner examining the core -->
  <circle cx="28" cy="30" r="12" stroke="#18faf9" stroke-width="3" />
  <!-- scanline through the lens -->
  <path
    d="M18 30 L38 30"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
    filter="url(#glow)"
  />
  <!-- handle: circuit trace with elbow -->
  <path
    d="M37 40 L46 50"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <circle cx="47" cy="51" r="2.5" fill="#ff2bd6" />
  <!-- HUD frame tick -->
  <path
    d="M50 12 L54 12 L54 16"
    stroke="#4fa8ff"
    stroke-width="1.5"
    opacity="0.6"
  />
</svg>`,
  /** SELF-CORRECT (phase-mark): Revising the approach */
  ICON_PhaseSelfCorrect: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="SELF-CORRECT phase — revising the approach"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- the old approach: dashed circle being revised -->
  <circle
    cx="32"
    cy="32"
    r="18"
    stroke="#18faf9"
    stroke-width="2"
    stroke-dasharray="4 3"
    opacity="0.7"
  />
  <!-- pencil redrawing it -->
  <path
    d="M44 40 L52 48"
    stroke="#18faf9"
    stroke-width="4"
    stroke-linecap="round"
  />
  <polygon points="41,43 37,47 45,49" fill="#ff2bd6" filter="url(#glow)" />
  <path
    d="M52 48 L56 44"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- revision spark where pencil meets the circle -->
  <circle cx="44.5" cy="44.5" r="1.5" fill="#ff2bd6" />
</svg>`,
  /** COMPLETE (phase-mark): Verified check in a green frame */
  ICON_PhaseComplete: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Phase: complete — verification passed"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- complete: the verified check in a solid frame -->
  <circle cx="32" cy="32" r="18" stroke="#3dff9a" stroke-width="3" />
  <path
    d="M22 33 L29 40 L43 24"
    stroke="#3dff9a"
    stroke-width="4"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
  <!-- terminal node -->
  <circle cx="32" cy="32" r="2" fill="#3dff9a" opacity="0.8" />
</svg>`,
  /** IMPLEMENT (phase-mark): Writing the fix — the GREEN implementation sub-mark */
  ICON_PhaseImplement: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="IMPLEMENT phase — writing the fix"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- code fragment -->
  <g
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M20 22 L12 32 L20 42" />
    <path d="M34 22 L42 32 L34 42" />
  </g>
  <!-- the fix landing: arrow into the fragment -->
  <path
    d="M46 32 L54 32"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <polygon points="50,27 58,32 50,37" fill="#ff2bd6" filter="url(#glow)" />
  <circle cx="12" cy="32" r="2" fill="#ff2bd6" />
</svg>`,
  /** ARCHIVE (phase-mark): Archiving the FID — archive box with closure check */
  ICON_PhaseArchive: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Phase: archive — archiving the FID"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- archive box -->
  <path
    d="M12 18 L52 18"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M14 22 L50 22 L50 52 L14 52 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <path
    d="M28 22 L28 28 L36 28 L36 22"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- closure check -->
  <path
    d="M23 40 L29 46 L42 32"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
</svg>`,
  /** Run: Active (run-mark): The engine is running — solid glowing core, dashed energized ring, radiating energy */
  ICON_RunActive: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Run: active — the engine is running"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- active: solid glowing core + energized ring -->
  <circle cx="32" cy="32" r="8" fill="#ff2bd6" filter="url(#glow)" />
  <circle
    cx="32"
    cy="32"
    r="16"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-dasharray="8 5"
  />
  <!-- energy radiating -->
  <g stroke="#ff2bd6" stroke-width="1.5" opacity="0.6">
    <path d="M32 10 L32 14" />
    <path d="M50 32 L54 32" />
    <path d="M32 54 L32 50" />
    <path d="M14 32 L10 32" />
  </g>
</svg>`,
  /** Run: Error (run-mark): A flaw, identified — lightning crack through a magenta frame */
  ICON_RunError: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Run: error — a flaw, identified"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- error: the magenta alert — a crack in the frame -->
  <circle cx="32" cy="32" r="18" stroke="#ff2bd6" stroke-width="3" />
  <!-- the crack: lightning through the core -->
  <path
    d="M35 16 L27 32 L33 32 L29 48"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
  <!-- frame fracture ticks -->
  <g stroke="#ff2bd6" stroke-width="1.5" opacity="0.6">
    <path d="M20 18 L24 24" />
    <path d="M44 46 L48 52" />
  </g>
</svg>`,
  /** Run: Fix (run-mark): Repair in progress — repair loop with wrench-trace, acid sparks at the repair point */
  ICON_RunFix: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Run: fix — repair in progress"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- fix: the repair loop — rotation with a wrench-trace -->
  <path
    d="M46 24 A18 18 0 1 0 50 38"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- wrench head: circuit elbow -->
  <path
    d="M50 38 L44 38 M50 38 L50 32"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
    filter="url(#glow)"
  />
  <!-- sparks at the repair point -->
  <g stroke="#f3e600" stroke-width="1.5" opacity="0.8">
    <path d="M16 18 L20 22" />
    <path d="M14 28 L19 28" />
  </g>
  <!-- terminal node -->
  <circle cx="46" cy="24" r="2" fill="#ff2bd6" />
</svg>`,
  /** Run: Done (run-mark): Shipped, verified, archived — sealed diamond, corner ticks */
  ICON_RunDone: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Run: done — shipped, verified, archived"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- done: the sealed diamond — complete and archived -->
  <polygon
    points="32,12 50,32 32,52 14,32"
    stroke="#3dff9a"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- inner seal -->
  <polygon
    points="32,22 42,32 32,42 22,32"
    stroke="#18faf9"
    stroke-width="2"
    opacity="0.7"
  />
  <!-- the shipped core -->
  <circle cx="32" cy="32" r="3" fill="#3dff9a" filter="url(#glow)" />
  <!-- archive ticks: the four corners of the done state -->
  <g stroke="#4fa8ff" stroke-width="1.5" opacity="0.5">
    <path d="M12 12 L16 12 M12 12 L12 16" />
    <path d="M52 12 L48 12 M52 12 L52 16" />
    <path d="M52 52 L48 52 M52 52 L52 48" />
    <path d="M12 52 L16 52 M12 52 L12 48" />
  </g>
</svg>`,
  /** Bash (tool-glyph): Terminal window */
  ICON_ToolBash: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Bash tool — terminal window"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- window -->
  <path
    d="M14 12 L50 12 L50 52 L14 52 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- title bar -->
  <path d="M14 20 L50 20" stroke="#18faf9" stroke-width="2" />
  <!-- window controls -->
  <circle cx="19" cy="16" r="1.3" fill="#ff2bd6" />
  <circle cx="24" cy="16" r="1.3" fill="#18faf9" />
  <circle cx="29" cy="16" r="1.3" fill="#4fa8ff" />
  <!-- prompt chevron -->
  <path
    d="M20 30 L26 34 L20 38"
    stroke="#ff2bd6"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
  <!-- command cursor -->
  <path
    d="M30 36 L40 36"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
</svg>`,
  /** Build (tool-glyph): Gear */
  ICON_ToolBuild: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Build tool — gear"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- gear teeth -->
  <path
    d="M32 14 L32 20"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M32 44 L32 50"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M14 32 L20 32"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M44 32 L50 32"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M19 19 L23 23"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M41 41 L45 45"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M45 19 L41 23"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M23 41 L19 45"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- gear body -->
  <circle cx="32" cy="32" r="7" stroke="#18faf9" stroke-width="3" />
  <!-- hub -->
  <circle cx="32" cy="32" r="2.5" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Call (tool-glyph): Arrow into a port box */
  ICON_ToolCall: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Call tool — arrow into a port box"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- target box -->
  <path
    d="M32 18 L52 18 L52 46 L32 46 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- call arrow -->
  <path
    d="M12 32 L28 32"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <polygon points="24,27 30,32 24,37" fill="#ff2bd6" filter="url(#glow)" />
  <!-- port node -->
  <circle cx="32" cy="32" r="2" fill="#ff2bd6" />
</svg>`,
  /** Deploy (tool-glyph): Rocket */
  ICON_ToolDeploy: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Deploy tool — rocket"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- rocket body -->
  <path
    d="M32 8 C38 16 38 28 32 36 C26 28 26 16 32 8 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- window -->
  <circle cx="32" cy="20" r="3" stroke="#4fa8ff" stroke-width="2" />
  <!-- fins -->
  <path
    d="M26 30 L18 40 L26 36"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <path
    d="M38 30 L46 40 L38 36"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- exhaust flame -->
  <polygon
    points="32,40 28,48 32,53 36,48"
    fill="#ff2bd6"
    filter="url(#glow)"
  />
</svg>`,
  /** Diff (tool-glyph): Two documents with spark */
  ICON_ToolDiff: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Diff tool — two documents with spark"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- left document (removed) -->
  <path
    d="M16 14 L28 14 L28 50 L16 50 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- right document (added) -->
  <path
    d="M36 14 L48 14 L48 50 L36 50 Z"
    stroke="#4fa8ff"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- central spark -->
  <path
    d="M32 24 L32 40"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
  />
  <circle cx="32" cy="20" r="1.5" fill="#ff2bd6" />
  <circle cx="32" cy="44" r="1.5" fill="#ff2bd6" />
  <!-- inner lines -->
  <path
    d="M20 22 L24 22"
    stroke="#18faf9"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M20 28 L24 28"
    stroke="#18faf9"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M40 22 L44 22"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M40 28 L44 28"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
</svg>`,
  /** Edit (tool-glyph): Pencil */
  ICON_ToolEdit: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Edit tool — pencil"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- pencil body: thick diagonal stroke -->
  <path
    d="M22 44 L42 24"
    stroke="#18faf9"
    stroke-width="7"
    stroke-linecap="round"
  />
  <!-- writing tip -->
  <polygon points="16,50 25,47 19,41" fill="#ff2bd6" filter="url(#glow)" />
  <!-- eraser -->
  <path
    d="M42 24 L46 20"
    stroke="#ff2bd6"
    stroke-width="5"
    stroke-linecap="round"
  />
</svg>`,
  /** Fetch (tool-glyph): Download arrow onto a tray */
  ICON_ToolFetch: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Fetch tool — download arrow onto a tray"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- tray -->
  <path
    d="M14 36 L50 36 L50 52 L14 52 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- fetch arrow -->
  <path
    d="M32 12 L32 30"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <polygon points="26,24 32,31 38,24" fill="#ff2bd6" filter="url(#glow)" />
  <!-- side ticks -->
  <path
    d="M18 14 L18 20"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M46 14 L46 20"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
</svg>`,
  /** Glob (tool-glyph): Orbital spokes */
  ICON_ToolGlob: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Glob tool — orbital spokes"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- six pattern spokes radiating from hub -->
  <path
    d="M32 32 L46 32"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M32 32 L39 44"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M32 32 L25 44"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M32 32 L18 32"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M32 32 L25 20"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M32 32 L39 20"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- orbit ring -->
  <circle
    cx="32"
    cy="32"
    r="20"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-dasharray="4 5"
  />
  <!-- orbiting dot -->
  <circle cx="32" cy="12" r="2.5" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Grep (tool-glyph): Search lens over text lines */
  ICON_ToolGrep: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Grep tool — search lens over text lines"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- text lines being searched -->
  <path
    d="M14 18 L40 18"
    stroke="#4fa8ff"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M14 26 L34 26"
    stroke="#4fa8ff"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M14 34 L30 34"
    stroke="#4fa8ff"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- search lens -->
  <circle cx="30" cy="36" r="11" stroke="#18faf9" stroke-width="3" />
  <!-- highlighted match inside lens -->
  <path
    d="M22 36 L38 36"
    stroke="#ff2bd6"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <!-- lens handle -->
  <path
    d="M38 44 L45 51"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <circle cx="47.5" cy="53.5" r="2.5" fill="#ff2bd6" />
</svg>`,
  /** Lint (tool-glyph): Broom sweeping */
  ICON_ToolLint: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Lint tool — broom sweeping"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- handle -->
  <path
    d="M40 12 L30 30"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- broom head -->
  <polygon
    points="22,34 38,34 34,46 26,46"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- bristles -->
  <path
    d="M26 36 L27 44"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M32 36 L32 44"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M38 36 L37 44"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <!-- sweep ticks -->
  <path
    d="M16 40 L12 40"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M14 46 L9 46"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
  />
</svg>`,
  /** Read (tool-glyph): Open book */
  ICON_ToolRead: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Read tool — open book"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- open book -->
  <path
    d="M32 20 L20 14 L20 46 L32 52 L44 46 L44 14 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <path d="M32 20 L32 52" stroke="#4fa8ff" stroke-width="1.5" />
  <!-- page lines -->
  <g stroke-linecap="round">
    <path d="M24 22 L29 20" stroke="#ff2bd6" stroke-width="1.5" />
    <path d="M24 29 L29 27" stroke="#ff2bd6" stroke-width="1.5" />
    <path d="M35 20 L40 22" stroke="#18faf9" stroke-width="1.5" />
    <path d="M35 27 L40 29" stroke="#18faf9" stroke-width="1.5" />
  </g>
</svg>`,
  /** Search (tool-glyph): Lens with crosshair */
  ICON_ToolSearch: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Search tool — lens with crosshair"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- lens -->
  <circle cx="27" cy="27" r="14" stroke="#18faf9" stroke-width="3" />
  <!-- crosshair ticks -->
  <path
    d="M27 17 L27 22"
    stroke="#ff2bd6"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M27 32 L27 37"
    stroke="#ff2bd6"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M17 27 L22 27"
    stroke="#ff2bd6"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M32 27 L37 27"
    stroke="#ff2bd6"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <!-- handle -->
  <path
    d="M37 37 L48 48"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <circle cx="50" cy="50" r="2.5" fill="#ff2bd6" />
</svg>`,
  /** Skill (tool-glyph): Hexagon with star core */
  ICON_ToolSkill: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Skill tool — hexagon with star core"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- flat-top hexagon -->
  <path
    d="M50 32 L41 48 L23 48 L14 32 L23 16 L41 16 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- four-point star core -->
  <path
    d="M32 22 L35 29 L42 32 L35 35 L32 42 L29 35 L22 32 L29 29 Z"
    fill="#ff2bd6"
    filter="url(#glow)"
  />
</svg>`,
  /** Task (tool-glyph): Clipboard with checked rows */
  ICON_ToolTask: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Task tool — clipboard with checked rows"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- clipboard body -->
  <path
    d="M18 12 L46 12 L46 52 L18 52 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- clip -->
  <path
    d="M26 8 L38 8 L38 14 L26 14 Z"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <!-- row 1: check + text -->
  <path
    d="M23 26 L26 29 L31 23"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
  <path
    d="M35 27 L42 27"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- row 2: check + text -->
  <path
    d="M23 35 L26 38 L31 32"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
  <path
    d="M35 36 L42 36"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- row 3: check + text -->
  <path
    d="M23 44 L26 47 L31 41"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
  <path
    d="M35 45 L42 45"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
</svg>`,
  /** Test (tool-glyph): Flask with passing check */
  ICON_ToolTest: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Test tool — flask with passing check"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- flask -->
  <path
    d="M28 10 L36 10 L36 20 L48 44 L16 44 L28 20 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- liquid surface -->
  <path
    d="M23 34 L41 34"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
  />
  <polygon
    points="23,34 41,34 46,44 18,44"
    fill="#18faf9"
    fill-opacity="0.12"
  />
  <!-- pass check -->
  <path
    d="M25 40 L28 43 L34 37"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
</svg>`,
  /** Think (tool-glyph): Thought bubble with nodes */
  ICON_ToolThink: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Think tool — thought bubble with nodes"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- thought bubble -->
  <circle cx="28" cy="26" r="14" stroke="#18faf9" stroke-width="3" />
  <!-- trailing bubbles -->
  <circle cx="18" cy="44" r="3.5" stroke="#18faf9" stroke-width="3" />
  <circle cx="12" cy="52" r="2" stroke="#18faf9" stroke-width="3" />
  <!-- thought nodes -->
  <circle cx="22" cy="26" r="2" fill="#ff2bd6" />
  <circle cx="28" cy="26" r="2" fill="#ff2bd6" />
  <circle cx="34" cy="26" r="2" fill="#ff2bd6" />
</svg>`,
  /** Todo (tool-glyph): List with checkboxes */
  ICON_ToolTodo: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Todo tool — list with checkboxes"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- list frame -->
  <path
    d="M16 14 L48 14 L48 50 L16 50 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- checked item -->
  <path
    d="M21 20 L28 20 L28 27 L21 27 Z"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <path
    d="M22.5 23.5 L24 25 L27 21"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
  <path
    d="M33 23.5 L43 23.5"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- unchecked item -->
  <path
    d="M21 33 L28 33 L28 40 L21 40 Z"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <path
    d="M33 36.5 L43 36.5"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <!-- in-progress item -->
  <path
    d="M21 45 L43 45"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-dasharray="3 3"
  />
</svg>`,
  /** Typecheck (tool-glyph): T monogram with check */
  ICON_ToolTypecheck: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Typecheck tool — T monogram with check"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- T glyph -->
  <path
    d="M22 16 L42 16"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M32 16 L32 34"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- type-safe check -->
  <path
    d="M24 42 L30 48 L44 34"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
</svg>`,
  /** Web (tool-glyph): Globe with meridians */
  ICON_ToolWeb: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Web tool — globe with meridians"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- globe -->
  <circle cx="32" cy="32" r="18" stroke="#18faf9" stroke-width="3" />
  <!-- meridian ellipse -->
  <ellipse cx="32" cy="32" rx="8" ry="18" stroke="#4fa8ff" stroke-width="1.5" />
  <!-- equator -->
  <path d="M14 32 L50 32" stroke="#4fa8ff" stroke-width="1.5" />
  <!-- tropic lines -->
  <path d="M19 24 L45 24" stroke="#4fa8ff" stroke-width="1.5" />
  <path d="M19 40 L45 40" stroke="#4fa8ff" stroke-width="1.5" />
  <!-- uplink node -->
  <circle cx="45" cy="19" r="2" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Write (tool-glyph): Pen on document */
  ICON_ToolWrite: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Write tool — pen on document"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- document -->
  <path
    d="M20 10 L44 10 L44 54 L20 54 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <path
    d="M26 44 L40 44"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <!-- pen diagonal, tip touching the page -->
  <path
    d="M38 16 L31 33"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M31 33 L27 40"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
    filter="url(#glow)"
  />
</svg>`,
  /** Active (status-indicator): Live and working — solid green core, white-hot center */
  ICON_StatusActive: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Status: active — live and working"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <circle cx="32" cy="32" r="10" fill="#3dff9a" filter="url(#glow)" />
  <circle cx="32" cy="32" r="4" fill="#ffffff" opacity="0.9" />
  <g stroke="#3dff9a" stroke-width="2" stroke-linecap="round" opacity="0.7">
    <path d="M32 12 L32 16" />
    <path d="M52 32 L48 32" />
    <path d="M32 52 L32 48" />
    <path d="M12 32 L16 32" />
  </g>
</svg>`,
  /** Blocked (status-indicator): Octagon with bar */
  ICON_StatusBlocked: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Blocked status — octagon with bar"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- stop octagon -->
  <path
    d="M20 12 L44 12 L52 20 L52 44 L44 52 L20 52 L12 44 L12 20 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- block bar -->
  <path
    d="M22 32 L42 32"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
  />
</svg>`,
  /** Complete (status-indicator): Ringed check */
  ICON_StatusComplete: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Complete status — ringed check"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- completion ring -->
  <circle cx="32" cy="32" r="16" stroke="#18faf9" stroke-width="3" />
  <!-- check -->
  <path
    d="M22 33 L29 40 L43 24"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
</svg>`,
  /** Connecting (status-indicator): Plug and cable */
  ICON_StatusConnecting: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Connecting status — plug and cable"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- plug prongs -->
  <path
    d="M24 12 L24 24"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M40 12 L40 24"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- plug body -->
  <path
    d="M20 24 L44 24 L44 34 L20 34 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- cable -->
  <path
    d="M32 34 L32 44 L26 50"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle cx="24" cy="52" r="2" fill="#ff2bd6" />
</svg>`,
  /** Error (status-indicator): Ringed cross */
  ICON_StatusError: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Error status — ringed cross"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- error ring -->
  <circle cx="32" cy="32" r="16" stroke="#18faf9" stroke-width="3" />
  <!-- cross -->
  <path
    d="M24 24 L40 40"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M40 24 L24 40"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
  />
</svg>`,
  /** Idle (status-indicator): Dim ring */
  ICON_StatusIdle: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Idle status — dim ring"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- idle ring -->
  <circle cx="32" cy="32" r="14" stroke="#18faf9" stroke-width="3" />
  <!-- dormant core -->
  <circle cx="32" cy="32" r="2" fill="#4fa8ff" opacity="0.5" />
</svg>`,
  /** Inactive (status-indicator): Present, not running — hollow core, dim ticks */
  ICON_StatusInactive: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Status: inactive — present, not running"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <circle
    cx="32"
    cy="32"
    r="10"
    stroke="#4fa8ff"
    stroke-width="3"
    opacity="0.7"
  />
  <circle
    cx="32"
    cy="32"
    r="4"
    stroke="#4fa8ff"
    stroke-width="2"
    opacity="0.6"
    fill="none"
  />
  <g stroke="#4fa8ff" stroke-width="1.5" stroke-linecap="round" opacity="0.4">
    <path d="M32 12 L32 16" />
    <path d="M52 32 L48 32" />
    <path d="M32 52 L32 48" />
    <path d="M12 32 L16 32" />
  </g>
</svg>`,
  /** Offline (status-indicator): Slashed ring */
  ICON_StatusOffline: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Offline status — slashed ring"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- ring -->
  <circle cx="32" cy="32" r="15" stroke="#18faf9" stroke-width="3" />
  <!-- offline slash -->
  <path
    d="M20 44 L44 20"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- dim core -->
  <circle cx="32" cy="32" r="2" fill="#4fa8ff" opacity="0.4" />
</svg>`,
  /** Partial (status-indicator): Running with a caveat — half-lit core, acid-yellow split */
  ICON_StatusPartial: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Status: partial — running with a caveat"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- partial: half-lit core, the split state -->
  <circle cx="32" cy="32" r="10" stroke="#18faf9" stroke-width="3" />
  <path
    d="M32 22 A10 10 0 0 1 32 42 Z"
    fill="#f3e600"
    filter="url(#glow)"
    opacity="0.85"
  />
  <circle cx="32" cy="32" r="2" fill="#18faf9" />
  <g stroke="#f3e600" stroke-width="1.5" opacity="0.5">
    <path d="M32 12 L32 16" />
    <path d="M32 52 L32 48" />
  </g>
</svg>`,
  /** Paused (status-indicator): Double bars */
  ICON_StatusPaused: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Paused status — double bars"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- pause bars -->
  <path
    d="M24 18 L24 46"
    stroke="#18faf9"
    stroke-width="7"
    stroke-linecap="round"
  />
  <path
    d="M40 18 L40 46"
    stroke="#18faf9"
    stroke-width="7"
    stroke-linecap="round"
  />
  <!-- hold tick -->
  <path
    d="M32 10 L32 14"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
  />
</svg>`,
  /** Retrying (status-indicator): Circular arrow */
  ICON_StatusRetrying: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Retrying status — circular arrow"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- retry arc -->
  <path
    d="M20 32 A12 12 0 1 1 32 44"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- arrow head -->
  <polygon points="28,40 36,44 28,48" fill="#ff2bd6" filter="url(#glow)" />
  <!-- center dot -->
  <circle cx="32" cy="32" r="2" fill="#18faf9" />
</svg>`,
  /** Syncing (status-indicator): Counter-rotating arcs */
  ICON_StatusSyncing: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Syncing status — counter-rotating arcs"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- upper arc -->
  <path
    d="M18 26 A14 14 0 0 1 46 26"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <polygon points="41,21 49,26 41,31" fill="#ff2bd6" filter="url(#glow)" />
  <!-- lower arc -->
  <path
    d="M46 38 A14 14 0 0 1 18 38"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <polygon points="23,33 15,38 23,43" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Warning (status-indicator): Triangle with exclamation */
  ICON_StatusWarning: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Warning status — triangle with exclamation"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- warning triangle -->
  <path
    d="M32 12 L52 48 L12 48 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- exclamation -->
  <path
    d="M32 22 L32 34"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
  />
  <circle cx="32" cy="40" r="2" fill="#ff2bd6" />
</svg>`,
  /** Agents (command-mark): Three figures */
  ICON_CmdAgents: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Agents command — three figures"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- center figure -->
  <circle cx="32" cy="22" r="5" stroke="#18faf9" stroke-width="3" />
  <path
    d="M22 38 C22 31 42 31 42 38"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- left figure -->
  <circle cx="18" cy="18" r="4" stroke="#4fa8ff" stroke-width="2.5" />
  <path
    d="M10 32 C10 26 26 26 26 32"
    stroke="#4fa8ff"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <!-- right figure -->
  <circle cx="46" cy="18" r="4" stroke="#4fa8ff" stroke-width="2.5" />
  <path
    d="M38 32 C38 26 54 26 54 32"
    stroke="#4fa8ff"
    stroke-width="2.5"
    stroke-linecap="round"
  />
</svg>`,
  /** Clear (command-mark): Trash can */
  ICON_CmdClear: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Clear command — trash can"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- can body -->
  <path
    d="M18 18 L46 18 L43 50 L21 50 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- lid -->
  <path
    d="M14 14 L50 14"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- handle -->
  <path
    d="M27 10 L37 10"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M29 10 L29 14"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M35 10 L35 14"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- inner lines -->
  <path
    d="M26 24 L26 42"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M38 24 L38 42"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
</svg>`,
  /** Commit (command-mark): Node graph with branch */
  ICON_CmdCommit: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Commit command — node graph with branch"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- rail -->
  <path
    d="M10 32 L54 32"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- rail nodes -->
  <circle cx="22" cy="32" r="3.5" fill="#18faf9" />
  <circle cx="42" cy="32" r="3.5" fill="#18faf9" />
  <!-- commit node -->
  <circle cx="32" cy="32" r="5" fill="#ff2bd6" filter="url(#glow)" />
  <!-- branch -->
  <path
    d="M42 32 L42 18 L48 18"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle cx="50" cy="18" r="2" fill="#4fa8ff" />
</svg>`,
  /** Compact (command-mark): Converging arrows */
  ICON_CmdCompact: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Compact command — converging arrows"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- left arrow -->
  <path
    d="M14 32 L26 32"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <polygon points="22,27 29,32 22,37" fill="#ff2bd6" filter="url(#glow)" />
  <!-- right arrow -->
  <path
    d="M50 32 L38 32"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <polygon points="42,27 35,32 42,37" fill="#ff2bd6" filter="url(#glow)" />
  <!-- center lines -->
  <path
    d="M28 20 L28 44"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M36 20 L36 44"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
</svg>`,
  /** Config (command-mark): Sliders */
  ICON_CmdConfig: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Config command — sliders"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- slider rails -->
  <path
    d="M14 20 L50 20"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M14 32 L50 32"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M14 44 L50 44"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <!-- knobs -->
  <circle cx="24" cy="20" r="4" fill="#ff2bd6" filter="url(#glow)" />
  <circle cx="38" cy="32" r="4" fill="#ff2bd6" filter="url(#glow)" />
  <circle cx="28" cy="44" r="4" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Exit (command-mark): Door with arrow */
  ICON_CmdExit: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Exit command — door with arrow"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- door frame -->
  <path
    d="M14 16 L14 48 L30 48"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- exit arrow -->
  <path
    d="M22 32 L46 32"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <polygon points="40,26 48,32 40,38" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Export (command-mark): Arrow out of a tray */
  ICON_CmdExport: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Export command — arrow out of a tray"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- tray -->
  <path
    d="M14 26 L50 26 L50 52 L14 52 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- export arrow -->
  <path
    d="M32 44 L32 18"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <polygon points="25,24 32,16 39,24" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Graph (command-mark): Triangle of nodes */
  ICON_CmdGraph: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Graph command — triangle of nodes"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- edges -->
  <path
    d="M32 16 L48 42"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M48 42 L16 42"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M16 42 L32 16"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- nodes -->
  <circle cx="32" cy="16" r="4" fill="#18faf9" />
  <circle cx="48" cy="42" r="4" fill="#18faf9" />
  <circle cx="16" cy="42" r="4" fill="#18faf9" />
  <!-- hub -->
  <circle cx="32" cy="33" r="2.5" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Help (command-mark): Question mark */
  ICON_CmdHelp: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Help command — question mark"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- circle -->
  <circle cx="32" cy="32" r="17" stroke="#18faf9" stroke-width="3" />
  <!-- question mark -->
  <path
    d="M32 20 C24 20 21 25 21 29 C21 34 25 35.5 27 38 L27 41"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    fill="none"
  />
  <circle cx="27" cy="46" r="2.2" fill="#ff2bd6" />
</svg>`,
  /** Logs (command-mark): Console with lines */
  ICON_CmdLogs: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Logs command — console with lines"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- console frame -->
  <path
    d="M14 14 L50 14 L50 50 L14 50 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- log lines -->
  <path
    d="M20 24 L44 24"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M20 31 L38 31"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M20 38 L42 38"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- marker -->
  <circle cx="46" cy="38" r="1.8" fill="#ff2bd6" />
</svg>`,
  /** Model (command-mark): Stacked layers */
  ICON_CmdModel: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Model command — stacked layers"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- top face -->
  <polygon
    points="32,10 48,19 32,28 16,19"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- left face -->
  <polygon
    points="16,19 32,28 32,46 16,37"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- right face -->
  <polygon
    points="48,19 32,28 32,46 48,37"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- inner edges -->
  <path d="M32 28 L32 46" stroke="#4fa8ff" stroke-width="1.5" />
  <path d="M16 19 L16 37" stroke="#4fa8ff" stroke-width="1.5" />
  <path d="M48 19 L48 37" stroke="#4fa8ff" stroke-width="1.5" />
  <!-- active layer node -->
  <circle cx="32" cy="19" r="2.5" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** New (command-mark): Circled plus */
  ICON_CmdNew: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="New command — circled plus"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- circle -->
  <circle cx="32" cy="32" r="17" stroke="#18faf9" stroke-width="3" />
  <!-- plus -->
  <path
    d="M32 20 L32 44"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M20 32 L44 32"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
  />
</svg>`,
  /** Skills (command-mark): Medal with ribbon */
  ICON_CmdSkills: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Skills command — medal with ribbon"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- ribbon -->
  <path
    d="M24 42 L20 54 L28 50 L32 54 L36 50 L44 54 L40 42"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- medal -->
  <circle cx="32" cy="30" r="14" stroke="#18faf9" stroke-width="3" />
  <!-- sparkle -->
  <path
    d="M32 22 L34.5 27.5 L40 30 L34.5 32.5 L32 38 L29.5 32.5 L24 30 L29.5 27.5 Z"
    fill="#ff2bd6"
    filter="url(#glow)"
  />
</svg>`,
  /** Status (command-mark): Gauge */
  ICON_CmdStatus: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Status command — gauge"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- gauge arc -->
  <path
    d="M16 44 A20 20 0 0 1 48 44"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- needle -->
  <path
    d="M32 44 L40 28"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
    filter="url(#glow)"
  />
  <circle cx="32" cy="44" r="2.5" fill="#ff2bd6" />
  <!-- baseline -->
  <path
    d="M14 44 L50 44"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- scale ticks -->
  <path
    d="M20 36 L23 39"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M44 36 L41 39"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
</svg>`,
  /** Theme (command-mark): Half-filled circle */
  ICON_CmdTheme: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Theme command — half-filled circle"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- circle -->
  <circle cx="32" cy="32" r="16" stroke="#18faf9" stroke-width="3" />
  <!-- left half fill -->
  <path d="M32 16 A16 16 0 0 0 32 48 Z" fill="#ff2bd6" fill-opacity="0.3" />
  <!-- divider -->
  <path d="M32 16 L32 48" stroke="#4fa8ff" stroke-width="1.5" />
  <!-- accent dots -->
  <circle cx="44" cy="22" r="1.5" fill="#18faf9" />
  <circle cx="20" cy="42" r="1.5" fill="#4fa8ff" />
</svg>`,
  /** API (dev-object-mark): Plug and socket */
  ICON_ObjApi: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="API object — plug and socket"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- plug head -->
  <path
    d="M22 12 L42 12 L42 24 L22 24 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- prongs -->
  <path
    d="M26 12 L26 6"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M38 12 L38 6"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <!-- cable -->
  <path
    d="M32 24 L32 44"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <!-- socket -->
  <path
    d="M24 44 L40 44 L40 54 L24 54 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- port dots -->
  <circle cx="28" cy="49" r="1.5" fill="#ff2bd6" />
  <circle cx="36" cy="49" r="1.5" fill="#ff2bd6" />
</svg>`,
  /** Branch (dev-object-mark): Git branch */
  ICON_ObjBranch: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Branch object — git branch"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- main line -->
  <path
    d="M16 50 L16 32 L32 32 L32 14"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- branch line -->
  <path
    d="M16 32 L48 32 L48 14"
    stroke="#4fa8ff"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- nodes -->
  <circle cx="16" cy="50" r="3.5" fill="#18faf9" />
  <circle cx="32" cy="14" r="3.5" fill="#18faf9" />
  <circle cx="48" cy="14" r="3.5" fill="#4fa8ff" />
  <circle cx="16" cy="32" r="2.5" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Calendar (dev-object-mark): Month grid */
  ICON_ObjCalendar: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Calendar object — month grid"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- page -->
  <path
    d="M14 18 L50 18 L50 50 L14 50 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- header -->
  <path d="M14 26 L50 26" stroke="#18faf9" stroke-width="2" />
  <!-- rings -->
  <path
    d="M22 12 L22 20"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M42 12 L42 20"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- day dots -->
  <circle cx="22" cy="34" r="1.6" fill="#18faf9" />
  <circle cx="30" cy="34" r="1.6" fill="#18faf9" />
  <circle cx="38" cy="34" r="1.6" fill="#18faf9" />
  <circle cx="22" cy="42" r="1.6" fill="#18faf9" />
  <circle cx="30" cy="42" r="1.6" fill="#18faf9" />
  <circle cx="38" cy="42" r="1.6" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Clock (dev-object-mark): Analog clock */
  ICON_ObjClock: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Clock object — analog clock"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- face -->
  <circle cx="32" cy="32" r="18" stroke="#18faf9" stroke-width="3" />
  <!-- hour hand -->
  <path
    d="M32 32 L32 20"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- minute hand -->
  <path
    d="M32 32 L41 37"
    stroke="#ff2bd6"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <!-- hub -->
  <circle cx="32" cy="32" r="2" fill="#ff2bd6" />
  <!-- tick marks -->
  <path
    d="M32 16 L32 19"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M48 32 L45 32"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M32 48 L32 45"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M16 32 L19 32"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
</svg>`,
  /** Cloud (dev-object-mark): Cloud with rain */
  ICON_ObjCloud: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Cloud object — cloud with rain"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- cloud -->
  <path
    d="M18 44 L46 44 C52 44 54 38 50 34 C50 27 44 23 38 25 C36 17 26 15 22 21 C15 21 11 29 15 34 C12 38 13 44 18 44 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- core node -->
  <circle cx="32" cy="34" r="2" fill="#ff2bd6" />
  <!-- rain -->
  <path
    d="M24 50 L22 54"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M32 50 L32 54"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M40 50 L42 54"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
</svg>`,
  /** Code (dev-object-mark): Angle brackets with slash */
  ICON_ObjCode: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Code object — angle brackets with slash"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- left bracket -->
  <path
    d="M24 20 L12 32 L24 44"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- right bracket -->
  <path
    d="M40 20 L52 32 L40 44"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- code slash -->
  <path
    d="M34 16 L30 48"
    stroke="#ff2bd6"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <!-- end nodes -->
  <circle cx="12" cy="32" r="2" fill="#ff2bd6" />
  <circle cx="52" cy="32" r="2" fill="#ff2bd6" />
</svg>`,
  /** Database (dev-object-mark): Cylinder */
  ICON_ObjDatabase: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Database object — cylinder"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- top rim -->
  <path
    d="M16 20 A16 6 0 0 0 48 20"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- body -->
  <path
    d="M16 20 L16 44 A16 6 0 0 0 48 44 L48 20"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- mid rim -->
  <path
    d="M16 32 A16 6 0 0 0 48 32"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <!-- data node -->
  <circle cx="32" cy="20" r="2" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** File (dev-object-mark): Document */
  ICON_ObjFile: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="File object — document"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- document -->
  <path
    d="M20 10 L40 10 L50 20 L50 54 L20 54 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- folded corner -->
  <path
    d="M40 10 L40 20 L50 20"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
  <!-- text lines -->
  <path
    d="M26 30 L44 30"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M26 37 L44 37"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M26 44 L38 44"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
</svg>`,
  /** Folder (dev-object-mark): Open folder */
  ICON_ObjFolder: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Folder object — open folder"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- folder -->
  <path
    d="M14 20 L26 20 L30 24 L50 24 L50 50 L14 50 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- label line -->
  <path
    d="M20 34 L34 34"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
</svg>`,
  /** Key (dev-object-mark): Circle and shaft */
  ICON_ObjKey: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Key object — circle and shaft"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- bow -->
  <circle cx="20" cy="32" r="8" stroke="#18faf9" stroke-width="3" />
  <!-- shaft -->
  <path
    d="M28 32 L50 32"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- teeth -->
  <path
    d="M42 32 L42 38"
    stroke="#ff2bd6"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M48 32 L48 40"
    stroke="#ff2bd6"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <!-- bow dot -->
  <circle cx="20" cy="32" r="2.5" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Lock (dev-object-mark): Padlock */
  ICON_ObjLock: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Lock object — padlock"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- shackle -->
  <path
    d="M24 26 L24 20 A8 8 0 0 1 40 20 L40 26"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- body -->
  <path
    d="M18 26 L46 26 L46 50 L18 50 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- keyhole -->
  <circle cx="32" cy="34" r="2.5" fill="#ff2bd6" filter="url(#glow)" />
  <path
    d="M32 36 L32 42"
    stroke="#ff2bd6"
    stroke-width="2.5"
    stroke-linecap="round"
  />
</svg>`,
  /** Merge (dev-object-mark): Converging paths */
  ICON_ObjMerge: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Merge object — converging paths"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- path one -->
  <path
    d="M16 14 L16 34 L32 44"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- path two -->
  <path
    d="M48 14 L48 34 L32 44"
    stroke="#4fa8ff"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- join node -->
  <circle cx="32" cy="44" r="4" fill="#ff2bd6" filter="url(#glow)" />
  <!-- tail -->
  <path
    d="M32 44 L32 51"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <circle cx="32" cy="53" r="1.8" fill="#18faf9" />
</svg>`,
  /** Server (dev-object-mark): Rack unit */
  ICON_ObjServer: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Server object — rack unit"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- rack -->
  <path
    d="M16 12 L48 12 L48 40 L16 40 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- shelves -->
  <path d="M16 22 L48 22" stroke="#18faf9" stroke-width="2" />
  <path d="M16 32 L48 32" stroke="#18faf9" stroke-width="2" />
  <!-- leds -->
  <circle cx="20" cy="17" r="1.5" fill="#ff2bd6" />
  <circle cx="20" cy="27" r="1.5" fill="#18faf9" />
  <circle cx="20" cy="37" r="1.5" fill="#4fa8ff" />
  <!-- slots -->
  <path
    d="M30 17 L44 17"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M30 27 L44 27"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M30 37 L44 37"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <!-- stand -->
  <path
    d="M24 40 L24 44"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M40 40 L40 44"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M20 46 L28 46"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M36 46 L44 46"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
</svg>`,
  /** Tag (dev-object-mark): Rotated square */
  ICON_ObjTag: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Tag object — rotated square"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- tag body (diamond) -->
  <rect
    x="20"
    y="20"
    width="24"
    height="24"
    rx="4"
    transform="rotate(45 32 32)"
    stroke="#18faf9"
    stroke-width="3"
  />
  <!-- hole -->
  <circle cx="32" cy="32" r="3" stroke="#ff2bd6" stroke-width="2" />
  <!-- string -->
  <path
    d="M46 14 L52 8"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <circle cx="53" cy="7" r="1.5" fill="#4fa8ff" />
</svg>`,
  /** Terminal (dev-object-mark): Monitor */
  ICON_ObjTerminal: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Terminal object — monitor"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- screen -->
  <path
    d="M12 14 L52 14 L52 42 L12 42 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- prompt -->
  <path
    d="M18 24 L24 28 L18 32"
    stroke="#ff2bd6"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M28 30 L40 30"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- stand -->
  <path
    d="M32 42 L32 48"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M22 50 L42 50"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
</svg>`,
  /** Binary (cyberpunk-motif): Bit cells */
  ICON_MotifBinary: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Binary motif — bit cells"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- row one -->
  <rect x="14" y="16" width="8" height="10" fill="#18faf9" />
  <rect x="26" y="16" width="8" height="10" fill="#4fa8ff" opacity="0.5" />
  <rect x="38" y="16" width="8" height="10" fill="#18faf9" />
  <!-- row two -->
  <rect x="14" y="32" width="8" height="10" fill="#4fa8ff" opacity="0.5" />
  <rect
    x="26"
    y="32"
    width="8"
    height="10"
    fill="#ff2bd6"
    filter="url(#glow)"
  />
  <rect x="38" y="32" width="8" height="10" fill="#4fa8ff" opacity="0.5" />
  <!-- row three -->
  <rect x="14" y="48" width="8" height="10" fill="#18faf9" />
  <rect x="26" y="48" width="8" height="10" fill="#4fa8ff" opacity="0.5" />
  <rect x="38" y="48" width="8" height="10" fill="#18faf9" />
</svg>`,
  /** Chip (cyberpunk-motif): Microprocessor */
  ICON_MotifChip: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Chip motif — microprocessor"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- body -->
  <rect
    x="18"
    y="18"
    width="28"
    height="28"
    rx="4"
    stroke="#18faf9"
    stroke-width="3"
  />
  <!-- inner die -->
  <rect
    x="26"
    y="26"
    width="12"
    height="12"
    stroke="#ff2bd6"
    stroke-width="2"
  />
  <!-- top pins -->
  <path
    d="M24 10 L24 18"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M32 10 L32 18"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M40 10 L40 18"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- bottom pins -->
  <path
    d="M24 50 L24 58"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M32 50 L32 58"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M40 50 L40 58"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- left pins -->
  <path
    d="M10 24 L18 24"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M10 32 L18 32"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M10 40 L18 40"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- right pins -->
  <path
    d="M50 24 L58 24"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M50 32 L58 32"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M50 40 L58 40"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
</svg>`,
  /** Chrome (cyberpunk-motif): Stacked chevrons */
  ICON_MotifChrome: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Chrome motif — stacked chevrons"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- chevron one -->
  <path
    d="M16 20 L32 10 L48 20"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- chevron two -->
  <path
    d="M16 30 L32 20 L48 30"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- chevron three -->
  <path
    d="M16 40 L32 30 L48 40"
    stroke="#4fa8ff"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- base rail -->
  <path
    d="M20 50 L44 50"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- rail nodes -->
  <circle cx="20" cy="50" r="2" fill="#ff2bd6" />
  <circle cx="44" cy="50" r="2" fill="#ff2bd6" />
</svg>`,
  /** Circuit (cyberpunk-motif): Traces and nodes */
  ICON_MotifCircuit: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Circuit motif — traces and nodes"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- top trace -->
  <path
    d="M12 12 L28 12 L34 18 L52 18"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- bottom trace -->
  <path
    d="M12 52 L28 52 L34 46 L52 46"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- end nodes -->
  <circle cx="12" cy="12" r="2.5" fill="#ff2bd6" />
  <circle cx="52" cy="18" r="2.5" fill="#ff2bd6" />
  <circle cx="12" cy="52" r="2.5" fill="#ff2bd6" />
  <circle cx="52" cy="46" r="2.5" fill="#ff2bd6" />
  <!-- bend nodes -->
  <circle cx="34" cy="18" r="2" fill="#18faf9" />
  <circle cx="34" cy="46" r="2" fill="#18faf9" />
  <!-- chip hint -->
  <path d="M28 28 L36 28 L36 36 L28 36 Z" stroke="#4fa8ff" stroke-width="1.5" />
</svg>`,
  /** Drone (cyberpunk-motif): Quad rotor */
  ICON_MotifDrone: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Drone motif — quad rotor"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- body -->
  <rect
    x="26"
    y="26"
    width="12"
    height="12"
    rx="3"
    stroke="#18faf9"
    stroke-width="3"
  />
  <!-- arms -->
  <path
    d="M26 28 L16 20"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M38 28 L48 20"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M26 36 L16 44"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M38 36 L48 44"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <!-- rotors -->
  <ellipse cx="14" cy="18" rx="6" ry="2" stroke="#4fa8ff" stroke-width="2" />
  <ellipse cx="50" cy="18" rx="6" ry="2" stroke="#4fa8ff" stroke-width="2" />
  <ellipse cx="14" cy="46" rx="6" ry="2" stroke="#4fa8ff" stroke-width="2" />
  <ellipse cx="50" cy="46" rx="6" ry="2" stroke="#4fa8ff" stroke-width="2" />
  <!-- camera -->
  <circle cx="32" cy="32" r="2" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Glitch (cyberpunk-motif): Offset bars */
  ICON_MotifGlitch: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Glitch motif — offset bars"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- bar one -->
  <rect x="14" y="18" width="36" height="6" fill="#18faf9" />
  <!-- bar two (offset) -->
  <rect x="20" y="30" width="28" height="6" fill="#ff2bd6" opacity="0.7" />
  <!-- bar three -->
  <rect x="14" y="42" width="36" height="6" fill="#4fa8ff" opacity="0.7" />
  <!-- slice window -->
  <rect
    x="38"
    y="16"
    width="10"
    height="10"
    stroke="#ff2bd6"
    stroke-width="2"
  />
</svg>`,
  /** Hex (cyberpunk-motif): Nested hexagons */
  ICON_MotifHex: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Hex motif — nested hexagons"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- outer hexagon -->
  <path
    d="M32 12 L49 22 L49 42 L32 52 L15 42 L15 22 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- inner hexagon -->
  <path
    d="M32 22 L41 27 L41 37 L32 42 L23 37 L23 27 Z"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <!-- core -->
  <circle cx="32" cy="32" r="2.5" fill="#4fa8ff" />
</svg>`,
  /** Holo (cyberpunk-motif): Projected diamond */
  ICON_MotifHolo: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Holo motif — projected diamond"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- emitter -->
  <path
    d="M20 50 L44 50"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M24 54 L40 54"
    stroke="#18faf9"
    stroke-width="2"
    stroke-linecap="round"
  />
  <!-- projection rays -->
  <path
    d="M20 50 L28 26"
    stroke="#18faf9"
    stroke-width="2"
    opacity="0.6"
    stroke-linecap="round"
  />
  <path
    d="M32 50 L32 20"
    stroke="#18faf9"
    stroke-width="2"
    opacity="0.6"
    stroke-linecap="round"
  />
  <path
    d="M44 50 L36 26"
    stroke="#18faf9"
    stroke-width="2"
    opacity="0.6"
    stroke-linecap="round"
  />
  <!-- hologram diamond -->
  <path
    d="M32 12 L42 24 L32 36 L22 24 Z"
    stroke="#ff2bd6"
    stroke-width="2"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
  <!-- inner node -->
  <circle cx="32" cy="24" r="2" fill="#18faf9" />
</svg>`,
  /** Matrix (cyberpunk-motif): Dot grid with highlight columns */
  ICON_MotifMatrix: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Matrix motif — dot grid with highlight columns"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- base grid -->
  <circle cx="20" cy="18" r="1.5" fill="#4fa8ff" />
  <circle cx="28" cy="18" r="1.5" fill="#4fa8ff" />
  <circle cx="36" cy="18" r="1.5" fill="#4fa8ff" />
  <circle cx="44" cy="18" r="1.5" fill="#4fa8ff" />
  <circle cx="20" cy="26" r="1.5" fill="#4fa8ff" />
  <circle cx="28" cy="26" r="2.5" fill="#ff2bd6" filter="url(#glow)" />
  <circle cx="36" cy="26" r="1.5" fill="#4fa8ff" />
  <circle cx="44" cy="26" r="1.5" fill="#4fa8ff" />
  <circle cx="20" cy="34" r="1.5" fill="#4fa8ff" />
  <circle cx="28" cy="34" r="2.5" fill="#ff2bd6" filter="url(#glow)" />
  <circle cx="36" cy="34" r="1.5" fill="#4fa8ff" />
  <circle cx="44" cy="34" r="1.5" fill="#4fa8ff" />
  <circle cx="20" cy="42" r="1.5" fill="#4fa8ff" />
  <circle cx="28" cy="42" r="1.5" fill="#4fa8ff" />
  <circle cx="36" cy="42" r="1.5" fill="#4fa8ff" />
  <circle cx="44" cy="42" r="1.5" fill="#4fa8ff" />
  <!-- secondary highlight column -->
  <circle cx="36" cy="26" r="2" fill="#18faf9" />
  <circle cx="36" cy="34" r="2" fill="#18faf9" />
</svg>`,
  /** Neon (cyberpunk-motif): Radiant core */
  ICON_MotifNeon: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Neon motif — radiant core"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- eight radiant spokes -->
  <path
    d="M32 10 L32 22"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M32 42 L32 54"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M10 32 L22 32"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M42 32 L54 32"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M17 17 L25 25"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M39 39 L47 47"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M47 17 L39 25"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M25 39 L17 47"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <!-- radiant core -->
  <circle cx="32" cy="32" r="6" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Node (cyberpunk-motif): Hub and satellites */
  ICON_MotifNode: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Node motif — hub and satellites"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- center hub -->
  <circle cx="32" cy="32" r="5" fill="#ff2bd6" filter="url(#glow)" />
  <!-- spokes -->
  <path
    d="M32 32 L32 14"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M32 32 L50 32"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M32 32 L32 50"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M32 32 L14 32"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <!-- satellites -->
  <circle cx="32" cy="12" r="3" fill="#18faf9" />
  <circle cx="52" cy="32" r="3" fill="#18faf9" />
  <circle cx="32" cy="52" r="3" fill="#18faf9" />
  <circle cx="12" cy="32" r="3" fill="#18faf9" />
  <!-- diagonal links -->
  <path
    d="M20 20 L26 26"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M44 20 L38 26"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M44 44 L38 38"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <path
    d="M20 44 L26 38"
    stroke="#4fa8ff"
    stroke-width="1.5"
    stroke-linecap="round"
  />
</svg>`,
  /** Pulse (cyberpunk-motif): Heartbeat line */
  ICON_MotifPulse: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Pulse motif — heartbeat line"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- pulse line -->
  <path
    d="M10 32 L22 32 L28 20 L36 44 L42 32 L54 32"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
  <!-- end nodes -->
  <circle cx="10" cy="32" r="2" fill="#ff2bd6" />
  <circle cx="54" cy="32" r="2" fill="#ff2bd6" />
</svg>`,
  /** Scan (cyberpunk-motif): Corner brackets with sweep */
  ICON_MotifScan: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Scan motif — corner brackets with sweep"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- corner brackets -->
  <path
    d="M12 16 L12 12 L16 12"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M52 12 L56 12 L56 16"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M56 52 L56 56 L52 56"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M16 56 L12 56 L12 52"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- scan line -->
  <path
    d="M16 32 L48 32"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
    filter="url(#glow)"
  />
  <!-- end nodes -->
  <circle cx="16" cy="32" r="2" fill="#ff2bd6" />
  <circle cx="48" cy="32" r="2" fill="#ff2bd6" />
  <!-- faint sweeps -->
  <path
    d="M16 24 L48 24"
    stroke="#4fa8ff"
    stroke-width="1"
    opacity="0.4"
    stroke-linecap="round"
  />
  <path
    d="M16 40 L48 40"
    stroke="#4fa8ff"
    stroke-width="1"
    opacity="0.4"
    stroke-linecap="round"
  />
</svg>`,
  /** Voxel (cyberpunk-motif): Isometric cube */
  ICON_MotifVoxel: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Voxel motif — isometric cube"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- top face -->
  <polygon
    points="32,12 48,21 32,30 16,21"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- left face -->
  <polygon
    points="16,21 32,30 32,48 16,39"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- right face -->
  <polygon
    points="48,21 32,30 32,48 48,39"
    stroke="#4fa8ff"
    stroke-width="2.5"
    stroke-linejoin="round"
  />
  <!-- inner edges -->
  <path d="M32 30 L32 48" stroke="#4fa8ff" stroke-width="1.5" />
  <path d="M16 21 L16 39" stroke="#4fa8ff" stroke-width="1.5" />
  <path d="M48 21 L48 39" stroke="#4fa8ff" stroke-width="1.5" />
  <!-- core -->
  <circle cx="32" cy="30" r="2" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Wave (cyberpunk-motif): Sine wave */
  ICON_MotifWave: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Wave motif — sine wave"
>
  <!-- SAVANT // CYBERDECK — hand-authored vector geometry, no external assets -->
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- wave -->
  <path
    d="M10 32 C18 18 26 18 32 32 C38 46 46 46 54 32"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
    fill="none"
  />
  <!-- center node -->
  <circle cx="32" cy="32" r="2" fill="#ff2bd6" filter="url(#glow)" />
  <!-- end nodes -->
  <circle cx="10" cy="32" r="2" fill="#18faf9" />
  <circle cx="54" cy="32" r="2" fill="#18faf9" />
  <!-- dashed center -->
  <path
    d="M10 32 L54 32"
    stroke="#4fa8ff"
    stroke-width="1"
    stroke-dasharray="2 4"
    opacity="0.4"
  />
</svg>`,
  /** Activity (sidebar-section): Agent activity stream — vertical timeline with pulse nodes and branch events */
  ICON_SidebarActivity: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Activity — agent activity stream"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- pulse trace: vertical timeline with activity nodes -->
  <path
    d="M32 10 L32 54"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <g fill="#ff2bd6" filter="url(#glow)">
    <circle cx="32" cy="14" r="3" />
    <circle cx="32" cy="32" r="4.5" />
    <circle cx="32" cy="50" r="3" />
  </g>
  <!-- branch events -->
  <g stroke="#4fa8ff" stroke-width="1.5" opacity="0.7">
    <path d="M32 22 L44 22" />
    <path d="M32 42 L20 42" />
  </g>
  <circle cx="46" cy="22" r="2" fill="#4fa8ff" />
  <circle cx="18" cy="42" r="2" fill="#4fa8ff" />
</svg>`,
  /** Trust Matrix (sidebar-section): Trust verification grid — 3x3 lattice, magenta verified cells, blue pending cells */
  ICON_SidebarTrustMatrix: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Trust Matrix — agent trust verification grid"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- 3x3 verification grid -->
  <g stroke="#18faf9" stroke-width="2.5" stroke-linecap="round">
    <path d="M16 10 L16 54" />
    <path d="M32 10 L32 54" />
    <path d="M48 10 L48 54" />
    <path d="M10 16 L54 16" />
    <path d="M10 32 L54 32" />
    <path d="M10 48 L54 48" />
  </g>
  <!-- verified cells (magenta = trust confirmed) -->
  <g fill="#ff2bd6" filter="url(#glow)">
    <circle cx="16" cy="16" r="3" />
    <circle cx="32" cy="32" r="3" />
    <circle cx="48" cy="48" r="3" />
  </g>
  <!-- pending cells (blue = frame) -->
  <g fill="#4fa8ff" opacity="0.7">
    <circle cx="48" cy="16" r="2" />
    <circle cx="16" cy="48" r="2" />
    <circle cx="32" cy="16" r="2" />
    <circle cx="16" cy="32" r="2" />
    <circle cx="48" cy="32" r="2" />
    <circle cx="32" cy="48" r="2" />
  </g>
</svg>`,
  /** FID Section (sidebar-section): Flaw Identification Document — notched document frame, magenta crack, green verification check */
  ICON_SidebarFid: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="FID — Flaw Identification Document, verified fix"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- document frame with notched corner (cyberdeck grammar) -->
  <path
    d="M14 8 L42 8 L50 16 L50 56 L14 54 Z"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <path
    d="M42 8 L42 16 L50 16"
    stroke="#4fa8ff"
    stroke-width="1.5"
    opacity="0.7"
  />
  <!-- the flaw: a crack in the document -->
  <path
    d="M22 20 L28 28 L24 34 L30 42"
    stroke="#ff2bd6"
    stroke-width="2.5"
    stroke-linecap="round"
    filter="url(#glow)"
  />
  <!-- the fix: verification checkmark over the crack -->
  <path
    d="M34 44 L38 48 L46 38"
    stroke="#3dff9a"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <!-- text lines -->
  <g stroke="#4fa8ff" stroke-width="1.5" opacity="0.5">
    <path d="M20 50 L36 51" />
  </g>
</svg>`,
  /** History (sidebar-section): Session history archive — clock face pointing back, magenta now-node, archive ticks */
  ICON_SidebarHistory: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="History — session history archive"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- clock face: the archive of what happened -->
  <circle cx="32" cy="32" r="20" stroke="#18faf9" stroke-width="3" />
  <!-- hands: pointing back in time -->
  <path
    d="M32 32 L32 18"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M32 32 L44 38"
    stroke="#ff2bd6"
    stroke-width="2.5"
    stroke-linecap="round"
    filter="url(#glow)"
  />
  <!-- archive ticks -->
  <g stroke="#4fa8ff" stroke-width="1.5" opacity="0.6">
    <path d="M32 8 L32 12" />
    <path d="M52 32 L56 32" />
    <path d="M32 52 L32 56" />
    <path d="M8 32 L12 32" />
  </g>
  <!-- terminal node: now -->
  <circle cx="32" cy="32" r="2.5" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Loop Section (sidebar-section): The ECHO Perfection Loop — cycle closing on itself, magenta return arrow, iteration nodes */
  ICON_SidebarLoop: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Loop — the ECHO Perfection Loop FSM"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- the loop: cycle that loops back on itself -->
  <path
    d="M32 12 A20 20 0 1 1 14 26"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- the return: arrow head closing the loop -->
  <path
    d="M14 26 L10 18 M14 26 L22 22"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linecap="round"
    filter="url(#glow)"
  />
  <!-- iterations: nodes along the cycle -->
  <g fill="#ff2bd6">
    <circle cx="52" cy="32" r="2" />
    <circle cx="44" cy="48" r="2" />
    <circle cx="20" cy="48" r="2" />
  </g>
  <!-- core: the improved engine -->
  <circle cx="32" cy="32" r="4" fill="#4fa8ff" opacity="0.85" />
</svg>`,
  /** Session (sidebar-section): Persistent session state — container pod, state layers, green always-on indicator */
  ICON_SidebarSession: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Session — persistent session state"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- persistent container: the session pod -->
  <rect
    x="12"
    y="14"
    width="40"
    height="36"
    rx="2"
    stroke="#18faf9"
    stroke-width="3"
  />
  <!-- state layers inside -->
  <g stroke="#4fa8ff" stroke-width="1.5" opacity="0.7">
    <path d="M18 22 L46 22" />
    <path d="M18 30 L46 30" />
  </g>
  <!-- the live state: glowing core row -->
  <path
    d="M18 40 L34 40"
    stroke="#ff2bd6"
    stroke-width="2.5"
    stroke-linecap="round"
    filter="url(#glow)"
  />
  <circle cx="44" cy="40" r="2.5" fill="#ff2bd6" />
  <!-- persistence: always-on indicator -->
  <circle cx="32" cy="56" r="2" fill="#3dff9a" filter="url(#glow)" />
  <path d="M32 50 L32 54" stroke="#3dff9a" stroke-width="1.5" />
</svg>`,
  /** Thinking (activity-indicator): Branching thought trace — paths the model tried, green cross on the kept branch */
  ICON_ActivityThinking: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Activity: thinking — the model is reasoning"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- thinking: the branching thought trace -->
  <path
    d="M32 54 L32 36"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M32 36 L20 22"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <path
    d="M32 36 L44 22"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <!-- thought nodes: the paths the model tried -->
  <g fill="#ff2bd6" filter="url(#glow)">
    <circle cx="20" cy="22" r="3" />
    <circle cx="44" cy="22" r="3" />
  </g>
  <circle cx="32" cy="54" r="2.5" fill="#18faf9" />
  <!-- the kept branch: small cross on the left path -->
  <g stroke="#3dff9a" stroke-width="2" stroke-linecap="round">
    <path d="M16 14 L22 18" />
    <path d="M22 14 L16 18" />
  </g>
</svg>`,
  /** Tool (activity-indicator): Sandbox gear — circuit-trace cog with stub teeth, executing core */
  ICON_ActivityTool: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Activity: tool — tool execution in the sandbox"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- tool: the sandbox gear — circuit-trace gear, not a stock cog -->
  <circle cx="32" cy="32" r="12" stroke="#18faf9" stroke-width="3" />
  <!-- gear teeth as circuit stubs -->
  <g stroke="#18faf9" stroke-width="3" stroke-linecap="round">
    <path d="M32 16 L32 10" />
    <path d="M48 32 L54 32" />
    <path d="M32 48 L32 54" />
    <path d="M16 32 L10 32" />
    <path d="M43 16 L47 10" />
    <path d="M43 48 L47 54" />
    <path d="M21 48 L17 54" />
    <path d="M21 16 L17 10" />
  </g>
  <!-- the executing core -->
  <circle cx="32" cy="32" r="4" fill="#ff2bd6" filter="url(#glow)" />
</svg>`,
  /** Subagent (activity-indicator): Parent node spawning a child — delegation trace, smaller child one generation down */
  ICON_ActivitySubagent: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Activity: subagent — a spawned child agent"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- parent node spawning a child: the delegation trace -->
  <circle cx="20" cy="32" r="7" stroke="#18faf9" stroke-width="3" />
  <circle cx="20" cy="32" r="2.5" fill="#ff2bd6" filter="url(#glow)" />
  <!-- the spawn trace with elbow -->
  <path
    d="M27 32 L40 32"
    stroke="#18faf9"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <!-- child node: smaller, one generation down -->
  <circle cx="47" cy="32" r="5" stroke="#4fa8ff" stroke-width="2.5" />
  <circle cx="47" cy="32" r="2" fill="#ff2bd6" opacity="0.8" />
  <!-- parallel children tick -->
  <g stroke="#4fa8ff" stroke-width="1.5" opacity="0.6">
    <path d="M40 32 L40 20" />
    <path d="M40 32 L40 44" />
  </g>
  <circle cx="40" cy="18" r="1.5" fill="#4fa8ff" />
  <circle cx="40" cy="46" r="1.5" fill="#4fa8ff" />
</svg>`,
  /** Researching (activity-indicator): Magnifier over indexed sources — source lines, glowing match, circuit handle */
  ICON_ActivityResearching: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Activity: researching — deep research in progress"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- researching: the magnifier over indexed sources -->
  <circle cx="26" cy="26" r="13" stroke="#18faf9" stroke-width="3" />
  <!-- indexed content inside the lens: source lines -->
  <g stroke="#4fa8ff" stroke-width="1.5" opacity="0.7">
    <path d="M19 22 L33 22" />
    <path d="M19 26 L33 26" />
    <path d="M19 30 L29 30" />
  </g>
  <!-- the found signal: glowing match -->
  <circle cx="26" cy="26" r="2" fill="#ff2bd6" filter="url(#glow)" />
  <!-- circuit handle with elbow -->
  <path
    d="M36 36 L48 50"
    stroke="#18faf9"
    stroke-width="3"
    stroke-linecap="round"
  />
  <circle cx="49" cy="51" r="2.5" fill="#ff2bd6" />
  <!-- citation tick -->
  <path
    d="M52 12 L56 12 L56 16"
    stroke="#4fa8ff"
    stroke-width="1.5"
    opacity="0.6"
  />
</svg>`,
  /** Nav: Back (nav-glyph): Left chevron with magenta terminal node and HUD corner tick */
  ICON_NavBack: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Navigation: back"
>
  <path
    d="M40 14 L20 32 L40 50"
    stroke="#18faf9"
    stroke-width="3.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle cx="20" cy="32" r="2.5" fill="#ff2bd6" />
  <path
    d="M12 12 L12 16 M12 12 L16 12"
    stroke="#4fa8ff"
    stroke-width="1.5"
    opacity="0.5"
  />
</svg>`,
  /** Nav: Forward (nav-glyph): Right chevron with magenta terminal node and HUD corner tick */
  ICON_NavForward: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Navigation: forward"
>
  <path
    d="M24 14 L44 32 L24 50"
    stroke="#18faf9"
    stroke-width="3.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle cx="44" cy="32" r="2.5" fill="#ff2bd6" />
  <path
    d="M52 12 L52 16 M52 12 L48 12"
    stroke="#4fa8ff"
    stroke-width="1.5"
    opacity="0.5"
  />
</svg>`,
  /** Nav: Up (nav-glyph): Up chevron with magenta terminal node and HUD corner tick */
  ICON_NavUp: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Navigation: up"
>
  <path
    d="M14 40 L32 20 L50 40"
    stroke="#18faf9"
    stroke-width="3.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle cx="32" cy="20" r="2.5" fill="#ff2bd6" />
  <path
    d="M12 12 L16 12 M12 12 L12 16"
    stroke="#4fa8ff"
    stroke-width="1.5"
    opacity="0.5"
  />
</svg>`,
  /** Nav: Down (nav-glyph): Down chevron with magenta terminal node and HUD corner tick */
  ICON_NavDown: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Navigation: down"
>
  <path
    d="M14 24 L32 44 L50 24"
    stroke="#18faf9"
    stroke-width="3.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle cx="32" cy="44" r="2.5" fill="#ff2bd6" />
  <path
    d="M12 52 L16 52 M12 52 L12 48"
    stroke="#4fa8ff"
    stroke-width="1.5"
    opacity="0.5"
  />
</svg>`,
  /** Alert: Info (alert-glyph): Blue circle frame, info dot and stroke, terminal dot at the base */
  ICON_AlertInfo: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Alert: info — informational notice"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <circle cx="32" cy="32" r="18" stroke="#4fa8ff" stroke-width="3" />
  <circle cx="32" cy="20" r="2.5" fill="#4fa8ff" />
  <path
    d="M32 28 L32 44"
    stroke="#4fa8ff"
    stroke-width="3"
    stroke-linecap="round"
  />
  <!-- terminal dot at the base -->
  <circle cx="32" cy="47" r="1.5" fill="#18faf9" opacity="0.7" />
</svg>`,
  /** Alert: Success (alert-glyph): Green circle frame, verified check */
  ICON_AlertSuccess: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Alert: success — verified positive"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <circle cx="32" cy="32" r="18" stroke="#3dff9a" stroke-width="3" />
  <path
    d="M22 33 L29 40 L43 24"
    stroke="#3dff9a"
    stroke-width="4"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />
  <!-- confirmation node -->
  <circle cx="32" cy="32" r="1.5" fill="#3dff9a" opacity="0.7" />
</svg>`,
  /** Alert: Warning (alert-glyph): Acid-yellow triangle, glowing exclamation stroke, HUD ticks */
  ICON_AlertWarning: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Alert: warning — attention required"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- warning: the triangle with the acid edge -->
  <path
    d="M32 12 L54 50 L10 50 Z"
    stroke="#f3e600"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <path
    d="M32 24 L32 38"
    stroke="#f3e600"
    stroke-width="3"
    stroke-linecap="round"
    filter="url(#glow)"
  />
  <circle cx="32" cy="45" r="2" fill="#f3e600" />
  <!-- HUD tick accents -->
  <g stroke="#f3e600" stroke-width="1.5" opacity="0.5">
    <path d="M8 54 L14 54" />
    <path d="M50 54 L56 54" />
  </g>
</svg>`,
  /** Alert: Error (alert-glyph): Magenta octagon (hard stop), crossing circuit traces, terminal nodes */
  ICON_AlertError: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Alert: error — a failure, named"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- error: octagon frame (hard stop, not a soft circle) -->
  <polygon
    points="24,12 40,12 52,24 52,40 40,52 24,52 12,40 12,24"
    stroke="#ff2bd6"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <!-- the X: two crossing circuit traces -->
  <path
    d="M24 24 L40 40"
    stroke="#ff2bd6"
    stroke-width="3.5"
    stroke-linecap="round"
    filter="url(#glow)"
  />
  <path
    d="M40 24 L24 40"
    stroke="#ff2bd6"
    stroke-width="3.5"
    stroke-linecap="round"
    filter="url(#glow)"
  />
  <!-- terminal nodes at the X's ends -->
  <g fill="#ff2bd6" opacity="0.8">
    <circle cx="24" cy="24" r="1.5" />
    <circle cx="40" cy="24" r="1.5" />
    <circle cx="40" cy="40" r="1.5" />
    <circle cx="24" cy="40" r="1.5" />
  </g>
</svg>`,
  /** Toggle: On (toggle-glyph): Energized track, glowing node right, white-hot center */
  ICON_ToggleOn: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Toggle: on — enabled, energized"
>
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <!-- toggle track: energized -->
  <rect
    x="10"
    y="22"
    width="44"
    height="20"
    rx="10"
    stroke="#3dff9a"
    stroke-width="3"
  />
  <rect
    x="14"
    y="26"
    width="24"
    height="12"
    rx="6"
    fill="#3dff9a"
    opacity="0.4"
    filter="url(#glow)"
  />
  <!-- the on state: node to the right -->
  <circle cx="44" cy="32" r="7" fill="#3dff9a" filter="url(#glow)" />
  <circle cx="44" cy="32" r="3" fill="#ffffff" opacity="0.9" />
</svg>`,
  /** Toggle: Off (toggle-glyph): Dim track, hollow node left */
  ICON_ToggleOff: `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Toggle: off — disabled, dim"
>
  <rect
    x="10"
    y="22"
    width="44"
    height="20"
    rx="10"
    stroke="#4fa8ff"
    stroke-width="3"
    opacity="0.7"
  />
  <!-- the off state: node to the left, hollow -->
  <circle
    cx="20"
    cy="32"
    r="7"
    stroke="#4fa8ff"
    stroke-width="2.5"
    opacity="0.8"
  />
  <circle cx="20" cy="32" r="2" fill="#4fa8ff" opacity="0.6" />
  <!-- dim track -->
  <rect
    x="28"
    y="27"
    width="20"
    height="10"
    rx="5"
    fill="none"
    stroke="#4fa8ff"
    stroke-width="1"
    opacity="0.3"
  />
</svg>`,
} as const

export type SavantIconName = keyof typeof SAVANT_ICON_SVG

/** Manifest six-token palette (verbatim, single-truth emission). */
export const ICON_PALETTE = {
  cyan: '#18faf9',
  magenta: '#ff2bd6',
  blue: '#4fa8ff',
  white: '#ffffff',
  green: '#3dff9a',
  acid: '#f3e600',
} as const

/**
 * Render an inline family SVG sized by the host CSS (default 1em square).
 * Unknown names render empty — a cosmetic lookup never throws (Law 14).
 */
export function savantIconSvg(name: SavantIconName): string {
  const svg = SAVANT_ICON_SVG[name]
  if (typeof svg !== 'string' || !svg.startsWith('<svg')) return ''
  return svg
}
