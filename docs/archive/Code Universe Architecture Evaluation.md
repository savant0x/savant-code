# **Architecture and Performance Evaluation of the Code Universe Export**

## **6.1 The Single-File Question**

**VERDICT:** The single self-contained HTML file architecture must be maintained for repository scales up to 10,000 files. The bloated 17.1 MB payload can be resolved entirely within the single-file constraint by leveraging the browser's native DecompressionStream in conjunction with lazy-parsed deferred chunks. A multi-file directory structure must be rejected as it fundamentally breaks the offline, zero-configuration distribution model.

### **Evidence and Analysis**

The defining characteristic of the Code Universe export is its zero-friction portability. The artifact operates under the assumption that a user can double-click a local file, share it via email, or archive it on a USB drive without configuring a local HTTP server or navigating browser security exceptions. Transitioning to a multi-file architecture—such as an index.html referencing a sibling data.json.gz and an assets/ directory—fatally compromises this user experience. Modern web browsers impose strict Cross-Origin Resource Sharing (CORS) policies on the file:// protocol. Attempting to execute a fetch() request for a sibling JSON file from an HTML document loaded via file:// will throw a CORS exception in Chrome, Safari, and Firefox, rendering the offline multi-file approach entirely unviable without an explicit local server daemon.  
However, maintaining a 17.1 MB single HTML file that relies on the synchronous parsing of a 15.6 MB JSON string introduces catastrophic main-thread blocking during the initial load sequence. The optimal architecture resolves this tension by compressing the payload *within* the single HTML file and utilizing the browser's native streams API for extraction.  
The document data accounts for approximately 12.5 MB of the total artifact payload. Text data, particularly source code and natural language, exhibits high redundancy and compresses exceptionally well. A standard DEFLATE or GZIP algorithm typically achieves a 70 percent to 80 percent reduction on source code structures. Therefore, the 12.5 MB document payload can realistically be reduced to a footprint of 2.5 MB to 3 MB. To execute this within a single file without relying on external dependencies or heavy JavaScript polyfills (like pako.js), the architecture must adopt the native DecompressionStream API.  
The Bun CLI export process will compress the document JSON block using standard deflate-raw or gzip compression. This compressed binary output is then Base64 encoded and embedded directly into the HTML within an inert \<script type="text/plain" id="savant-docs-payload"\> tag. At runtime, the browser retrieves the text content and converts it back to a binary array. Historically, this conversion relied on the atob() function, which is notoriously slow and memory-intensive1. However, the modern Uint8Array.fromBase64() static method has recently achieved universal browser support. This method interacts directly with the underlying JavaScript engines (such as V8 in Chrome and SpiderMonkey in Firefox), processing Base64 data into binary arrays at speeds ranging from 4.6 GB/s to 9.4 GB/s without allocating massive temporary string buffers in the heap1. Once the binary array is synthesized, it is piped through the native DecompressionStream, which operates asynchronously and offloads the decompression workload. Browser support for DecompressionStream (specifically the "gzip" and "deflate-raw" formats) is now ubiquitous across all major desktop and mobile platforms, including Chrome 80+, Edge 80+, Firefox 113+, and Safari 16.4+5.  
To guarantee sub-100 millisecond interactive times, the application must abandon the synchronous evaluation of the entire 15.6 MB database. The architecture dictates structurally partitioning the payload into three distinct Base64-compressed blocks to enable lazy evaluation. Block A encompasses the Universe and Meta data (approximately 1.5 MB uncompressed, yielding roughly 300 KB compressed). This block is decompressed and parsed synchronously on load to bootstrap the Graphology graph and initialize the Sigma.js WebGL renderer immediately. Block B contains the Document Previews (approximately 1 MB uncompressed, yielding roughly 200 KB compressed), which are decompressed in a microtask immediately after the first frame is painted to the canvas. Finally, Block C houses the Full Source Documents (approximately 11.5 MB uncompressed, yielding roughly 2.5 MB compressed). Block C is strictly deferred, decompressed and parsed only upon explicit user interaction, such as invoking the search bar or expanding a specific node's detail panel.  
While the single-file architecture thrives within the current 2,084-file boundary and scales comfortably up to approximately 10,000 files, it will inevitably confront hard hardware limitations at extreme scales. Processing 200,000 files implies an estimated 50 MB to 80 MB raw JSON database. Even with aggressive compression, the sheer volume of DOM string allocation and the memory ceilings inherent to the ELK layout web workers will trigger Out-Of-Memory (OOM) crashes in the browser10.  
The decision rule for navigating this boundary dictates a strict bifurcation based on scale. For repositories containing fewer than 10,000 files, the CLI emits the highly optimized single HTML file. For repositories exceeding 10,000 files, the single-file constraint is actively abandoned. In this scenario, the CLI generates a pre-compressed .tar.gz artifact directory and requires the operator to utilize a secondary command: savant serve \<artifact\>. This command spawns a lightweight, localized HTTP daemon that streams the data in chunks, bypassing the single-file browser constraints entirely when physical hardware limits are surpassed.

## **6.2 The Full-Framework Question (Next.js)**

**VERDICT:** Stay static. The proposition to abandon the single-file static HTML artifact in favor of a modern web framework like Next.js must be decisively rejected. Transitioning to a hosted server model actively destroys the product's primary value propositions: absolute code confidentiality, zero-operations portability, and deterministic offline reproduction.

### **Evidence and Analysis**

