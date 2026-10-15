# Build Order: Cyberpunk Brain View — Second Visualization Mode for Graph Export

**Date:** 2026-08-07
**Requested by:** Spencer
**Status:** Planning — research complete, FID pending
**Research doc:** `docs/design/Cyberpunk 3D Canvas Brain Render.md` (490 lines)

---

## Concept

Add a second visualization mode to the Code Universe graph export. Users can switch between:

| View | Metaphor | Best For |
|------|----------|----------|
| **Universe** (existing) | Cosmic/space | Hierarchical exploration, drill-down |
| **Brain** (new) | Neural network | Understanding connections and pathways |

The brain view maps codebase modules to neural regions and dependencies to synaptic connections. The 3D wireframe brain is rendered using pure canvas math (no WebGL, no Three.js) with cyberpunk neon aesthetics.

---

## Codebase-to-Brain Mapping

| Code Concept | Brain Metaphor | Visual |
|--------------|----------------|--------|
| Packages/modules | Brain regions (lobes) | Wireframe nodes |
| Dependencies | Synaptic connections | Neon edges |
| Call graphs | Neural pathways | Animated particles |
| Import depth | Signal strength | Edge thickness |
| Cluster ID | Lobe assignment | Color coding |

**Color mapping (generic path heuristics — works on ANY codebase):**

| Path Pattern | Lobe | Color | Hex |
|--------------|------|-------|-----|
| `src/components/`, `src/pages/`, `src/views/`, `ui/`, `frontend/` | Frontend | Cyan | #00FFFF |
| `src/api/`, `src/routes/`, `src/services/`, `server/`, `backend/` | Backend | Magenta | #FF00FF |
| `db/`, `migrations/`, `models/`, `schema/` | Database | Yellow | #FFFF00 |
| `test/`, `__tests__/`, `*.test.*`, `*.spec.*` | Testing | Lime | #00FF00 |
| `lib/`, `utils/`, `helpers/`, `common/` | Utilities | White | #FFFFFF |
| Everything else | Utilities | White | #FFFFFF |

**Classification rules:**
- Test suffix wins over path prefix (a test under `cli/` is Testing/lime, not Frontend/cyan)
- First-segment match on common directory conventions
- Fallback = Utilities/white (keeps 5-lobe story clean)
- **Generic — works on any project, not hardcoded to Savant Code**

---

## Architecture

### Data Flow
```
serializeGraphForExport() → brain-data.json → project(x,y,z) → canvas 2D
                                    ↓
                            68 regions (or N clusters)
                            edges with weights
                            MNI-style coordinates
```

### Key Components

1. **Brain Data Generator** — Maps codebase clusters to 3D coordinates
   - Input: Knowledge graph clusters + edges
   - Output: JSON with nodes (x,y,z, lobe, label) and edges (source, target, weight)
   - Coordinate system: Cluster center positions mapped to sphere surface

2. **3D Projection Engine** — Pure canvas math renderer
   - `project(x,y,z)` — Yaw/pitch rotation → perspective divide
   - Near-plane clipping (discard nodes behind camera)
   - Depth sorting (painter's algorithm)

3. **Cyberpunk Renderer** — Neon glow, wireframes, particles
   - `drawNode()` — Wireframe sphere with neon glow
   - `drawEdge()` — Neon line with depth attenuation
   - `drawParticles()` — Animated synaptic firings
   - CRT scanline overlay (optional)

4. **Camera Controls** — Interactive exploration
   - Pointer-lock mouse look (yaw/pitch)
   - WASD spatial movement
   - Wheel-to-zoom
   - Click node → show details sidebar

5. **View Selector UI** — Tab-based switching
   - `[Universe] [Brain]` tabs in header
   - Smooth transition animation between views
   - Shared sidebar (node details work in both views)

---

## Implementation Phases

### Phase 1: Brain Data Generator
- Map codebase clusters to 3D coordinates (sphere distribution)
- Assign lobe colors based on cluster type
- Generate edges from dependency graph
- Output: `brain-data.json` embedded in HTML

### Phase 2: 3D Projection Engine
- Implement `project(x,y,z)` with yaw/pitch rotation
- Add perspective divide with FOV scaling
- Implement near-plane clipping
- Add depth sorting (painter's algorithm)

### Phase 3: Cyberpunk Renderer
- Implement `drawNode()` with neon glow
- Implement `drawEdge()` with depth attenuation
- Add particle system for synaptic firings
- Add CRT scanline overlay

### Phase 4: Camera Controls
- Pointer-lock mouse look
- WASD movement
- Wheel-to-zoom
- Click selection (ray-sphere intersection)

### Phase 5: View Selector UI
- Add tab buttons to header
- Implement view switching logic
- Add transition animation
- Share sidebar between views

---

## Technical Reference

**Research doc:** `docs/design/Cyberpunk 3D Canvas Brain Render.md`

Key formulas from the research:
- **Projection:** `screen_x = (x * cos(yaw) - z * sin(yaw)) * fov / z + cx`
- **Rotation:** Standard 2D rotation matrices for yaw/pitch
- **Clipping:** Discard nodes where `z < near_plane`
- **Selection:** Ray-sphere intersection quadratic equation

**Data format:** Desikan-Killiany atlas (68 regions) adapted for codebase clusters

---

## Constraints

- Single HTML file (no external dependencies)
- Canvas 2D only (no WebGL, no Three.js)
- Must work offline (no CDN)
- Must share data format with Universe view
- Must be interactive (rotate, zoom, click)
- Cyberpunk aesthetic (neon, wireframe, dark background)
- Target: 60fps with 500-1000 nodes

---

## Success Criteria

- Brain view renders 500+ nodes at 60fps
- Camera controls are smooth (pointer-lock, WASD, zoom)
- Clicking a node shows details in sidebar
- View selector switches between Universe and Brain
- Cyberpunk aesthetic is consistent with Code Universe
- Single HTML file, zero dependencies, offline-first

---

*Build order written 2026-08-07 by Nova.*
