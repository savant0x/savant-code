# **Architectural Redesign for Spatial Codebase Knowledge Graphs**

## **Executive Diagnosis of Current Visual Failures**

The visualization of highly connected relational data presents a fundamental tension between structural legibility and granular detail. As graph size and density increase, visual readability rapidly diminishes, frequently resulting in an overcrowded, incomprehensible mass colloquially known as a "hairball"1. The current codebase export implementation successfully avoids this hairball effect but fails entirely in the opposite direction. It produces a sparse, disconnected scatter plot of nodes that lacks topological meaning, rendering it ineffective as a knowledge graph.  
The root cause of this failure is a cascading breakdown between the rendering engine, the layout algorithm, and an incomplete data model. Specifically, the interplay between Cytoscape.js compound nodes, the export-time Eclipse Layout Kernel (ELK) algorithm, and the absence of an aggregate relationship schema creates the observed "two rows of circles" phenomenon. In the existing export, directories are modeled as Cytoscape compound nodes, with individual file nodes nested as children. Because the system attempts to manage a scale of approximately 2,000 nodes and 8,000 edges without overwhelming the browser's rendering thread, it collapses these directory containers by default.  
However, Cytoscape compound nodes are inherently unsuited for hierarchical force-directed layouts. A compound parent node does not possess its own discrete spatial position or size; rather, its dimensions are implicitly derived from the bounding boxes of its children2. When the children are hidden to reduce visual clutter, the exact file-to-file edges that cross between different directories are subsequently hidden. The underlying data model currently lacks aggregate region-to-region edges to represent these hidden connections. Consequently, the ELK layout algorithm—which operates synchronously during the export phase—processes a graph consisting solely of isolated parent containers and a handful of root files (such as .env.example or bunfig.toml) that possess zero visible edges.  
The ELK algorithm is optimized for directed acyclic graphs (DAGs) and port-based hierarchical diagrams, such as UML models or circuit board schematics. When ELK attempts to process a highly cyclical software architecture graph where all connective exact edges have been stripped away by compound collapsing, the algorithm detects no gravitational or spring forces to resolve. Lacking any connective tissue to pull related components into cohesive clusters, ELK defaults to spacing these disconnected components uniformly on a two-dimensional grid. This programmatic fallback is precisely what generates the massive empty spacing and the disconnected rows of objects.  
Furthermore, Cytoscape.js is primarily a Canvas-based rendering engine that executes within a single synchronous JavaScript thread. While it is highly extensible and supports a broad array of graph theory algorithms, it struggles with the rendering overhead required for highly styled, dynamic graphs containing thousands of translucent elements3. Browsers limit the performance of Canvas repaints, and because JavaScript's implementation of parallelism (Web Workers) introduces severe serialization overhead, running iterative physics layouts in the browser blocks the main UI thread3. To maintain basic interaction performance, the current implementation aggressively hides elements, inadvertently stripping the graph of the very relationships that define a spatial knowledge graph. The result is a topological map that conveys no topology, no clustering, no sense of depth, and no community structure1.

## **Comparative Analysis of Rendering Architectures**

To realize the product vision of an explorable, spatial information universe, the rendering architecture must simultaneously support high-performance graphics, semantic zoom, and multi-scale visual analytics6. The system must handle approximately 10,000 discrete elements (2,000 files and 8,000 edges) without dropping below 60 frames per second during panning and zooming. Three architectural paradigms present viable paths forward for generating a single, self-contained offline HTML artifact.

### **Architecture A: Enhanced Canvas Rendering via Cytoscape.js**