The suggestion to migrate the Code Universe to Next.js represents a fundamental misalignment with the artifact's primary job. As established, the export functions as a CLI-produced deliverable that users double-click, share via physical media or email, and utilize to visualize proprietary codebases in fully disconnected environments. A served web application fundamentally alters these properties. A local file evolves into a hosted URL; an offline utility becomes network-dependent; a deterministic, reproducible snapshot mutates into a live state; and a zero-cost utility suddenly demands deployment pipelines, operational overhead, and authentication infrastructure.  
The most critical factor demanding the rejection of a hosted framework is data confidentiality. The current 17.1 MB payload contains up to 8 MiB of raw, proprietary source code encompassing the user's intellectual property. Enterprise security compliance policies universally dictate that proprietary source code cannot be uploaded to third-party SaaS environments without rigorous vendor risk assessments, SOC2 audits, and complex localized deployment models. Tools operating in air-gapped environments or handling highly sensitive data specifically require platforms that never transmit information to external servers13. If the Savant ecosystem shifts to a Vercel-hosted Next.js deployment, the user's source code must cross a network boundary. The threat model immediately escalates from simple local execution to managing cloud storage, transit encryption, and complex Role-Based Access Control (RBAC). The determination regarding whether user source code should be hosted must be a definitive negative; consequently, the architecture must remain completely isolated from cloud infrastructure.  
Furthermore, a comprehensive evaluation reveals that a modern framework provides negligible performance benefits for this specific visualization task. The core value of Next.js lies in Server-Side Rendering (SSR), API route generation, and React Server Components. However, the most computationally expensive operations required by the Code Universe—specifically the Eclipse Layout Kernel (ELK) layered, container-based two-stage layout positioning and the algorithmic community detection—are already executed deterministically in Bun during the CLI export phase16. The browser receives an array of preset x and y coordinates. The rendering engine, Sigma.js, utilizes a WebGL canvas to draw the graph20. WebGL operations interface directly with the local GPU and inherently cannot be Server-Side Rendered. Therefore, migrating to Next.js purchases serving, state management, and component composition, but provides absolutely zero advantages for graph layout calculation or rendering performance.  
While a hosted Next.js application is inappropriate, the desire for dynamic, real-time data integration remains a valid engineering goal. The optimal middle path relies on introducing a "Local Serve" hybrid model. Rather than pivoting the entire front-end stack to a server framework, the existing Rust/Bun CLI is extended to include a savant serve subcommand. When executed, this command instantiates a high-performance HTTP server directly on the user's localhost. It bypasses the HTML export entirely, reading the live SQLite knowledge graph and streaming the data directly to the existing Sigma.js front-end over the local network interface. This approach captures the vast majority of the benefits associated with a framework—live database reads, elimination of the re-export step, and dynamic search querying—at a fraction of the engineering complexity. Most importantly, it preserves absolute code confidentiality, as the data never leaves the user's local machine13.  
This dual-delivery architecture guarantees that the single-file export remains the definitive solution for static reporting, sharing, and offline analysis, while the local serve mode handles continuous integration workflows and extreme-scale repositories, rendering a pivot to Next.js entirely unnecessary.

## **6.3 Wasted Payload (Dead Weight Cleanup)**

**VERDICT:** The payload must be immediately purged of legacy Cytoscape elements, the CSS watermark must be converted to an optimized SVG path, the title string must be corrected, and all stale CYTO\_JS constants must be stripped from the bundled runtime.

### **Evidence and Analysis**

A structural inspection of the 17.1 MB artifact reveals that a substantial portion of the payload is non-functional dead weight. Eliminating these inefficiencies reclaims approximately 2.3 MB of disk space and memory footprint without requiring complex compression algorithms or altering any user-facing capabilities.  
The most egregious violation of payload efficiency is the retention of the legacy elements array. The artifact currently contains 10,023 Cytoscape-style element rows, consuming roughly 1.5 MB of space. The browser runtime was previously migrated to Sigma.js, which consumes the universe object and completely ignores the legacy elements data. Emitting 1.5 MB of unread JSON string data incurs penalties in disk size, network transfer (if emailed), and V8 garbage collection during the JSON.parse phase. The proposition to hide this data behind a SAVANT\_GRAPH\_EXPORT\_TOOLING=1 environment variable must be rejected. If external tooling requires structural graph data, that tooling must read the deterministic SQLite database directly rather than attempting to parse a UI-optimized HTML report. The elements array must be dropped entirely from the GraphUniverse type definition.  
The inclusion of an 868 KB Base64 encoded PNG file within the CSS \<style\> block for a background watermark represents a severe misallocation of the rendering budget. Raster graphics embedded as Base64 strings inflate by approximately 33 percent compared to their binary equivalents2. To achieve a zero visual regression state while minimizing costs, the character art must be traced and converted into an optimized Scalable Vector Graphics (SVG) path. If rasterization is strictly mandated by the brand guidelines, the image must be converted to a low-resolution WebP format, driving the footprint below 50 KB. Furthermore, a CSS media query (@media (max-width: 768px) and (prefers-reduced-data: reduce)) must be implemented to set display: none on the watermark for mobile devices, conserving vital GPU rendering memory on constrained hardware.  
The \<title\> tag contains a trivial string duplication bug: "Savant Code Code Universe". This requires a direct string replacement patch in the HTML template generation script.  
Finally, the presence of stale documentation, outdated comments referencing the deprecated Cytoscape stack, and the unused CYTO\_JS constant module indicates a failure in the bundling pipeline's tree-shaking mechanisms. The Bun bundler configuration must be audited and updated to aggressively eliminate dead code pathways and strip all comments during the final minification phase prior to injection into the static artifact.

## **6.4 Doc \+ JSON Payload Engineering**

**VERDICT:** Implement a dictionary-based tokenization architecture for all repeating JSON keys, round all ELK layout coordinates to absolute integers, and aggressively lower the default document media budgets to enforce strict payload ceilings.

### **Evidence and Analysis**

