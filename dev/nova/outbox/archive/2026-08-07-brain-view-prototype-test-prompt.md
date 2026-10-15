# Brain View Prototype Test Prompt

**Purpose:** Test the cyberpunk brain visualization concept with different models before building the full feature.

---

## Prompt

Build a single self-contained HTML file that renders a 3D wireframe brain visualization with cyberpunk neon aesthetics. The brain should have:

1. **68 nodes** representing brain regions (use the Desikan-Killiany atlas MNI coordinates)
2. **Edges** connecting regions (synaptic connections)
3. **5 lobe colors:** Frontal=Cyan, Parietal=Magenta, Temporal=Yellow, Occipital=Green, Insular=White
4. **Cyberpunk aesthetic:** Dark background, neon glow on edges, wireframe style
5. **Interactivity:** Mouse drag to rotate, wheel to zoom, click node to highlight
6. **Single HTML file** — zero dependencies, no WebGL, no Three.js, pure canvas 2D

The 3D projection should use one math function: `project(x,y,z)` with yaw/pitch camera rotation and perspective divide. Use painter's algorithm for depth sorting.

---

## Test Across Models

| Model | Use For |
|-------|---------|
| **GLM 5.2** | Visual quality (when available) |
| **GPT-5.6 Luna** | Code generation |
| **DeepSeek V4 Flash** | Balanced |
| **MiniMax M3** | Visual alternative |

---

## Success Criteria

- Brain renders with 68 nodes and edges
- 5 lobe colors are distinct and readable
- Neon glow effect is visible
- Rotation and zoom work smoothly
- Single HTML file, zero dependencies
- Loads in < 2 seconds

---

*Test prompt written 2026-08-07 by Nova.*
