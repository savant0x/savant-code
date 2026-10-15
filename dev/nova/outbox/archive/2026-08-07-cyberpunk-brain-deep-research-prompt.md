# Deep Research Prompt: Cyberpunk Brain Visualization

**Purpose:** Research how to build a cyberpunk-themed 3D brain visualization with neon colors, wireframe aesthetics, and interactive exploration — using pure canvas math (no WebGL, no Three.js).

---

## Research Context

**Goal:** Build a self-contained HTML file (single file, zero dependencies) that renders a 3D wireframe brain with cyberpunk neon aesthetics. The brain should be interactive — users can rotate, zoom, and explore different regions.

**Reference implementation:** Stratus built a custom 3D renderer in `echo.html` (394KB, zero deps) using:
- One math function: `project(x,y,z)` — yaw/pitch camera rotation → perspective divide
- Wireframe buildings from data records
- Painter's algorithm for depth sorting
- Pointer-lock camera controls (mouse look, WASD, wheel-to-zoom)
- Canvas 2D context (no WebGL)

**Design direction:** Cyberpunk theme — dark background, neon colors (cyan, magenta, yellow), wireframe aesthetics, glowing edges, particle effects.

---

## Research Questions

### 1. 3D Math for Brain Visualization
- How to project 3D brain coordinates to 2D canvas?
- How to implement yaw/pitch camera rotation?
- How to handle perspective divide (scale = camera.zoom / depth)?
- How to implement depth sorting (painter's algorithm)?

### 2. Brain Data Structure
- What data format represents a brain? (nodes, regions, connections)
- How to map brain regions to 3D coordinates?
- How to define connections between regions (synapses, pathways)?
- What's a good source for brain region data? (Allen Brain Atlas, FreeSurfer)

### 3. Cyberpunk Aesthetics
- How to create neon glow effects on canvas?
- How to render wireframe with glowing edges?
- How to add particle effects (floating dots, energy streams)?
- How to create scanline/CRT effects?
- What color palette works for cyberpunk? (cyan #00ffff, magenta #ff00ff, yellow #ffff00)

### 4. Interactivity
- How to implement pointer-lock camera controls?
- How to handle click selection on 3D nodes?
- How to show node details on hover/click?
- How to animate transitions between brain regions?

### 5. Performance
- How to render 1000+ nodes at 60fps on canvas?
- How to optimize wireframe rendering?
- How to use offscreen canvas for layering?
- How to batch draw calls?

### 6. Existing Implementations
- What open-source brain visualization tools exist?
- How does Three.js Brain (neuroglancer) work?
- How does BrainBrowser ( Montreal Neurological Institute) work?
- What can we learn from their data formats?

---

## Output Format

Please provide:

1. **3D Math Primer** — The exact formulas for projection, rotation, and perspective
2. **Brain Data Format** — JSON schema for nodes, regions, and connections
3. **Cyberpunk Rendering Techniques** — Canvas tricks for neon glow, wireframes, particles
4. **Camera Controls Implementation** — Pointer-lock, mouse look, WASD movement
5. **Performance Optimizations** — Batch rendering, offscreen canvas, depth sorting
6. **Open Source References** — Links to brain visualization repos we can study
7. **Implementation Sketch** — Pseudocode for the core renderer

---

## Constraints

- Single HTML file (no external dependencies)
- Canvas 2D only (no WebGL, no Three.js)
- Must run offline (no CDN)
- Must be interactive (rotate, zoom, click)
- Cyberpunk aesthetic (neon, wireframe, dark background)
- Target: 60fps with 500-1000 nodes

---

*Research prompt written 2026-08-07 by Nova.*