With the documents object consuming approximately 12.5 MB and the universe object consuming 1.5 MB, optimizing the underlying data structures prior to compression yields compound benefits for both storage size and parsing latency.  
JSON object arrays inherently suffer from massive string duplication. In a graph containing thousands of nodes and edges, keys such as "type", "source", "target", "label", "text", and "id" are repeated continuously. While DEFLATE and GZIP algorithms manage repetitive strings efficiently, pre-tokenizing the payload achieves an independent 20 percent to 30 percent reduction in raw string size. More critically, dictionary compression drastically reduces the memory overhead required by the JavaScript engine. When JSON.parse encounters millions of characters of repetitive keys, the V8 engine must allocate corresponding string instances in the heap. By implementing a schema definition header and converting objects into dense arrays of arrays (e.g., \[\["node\_1", "Node Label", 1\], \["node\_2", "Label", 2\]\]), the engine parses primitive arrays, bypassing massive object key allocation entirely.  
The precision of the spatial coordinates generated by the Eclipse Layout Kernel (ELK) requires immediate truncation. Currently, positions are rounded to one decimal place. In a WebGL canvas rendering over 7,000 nodes mapped to a dynamic screen space through a camera matrix, fractional pixel precision in the source data is visually imperceptible. Truncating all x and y coordinates to integers utilizing Math.round() eliminates the decimal point and trailing digits. Across 7,022 nodes and 7,925 edges (which include multiple routing control points per edge), this truncation yields a measurable reduction in the string payload and minimizes the byte-length of the numbers that V8 must parse and cast to standard double-precision floats19.  
Because inline documents are enabled by default, the artifact is highly susceptible to silent regressions in file size. The default budget policy must be aggressively tightened to prevent the payload from unknowingly ballooning past 17 MB on mid-sized repositories. The aggregate maxTotalTextBytes limit must be reduced from 8 MiB to 3 MiB, and the per-file maxTextLines limit must be capped at 300 lines. If a repository exceeds this aggregate threshold, the exporter must automatically downgrade the export strategy, falling back to inlining only the 8 KiB headBytes previews for the remaining files. To maintain user trust, the UI must detect this condition and display an unobtrusive diagnostic banner: "Repository scale exceeded default offline budgets. Document previews loaded. Execute export with \--full-docs to force complete source embedding." This guarantees that the default double-click experience remains performant, while providing an explicit opt-in mechanism for users who specifically require massive offline documentation and are willing to accept the associated load-time penalties.

## **6.5 Render-Time Scale**

**VERDICT:** Refactor Graphology iteration patterns to eliminate V8 garbage collection spikes, enforce aggressive Level of Detail (LOD) culling within the Sigma.js WebGL pipeline, precompute the search index during the CLI export, and throttle canvas background effects based on device motion preferences.

### **Evidence and Analysis**

Rendering a topology of 7,022 nodes and 7,925 edges pushes the boundary of single-threaded JavaScript execution. While Sigma.js successfully leverages WebGL to offload pixel rendering to the GPU20, the JavaScript engine still bears the burden of managing the graph state, executing spatial indexing, and processing iterators.  
A critical performance bottleneck originates in the iteration patterns utilized across the Graphology instance. Graphology's default iterator methods, such as graph.nodes(), dynamically allocate and return new arrays containing the entirety of the graph's keys. When executing these methods inside a rendering loop or a hover-state event listener over 7,000 nodes, the engine rapidly exhausts memory space, triggering frequent Garbage Collection (GC) pauses that manifest as severe frame drops22. The architecture mandates a complete refactoring of all client-side iteration. The codebase must exclusively utilize Graphology's callback methods, specifically graph.forEachNode(callback) and graph.forEachEdge(callback). These methods pass internal values directly to the execution context without allocating intermediary arrays, preserving V8 heap integrity and ensuring smooth performance22. Furthermore, the system must abandon complex string-based edge keys in favor of basic incremental integers to optimize the internal memory map footprint22.  
To maintain a consistent 60 frames-per-second (FPS) refresh rate, the Sigma.js rendering pipeline must be tuned to aggressively cull non-essential geometry. At a zoomed-out universe level, rendering 7,900 edges and 7,000 text labels creates massive WebGL overdraw, saturating the GPU fill rate. The configuration must enforce hideEdgesOnMove: true and hideLabelsOnMove: true. By suppressing edges and text during camera translation, panning and zooming remain highly responsive21. A labelRenderedSizeThreshold must be implemented, ensuring labels are entirely omitted from the GPU pipeline unless the user has zoomed in closely enough for the typography to be legible on the screen.  
The current fuzzy search implementation rebuilds its index or executes linear scans on every keystroke, blocking the main thread and causing input latency. Because the file:// protocol restricts the loading of external Web Workers, moving the search logic to a background thread at runtime is architecturally complex. Instead, the Bun CLI must precompute a lightweight trie or an inverted search index during the export phase. The browser client receives this pre-built index as part of the JSON payload. This shifts the runtime cost of a search from a blocking ![][image1] iteration over 7,000 nodes to a highly optimized ![][image2] traversal, guaranteeing immediate keystroke responsiveness.  
Finally, rendering a secondary full-screen canvas to power the background starfield and planet effects at 60 FPS is an irresponsible allocation of resources, particularly for laptop batteries and constrained mobile processors. The background canvas must be throttled. The standard animation loop for the starfield should be capped at 30 FPS. Furthermore, the requestAnimationFrame loop must be paused entirely if the user has enabled prefers-reduced-motion in their operating system settings, or if the primary camera has remained idle for more than three seconds, minimizing continuous CPU/GPU polling.

## **6.6 Robustness and Hostile Inputs**