This approach retains the existing Cytoscape.js library (accessible at https://js.cytoscape.org/) but fundamentally alters the underlying data model and layout strategy8. Cytoscape.js is capable of rendering thousands of graph elements on average hardware, provided the visual styles remain rudimentary and rendering loops are carefully managed4.  
Under this architecture, compound nodes are entirely abandoned, as they are actively hostile to hierarchical force-directed layouts and restrict the natural organic clustering of code communities2. Instead, the exporter computes flat spatial coordinates for all file nodes. Regions are no longer structural DOM or Canvas parents; they are indicated merely through underlaid polygons (visual hulls) drawn on the canvas background beneath the file nodes.  
The primary advantage of this approach is continuity. It requires no new library dependencies, and Cytoscape provides shortest-path algorithms, search utilities, and event bindings out of the box4. However, the disadvantages are severe. Cytoscape is fundamentally limited by HTML5 Canvas performance when dealing with high-fidelity visual effects. Implementing a smooth "space exploration" aesthetic with node glows, alpha-blended edge corridors, and anti-aliasing for 8,000 visible edges requires pixel-level manipulation that CPU-bound Canvas operations cannot sustain3. Interaction will suffer from micro-stutters, and the visual result will remain schematic rather than immersive.

### **Architecture B: Custom Canvas Rendering with D3 Force Simulation**

Inspired by structural codebase analysis tools like Emerge (accessible at https://github.com/glato/emerge), this architecture leverages D3's robust mathematical force-directed simulation combined with a highly customized HTML Canvas rendering loop5.  
The exporter runs a continuous force simulation utilizing the Louvain modularity algorithm to detect communities and cluster them tightly based on dependency weight. The frontend renders these clusters using custom HTML Canvas routines, dynamically drawing concave hulls around specific modules to isolate communities5. This provides absolute programmatic control over every pixel, enabling highly optimized, deterministic rendering. The ability to fade irrelevant nodes and highlight active dependency paths is implemented directly at the rendering-loop level, ensuring that the visual hierarchy remains distinct5.  
Despite the mathematical rigor, rebuilding the entire interaction layer from scratch introduces immense engineering overhead. Constructing zoom behaviors, bounding box calculations, pan-and-drag event listeners, and shortest-path hover interactions requires replicating years of open-source development. Furthermore, while a custom Canvas loop is faster than Cytoscape's generalized wrapper, it still ultimately relies on the CPU for rendering complex overlapping geometries, which limits the potential for ambient spatial styling.

### **Architecture C: WebGL Acceleration via Sigma.js and Graphology**

Sigma.js (accessible at https://www.sigmajs.org/) is explicitly engineered for rendering networks of thousands of nodes and edges in the browser at a locked 60 frames per second by leveraging WebGL10. It operates in a strict, symbiotic architectural pattern with Graphology, a multipurpose algorithmic library that manages the underlying graph data structures10.  
In this paradigm, the Bun/TypeScript CLI exporter utilizes Graphology in a headless Node environment to execute heavy computational tasks prior to export. Graphology computes network metrics such as degree and betweenness centrality, and executes intensive layout algorithms like ForceAtlas210. The resulting pre-calculated JSON payload is embedded directly into the standalone HTML file. The frontend then utilizes Sigma.js to render the graph using WebGL shaders. This native hardware acceleration delegates the rendering of custom visual effects—such as node halos, translucent edge corridors, and parallax backgrounds—directly to the GPU10.  
The advantages of this architecture align perfectly with the product goals. WebGL easily processes 10,000+ elements using custom vertex and fragment shaders without frame drops, allowing for deep spatial immersion10. The strict separation of concerns, where Graphology handles the mathematical topology and Sigma.js handles the visual presentation, vastly simplifies frontend state management10. The primary disadvantage is the steeper learning curve associated with writing GLSL shaders for custom node and edge styling, as opposed to standard CSS or Canvas configuration objects.

### **Recommended Architectural Paradigm**

The recommended architecture is the WebGL-accelerated pipeline utilizing **Sigma.js and Graphology**.  
The justification for a complete renderer migration rests on the strict performance criteria dictated by the product goal. The product demands a "spatial visual language" featuring node glows, ambient depth, fluid edge corridors, and the progressive reveal of up to 8,000 exact file-to-file edges. CPU-bound Canvas renderers like Cytoscape.js inherently struggle with the continuous repainting of thousands of overlapping translucent elements3. WebGL moves this rendering payload entirely to the GPU, ensuring that semantic zooming from architecture-level regions down into file-level details remains flawlessly smooth, maintaining the required immersive space exploration aesthetic10.  
Furthermore, Graphology provides native, highly optimized support for community detection algorithms (such as Louvain) and robust force-directed layouts (such as ForceAtlas2) that can be executed deterministically during the export phase10. This fulfills the core technical constraint of avoiding synchronous physics simulations in the browser while guaranteeing that the graph reflects genuine codebase topology rather than arbitrary directory trees. Cytoscape's current approach—relying on DOM-heavy wrappers and implicit compound nodes that actively restrict layout engines—is fundamentally incompatible with the fluid, multi-scale community visualization required for massive graph data1. Sigma.js provides the raw rendering throughput required, while Graphology provides the rigorous mathematical backing.

## **The Multi-Scale Spatial Data Model**

To support seamless semantic zoom without actively mutating thousands of DOM elements—a process that triggers expensive browser reflows—the data model must pre-calculate all spatial coordinates, Level of Detail (LOD) visibility thresholds, and hierarchical relationships during the export phase. The graph must be serialized into the HTML document as a flat, highly enriched array of nodes and edges, entirely eliminating nested JSON structures that induce recursive parsing overhead.  
The information architecture utilizes a tri-modal scale: Macro (Regions), Meso (Boundaries), and Micro (Files).

### **Regional Macro-Nodes**

Regions are not configured as compound container nodes. They are standard, discrete nodes positioned at the calculated barycenter of their constituent files. They serve as the highest-level architectural landmarks in the space.

| Property | Data Type | Description |
| :---- | :---- | :---- |
| id | String | A deterministic SHA-256 hash of the absolute directory path to prevent XSS injection from hostile file paths. |
| type | String | Hardcoded as "region". |
| label | String | The sanitized directory path. |
| x, y | Float | The fixed spatial coordinates calculated by the export layout algorithm. |
| size | Float | Proportional to the total count of file nodes logically contained within the directory. |
| color | String (Hex) | Derived from the dominant Louvain community present within the region5. |
| lod\_visibility | Object | { min: 0, max: 1.5 } dictating that the region node fades out when the camera zooms past 1.5x. |

### **File Micro-Nodes**

File nodes hold explicit, exact coordinates. These coordinates are constrained geometrically within the bounds of their parent region's pre-allocated spatial territory.

| Property | Data Type | Description |
| :---- | :---- | :---- |
| id | String | A deterministic SHA-256 hash of the absolute file path. |
| type | String | Hardcoded as "file". |
| parent\_region\_id | String | A reference to the parent directory's hash. |
| label | String | The basename of the file (e.g., template.ts). |
| full\_path | String | The complete repository-relative path, utilized by the sidebar and search index. |
| x, y | Float | The fixed spatial coordinates. |
| size | Float | Mapped logarithmically to the node's In-Degree (number of incoming dependencies). |
| centrality | Float | The Betweenness Centrality score, which controls the intensity of the WebGL glow shader11. |
| community\_id | Integer | The distinct Louvain community identifier5. |
| lod\_visibility | Object | { min: 1.2, max: Infinity } dictating that the file node fades in as the camera zooms past 1.2x. |

### **Exact and Aggregate Edge Schemas**

The visualization of edges must scale with the camera. At the Macro level, showing 8,000 exact file-to-file edges produces an unreadable hairball1. Therefore, the exporter must construct deterministic aggregate edges between regions. To solve the "disconnected rows" problem, these aggregate edges act as structural corridors that pull regions together during layout and provide visual flow for the user.  
To guarantee that the visual representation of the graph accurately reflects the underlying structural dependency mass, the data model enforces a strict mathematical conservation of edges. Let ![][image1] be the set of all files, and ![][image2] be the set of regions. An exact edge ![][image3] spanning from a source file to a target file has a parsed AST weight of ![][image4]. For any two distinct regions ![][image5] and ![][image6], the aggregate edge weight ![][image7] is formulated as:  
![][image8]  
This formulation ensures that the macro-scale visual corridors accurately represent the true dependency volume of the underlying micro-scale exact edges. If fifty files in src/api import thirty files in src/db, the single aggregate edge connecting the API region to the DB region will possess a structural weight of 80, dictating both its gravitational pull during layout and its visual thickness on the canvas.

| Schema Type | Connection Level | Properties | LOD Visibility |
| :---- | :---- | :---- | :---- |
| **Exact Edge** | File ![][image9] File | source (hash), target (hash), weight (AST count) | { min: 1.8, max: Infinity } |
| **Aggregate Edge** | Region ![][image9] Region | source (hash), target (hash), weight (Summed weight) | { min: 0, max: 1.5 } |
| **Boundary Stub** | File ![][image9] Region | source (file hash), target (region hash), weight | { min: 1.2, max: 1.8 } |

Boundary stubs are a crucial topological bridge designed specifically for the Meso scale. When semantic zoom reveals individual files in Region A, but Region B remains visually collapsed as a macro-node, an exact edge connecting a file in Region A to a file in Region B cannot be rendered because the target file in Region B has no active screen presence. To maintain context, a boundary stub is rendered connecting the visible file in Region A directly to the centroid of Region B.

### **Root Files and Disconnected Components**

Root files (such as package.json, tsconfig.json, or .env) lack a standard directory grouping that scales cleanly with the rest of the architecture. The data model resolves this by assigning all root-level files to a deterministic, virtual //ROOT macro region.  
Disconnected components—clusters of code or solitary files that share zero edges with the primary dependency graph—pose a layout risk. Standard force-directed algorithms will push disconnected islands infinitely outward due to repulsion forces lacking any counteracting spring forces. To resolve this, disconnected components are flagged during export and anchored to a peripheral, low-gravity orbit surrounding the primary graph. This keeps them accessible within the spatial universe without allowing them to drift into deep space, keeping them distinct from the core dependency topology.

## **Deterministic Export-Time Layout Algorithm**

Executing a force-directed simulation on 10,000 discrete elements within a synchronous browser thread causes catastrophic UI blocking, as the JavaScript engine attempts to resolve thousands of physics vectors per tick3. Therefore, all spatial coordinates (x, y) must be deterministically calculated by the Bun/TypeScript CLI during the offline export phase, embedding the static geometry directly into the HTML payload.  
To achieve a clustered, multi-scale layout reminiscent of geographical maps1, the layout strategy replaces the rigid, tree-based ELK kernel with a Hierarchical Force-Directed algorithm driven by Graphology.

### **Phase 1: Metric Extraction and Modularity**

The Bun CLI parses the codebase Abstract Syntax Tree (AST) to map exact file dependencies. Once the raw nodes and edges are populated in a headless Graphology instance, foundational metrics are calculated10. Source Lines of Code (SLOC), In-Degree, Out-Degree, and Betweenness Centrality are computed and attached to the file nodes5. Centrality is particularly important, as its time complexity is ![][image10], making it entirely unfeasible to calculate in the browser on a 2,000-node graph in real-time11.  
Subsequently, the Louvain modularity algorithm is executed to detect dense organic communities5. While directories provide explicit geographic boundaries, codebases often possess implicit semantic communities that transcend rigid folder structures. The Louvain community IDs are preserved in the data model to influence internal placement and coloring.

### **Phase 2: Macro-Layout (Region Geography)**

The physical layout is computed in two distinct passes to prevent collision when semantic zoom is applied later in the browser. In the first pass, directories define the primary physical regions.  
Because coordinates are static, expanding a region to show its internal files in the browser must not push adjacent regions away, as this would require a real-time force simulation on the client. To solve this, expanded regions must avoid colliding with adjacent regions by being pre-allocated sufficient spatial area during the export layout phase.  
The CLI calculates the projected convex hull area required for each directory based on its file count. A ForceAtlas2 simulation (developed natively for Gephi and integrated into Graphology) is then executed exclusively on the Region Macro Nodes10.

* **Repulsion:** Regions strongly repel each other, with their collision radii set to their maximum projected convex hull size.  
* **Attraction:** The computed Aggregate Edges act as heavy springs, pulling strongly coupled regions tightly together, creating logical neighborhoods11.  
* **Resolution:** The algorithm iterates until the kinetic energy of the system stabilizes, fixing the geographical barycenters of all major codebase domains.

### **Phase 3: Micro-Layout (Community-Influenced Internal Placement)**

Once the macro regions have fixed coordinates, a secondary, constrained ForceAtlas2 simulation is executed for the file nodes *within* the boundary of each region.  
Geography (the directory) dictates the absolute bounding box. However, within that bounding box, files are influenced by their Louvain community assignments5. If a file residing in src/utils belongs to a dependency community centered heavily in src/auth, that specific utility file will physically migrate during the simulation to the edge of the utils bounding box closest to the auth region. This elegantly harmonizes the rigid, developer-defined directory structure with the organic, emergent dependency structure.  
During the final layout ticks, the Barnes-Hut approximation is enabled to enforce strict node padding, ensuring that file nodes never visually overlap, allowing text labels to remain legible11.

## **Semantic Zoom and WebGL State Machine**

The user experience must seamlessly transition from architectural overviews to file-level details. This multi-scale interaction requires a robust state machine governed by the camera's zoom level.  
To prevent dropping frames, the state machine never actively adds or removes DOM elements or WebGL vertices. All 10,000 elements are loaded into the GPU buffers upon initial render. The semantic zoom is achieved by passing the camera zoom level (![][image11]) as a uniform variable to the WebGL vertex and fragment shaders. The shaders compare ![][image11] against each element's pre-calculated lod\_visibility threshold. If the element falls outside the threshold, the shader drops its alpha channel to zero, effectively culling it from the render pipeline with zero CPU overhead.

### **The Spatial State Hysteresis Loop**

A common usability failure in LOD systems occurs when a user hovers precisely at a zoom threshold, causing thousands of elements to flicker rapidly between visible and hidden states. To prevent this, strict hysteresis loops are implemented in the camera logic.

| Logical State | Camera Scale (Z) | Rendered Elements | Primary User Interaction |
| :---- | :---- | :---- | :---- |
| **Macro** | **![][image12]** | Regions, Aggregate Edges | Panning the global architecture, identifying core domains. |
| **Meso** | **![][image13]** | Regions, Files (in focus), Boundary Stubs | Drilling into specific subsystems, isolating region connectivity. |
| **Micro** | **![][image14]** | Files, Exact Edges, Basename Labels | Tracing exact execution paths, reading granular file dependencies. |

The hysteresis buffer dictates that if a user zooms in past ![][image15], the system transitions to the Meso state. To revert back to the Macro state, the user must zoom out significantly past ![][image16]. This ![][image17] delta acts as a mathematical dead-zone, preventing jarring visual transitions.

## **Visual-Design Specification: The Code Universe**

To fulfill the product directive that the interface should feel like exploring space—rather than inspecting a rigid schematic—the visual language employs ambient lighting, depth cues, and organic boundaries, executed via WebGL fragment shaders10.

### **Background and Ambient Depth**

The Canvas clear color is set to a deep space dark (\#0A0D14). To provide an intuitive sense of scale, parallax background elements (subtle, low-opacity geometric points resembling distant stars) are implemented via a secondary WebGL background layer. These points translate at a fractional rate (0.5x) relative to the primary camera translation, creating a profound sense of Z-axis depth without cluttering the informational data layer12.

### **Node Rendering and Information Hierarchy**

* **Region Macro Nodes:** Rendered as massive, diffuse, low-opacity circular fields with a bright, solid core. Upon zooming past the Macro threshold, the solid core fades out, and the outer boundary transitions into a subtle visual hull encapsulating the micro-files5.  
* **File Micro Nodes:** Rendered as sharp, solid circles.  
* **Glow and Importance:** The base size of a file node scales linearly with its In-Degree (the number of internal modules relying upon it). The *glow* of the node—generated by a custom WebGL fragment shader computing radial gradients—maps directly to its Betweenness Centrality11. This dual-encoding ensures that critical hub files, which act as architectural bottlenecks or foundational utilities, shine prominently like stars, intuitively drawing the user's analytical focus.

### **Edge Flow and Motion**

* **Macro Aggregate Edges:** Rendered as thick "corridors." These are highly transparent, additive-blended Bezier curves. The physical width of the corridor is logarithmically proportional to the aggregate structural weight of the underlying exact edges.  
* **Micro Exact Edges:** Rendered as thin, solid lines with subtle gradient flows indicating directionality (source file to target file).  
* **Motion Restraint:** Particle flows or animated pulses along 8,000 edges are computationally catastrophic and visually overwhelming. Motion is strictly limited to user interaction. Hovering over a specific file node triggers a high-speed particle trace along its shortest path to the repository root, temporarily dimming all unrelated nodes in the universe. No decorative animation is permitted.

### **Identity, Typography, and Disambiguation**

A persistent usability flaw in codebase visualization occurs when files with identical basenames (e.g., template.ts, index.js, utils.ts) are rendered out of context.  
At the Micro scale, the WebGL text renderer displays the file's basename directly adjacent to the node. If collision-detection metrics allow space, the immediate parent directory is displayed directly above it in a muted, smaller typeface.  
When a node is selected, the HTML DOM Sidebar UI takes over to provide full identity. The sidebar dynamically renders the complete repository-relative path utilizing a distinct visual wrapping technique. The path is broken dynamically on slashes (/), displaying as a stepped, easily copyable breadcrumb trail.  
Furthermore, the search index interface strictly disambiguates same-named files. Search results utilize a CSS Flexbox layout where the matching basename is boldly highlighted on the left, and the parent directory path is right-aligned and muted, connected by a subtle leader dotline (e.g., template.ts ............ src/commands/graph-export).

## **Performance Budgets and Acceptance Criteria**

WebGL provides massive rendering headroom, but strict performance budgets must be algorithmically enforced to guarantee that the export remains a universally distributable, offline HTML file capable of executing on standard consumer hardware.

| Performance Metric | Target Threshold | Hard Constraint | Rationale |
| :---- | :---- | :---- | :---- |
| **Max File Count** | 2,500 Nodes | 5,000 Nodes | Codebases exceeding 5k files require complex server-side image tiling, violating the offline single-file constraint13. |
| **Max Edge Count** | 10,000 Edges | 25,000 Edges | Vertex buffer limits on mid-tier integrated graphics hardware. |
| **HTML Payload Size** | \< 3 MB | \< 5 MB | Fast offline loading from the local file:// protocol without memory allocation errors. |
| **Layout Compute Time** | \< 10 Seconds | \< 30 Seconds | Exporting via the CLI should not become a bottleneck in automated CI/CD pipeline runs. |
| **Interaction Frame Rate** | 60 FPS | 45 FPS | Absolutely essential for maintaining the fluid "exploration" user experience10. |
| **Time to First Render** | \< 1.0 Second | \< 2.5 Seconds | Main thread blocking script execution must be strictly minimized during initialization. |

## **Comprehensive Edge-Case Testing Strategy**

The knowledge graph architecture must gracefully handle the extreme topological anomalies that frequently characterize real-world, legacy codebases. The following testing protocols must be integrated into the Bun CLI's test suite:

> 1. **Empty and Disconnected Graphs:**  
   * *Scenario:* Initialize the exporter against a repository consisting of isolated scripts with zero cross-file imports.  
   * *Validation:* The ForceAtlas2 layout must not throw division-by-zero errors. The layout must cleanly organize the disconnected islands into a peripheral ring or grid structure11.  
> 2. **Dense Hubs (The Big Ball of Mud):**  
   * *Scenario:* A monolithic repository where a central utils.ts or types.ts file is imported by 1,900 other files simultaneously.  
   * *Validation:* The force simulation must not collapse the entire graph into an overlapping singularity5. The central hub node must display maximum shader glow (centrality), and the layout engine must successfully route aggregate edge corridors around the core without suffocating the visual space.  
> 3. **Aggregate-Edge Mathematical Conservation:**  
   * *Scenario:* Traverse the final JSON payload generated by Graphology.  
   * *Validation:* Assert computationally that the sum of all Exact Edges precisely equals the sum of all Aggregate Edges across all possible region pairs.  
> 4. **Hostile Paths and Labels:**  
   * *Scenario:* Codebases containing files named ../../../etc/passwd or possessing embedded XSS vectors like \<script\>alert(1)\</script\>.ts.  
   * *Validation:* All internal IDs must be verified as secure SHA-256 hashes of the original path. Labels must be strictly sanitized before being injected into WebGL texture buffers, ensuring they are never evaluated as raw DOM innerHTML.  
> 5. **Multi-Scale Hysteresis Thrashing:**  
   * *Scenario:* A user rapidly zooms in and out directly across the ![][image15] threshold using a continuous trackpad scroll.  
   * *Validation:* The hysteresis dead-zone must mathematically prevent the WebGL buffers from thrashing. No visual flickering or rapid alpha-channel popping should occur.

## **Phased Implementation Plan and Scope Definition**

To systematically mitigate risk, the migration should be executed across four distinct engineering phases.

* **Phase 1: CLI and Topological Data Model (Weeks 1-2)**  
  * Deprecate the ELK layout kernel. Integrate Graphology into the headless Bun exporter10.  
  * Implement the Louvain community detection and the dual-pass ForceAtlas2 layout algorithms5.  
  * Construct the tri-modal data model (Macro/Meso/Micro) and programmatically calculate Aggregate Edges to enforce structural weight conservation.  
* **Phase 2: WebGL Renderer Migration (Weeks 3-4)**  
  * Scaffold the offline HTML template utilizing Sigma.js v310.  
  * Write the custom WebGL vertex and fragment shaders required for mapping centrality to node glows, and structural weight to edge corridors.  
  * Map the static Graphology JSON payload to the Sigma.js rendering buffers.  
* **Phase 3: Semantic Zoom and State Interaction (Weeks 5-6)**  
  * Implement the camera state machine, binding the zoom level ![][image11] to the shader uniform variables to enforce the LOD thresholds and hysteresis rules.  
  * Build the mathematical interpolation logic for rendering Meso-scale Boundary Stubs.  
  * Develop the HTML DOM Sidebar UI, engineering the full-path breadcrumb wrapping and flexbox search disambiguation logic.  
* **Phase 4: Optimization, Physics Tuning, and Polish (Week 7\)**  
  * Tune the ForceAtlas2 parameters (gravity, scaling ratio, and Barnes-Hut thresholds) against diverse benchmark codebases to eliminate node overlaps11.  
  * Audit the WebGL pipeline for memory leaks and ensure the browser's garbage collector operates cleanly during prolonged exploration sessions.

### **Out of Scope Definition**

To protect the performance budget and ensure a successful primary implementation, several features must explicitly remain out of scope for the V1 release:

> 1. **AST-Level Granularity:** Displaying discrete functions, classes, and variable-level edges within the spatial map is out of scope. The terminal, atomic unit of this graph is strictly the File.  
> 2. **Live Editing and Hot Reloading:** The HTML export is designed as a static, offline analytical snapshot. Real-time graph mutations driven by live IDE typing or filesystem watchers are excluded, as they require dynamic layout recalculation which violates the static WebGL buffer architecture.

## **Strategic Risks and Rejected Alternatives**

### **Identified Risks**

The primary engineering risk revolves around **WebGL Context Loss**. If the user minimizes the browser window, or the operating system reclaims GPU memory for another application, the WebGL context may be lost. While Sigma.js is engineered to handle context loss gracefully, the state recovery logic (restoring the camera position, active search selections, and LOD states) must be explicitly tested and hardened10.  
A secondary risk is **Force-Directed Determinism**. Layout algorithms like ForceAtlas2 often rely on random seed initialization to position nodes before physics iterations begin. If left unconfigured, re-exporting the exact same codebase twice will yield two completely different visual maps. The Bun CLI must inject a static cryptographic seed (e.g., a hash of the repository name) into the Graphology layout engine to guarantee deterministic, reproducible coordinates across multiple exports.

### **Rejected Alternatives**

* **Synchronous Browser Layouts (COSE / Browser-side ForceAtlas2):** The option of generating a flat list of nodes and relying on the browser to run a force layout simulation upon opening the HTML file is explicitly rejected. Due to the lack of efficient multi-threading, calculating thousands of force vectors synchronously causes massive UI locking, degrading the user experience before it even begins3.  
* **Cytoscape.js with cy.expandCollapse:** The existing Cytoscape extension designed for collapsing containers relies on dynamic DOM manipulation and compound bounding boxes. This approach fundamentally destroys pre-calculated physics layouts, as expanding nodes pushes the entire graph outward dynamically in real-time, creating messy, overlapping collisions2.  
* **Server-Side Tile Generation:** Uncharted Software relies heavily on distributed cluster computing and hierarchical image tiles (similar to Google Maps) to manage massive graph datasets1. While this is the industry standard for graphs exceeding one million nodes, it is explicitly rejected here because the technical constraints dictate a self-contained, offline HTML file opened via the file:// protocol, which prohibits fetching external image tiles from a server. The WebGL shader LOD approach adequately provides a multi-scale experience for 10,000 elements without requiring a backend server.

*This is for informational purposes only. For medical advice or diagnosis, consult a professional.*

#### **Works cited**

> 1. Multi-Scale Community Visualization of Massive Graph Data \- Uncharted, [https://uncharted.software/assets/multi-scale-community-visualization.pdf](https://uncharted.software/assets/multi-scale-community-visualization.pdf)  
> 2. Compound nodes layout issues \- cytoscape js \- Stack Overflow, [https://stackoverflow.com/questions/40776940/compound-nodes-layout-issues-cytoscape-js](https://stackoverflow.com/questions/40776940/compound-nodes-layout-issues-cytoscape-js)  
> 3. Performance and layouts of Cytoscape.js \- Stack Overflow, [https://stackoverflow.com/questions/50344455/performance-and-layouts-of-cytoscape-js](https://stackoverflow.com/questions/50344455/performance-and-layouts-of-cytoscape-js)  
> 4. Cytoscape.js: a graph theory library for visualisation and analysis \- Oxford Academic, [https://academic.oup.com/bioinformatics/article/32/2/309/1744007](https://academic.oup.com/bioinformatics/article/32/2/309/1744007)  
> 5. [https://github.com/glato/emerge](https://github.com/glato/emerge)  
> 6. Graphs | Uncharted®, [https://uncharted.software/research/graphs/](https://uncharted.software/research/graphs/)  
> 7. Graph Mapping: Multi-Scale Community Visualization of Massive Graph Data | Uncharted®, [https://uncharted.software/research/graph-mapping-multi-scale-community-visualization/](https://uncharted.software/research/graph-mapping-multi-scale-community-visualization/)  
> 8. Cytoscape.js, [https://js.cytoscape.org/](https://js.cytoscape.org/)  
> 9. Cytoscape.js performance very low \- Google Groups, [https://groups.google.com/g/cytoscape-discuss/c/qEDrA0QZ7Vc](https://groups.google.com/g/cytoscape-discuss/c/qEDrA0QZ7Vc)  
> 10. [https://www.sigmajs.org/](https://www.sigmajs.org/)  
> 11. [https://gephi.org/](https://gephi.org/)  
> 12. Uncharted Territory | Knight Lab Studio, [https://studio.knightlab.com/results/uncharted-territory-datavis-vr/](https://studio.knightlab.com/results/uncharted-territory-datavis-vr/)  
> 13. PanTera \- Uncharted Software, [https://uncharted.software/research/pantera/](https://uncharted.software/research/pantera/)  
> 14. By Default All Nodes should be collapsed to enhance Performance \#17 \- GitHub, [https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/issues/17](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/issues/17)  
> 15. Uncharted Research Multi-Scale Community Visualization of Massive Graph Data, [https://uncharted.software/research/multi-scale-community-visualization/](https://uncharted.software/research/multi-scale-community-visualization/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAZCAYAAADXPsWXAAAA7ElEQVR4Xu2SvQ4BQRSFr/hJhEQjRCeiUYqIQnRansBTKEh0otIrFURCI/EKm3gIlUKlUlIocK5Zm9m7uzKh3S/5mnvu7iRzhijEjyzcw6fmHba1nQTciJ2Bljt0SIVLGdhE4RqOYFxkDjV4hVsYExnTgCuYlIFOCZ6hBdPu6P3hAlbF3EMeHuEJFkTWg2MYEXMPfLoFL7CizYtwB3PaLBC+B76PG6zbMz55CrufJRPmpBrippgWnNGXNvwYkvpJH2ZIvY2ya8MAfmAPeCBVp2zJiM9bYfld/ARXyxVPyKDOIPgCmzAlg5CQf3kBE1AmXeAJjTAAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAABC0lEQVR4XmNgGAXowBGInwPxfyT8Coh/AfFfID4JxMFAzAzTgAvMAeLfQGyDJAbSlMYAMagMiBmR5FAALxAfBuK7QCyOJicJxA9xyMGBJhC/BeI1QMyCJmcKxN+A+CoQi6DJwYEfA8Tv6egSQNDAAJErRhNHAZMYMP3PCsTJDBCXlUL5WAEPEB9ggIT6MSj7OgPE1ulALAxTiAtg8z8otCsZIKHvChXDCWD+L0ITNwbirwyQ6MULsPkfBKIZIAa3oomjAHzxDzIYZEA5mjgK0AHi9wyY8Q9ir2JANaAaiF1gCmwZIKkLPf2DwgMGQOkfFIggg2KBeDYQcyLJEwVA3vJlgMQEyZpHwfAGAGlHPJOLUE8QAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFUAAAAaCAYAAADG+xDjAAADXElEQVR4Xu2YS6hNURjH//LIW94JiUSKkEeJjCgSCgPFyKM7Rt7JLRmQR5ESIgMkSpIyELcUYsJAJhQSAzNFHoXvd7+9O/uuzt5n39fZTu1f/bv3rHX23mt9z7WPVFJS0jUMMfUOB+tI0c/vclaYjqvYTc03XZEbt+GZbXpoGhVOFMBG01kV69xO089027Q+nCgI1nPHtCacaCSWmV6aRocTBYKDH6tBy0AP0yXTqXCiYCaZ3pgWhRN5IDpWmharmBoywvRK6ak23rTcNDgY72saGIzVYrj8XtwzhvtiuHDvA0z3TfuC8UymmJ6arslDfb/phrye1JM5pg/R3xAMfdl0RF4eMApg0Fum66ae0Vgt5sr3t0f+vKnR+AXTX7mxQ3g2JwGyqSYzTV9Me1W5YKTprrLr2gH5gvLqnmlY65XpkCWf5emWhFPARbkhiZZPpgnRHN/lmu3R51oQKHTzyfIA+qqKExeavsnXEbLb1KIcGRF3to+midEYhjxj2qmcXulC2Mx705hgnMjaIm8UcUb1iuaIqp/KX+9I923yFOc+3C9uQNzzvDzQQjDqc9PQcCKEi/HUL3k08YCjcs/V26CQZtSYBabvanvcOmx6ZxqbGMsDQUQwNSfGBpnOyWt7CEZ9q+zsbWWJ6Y/8gvZCGrD5vCKFa9W8WkZlncnyQD2lTCH+bw8bTL/VNsKnmw4mPifJnf7z5J6vVkP6K9sIM0zr2iHStFbjY4PUy2rpBzSLFlU2FtdT6iyOIMv6yNeNE7MMjZFCB+6SZ0M1yAhOAJwEMolrFBckwdjUm7jD1otpcqOSQdWgOz+SpynlCSPQrQkKXho2Rd/bHI0na28IjY30Hxd95j0fO1T7Ps+i8+c+P88yvZAfMagnGPmkcnikGyACW0xNwXgMDQtD3JQfoTgSPTA9kzfc+LcCjPxDXgPTSgnG5C3piTwDrir9jYnmxDNWhRNZxOmSp+51N81yo1WLGKBr0yziEsB6aSzhgZ3UP63sxkIEko0oqzFTEl6rckJqODg/kjk0jc6AAY4p3Tl5wdiHImUZ/r9nh+mEOr4JoheDLg0nOgBOpkHFLxsNC6lM6q4NJ3JCHV2tjjslhnXwA0/abxENB42SlAtfWevJVvmpoqSkpKSkAP4Bw/aQJ4HVzVIAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAAaCAYAAAAqjnX1AAACjUlEQVR4Xu2WTchMURjHH6F8S96SIh/ZiKJ4RfnaCAuSFcVKssFCeCOLtyQpSrKQlCwsfOwkiTIhxMJKFBYkomRnJ/6/zjnNc8/MvWammVjMr35N95z78dznPM+5Y9bn/2SCHJMPVjBZjs4He8liednCg1tlmbxq7V3TMTPkA7kgn2iBHfKC9TijI+RZOZyNt8pYeUtuzSe6yUL5Jv52yjb5xHq47EPytrXXMDlz5Tu5Mp/wjJRL5Gor1gZLOTH+wjy5yB0TGAEejcdlcM+lcoucmc3BeHnfKu7DDagpTngoz7i5zfKHhcAG5Cv5xcKbw3T5QW6Kxznc+5B8K/dbWFYabJ0/KXLFQqenBBRYK49ZqIdHVjzxnIXACJCxw/Kz1YMk+1+t+TKNkuctBDjbje+VB9xxgrKpWdhrG9gt58sV8qeFt4Up8oUVg2aruWMhaCDIj/E3h2z9snrXk9X18q6cFcc8BMnzeG4pw/KTnBOPCfy73JNOiGOnrR50VZCX5G/5Tb6X1+QuOcmf5CBIzpuWTyRIcU3etLBMwL5FZgfjMZDl7e64LMjUUNQrddsKlcsNqQF8d3GRfwjBk8WUaaA2qdGNbgzINGVSs8aHspOMy8bghIUOp9ObkjqXE4H6uW7FTl4lj1ix+9J1viQSZN03GfB1OSl3ujFIL0WjVsLyUoM35D25Tz6WTy1sDxet8YvAzflT0ezmvOgp+dLCtdTkM7nGnxShWZ5b2PL+CjemcNMSEcTUqM+gh4zxgLKu5F6UTL7sHnaW11Yspa7CC5DxDflEi/Dyx6NliegKLBNlQs21C59aGqbZ3tlVyACfP2wnG5QXNd3Tv2keHnhQLs8nKuBr12mZ9Onzz/gDcjxn45C77ckAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAaCAYAAACzdqxAAAABW0lEQVR4Xu2UMUvDUBSFj1gHQXFQEBd3QVAoDgUdHBwUFKFjcWlB6eCiqKiLi6OLCg76C8TZxUUQBH9AcergVBDESYeK6LncF3jeNE1SSl36wUfTe9v3kpObAF06zTyt0R/PV1qn3/SJ5mlv8Ie0XNEvOuvVZLF16Aa7tMfrJWKQPtAqHTW9MfoS0Ytlgr7RG5oxvRn6SSt0xPRiWYFmu2Eb5Aja2zb1RJwinG8fLUGvZMd9T8UAvYdOwaM7foae5QUdDn6Ylkb5yt3fh07Dgqv5DNGy+4wkyHfL1LP0AzqGlil6Dr3aSBrlKxSgGx6beiKaza9sKAvveTWJaJXe0mmvHmKSviM8v3J8jb8LH9IiXaQH0DEMMQd9muz7QfIOkPeD3DzZYI1e0nGnnLGNLhUSzzJ0MvpdLUfvEDMRrSDZSzxL0Cjbxgk9o5to4W3XDFlMpqmti3b5Z34BIFpFxS7mBEUAAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAaCAYAAABctMd+AAABbUlEQVR4Xu2UsStFURzHv0JRDKJQVoNikg2lKAu9Msqk2AyEsFhsFhYDZZfyBygpUsoqk8GklEwMJL7ffufoOO+63XffK8v71Kd37/nd+zv3/c7vHKDKfzNCH+lX4BN9p5/0mk7RWv9CHg7oBx0MxpRwDjbJCq0JYplpphf0nrZHsU768EcsEz30mR7Tuig2QN/oLW2LYpmYhNV6Pg6QTVhsKRrPzC6K611PZ2H/aNndl0wTPYd1x5W7voN97R5t9Q/mIane6oo1WJeMubEkJuhwPBji670YjffTV1iLJqEP2UL65In1FtOwSZUgF2n9rUmVfDUaF910n64jZaF76QuK+1vXR/idfIOO0i664H5vaJ+L/zAE23XxeaL6e3SeaEE1yQzsSxtpB2wzaXOd0Rb/QqmoVOoILZoSh2jDHSLneZOGEiqxFr3iqCyXsHatOEp6ijLqHdNAT2Dtt4MyDrIkVOcC3abj7r5KNr4BvgtJYYMVeyYAAAAASUVORK5CYII=>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAaCAYAAADBuc72AAACKklEQVR4Xu2WMUhXURTGvyDDSIhKAknhX0kSgkOuKkKKNuRgBIFOLi0NbqGIRSmKUwmihCgRkYSLZNkQITQ4COrgJDg0NTk6uJjf57mXblevTe/Z8P/gN7xz3v//vnPfOfc+oKii/n+VkxXyO+AXqSeVZD3KbZFbh78EuqPcArngcpnpKexhT+IE1Q/LdcYJqo58J4Uonpm6YGZkOJY3qntCnSEDpDWKZ6r7MDMyFapAtnF8EbVkjJRE8UzVQvbJ2yCmFRsir3DU6FkyAjObqzQ8u/jbqGKjsN6U0TDXSPpgxeQqb/QbbHL1Ol+T6iDnjZaRSVLlrnNVBflJlmFGNCC9LhcXoaF67HK5yxtdha3iDLnqcrfJDqyIm2QCVsyp6BLMpMw+Iw+DnC/iBxlEzttRLK3QMmzy58j5IOeNaqA+IL0d6TdqiY+wAVTLeGnomsg78oI0w+5PxZNS76kH92ATHcoXoT4NHx5K9yySdtjD35PhIP+ATMGK1D06mnV8p+InSlM9DdsjQ3mjL5Hejh6RL7DVKCWfyD2X0+6wQRrctYZxnlxPxOPnH5FWK1XNHXI5DgZSkf5Uuwbr5xvuWoY38ee/x2EtkopnKhnVMSzpFS6Ru7Ce04pptfVmrsCKUCwVz1RtsIHQ3vuGfIUdsdri1H/6JpiFtYTvw1Q8c+nB/nv0nLuOpd3guD5MxXOTXukarB0uks+k44T4qUmr2kOeO2r+ES+qqFAHEcl4jcE6G/gAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,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>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAAAdklEQVR4XmNgGAWjYMABBxCnATEPugQlgBGIW4HYGF2CUgAysBeIWdAlKAEg1xYAcRyUjRUIALEkiVgOiOcD8WQg5mOgEjAB4tVALIMuQS4QBuLFQCyPLkEJyALiCHRBSgAonU4FYml0CUoAKLZ5ofQoGAX0AAA5bAi7Yfn2hgAAAABJRU5ErkJggg==>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAAAaCAYAAAA38EtuAAAEHElEQVR4Xu2YWahNURjHP6HIPM9jXkyZheTBFA8kSYoHLyJ5MmR4upEHHmQqQwpJCvEgkYQiD7wpUa4MiRBKeTF/v7v25669zt777HPOddVxfvXv3LvWPmev9a1v2lukRo0a2bRXtQkHq5BOqtbhYLl0U81VLVENV7WMTxcwVnVc3CKqncmq01LBXluoZqjuqa6olke6pnqimtR4aYz+qpuqkd7YLtVX1S9P+7x5WOHNIe7TMXbF32e+xNeQpfXRd4C1H5YyPJsvYJxnUmhQ5o6qPqnGBXMczl5VXTAOfVQvIvF3EktVN1Q9w4lm5qTqm2p6MM7+xovbw2JvvK3qUjBWFAx5SPVRXFgkQfr4oDoo7ubGKNXj6DOEnH1L9UY1ND7VAKF3TuKR8C/oorqveq7qF5/6wzHV7GBsmequlJBC1qh+Rp9p2GIeqrp745tVlyW5CLZSnVd9UU0I5mC1xMOxGO1UvcJBDxygrxSvJyFjVJ/FrZU1A5/UHUsNpD2u88F56qUwChIZpnqteiTZmzBD+2kA42LkbXZRAngC+W1BMM59L4grunnpoTqrmhhOiDPyStUBKT1vUodYI05j4NmsncMFUkTnxukGmLsu2fv/Q524m+wMxkM4PVKAb2jLwaERfVg8v4/3GhiCQjLHG8sLhfeqxFNcJUYGDPpdtUjcngapjkhxmwC5nQ7ET6cFWA4lbYT5J4R5rrut6hCNkQ7eSnbomLf4p46BKaAWpqXiG7tSI1uk/lC9Ur1UvYv+L2YTwJFuibNlKuaRFDmKXRb7xRmszhvD0CwsKf8a1j5x8kCqOKMabBeUiRmb4lyukYG1U0P8/IwjkaKsgJPzzblCMDQHxYGlkqf9ggHi+uj3Eu8Q8hjaNkIu49S3iOtBKwVPppCypmnBXClYxPlFmVrF4VmBp7tY2zgdA0M/lez61tA90EVkGZoNbRW3mA3BXB5D43mEJKc+S3VCXA9aCaxpnThjDFRdlPS2NAt+57gk988GznFKNSSciMiVOggVwjjrRmyABxUeWMLwJLToWEgPadhh8hs3pfCBp1R8I9t6ekt5xrb8nOWRRB/3Sit2FEyi1bqTVNg4RuBkQ0POFFcY9kiyF5oR/Y4ixAouEUFkpC04D3yXEKaQhmstx9hJ+dnAcKQ5UtPUYM5gPXQc1K9c8MhdL+4dh73f4F3HA3HGTjOOhV6xG50U99sUwkoYodouhUY2uqp2R59Z0E0QiRw+8jsO5L+joeAmORkQEexrYTiRBZWVzoO3dfTFPGGlGdiHQsHNsqruaHG9abWBp/Ogl5a/mxS89I5qXjhR5eCEOyLlccgmgdA5J+khVo3wCoEi2KyRyoluitRsp/sPoUZQm0p6RdpUcPONqinhRBWySv6/VFmjRo0aVclv67PSf+mavpIAAAAASUVORK5CYII=>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAZCAYAAAA4/K6pAAAA4klEQVR4XmNgGAXYQAQQ/0fCf4H4CRSD2CCxGXDVaIARiOcD8SMgdgViZiQ5MyB+D8R7gJgfSRwFSAPxcSDWRhPXBOK7QHwLiOXR5FCACxBXo4mBNIA0vgZiEzQ5DODGALENBkBOBTkZ5HSQF0gCnEA8hwEScMFocgQBKxDPYoCEeBkDJHCJBiDFIE3/oDRMMwsQGzBADMcJQIrDGSDOBrkAWbESEE9mgBiEFcDi+RAQS6DJgWLiCBDroInDASyq0OMZ5AJ7IL4OxDsYIAGLAbiBeDsDavLFhnNgGkbBKKA6AADyoC2JGIBjgwAAAABJRU5ErkJggg==>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAaCAYAAADhVZELAAACf0lEQVR4Xu2WTYhOURjH/0KRr2KjZmFiJZLytSQxNQsRZUQpU7JRZMGComQlathIU6KUlS0LRShWkw1KbGRmMYoVC+Xj//fcM517uu+957z39WZxfvVr5j33nts9z3me5x4gk8lk/i0H6G/Pn/RTof7X2I2Zu/vPbLqfDgbjdcynB+lNeo3ugD0niln0Fv1Id6I8cTP9Sh/RJd54P9CidtExOkm/0Q2lOzqjd71Pj9JV9Dxscx8U1xoZoC/ommB8Nf1A39EVwbW2LELzrikow3QbbFEpQTlO79DFxW9t/EVYxp9xN9WhtDobjCkICsZnujG41i16sS30Mb0CW3QsWkhKUG7DAnDKG9tEv8OyfoE3XskQLCscSi9NVNmofNqijNhNX9JzdFn5chSpQdlDX8PagUNz9YwndKE33oh2bxxWf/uCa6nMhTXwCXoCEbtTQ2pQqjgEyx5laTRahDq1Jp6GpXs3KLCj9FXxN6VMOtE2KMr+p0jsjwqAAvGr+OsCMoeuhwWsCWWCMkKZoQyJmRNLm6C4tb1HuU3UokkjsJJRpviLWUmvw4LTxBHYTuxF85cllTZBURt4hrQzzt9JCkjVWUSftmPBWB1+thxGb0pHdBsUrU1nk6XFbzVY9ZZ5M3dU4A5nqrflwTXV3nO6NhiPwfWVN2jfZEVdUJTZetewXLW2uyhvtMpHh8GO/dKdRcLmo4dvpW/pQ7Tb7fBz7A5TqSgoOmPorBGir4k+Dhe8MS1ePWQadlJ3fqGXvPtKaOeUVnpYnSqfXqDgbIfV9mXEnVX0jvdgC/HfaYpe9e47SX+gfIRwh7cqVT7/FUrbdbBFuTrPZDKZTCaTydTwB3ynhmrgSIrWAAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHsAAAAaCAYAAACXbyOAAAAEEElEQVR4Xu2ZSahVRxCGS4zgmBgVg8bggOAADhBMMKiouDCLkBAFFVw84kJw40KcQCWLLBzAKAYVQUQhKxVXKgGJYhZKDHFAFJSAikTcKIguIk71vbrN69Pv3ntO971OoT/4eb7ue+6rU9VVXd2KZDKZTCaTeV8ZpVocDpYwTrVVtU+1SjWsOP1W+Eh1XvXS0wPVndpP9/sU98BbYJTE+/pD1UoxX29UfVacLmeCaoXqd9Vz1cHidFMWqI6KOW2m6qLqqep7/0OJ9FB9qTqtWhfMlfG56pFqt2qwN95LzFG8J7a3Sk/Vt2ILa1EwV49WfD1S9ZtqvlhCzVZdlkhfY8B3qq9Ud6W6AZ+o/lDNEwsMjFX9q7opCauuBg6cK/bd26QYrKqsVe2QLruAQP+oeqFaE8zFwneRlX+LZVq/4nRDUn2Nrb9I98AS+LNilSwKVsttqW4A2fNE9Y9Y4AGjfhUrk1/XxqriHHhFtUGsZKXQW7VXNdobwy4CTKD3iP2tFAgqwb2m+kHVpzhdmVhf91edUXUUhztj8Jd0+b8ysQawmijhB8SMcfA8wf7GG2sGDsNxl1TLpHqWNGKgaqnqA2+Mkk3ZpISnBJqFxwKkXJOZKd/hE+tr3uWI2Ba5Wuzvs4DXiy1e/10rEWtAPT5WXVDdF2vcmoEDyTZKIRndqgMbQcl8qDol8eUOn2wX21LYWthi2kGKr78Qew8S6U/Vz6pjEv9OnaQYEEKTQgaV7YkDxJx/XGyBvC6cg26INTgxjBDrPXaq+gZzrZLq6zmq/6TrhLFJEreSVAMcOPO6WBNUJUvb0Yg1A3sIchjoT4Pfm5HaiJWR4uupYnawjVC+SSoCfkgSAp5igINSQpbikNhSRwVwRyw6TuxolUFixxuymuz2Ye+dEYyV4R+xWmkeHbG+HioWaL8bnyh21KXppCuPItYAhws0JdyV7lliKzEGnp2sOilmQ9me3wjsYYuod5amaz2sGhKMV8WvRuzlqQsz1tecbK5Kd7t5H6opR80oygzAicOl+9mV82x4/vtJNS0Yi2G0ar9Y4FkA/t9shn9p0iHF5/g3vcSuYDwFf2FiJ/bGEOtrTjY0vmF/wzxH3eXBeCnOAB4OncF+ym0NzcH02pi7pGCMa0gnLgtuqcbUPtcK2ERp52qwDBfMepcmZMBm1TNJKHklUIGoFkvCiSbE+ppmkTGqp8941TmJWGzcgBEgt+Gjx2KXG5Nqn+EcfUKKzY67VHHP+Kq3Cl83BDG0IxQlL/oCoo2k+hoI/D2xhoymcYvY+7CtZP6HUE3phxbWflY59bwTcNNFOasi/4buTUF5paSGtjQS17SZOuAYrv1opqoo9r8C2wGLkX0+tKWRyLRMJpPJZDKZTCaTCXgFBHbtfZa1e9IAAAAASUVORK5CYII=>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAaCAYAAADhVZELAAACl0lEQVR4Xu2XS6iOQRjH/8LCXbGgkxwWJBK5lRQJZSGiUJYWLIToOKcodhY45ZoQyYaIjbBQhHJZsFRKIWwUKxbk8v/3zDDv9H3v9853vu+Uml/9Ou87M2fOzPM+czlAJpPJtJeN9HfgT/reqWeVnf7buv8ZSNfTzqi8jAF0AT1GT9FVdHChRQn65Qv0HV0OG4BnPv1C79JRQXl/MAQ2kaP0A/1K5xRa1Edz6qIn6UTnIXoLFefRQR/T6VH5NPqavoJ12ohhSPgSFVBQVtIldD/SgjKD3qAjgjL1p6BoVTRkGd0blSkICsYnOjeqq8dC+pDugAWolXQjLSjKsOd0TFR+ke6KymqyApYVHqWXlouWjZZPClp6S2HBUbrGg2qW1KAsoj/oMzrFlXXSp3S2e6+MUuwcbHNdF9Wl4De5e/QEHV+sTiY1KFrGZ2AHxHfaC/tQa8NGVQg72gObWF9RHzPpbXqNTi1WVyY1KGIovYJ/J+pL2Fgqo8ErEL/cTx+QQXQWWrOBKiAKzHX3nEJqUDTew/QSbK97AQuM+tDSaogCsAG2ZJQpYQAm0+Ow4LSCSbCg6GQYHdWVkRqUrbClO9y9a1vogc3xjnsvRXuHGte6i2yjW6KyZlBmXHWmZolICYpOPs2l1rg1n7dosMf5y9kDOi6q07H8CHbmN4PfT27Ss7AsaZayoCizNVaf4cqO+3STbxAwD3YnGxtXePxdJL6cqfPFsI2pUqpFtONYVlC+wSYVcwS2XxwIynbDAhNmvsZ1EMV2BZRiOhH8zlxPpVtV9EdX0yd0Hx1ZrE5GY7xMP6M4po+wI9azE3bshlcIfUj9r/aGbqebYUvqPFp/sSxFm1s7brN9YQJd49RzJpPJZDKZzH/HH+DZhy4T3uPOAAAAAElFTkSuQmCC>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAaCAYAAADhVZELAAACNklEQVR4Xu2WPUgcQRTHn5iAYjBgIRELQ2IjWghqWi1iQCQgJCQm1mJjIRZaWCiIpYLaiATEgGBla4oUIQbSpBVBTCOaIoKpYiH48f/f2z1mh729HQ9vFeYHP+5uPvZ23r55OyIej8dzuwzCK8MLeBTI72xbyY8uP5XwHXxqtSdRDT/CVbgEX4peJxUVcA0ewl6JTnwB/8Gv8LHRXg64qNdwER7D/7AjMqIwvNctOAyfw2nRh7sd9BWlEf6ErVZ7C/wN92GT1VcOGJQ+2CO6KJegjMLPsDb4zQc/K5rxk+GgJJhWU1Ybg8BgnMBOqy8LuBCXoKyLBmDcaOuCZ6JZX2O0x/JKNCtCmF6cyG3D7XMXcA3KANwVLQchnMtrfIOPjPaiMGU/ie6/N1ZflrgGJY4h0eyZtzuSeChaqTlxQnQfpqUZ/hIt1mn9kJuZjlKDwuz/Lo71kQFgIC6DzzAgD2C7aMCypJSghGs7kGiZSIST3otuGWaKGYBncFk0OFlSSlBYBnbE7YyTm8SAxJ1F+Gobsdri4NmmHjY46FLsbhoUro1nk7rgN/+TtaUqPyKG8HDG/fbE6uPe+wHbrPY4+Irrh28dTJ3KkhwUZjbv1d7iXNuGRB80/5OHwYL1MjyL2MWHF++Ge/CL6BspaxgUnjF41rDh24QvhxmjjYtnDfkr0eJ+CueMcRH4ZJlWvFiS3D5ZwXvcFF2IeU9/4IIxbgyeS/QIER7e4uT28Xg8Ho/H4/HcZ64BqAWFc1fxUD0AAAAASUVORK5CYII=>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAaCAYAAAAg0tunAAACzElEQVR4Xu2XS6hNURzGP6EISVcuIY9MxIBcRMQAkZS8lZKUKxkoRTJgYog8kqSMRJiKgXI9yoCMPEpJhEIYkZTH91l73fs/6+xzzlriHGV99euc89/rnLP3t/+PtYGsrKysLKt15IfhG3lZoPeKnexe3Xz1JmvI2CBeT73ITHKUnCBL4X7HajWZTQbCrR9GNpApdlEj6YtnyAuyEJV/MoN8JNfIYBNvhvqTZeQIeUU+kWkVK2pL17SL3CDjSBs5S06RvsWaPuQCKhNHXETitY4kd8ikID6RPCVPyJjgWDMkA5eQ+WQf0gzUujdkjomNJ8/JYhM7TR7AJc8llGdpQy0ge4OYDJNx70hHcKwV2o00Aw/AmTXCxAaRW3DVpgyVjiH+N2tqEVy2eSl9VbIqXZXwv6AUA/uRy6g2UH2ui9wlQ4rYHzHQSmWjtNbgWBkca6VSDPRG1TLQxo+Tw+Q+3MBUK5taHEuWmquarBqpGrBP8xhNIPfgekks6399M04pBsocmRRjoMp5D3r6nibwB/xG5fmp9b149eZpUmmk+8nVKqUY2A43/GIMVF+0Q2MUXCaeg7v2KMmstXBla8e8pMmlPhH9Y39JKQaWGVUvbuWzVzdANyJK6nUyr2yvt510BrEy6S5qE6oTiEUXFKsUA3WztSUJjfIGahIr8zbBVdxWs8YbGH63pvxG+SYZHhzTVuY2mRzEyzQAbg+1KgE7+RupnoGqGJ2rrRytf4/K/xhKHsI9mUhao35vDfQl3IWIG+z3euFGWScyjzwmV+Emc6uli/1MpocHqINwRuw3MQ01GaFHVK+55C2ZVXzWq6awNV6t7AsidiDKmCuofowJUQm3SjrH83BT0Z7Ta3LIrNtBvqL6oleQZ2QL2UgekW3oGZB63Umuk81wmamstWv+e7XBPU8LvS/TaLIc7oEinAFZWVlZWVlZWVlZ3foJ1gOrjdh/QRkAAAAASUVORK5CYII=>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAZCAYAAAC2JufVAAAB1UlEQVR4Xu2VzStFQRiHX0kRQopI+ViQsiAhG1mgKFIUIXbyF/haKVmQ7KRsfOwsLCwoUW7ZkJXyUcpGYYUNConfa87cOzP3zJDu3Z2nng7vvHfmd++ZM4coICB+pMA+uAznYJk+/CeqYItZBMlwEFZ4fyfCAjgMiyJtOhlwD07DNFgJL2CX2mShDo7CE/gFx/ThHzLhMYlx1XmYpPRp8EQ8aZZS64eXMFep+cGh2mEbfCH/UPxFt+EZvIarJD6XoPRocBAOtGbUa+Az7DDqNqrJHYrnzzMHbJTDB4oOJReZMeo2YhpKTmYLZdZt/BZqAy6QuIW3cIscm5z3A286c/FYh9qFPST2EcsP1RUsVPrCtFL8Q3GIdO8q4T37CqeUWhjb4ra6DVcoP2T/Pkw1xqgE3lP04vJDk0bdhivULPyAzUpN9odI3F4NLoRInCN82kqa4Lt3lfAhm0/+54srFH/hT9JDydu3Qv7z0QC8gcXe/3IjHpEIwmTDU/gG672aiuuX7YXjFFmcrxPwCdbKJhM+6pfgAewkEeicxOtGwr/oDkU/MSPwjvTXxyM8hDleD8+/CDfhEFwncTbyQ+aE05fCbthAjnfSP1HnbyR9qwQEBATY+AYmIWrQjzO/aAAAAABJRU5ErkJggg==>