**VERDICT:** Implement cryptographic-grade escaping for all JSON strings, enforce hard byte-cap boundaries on single-file parsers before reading, implement degradation limits for the ELK layout algorithms, and establish strict feature-detection ladders for browser API quirks.

### **Evidence and Analysis**

The Code Universe artifact is designed to ingest and visualize arbitrary source code written by end-users. This code must be treated as a potentially hostile input vector, capable of containing malicious script injections, massive binary blobs, or deeply nested structures designed to exhaust system memory. The export mechanism requires defensive engineering at every layer.  
The standard JSON.stringify utility does not inherently escape characters that dictate HTML script boundaries. If a user commits a source file containing the literal string \</script\>, the browser's HTML parser will prematurely terminate the inert JSON data block. This results in a fatal syntax error and opens the door to Cross-Site Scripting (XSS) if the payload is subsequently injected via innerHTML. The Bun serializer must execute a post-processing sanitization pass over the JSON.stringify output. It must explicitly escape \< as \\u003c, \> as \\u003e, and neutralize Unicode line separators (U+2028, U+2029) which act as line terminators in older JavaScript engines. The client must strictly consume this data via the textContent property, routing it directly into JSON.parse() to guarantee the DOM is never evaluated for executable code.  
When handling massive single files, the current lineCount cap is wholly insufficient. A user might commit a 1 GB minified JavaScript payload devoid of line breaks. The Bun indexer must implement a hard stat byte-limit check *prior* to opening the file stream. If the physical file size exceeds the maxTextBytes parameter, the stream must only seek and read the first 8 KiB to generate the preview, immediately closing the descriptor to prevent memory saturation. The parser must also scan for NUL bytes (0x00); if detected, the file must be classified as binary media and skipped entirely, unless its signature matches an explicitly permitted image format (PNG, JPEG, WebP).  
At extreme scales, the graph layout algorithms become a liability. The Eclipse Layout Kernel (ELK) executes its layered layout algorithm within a Web Worker during the Bun export phase. Memory leaks, exponential time complexities, and garbage collection failures are well-documented when ELK attempts to process layer counts exceeding 10,000 nodes in a single container10. The CLI exporter must actively track container density during Stage 1\. If a specific folder or cluster exceeds 2,000 nodes, the system must trigger a graceful degradation protocol. It must abort the expensive ELK Stage 2 internal node positioning for that specific container, falling back to a highly deterministic, low-cost circular or grid layout. This prevents the entire export process from timing out or crashing the Bun runtime.  
Finally, the browser runtime must anticipate platform policy restrictions and feature gaps. The Web Audio API is heavily restricted by modern browsers, which actively block autoplaying audio contexts to prevent user annoyance26. The audio context must be initialized in a strictly suspended state and resumed exclusively inside a verified user interaction event listener (e.g., a click or touchstart on the WebGL canvas). Similarly, if the DecompressionStream API is missing (e.g., on older versions of mobile Safari), the fallback ladder must prevent the application from failing silently with a blank screen. It must present a clear, static "Unsupported Browser" screen with explicit instructions detailing the required browser versions.

## **6.7 Broader Improvements**

**VERDICT:** Elevate the artifact from a prototype to an enterprise-grade deliverable by introducing deterministic Continuous Integration (CI) gating, Playwright functional testing specifically targeting the file:// protocol, comprehensive accessibility auditing, and an architectural consolidation pass.

### **Evidence and Analysis**

To ensure the Code Universe remains maintainable over a two-year horizon and meets the standards expected of an enterprise engineering tool, the testing infrastructure and User Experience (UX) pipelines require significant maturation.  
**1\. Interactive Contract Tests (Playwright)** Relying on a headless Chrome harness to simply verify that the HTML file parses without throwing errors is insufficient. The interactivity of the export must be mathematically asserted. Playwright natively supports testing local HTML files via the page.goto('file:///path/to/export.html') command. A minimal, high-value Playwright suite must be implemented to assert the following behaviors:

* The canvas WebGL context initializes and renders the primary graph without triggering console warnings.  
* Dispatching a wheel event successfully triggers the zoom state machine, updating the camera matrix.  
* Pressing the / key correctly traps focus in the search bar, and typing yields accurate fuzzy search results.  
* Critically, the test must verify the zero-network constraint. Playwright's network interception capabilities (page.route('\*\*/\*', route \=\> route.abort())) must be configured globally for the test context28. If the local HTML file attempts to request an external web font, a CDN-hosted library, or a telemetry pixel, the test must explicitly fail.

**2\. Determinism as a CI Gate** The rule that the same repository state must yield a byte-for-byte identical export is a hard law that prevents configuration drift. This must be formally asserted in the CI pipeline. The CI script must execute savant export twice consecutively on a stable, mocked repository fixture. It must utilize a stream editor (e.g., sed) to normalize the highly volatile minute-resolution timestamp in the footer string. Subsequently, it must execute a cryptographic hash (shasum \-a 256\) on both resulting HTML files. Any deviation in the hashes indicates a breakdown in determinism and must fail the build.  
**3\. Freshness and CLI Integration** The export is fundamentally a snapshot in time. As the underlying SQLite database changes via subsequent CLI indexing commands, the user's mental model of the HTML artifact can become desynchronized. The footer must be enhanced to include a prominent "Indexed At" timestamp accompanied by a staleness hint. If the user desires a visualization that continuously tracks the live database, they must rely on the previously recommended savant serve command.  
**4\. Error-Path UX** When internal limits are reached during export—such as document budget exhaustion, audio signature mismatches, or ELK layout timeouts—the user must be informed without ruining the initial "wow" factor of the primary graph presentation. The UI must render a discrete, standardized warning icon (e.g., a yellow triangle) anchored in the bottom interface overlay. Clicking this icon must reveal an "Export Diagnostics" modal, providing a concise summary of the failures, such as "34 files truncated due to budget constraints" or "2 images skipped due to signature mismatch."  
**5\. Accessibility Completeness** While ARIA labels currently exist, keyboard navigation requires reinforcement. A standard Focus Trap must be implemented within the node details sidebar and all draggable windows. When a UI panel is opened, Tab navigation must be strictly constrained to the interactive elements within that panel until the Escape key is depressed, preventing the focus outline from wandering invisibly through the canvas elements beneath the overlay.  
**6\. Search Quality** Currently, the fuzzy search algorithm matches only against file paths and node labels. To enhance utility, the search index should be expanded to include the document *contents* (specifically the 8 KiB head text previews) for the 2,000-file baseline. Because the search index will be precomputed in Bun as mandated in Section 6.5, this adds zero latency to the browser's runtime performance, while vastly improving the discoverability of specific function definitions and variables.  
**7\. Binary/Runtime Packaging** The SIGMA\_JS bundle is currently generated and minified at build time. To prevent the distribution of a stale vendored runtime, the binary build path must include an automatic verification step. This step ensures that the version of Sigma.js and Graphology injected into the HTML string perfectly matches the versions locked in the package.json lockfile.  
**8\. Two-Year Maintenance View** Architectural consolidation is required to address mounting technical debt. The CLI export logic currently orchestrates ELK (via a legacy Google Web Toolkit web-worker new Function sandbox), Bun file I/O operations, and custom JSON schema serialization23. The dual-format serialization mapping both the legacy element structures and the modern universe model must be aggressively consolidated into a single, strictly typed TypeScript interface (GraphUniverse). This schema enforcement guarantees stability and lowers the cognitive burden for future maintainers over the next two years.

## **6.8 Deliverables**

### **1\. Architectural Verdict**

For the current scale (17 MB / 2,084 files) and up to a ceiling of 10,000 files, the Code Universe will **maintain the single-file, zero-network HTML paradigm**. The payload issues will be resolved through a combination of dictionary tokenization, strict GZIP/DEFLATE compression, and the utilization of the native browser DecompressionStream API for deferred evaluation. A multi-file directory is rejected due to local CORS restrictions. A full framework pivot (Next.js) is rejected due to the unacceptable compromise of source code confidentiality. For scales exceeding 10,000 files, the system will shift to a **local-serve decision rule**, utilizing a savant serve command to stream data from the local database.

### **2\. Size-Byte Plan**

| Optimization Lever | Current Size | Target Size | Byte Delta | Implementation Action |
| :---- | :---- | :---- | :---- | :---- |
| **Documents (Text)** | 12.5 MB | \~2.5 MB | \- 10.0 MB | Lower budget to 3 MiB; GZIP compress & Base64 encode; parse lazily. |
| **Legacy elements** | 1.5 MB | 0 MB | \- 1.5 MB | Delete completely from schema (unused dead weight). |
| **Universe Data** | 1.5 MB | \~1.1 MB | \- 0.4 MB | Dictionary tokenization; round coordinates to integers. |
| **CSS Watermark** | \~0.86 MB | \~0.05 MB | \- 0.81 MB | Convert raster PNG to a highly optimized inline SVG path. |
| **Sigma.js / Logic** | \~0.55 MB | \~0.50 MB | \- 0.05 MB | Minify further; strip unused Cytoscape comments and constants. |
| **Audio Data** | \~0.05 MB | \~0.05 MB | 0 MB | Maintain as Base64 OGG (already optimized). |
| **Total Projected** | **17.17 MB** | **\~4.2 MB** | **\- 12.9 MB** | Restores the artifact to a highly portable, performant state. |

### **3\. Primary Implementation Sketch**

**CLI (Bun) Pipeline:**

JavaScript  
// 1\. Sanitize and Optimize Data Structure  
delete rawData.elements; // Eliminate legacy debt  
roundCoordinatesToIntegers(rawData.universe); // Enhance precision formatting  
const tokenizedUniverse \= applyDictionaryTokenization(rawData.universe);

// 2\. Compress and Encode Data Blocks  
import { gzipSync } from "bun";  
const compressAndEncode \= (data) \=\> Buffer.from(gzipSync(JSON.stringify(data))).toString('base64');

const base64Universe \= compressAndEncode(tokenizedUniverse);  
const base64Docs \= compressAndEncode(rawData.documents);

// 3\. Inject into HTML Template  
const html \= template  
  .replace('\_\_UNIVERSE\_DATA\_\_', base64Universe)  
  .replace('\_\_DOCS\_DATA\_\_', base64Docs);

**Browser (Load) Runtime:**

JavaScript  
// Fast decoding of Base64 to binary utilizing modern browser APIs  
async function parseCompressedPayload(base64Str) {  
    const binary \= Uint8Array.fromBase64(base64Str);   
    const stream \= new DecompressionStream("gzip");  
    const writer \= stream.writable.getWriter();  
    writer.write(binary);  
    writer.close();  
      
    const response \= new Response(stream.readable);  
    return await response.json();   
}

// Block A: Synchronous bootstrap of vital graph topology  
const universe \= await parseCompressedPayload(document.getElementById('savant-universe').textContent);  
initializeGraphology(universe); // Enforce graph.forEachNode() iteration

// Block B & C: Deferred bootstrap of heavy documents to prevent main-thread blocking  
setTimeout(async () \=\> {  
    window.savantDocs \= await parseCompressedPayload(document.getElementById('savant-docs').textContent);  
}, 150);

### **4\. Computation Location Map**

* **ELK Layered Layout (Positions):** Computed during CLI export time in Bun (Web Worker).  
* **Community Clustering (IDs):** Computed during CLI export time in Bun.  
* **Search Index Generation:** Computed during CLI export time in Bun (New Requirement).  
* **Data Decompression:** Computed at Load / Lazy on Browser (New Requirement).  
* **Graphology Construction:** Computed at Load on Browser.  
* **WebGL Matrix Rendering:** Computed at Load and interactively on Browser GPU.

### **5\. Deferred-Loading Buster (1-file, 0-network)**

To bypass the limitations of the file:// protocol, which prohibits fetching external chunks, the payload is serialized into multiple inert \<script type="text/plain"\> blocks within the DOM. The JavaScript main thread reads the textContent of the Universe block first, decompresses it via the DecompressionStream, and initiates WebGL rendering. Only after the first frame is painted does a setTimeout or requestIdleCallback invoke the decompression of the Document blocks. This guarantees that the user sees the rendered graph instantly, while the heavy 12.5 MB text payload unpacks silently in the background without violating the single-file constraint.

### **6\. "Five Questions" Evaluation**

> 1. **Work for ALL cases? (9/10):** The strict feature-detection fallback ladder ensures compatibility on older browsers, while the transition to savant serve covers massive enterprise repositories exceeding 10k files.  
> 2. **Scale 1,000×? (10/10):** Addressed explicitly by enforcing the 10,000-file cutoff rule, abandoning the single HTML file for a dedicated local server when hardware limits demand it.  
> 3. **Survive hostile inputs? (9/10):** Guaranteed by the implementation of cryptographic JSON escaping, NUL byte detection, and strict byte-cap stat checking before reading massive files into memory.  
> 4. **Maintainable in 2 years? (8/10):** Significantly improved by purging the legacy Cytoscape code, enforcing a strict TypeScript schema, and isolating the ELK GWT worker code.  
> 5. **Industry Standard? (9/10):** Leveraging DecompressionStream, Uint8Array.fromBase64, and WebGL instanced rendering represents the absolute frontier of local web performance engineering.

### **7\. Risks & Pitfalls**

* **DecompressionStream Polyfills:** Older mobile browsers (e.g., iOS Safari prior to 16.4) lack support for DecompressionStream. The system must detect this and degrade gracefully to a warning screen, rather than attempting to ship a 500 KB JavaScript polyfill that would defeat the purpose of optimization.  
* **V8 String Ceilings:** Even with compression, attempting to JSON.parse a 50 MB uncompressed string in a single operation will exceed the V8 engine's maximum string length limitation, resulting in an uncatchable exception. This underscores the necessity of the 10,000-file cutoff rule.  
* **Audio Autoplay Locks:** Failure to properly wire the Web Audio API initialization to the first user gesture will result in console errors and broken audio playback across all modern browsers.

### **8\. Single-Line Framework Verdict**

**VERDICT: STAY STATIC / LOCAL-SERVE HYBRID.** The architecture must retain the static single HTML file for standard sharing and offline reporting, while introducing a \--serve CLI command to stream the local SQLite database for real-time analysis at extreme scale. Moving to a hosted Next.js environment fundamentally violates the requirement for zero-network, air-gapped code confidentiality, and provides no layout performance benefits since ELK computes coordinates deterministically in the CLI and Sigma.js renders via WebGL, neither of which benefit from Server-Side Rendering.

### **9\. Ranked Improvement Backlog**

| Rank | Improvement Item | Effort | Impact | Next Action |
| :---- | :---- | :---- | :---- | :---- |
| **1** | Decompression & Lazy Block Loading | Medium | High | Re-architect the Bun JSON serialization pipeline to utilize gzip compression, Base64 encoding, and DOM block chunking to unblock the browser main thread. |
| **2** | Wasted Payload Purge | Low | High | Delete elements array, convert the raster watermark to a simplified SVG, and fix the \<title\> tag. |
| **3** | Graphology Memory Refactoring | Medium | Medium | Replace all graph.nodes() iterator allocations with graph.forEachNode() callbacks, and transition to integer-based edge IDs to prevent V8 garbage collection frame drops. |
| **4** | Playwright file:// Network Gates | High | Medium | Build an automated interactive test suite utilizing page.route('\*\*/\*', route \=\> route.abort()) to guarantee absolute zero-network compliance in CI. |
| **5** | Implement savant serve Architecture | High | High | Begin structural design for the local HTTP daemon to handle live database streaming for repositories exceeding the 10,000-file threshold. |

#### **Works cited**

> 1. Uint8Array.fromBase64() \- JavaScript \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global\_Objects/Uint8Array/fromBase64](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64)  
> 2. Base64 \- Glossary \- MDN Web Docs \- Mozilla, [https://developer.mozilla.org/en-US/docs/Glossary/Base64](https://developer.mozilla.org/en-US/docs/Glossary/Base64)  
> 3. How fast can browsers process base64 data? \- Daniel Lemire's blog, [https://lemire.me/blog/2025/11/29/how-fast-can-browsers-process-base64-data/](https://lemire.me/blog/2025/11/29/how-fast-can-browsers-process-base64-data/)  
> 4. How to convert uint8 Array to base64 Encoded String? \[duplicate\] \- Stack Overflow, [https://stackoverflow.com/questions/12710001/how-to-convert-uint8-array-to-base64-encoded-string](https://stackoverflow.com/questions/12710001/how-to-convert-uint8-array-to-base64-encoded-string)  
> 5. DecompressionStream \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream)  
> 6. DecompressionStream API | Can I use... Support tables for HTML5, CSS3, etc \- CanIUse, [https://caniuse.com/mdn-api\_decompressionstream](https://caniuse.com/mdn-api_decompressionstream)  
> 7. Compression Streams are now supported on all browsers | Blog \- web.dev, [https://web.dev/blog/compressionstreams](https://web.dev/blog/compressionstreams)  
> 8. DecompressionStream() constructor \- Web APIs \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream)  
> 9. Compression Standard, [https://compression.spec.whatwg.org/](https://compression.spec.whatwg.org/)  
> 10. WebWorker causing memory usage grows very fast and high \- Stack Overflow, [https://stackoverflow.com/questions/75585653/webworker-causing-memory-usage-grows-very-fast-and-high](https://stackoverflow.com/questions/75585653/webworker-causing-memory-usage-grows-very-fast-and-high)  
> 11. Web Worker consumes massive amount of memory \- Stack Overflow, [https://stackoverflow.com/questions/35003676/web-worker-consumes-massive-amount-of-memory](https://stackoverflow.com/questions/35003676/web-worker-consumes-massive-amount-of-memory)  
> 12. \[AskJS\] Reducing Web Worker Communication Overhead in Data-Intensive Applications : r/javascript \- Reddit, [https://www.reddit.com/r/javascript/comments/1h3m2rv/askjs\_reducing\_web\_worker\_communication\_overhead/](https://www.reddit.com/r/javascript/comments/1h3m2rv/askjs_reducing_web_worker_communication_overhead/)  
> 13. FAQs \- Resources \- CodeScene, [https://codescene.com/resources/faq](https://codescene.com/resources/faq)  
> 14. Comparison of Tools for AI Project Analysis in an Air-Gapped Environment \- ONES.com, [https://ones.com/blog/tool-guide/comparison-of-tools-for-ai-29/](https://ones.com/blog/tool-guide/comparison-of-tools-for-ai-29/)  
> 15. Frequently Asked Questions \- Heimdall FAQ, [https://heimdallmap.com/faq.html](https://heimdallmap.com/faq.html)  
> 16. drawio-offline \- Yarn Classic, [https://classic.yarnpkg.com/en/package/drawio-offline](https://classic.yarnpkg.com/en/package/drawio-offline)  
> 17. 32nd International Symposium on Graph Drawing and Network Visualization (GD 2024), [https://drops.dagstuhl.de/entities/volume/LIPIcs-volume-320](https://drops.dagstuhl.de/entities/volume/LIPIcs-volume-320)  
> 18. Pragmatic Software Architecture Visualization with Web Technology \- MACAU, [https://macau.uni-kiel.de/servlets/MCRFileNodeServlet/macau\_derivate\_00009737/nre-diss.pdf](https://macau.uni-kiel.de/servlets/MCRFileNodeServlet/macau_derivate_00009737/nre-diss.pdf)  
> 19. Evaluation Service for Turing Machine Design Tasks \- IS MUNI, [https://is.muni.cz/th/dc8vx/Bc\_thesis\_536635.pdf](https://is.muni.cz/th/dc8vx/Bc_thesis_536635.pdf)  
> 20. Sigma.js, [https://www.sigmajs.org/](https://www.sigmajs.org/)  
> 21. sigma \- UNPKG, [https://app.unpkg.com/sigma@3.0.0-beta.6/files/src/sigma.ts](https://app.unpkg.com/sigma@3.0.0-beta.6/files/src/sigma.ts)  
> 22. Performance tips | Graphology, [https://graphology.github.io/performance-tips.html](https://graphology.github.io/performance-tips.html)  
> 23. elkjs/README.md at master · kieler/elkjs \- GitHub, [https://github.com/kieler/elkjs/blob/master/README.md](https://github.com/kieler/elkjs/blob/master/README.md)  
> 24. Scaling a Node.js Backend from 10K to 1M Users \- Kosi Digital, [https://kosidigital.com/blogs/nodejs-backend-scaling-guide-10k-to-1m-users](https://kosidigital.com/blogs/nodejs-backend-scaling-guide-10k-to-1m-users)  
> 25. maximum call stack exceeded · Issue \#381 · kieler/elkjs \- GitHub, [https://github.com/kieler/elkjs/issues/381](https://github.com/kieler/elkjs/issues/381)  
> 26. Autoplay guide for media and Web Audio APIs \- MDN Web Docs \- Mozilla, [https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)  
> 27. Web Audio, Autoplay Policy and Games | Blog \- Chrome for Developers, [https://developer.chrome.com/blog/web-audio-autoplay](https://developer.chrome.com/blog/web-audio-autoplay)  
> 28. Route | Playwright Python, [https://playwright.dev/python/docs/api/class-route](https://playwright.dev/python/docs/api/class-route)  
> 29. Route | Playwright, [https://playwright.dev/docs/api/class-route](https://playwright.dev/docs/api/class-route)  
> 30. Playwright Network Interception with route(): Complete Reference | QASkills.sh, [https://qaskills.sh/blog/playwright-network-interception-route-guide](https://qaskills.sh/blog/playwright-network-interception-route-guide)  
> 31. Mock APIs \- Playwright, [https://playwright.dev/docs/mock](https://playwright.dev/docs/mock)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAaCAYAAAAaAmTUAAADC0lEQVR4Xu2XTahNURTHl1CEJF/5SmRAvhNRGEhiwMhAMcbAyGeMzsTAREIp1BtJIpn4nFBkwEyJQiIRQsyk8P+9fXb23ufsc+/r3mfy3q/+nff22nffvdZZa+19zQYZOIyWRqSDHdC19cZLG6St0jxpaGyusETqkcamhg6YKV0pn31miLRWeiTdlLaXuiO9kJb/mxoxXborzU8NYoJ0X/pT6pu0IJphdrC0eb2TFpa2NdI162OQhkvHpNdW3TS2s+Y2sjSxEYATUpGMp2yRvpvbbBGbeiEgD6W5yTjrn5YOJeNZ2OwZ6au0IrF5SLUv5hbmCzxE+Xn5bKKQdpmL+jNpcmQ1Wyydk4Yl47DK3GdmpYY6dku/y2eOcdJj6am51PEQsevWXKijpPPmok8weDvbohkunfcmYx7/3cxpZI703uqjFeIXfCNNKcdwAEeO+EkZZpuLOvOJ8k/pljQymEOKrw7+TyEYFyzOigqFuUgdTcZT2NAHi53hyf+b/aQMm6QD5d84gCM4hGNAoC5ZczDJABrJmNTgoY/fM5di62NTBezMCxdcJn205ohCYfH6pBgB9PVHPVKzdfXiIWBhICv4yFLYLNjESat2Ipx5Wz5z+HqZFozxBkhrmgFF3VQvHpwhM8iQWrwzjR6LGebOmc8WnyXtOBPWS0hhLjh7rHW9AM78MNf1aqEr0Z2anCENDpv74n2JrR1nOF/4fIpvPKTpbYs7ZB0t04wcvSj9snxkOHc4LDk0OY9CiDobosBzFFZfj/4wJEhcWZrqBUjFV9bcJHpPdDbbY9XNrpM+ScctbqMe/2Y5DOuYaC7qi1JDiW/Tuc+H0P5bnWe9cH15ae5O5u9j3M2emHMo19sZJwg0h5BJ5tYK71unrHpZJUBXLZ8VHt4ab6/tKw1fREfjlkx+TrW8EyG0WTbOWdFf0PHofv5c6jf4qfBA2pgausgOc4dqWgb9Ah3rstXXVacQrBuWvwB3HdKR6wpqJzXbhbUKc0dCN9dtCSmwX1qZGjqAX7o77T87MsggA4G/J2WStVh5SPcAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFEAAAAaCAYAAADPELCZAAAEjElEQVR4Xu2Ya8hlYxTH/0Ix7s3UIJpGvrg1pplxCw0hl0iiFPk2wwfN5DLEp1OSpBCKXJp8kEJ8cBmhnCJEEeWSSyIRQskXd+v3rr3mPHudvfc5x3u8Yzi/+nfes5999rOe9azLs19pxoz/KrubdskXtyP2Mu2cL86HxabTTOebDjHtWB8e4kjTZrkhAU7lOTsU1/7NHGV6SPU1TAyLPdH0ummL6aJKz5k+Mq0Z3FrjANOLpsOq70eYvjH9aerLnblQnGT6Vj43eta0azG+p3w9MY4eN+1WjV9sukd/MyL50c2mTzXsLMbuNf1gWpnGcPztpl66zm+e0MI7EbAJe38x/Ww6tj48x3mmx1R3MPD9Sfn4RLDgu03fy0O6CVL6O9Ndqqfn4aYPqs/Mg9o2TtxHPvdGeaRlm+FKeZY1caHpFU2Y1peZ/qg+28CwN0zvmpYU1681Pa3mhrKtnLjCdJtpP9P7pi9My4vxnUz3Vfc1cZDpY9PxeaCNg01fyidbmsZKwomfyY0DHIcDr4+bEm1OpNlcIP/dKjU3LZ691nSu6UB5LSOyrtOgfrVBhF1a/d2TR+PlW0c9CLCNNTXB819Q+7qG6MknuTFdz7A7X6nuRD75fnbclMhOJKUukW/GWtMy0y2m5037VvcAnf5D001yh3D/J6b1ps/lju/iVg3uocxQy1/TID2JsDurv9vAdjp1LgNDsLi+PJVPqQ8NwTj3vWTao7qGoV+rPeyzE0+VL+iEuEFejx+RF3OKOqKjUvRJO6DI/246WT5318KiHkbJ4RkPy20/vbpGlLbVw4Ay1ddwFg0RkUTDoHF0cYc8YnvFNZzYFRmlEyP1c00FDP5VvhlhE78NiHTmphmMIuph6WichxNxJpvUVQ8DbCID2lJ+K2FwmaJNUJM4J3L+irMgTOJE6i0pGd9LMDicFEeMvgb3EYltR5VMWQ8D0ph0JguIZuwa5Rxswt6uPjEHEUFkdDmRHaWYs8ir0tgkToy5mnY3nBgpdqbpR3nEbJCfXWkMXWkMjFPr8jkXOEQzx3vy8/Aoxk7nqBeRSk1wbmQHObzmUzzNhs5+RroelE6MuThu8IZTQlNjDpoA4IjV8i7O5o5cSEWuhyVEFCeQcrO6wCY69KiTwBy8gbCAzRp2EqHP6xvdLp/sIaIrp09QOhGYiwM9URHgKF4zeeuJSLtf3lh4bw9RRrJ9GezlFW5RHqjoabz6jx10ZvrA2BD+HC5ZDLuEtpjekRvWlkZcx/l5Mt6dOaKw6wjHRfc/1PSq6SnTA/JN2KS6g84y/ab6+y2iJhOhGZ79kwb3UT95RoZIp/PncpJhHF+ckwdGwYGXHWLX6Yb7q915JbwiMeEowzJ7y1MsRxfRygYcl64vNz2j9rejaUIDI/WZc0EgHV/W4Aw2X+jQfTXXQbr0WB1zHhA4N1QaJ4imBmH/qJrr5qQsM71tukL1KKUMvGm6Rv/s4ngNpqFgx4LCoqhraBoL5D0ZZ+HMtypRQ4/WdJ7fBptGjZ/432DTAgOuNh2TB7Yj1ml6ZWnGjBkz/nf8BcUu7q4Zz3qbAAAAAElFTkSuQmCC>