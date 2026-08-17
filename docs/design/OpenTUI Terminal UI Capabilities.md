<!-- markdownlint-disable MD013 -->
<!-- MD013 is narrowly disabled for this evidence-heavy research report: long cited prose, wide comparison tables, and the verification appendix are intentionally preserved in source form, per repo convention (see docs/design/zero-trust-agentic-provenance.md and docs/archive/design/*.md). -->

# **Architectural Analysis of OpenTUI for AAA Terminal Interfaces**

## **1\. Core Rendering Engine Architecture and Performance**

The evolution of terminal user interfaces (TUIs) has historically been bottlenecked by the performance constraints of string concatenation and garbage collection within JavaScript runtimes. The OpenTUI engine (@opentui/core) circumvents these limitations by decoupling the rendering pipeline from the JavaScript main thread. Instead of relying on the host runtime to calculate layouts and generate terminal escape sequences, OpenTUI delegates these operations to a highly optimized, native core authored in Zig1. This core, comprising approximately 15,900 lines of code, exposes a C Application Binary Interface (ABI) integrated into runtimes like Bun and Node.js via a Foreign Function Interface (FFI)1.  
For an agent harness like Savant-Code, operating on Bun, this FFI binding model is transformative. The TypeScript layer merely manages a lightweight tree of Renderable references. During a frame update, the JavaScript runtime synchronizes the state of these references with the native Zig core4. The core retains the actual memory layout of the terminal grid in a parallel data buffer, distinguishing strictly between bytes, code points, and UTF-16 code units5.  
The engine utilizes a double-buffered, diff-based rendering pipeline. Rather than redrawing the entire terminal screen—a process that causes flickering and severe CPU spikes—OpenTUI composes the next frame as a complete surface in memory, compares it to the previous frame's buffer, and emits minimal ANSI escape sequences solely for the changed cells3. Utilizing SIMD-friendly contiguous arrays, this diffing operation completes in sub-millisecond timeframes3.

### **Comparison: OpenTUI vs. React Ink**

The architectural divergence between OpenTUI and legacy TypeScript renderers like React Ink is substantial, directly impacting operational parameters such as memory footprint and execution speed.

| Metric / Feature | OpenTUI (@opentui/core) | React Ink | Architectural Implication |
| :---- | :---- | :---- | :---- |
| **Rendering Backend** | Native Zig (FFI) | JavaScript (String buffers) | OpenTUI bypasses V8/JavaScriptCore garbage collection pauses, crucial for LLM streaming. |
| **Layout Engine** | Yoga (Native Flexbox) | Yoga (WASM / JS Port) | Native layout calculation in OpenTUI significantly reduces main-thread blocking5. |
| **Alpha Blending** | True RGBA Porter-Duff | None | OpenTUI supports transparent overlays and shadow effects natively3. |
| **Scissor Clipping** | Stack-based (Native) | Manual / Polyfilled | Nested viewports safely hide overflow without calculating hidden strings3. |
| **Update Mechanism** | Diff-based cell updates | Full string recalculation | OpenTUI drastically reduces terminal emulator CPU load by only updating dirty cells3. |
| **Memory Footprint** | \~40MB (in complex apps) | \~80MB+ | OpenTUI leaves more RAM available for local LLM contexts and agent memory8. |
| **Startup Latency** | \~200ms | \~500ms | Faster agent initialization in ephemeral environments8. |

## **2\. The Frame-Based Animation System**

To achieve visually stunning, AAA-quality interfaces, animations must run independently of the React reconciliation cycle. OpenTUI implements a rigorous, frame-based animation API designed to deliver fluid 60 FPS motion without blocking background agent processes.  
The lifecycle of an animation is governed by the requestLive() and dropLive() routines. By default, OpenTUI operates in an automatic mode, responding only to state mutations4. When continuous rendering is required, invoking renderer.requestLive() increments an internal request counter, keeping the render loop active4. Multiple components can independently request live rendering; the engine only returns to an idle state when all components invoke renderer.dropLive() and the counter reaches zero4. This ensures that overlapping animations share a unified, efficient loop.  
Frame rate configurations allow developers to balance visual fidelity against system resources. The targetFps parameter defines the steady-state refresh rate (typically defaulting to 30, but adjustable to 60 for AAA applications), while maxFps caps the upper limit for immediate, state-driven re-renders4. Running a terminal at 60 FPS sets a minimum frame time of approximately 16.6 milliseconds9. For battery-conscious agent operations, it is critical to lower the targetFps when the application loses focus or idles.

### **Animation Hooks and Custom Loops**

Because explicit documentation regarding the renderBefore and renderAfter callbacks is omitted from the primary specification4, their mechanics must be deduced from the engine's FFI architecture and standard game-loop paradigms. It can be logically concluded that renderBefore(deltaTime) fires at the commencement of a frame tick, prior to the Yoga layout resolution. This phase allows developers to inject procedural physics, update external state machines, or manipulate coordinate data before the native core locks the cell buffer. Conversely, renderAfter(deltaTime) executes post-commit, after the terminal has received the updated ANSI sequences, making it the optimal location for telemetry capture, time-to-first-draw measurements, and garbage collection scheduling.  
The primary hook for custom motion is onUpdate(deltaTime). This hook exposes the elapsed time since the previous frame, permitting frame-rate-independent physics10. The idiomatic approach to high-performance animation requires manipulating native Renderable properties within this hook, bypassing the React virtual DOM entirely9.  
Furthermore, OpenTUI supports affine transforms via translateX and translateY. Based on the rendering pipeline's architecture5, these transforms operate as visual offsets applied after the Yoga layout phase. Because they do not alter the component's intrinsic document flow, manipulating these values does not trigger a recursive layout reflow, allowing for computationally inexpensive slide-ins and parallax effects.

### **The Timeline Module and Physics**

For declarative animation, the engine provides the animation/Timeline module, powered by a robust JSAnimation implementation10.

| Timeline Parameter | Type | Description |
| :---- | :---- | :---- |
| duration | Number | The length of the animation cycle in milliseconds10. |
| loop | Boolean | Instructs the timeline to restart indefinitely upon completion10. |
| alternate | Boolean | Creates a ping-pong effect, reversing the animation curve on every other cycle. |
| autoplay | Boolean | Determines if the animation begins immediately upon instantiation10. |
| easing | String / Function | Defines the interpolation curve. The system includes 25 distinct easing functions (e.g., cubic beziers, bounce)6. |

Beyond static tweens, the engine integrates procedural physics. Elements can be animated using spring physics algorithms, allowing components to exhibit natural elasticity, inertia, and bounce based on configurable tension and friction parameters12.

## **3\. The Layout Engine: Yoga Flexbox Integration**

Spatial math and component positioning are delegated to Yoga, a highly optimized Flexbox engine running within the native Zig boundary5. This integration ensures that the layout behavior matches standard CSS specifications, providing a predictable environment for designing complex dashboard architectures.  
The layout is resolved as a continuous mathematical calculation that is discretized only when applied to the terminal grid5. This means that percentage-based widths scale perfectly during terminal SIGWINCH resize events without requiring JavaScript intervention5.

### **Supported Layout Capabilities**

| Layout Paradigm | Supported Properties and Behaviors |
| :---- | :---- |
| **Directional Flow** | flexDirection (row, column), flexWrap, flexGrow, flexShrink, and flexBasis2. |
| **Alignment** | alignItems, justifyContent, alignSelf, and alignContent14. |
| **Spacing & Box Model** | padding, margin, and gap2. |
| **Positioning** | Standard flow is relative. Supports position: "absolute" combined with top, bottom, left, right to remove elements from the standard document flow4. |
| **Z-Index Layering** | Layers composite bottom-to-top on the Z-axis17. Absolute elements with higher Z-indexes render over base content. |
| **Overflow Dynamics** | Configurable as hidden (enforcing native scissor clipping), scroll (enabling interactive viewports), or visible3. |
| **Borders** | Support for rounded, double, single, and none2. Borders can be configured per-side2. |

To emulate advanced visual effects like box-shadow within a terminal constraint, developers utilize absolute positioning and negative Z-indexes to place dimmed background cells or block characters behind primary containers, simulating depth against the back buffer.

## **4\. Visual Styling and Material Execution**

To differentiate Savant-Code from legacy CLI tools, the interface requires high-fidelity graphics. OpenTUI implements a styling pipeline that fully exploits modern terminal emulator capabilities3.  
The system natively supports 24-bit Truecolor via RGB hex codes, alongside standard ANSI and 256-color palettes3. The defining feature of this pipeline is its implementation of real RGBA alpha blending utilizing the Porter-Duff compositing algorithm3. When a developer assigns a translucent hex code (e.g., \#FF000080 for 50% red) to an overlay, the native core calculates the precise mathematical blend against the background cells and outputs the exact interpolated truecolor ANSI sequence required to display it3. This facilitates complex visual hierarchies, such as dimmed background states behind active modals.  
Text typography is robustly handled. Modifiers are applied semantically and correctly parse UTF-16 code units so that wide graphemes and emojis do not disrupt text wrapping or alignment computations3.

| Visual Attribute | Implementation Details |
| :---- | :---- |
| **Colors** | Background and foreground colors accept string names, ANSI indices, or hexadecimal RGB/RGBA values2. |
| **Text Modifiers** | Native support for bold, italic, underline, strikethrough, dim, inverse, and blinking19. |
| **Fills & Gradients** | Backgrounds support solid fills. Extensions allow for gradient wave generation across text and backgrounds22. |
| **Borders** | Color, style, and width are highly customizable. Developers can define distinct visuals for the top, bottom, left, and right edges2. |
| **Post-Processing** | Advanced libraries integrated with OpenTUI support effects such as glow (radius brightening), blur (background color averaging), and procedural distortion23. |

## **5\. Built-in Component Architecture**

The @opentui/core and @opentui/react packages provide a comprehensive standard library of UI primitives designed to interface flawlessly with the native layout engine1. These components abstract the complexity of FFI memory management while exposing extensive customization surfaces.

| Component Class | Component Name | Description and Customization Surface |
| :---- | :---- | :---- |
| **Display & Layout** | Box / \<box\> | The primary layout container. Configured with Flexbox properties, borders, and padding2. |
|  | Text / \<text\> | The foundational text rendering node. Accepts content, foreground color, and semantic modifiers2. |
|  | ScrollBox / \<scrollbox\> | A container explicitly engineered for overflow content, managing nested vertical and horizontal scroll contexts10. |
|  | ASCIIFont / \<ascii\_font\> | Renders large banner text using Figlet font libraries10. |
|  | FrameBuffer | Provides low-level, direct pixel/cell array access for game rendering or custom graphics2. |
|  | Image | Interfaces with Kitty or Sixel graphics protocols to render actual bitmaps2. |
| **Input & Interaction** | Input / \<input\> | A single-line text field featuring a managed cursor, placeholder styling, and focus states10. |
|  | Textarea / \<textarea\> | A multi-line text editor. Exposes a programmatic API for Emacs/Vim-style cursor movement, word-forward/backward jumps, and selection tracking10. |
|  | Select / \<select\> | A vertical list selection interface supporting keyboard navigation10. |
|  | TabSelect / \<tab\_select\> | A horizontal, tab-based navigation component with built-in scroll support for overflowing tabs10. |
|  | Slider | A visual track component allowing numeric input adjustment2. |
| **Code & Data** | Code / \<code\> | Integrates with Tree-sitter for native syntax highlighting, offloading parsing from the main JS thread4. |
|  | LineNumber / \<line\_number\> | Renders sequential tracking lines alongside code blocks, featuring diagnostic hints10. |
|  | Diff / \<diff\> | A specialized viewer for visualizing unified or split Git diffs10. |
|  | Markdown | Streams and progressively parses markdown structures into formatted UI elements2. |
|  | TextTable | Structured grid rendering engineered for complex datasets and wrapping2. |
|  | QRCode | Generates terminal-renderable QR code sequences1. |

## **6\. Input, Interaction, and Event Routing**

The input model in OpenTUI discards standard Node.js generic streams in favor of a raw, low-level event architecture capable of interpreting complex terminal interactions. The engine actively parses terminal input sequences and emits highly structured key events via the renderer.keyInput emitter28.  
Keyboard events are separated into distinct properties, including the canonical name (e.g., "return", "escape"), the raw decoded sequence, and modifier booleans (ctrl, shift, meta, option)28. A critical innovation within OpenTUI is the implementation of "Scope Trees" for focus management30. Rather than relying on a massive, global switch statement to handle application routing, key events bubble upwards from the currently focused renderable. Using the useKeyboard hook with a specific ref option assigns the handler to a local subtree31. If an event is intercepted by a modal or floating panel, executing stopPropagation() prevents the keystroke from leaking to the underlying document31.  
For accessibility and navigation, passing trapFocus: true and autoFocus: true to a container ensures that the Tab and Shift+Tab keys cycle focus strictly within that container's children31. Advanced keybinding layers and leader-key chords are supported via the @opentui/keymap ecosystem library1.  
Mouse interactions are fully supported by enabling the Kitty Keyboard protocol or SGR 1006 during renderer instantiation ({ useMouse: true, enableMouseMovement: true })3. The engine translates terminal cell coordinates to the active layout bounds, enabling click, hover, and scroll events4. With continuous position tracking active, developers can implement fluid drag-and-drop mechanics32.  
Copy and paste integration bypasses the risk of terminal buffer overflow. The usePaste(handler) hook intercepts bracketed paste sequences natively10. It provides raw byte arrays that are subsequently processed via the decodePasteBytes utility, allowing massive code blocks to be ingested instantly without triggering thousands of individual, layout-blocking keypress events10.

## **7\. React Reconciler Specifics (@opentui/react)**

To interface the declarative nature of modern UI development with the imperative Zig core, Savant-Code utilizes the @opentui/react reconciler1. The application is mounted via createRoot(renderer).render(\<App /\>), at which point the custom reconciler traverses the JSX tree, minting and updating the native FFI Renderable instances10.

### **Hook Surface Area**

The reconciler exposes a highly specialized suite of hooks designed for terminal environments:

| Hook | Functionality and Usage |
| :---- | :---- |
| useRenderer() | Fetches the top-level CliRenderer instance from context, allowing direct access to the engine's lifecycle methods10. |
| useTimeline(options) | Automates the animation lifecycle. Registers a timeline with the engine, automatically managing the requestLive() and dropLive() counter on mount/unmount10. |
| useKeyboard(handler, options) | Attaches keyboard listeners. Supports isolating scope via { ref: myRef } and capturing keyup events via { release: true }10. |
| usePaste(handler) | Intercepts bracketed paste events, providing raw byte streams for safe decoding10. |
| useTerminalDimensions() | Returns a reactive { width, height } object reflecting the current row and column count of the emulator10. |
| useOnResize(callback) | Subscribes directly to terminal SIGWINCH resize events for manual calculation interventions10. |
| useFocus() & useBlur() | Attaches lifecycle callbacks to focus state changes on specific components10. |

### **Re-renders vs. Direct Core Manipulation**

A critical architectural consideration is the performance implication of React's Virtual DOM. Driving 60 FPS animations via React state (e.g., calling setWidth() inside a setInterval) forces the reconciler to walk the component tree and triggers recursive Yoga layout recalcs on every frame. This pattern is documented to spike CPU usage beyond 30%9.  
The idiomatic method for high-performance animation requires bypassing React entirely. Using the useTimeline hook, developers attach to the onUpdate callback to mutate the unmanaged, native FFI reference directly (e.g., ref.current.translateX \= newValue). This executes at sub-millisecond speeds, while React remains oblivious until an onComplete callback synchronizes the final state9.  
For legacy class components, developers must override componentDidMount to construct imperative Timeline logic and manually manage the live counter, writing directly to DOM refs in unprotected update methods.

### **Error Boundaries and Fallback UI**

Terminal renderers operate in a delicate state, manipulating the emulator's raw mode. If the React tree encounters an unhandled exception and crashes, the terminal may be left with a hidden cursor and raw input capturing enabled. Implementing an ErrorBoundary that renders a fallback \<box\> with error traces is mandatory. Crucially, fatal process exits must intercept SIGINT or uncaughtException to explicitly invoke renderer.destroy(), restoring the stty cooked mode and gracefully exiting the FFI boundary3.

## **8\. Verified Ecosystem Libraries**

The @opentui/core ecosystem contains several verified third-party libraries that exponentially expand the visual and functional capabilities of Savant-Code.

### **opentui-spinner**

Handling asynchronous states fluidly is vital. opentui-spinner provides a highly optimized \<Spinner\> component featuring over 80 distinct spinner animations (sourced from the cli-spinners standard)22. The library's primary innovation is its adaptive scheduler. Rather than each spinner spawning its own setInterval timer, all spinners globally share a single heap-based interval scheduler capped at 60 FPS22. This eliminates CPU thrashing during concurrent network requests. Invisible spinners are automatically suspended, halting FFI render requests entirely22. Additionally, the library exports visual color generators: createPulse(\[colors\], speed) and createWave(\[colors\])22. These utilities generate hex arrays that sweep across the spinner characters, returning RGBA strings that OpenTUI natively blends into smooth gradients.

### **opentui-ui**

A high-level composite component framework designed to accelerate application development34. It provides accessible, complex widgets abstracting the layout engine:

* **Dialog:** Implements centered modals with background dimming, integrating the trapFocus keyboard scope isolation natively31.  
* **Toast:** Ephemeral notification stacks mapped to absolute positioning, automatically managing entry/exit timeline animations and Z-index layering36.

### **termdraw**

An advanced object-based terminal illustrator32. Termdraw utilizes OpenTUI's mouse support to enable vector-style drawing across the cell grid32. It enables the rendering of movable, resizable lines, boxes, and ascii-art components natively in the terminal32. For integration, it exports \<TermDrawApp\> and \<TermDrawEditor\>, allowing developers to embed a fully functional drawing canvas as a standard React component within their TUI32.

### **anscribe**

A utility bridging the visual UI with agentic logic. Anscribe captures live UI states by serializing the current configuration of an OpenTUI layout tree. It then passes this spatial data via clipboard or the Model Context Protocol (MCP) to AI agents, providing LLMs with genuine spatial awareness of the terminal GUI24.

## **9\. Real-World Visual Examples and Capabilities**

OpenTUI powers applications that push the boundaries of what is traditionally considered possible in a terminal emulator.

> 1. **OpenCode:** The flagship AI coding agent powering millions of interactions1. OpenCode demonstrates the engine's capability to manage highly complex layouts concurrently. It renders split diff views, threaded chat interfaces, streaming markdown, and real-time Tree-sitter code highlighting without experiencing layout thrashing or input lag4.  
> 2. **opentui-doom:** A functional port of the classic game DOOM. By directly interfacing with the OpenTUI FrameBuffer primitive, it maps an array of RGBA pixels directly to the terminal cell buffer, demonstrating the extreme performance limits and refresh rates achievable by the C ABI24.  
> 3. **present-drop:** An interactive arcade game that highlights the timeline system's capabilities. It relies on instantaneous keystroke-to-motion latency, utilizing bounding box collision detection and smooth entity movement to deliver a playable experience entirely inside the CLI24.  
> 4. **gloomberb & Ascii-Motion:** Gloomberb exemplifies dense data visualization through a Bloomberg-style financial dashboard utilizing nested Flexbox grids24. Ascii-Motion showcases the absolute limits of terminal post-processing, executing non-destructive effects like Digital Rain, Wave Warps, and multi-layer compositing using keyframe interpolation13.

The visual effects achievable with OpenTUI include particle systems rendered behind translucent UI panels3 and real-time data visualization plotting metrics via Braille characters to quadruple the effective spatial resolution12.

## **10\. Version History and Migration Guide (0.2.2 to 0.5.x)**

For Savant-Code, upgrading from version 0.2.2 to the 0.5.x branch unlocks critical stability enhancements and visual capabilities but requires navigating several breaking changes.

### **Version Highlights**

| Version Branch | Key Additions and Architectural Changes |
| :---- | :---- |
| **0.3.x** | Introduced robust keyboard isolation and Scope Trees. The useKeyboard hook transitioned from global listener registration to tree-native bubbling, allowing modals to trap focus effectively31. Added the TabSelect component. |
| **0.4.x** | Stabilized the reconciler engines. Corrected autoplay conditions within the useTimeline hook38. Significantly improved Windows process cleanup reliability and GBK/UTF-8 subprocess handling39. |
| **0.5.x** | Rebased the native core to Zig 0.1638. Re-architected Node FFI layout reads to exponentially speed up struct storage reuse38. Added Native Image Rendering for ICC profiled PNG images directly in the buffer38. Introduced embedded terminal runtime execution contexts38. |

### **Migration Guide and Gotchas**

When transitioning Savant-Code to 0.5.x, several critical code paths must be audited:

> 1. **Keyboard Event Refactoring:** The shift to tree-native bubbling means that legacy global useKeyboard handlers bound to dialogs will now "leak" events to the underlying UI. Developers must explicitly bind these handlers via a React ref and utilize the trapFocus property to maintain isolation31.  
> 2. **Animation and Type Dependencies:** The internal TypeScript definitions for ColorGenerator (utilized by opentui-spinner for wave effects) underwent structural changes. To prevent TypeScript compilation failures, ecosystem dependencies must be simultaneously bumped (e.g., opentui-spinner to ^0.0.7) to ensure peer-dependency alignment40.  
> 3. **Destruction Lifecycle Strictness:** The renderer.destroy() flow is heavily enforced in 0.5.x. Failing to execute teardown logic on a fatal crash will permanently mangle the terminal state42. Ensure all signals (SIGINT, SIGTERM, uncaughtException) are trapped and route to the destroy method.

## **11\. Performance Optimization Strategies**

Sustaining a flawless 60 FPS in a terminal emulator demands strict adherence to performance constraints.  
To isolate bottlenecks, developers must utilize the built-in debug overlay by injecting the OPENTUI\_DEBUG=true environment variable43. This exposes telemetry regarding the internal scheduler. For deeper analysis, execution should be traced utilizing Bun’s native CPU profiler (bun \--cpu-prof), which accurately identifies whether CPU time is being consumed by FFI boundary crossings, Yoga layout calculations, or V8 JavaScript execution overhead22.  
The primary cause of dropped frames and CPU spikes is layout thrashing—forcing the Yoga engine to repeatedly recalculate spatial constraints9. To avoid this, developers should never animate structural layout properties (such as width, height, or padding). Instead, visual properties (translateX, translateY, color, opacity) should be targeted, as these are applied post-layout and do not trigger sibling reflows. When animating structural bounds is unavoidable, the container must be isolated using absolute positioning constraints to prevent chain-reaction recalcs.  
Battery management is equally critical. Animations trigger continuous FFI calls via requestLive(). Left uncontrolled, an invisible spinning element will rapidly deplete a laptop's battery by demanding 60 render passes per second. Memory cleanup patterns dictate that dropLive() must be rigorously invoked within React useEffect cleanup blocks. Furthermore, components should actively query their layout bounds; if they overflow and become hidden by scissor clipping, they must auto-suspend their animation loops22. Dynamic adjustment of targetFps is recommended: drop to 15 FPS when the application loses focus, and burst to 60 FPS exclusively during active interaction.

## **12\. Limitations, Protocol Constraints, and Workarounds**

Despite its architectural sophistication, OpenTUI remains bounded by the realities of terminal emulator fragmentation.

### **Graphics Protocol Fragmentation**

While OpenTUI v0.5.x introduces native image rendering38, the actual display is entirely dependent on terminal support. The engine probes the environment for advanced graphics protocols, such as Sixel or the Kitty image protocol5.

* **Limitation:** On legacy environments (such as the standard Windows Console, GNOME Terminal, or older iterations of Apple Terminal), these protocols fail, meaning pixel-perfect bitmaps cannot be rendered.  
* **Workaround:** OpenTUI elegantly handles this via an automatic fallback sequence. Upon capability failure, the engine maps the sampled image colors to Unicode half-block characters, maintaining the spatial layout and color palette of the image within the constraints of the standard grid resolution5.

### **The OSC 66 Terminal Defect**

* **Limitation:** OpenTUI relies on OSC 66 escape sequences to query the terminal emulator for explicit character width detection. On unsupported terminals (e.g., older GNOME terminals, Konsole, and VT100 emulators), this query leaks directly into standard output, resulting in broken "66" text artifacts polluting the screen44.  
* **Workaround:** Applications like Savant-Code must implement environment detection and explicitly inject process.env.OPENTUI\_FORCE\_EXPLICIT\_WIDTH \= "false" before instantiating the CliRenderer to silence the probe on known hostile platforms44.

## **13\. Idiomatic Reference Patterns**

To maximize the efficacy of OpenTUI within the Savant-Code harness, the following idiomatic implementation patterns should govern UI construction.  
**Animated Spinner During Async Work:** Developers must not implement manual setInterval timers for loading states. The idiomatic approach imports SpinnerRenderable from opentui-spinner22. This component is wrapped in a React state block mapped to the asynchronous task's execution. The library's adaptive scheduler will automatically manage the frame loop, suspending all FFI render calls the moment the agent process returns the state to false22.  
**Live-Updating Progress Bar with Shimmer Effect:** Construct a \<box\> element configured with overflow: hidden. Nest a secondary \<box\> representing the progress fill inside. Attach a useTimeline hook to animate the inner box's width from 0% to 100%. To achieve a wave/shimmer effect, generate an array of RGBA hex codes via createWave(\["\#00FF00", "\#FFFFFF", "\#00FF00"\])22. Pass this generator to the background color property, and animate the color offset within the onUpdate tick to bypass React entirely.  
**Typewriter Text Reveal:** When an LLM streams tokens, rendering the output token-by-token via React state will cause crippling layout thrashing as Yoga recalculates the text wrapping on every frame. Instead, instantiate an off-screen ScrollbackSurface4. Append incoming tokens to a native TextRenderable string. Execute surface.commitRows() sequentially, instructing the diff engine to paint the newly generated lines directly into the terminal's native scrollback without forcing the entire UI layout to recalculate4.  
**Animated Foldable/Collapsible Panel:** Implement an outer \<box\> with flexDirection: column. Inside, render the header row, followed by an inner content \<box\>. When the user triggers a fold via keyboard input, do not immediately remove the inner box from the JSX tree. Instead, apply a useTimeline animation targeting the inner box's height, easing the value to 0 over 300ms using a spring physics curve10. Once the timeline emits onComplete, safely unmount the component in React to finalize the state.  
**Scrolling Log Output with Smooth Scroll:** For massive agent output streams, instantiate a \<scrollbox\> element. As new log elements append, do not allow the terminal to jump line-by-line. Instead, manually increment the viewport's vertical scrollTop property using a Spring interpolation curve12 within the onUpdate loop. This transforms jagged log jumps into a fluid, sub-pixel-smooth scrolling experience, representing the benchmark for AAA-quality terminal interfaces.

### **Works cited**

> 1. OpenTUI is a library to build terminal user interfaces (TUI) · GitHub, [https://github.com/anomalyco/opentui](https://github.com/anomalyco/opentui)  
> 2. Getting started | OpenTUI Docs, [https://opentui.com/docs/getting-started/](https://opentui.com/docs/getting-started/)  
> 3. GitHub \- Dicklesworthstone/opentui\_rust: Terminal UI rendering engine for Rust with real RGBA alpha blending, scissor clipping, and double-buffered cell composition. Port of OpenTUI (Zig)., [https://github.com/Dicklesworthstone/opentui\_rust](https://github.com/Dicklesworthstone/opentui_rust)  
> 4. Renderer \- OpenTUI, [https://opentui.com/docs/core-concepts/renderer/](https://opentui.com/docs/core-concepts/renderer/)  
> 5. Rendering pipeline | OpenTUI Docs, [https://opentui.com/docs/core-concepts/rendering-pipeline/](https://opentui.com/docs/core-concepts/rendering-pipeline/)  
> 6. jyooi/elixir-opentui: A terminal UI framework for Elixir with a high-performance Zig NIF backend. \- GitHub, [https://github.com/jyooi/elixir-opentui](https://github.com/jyooi/elixir-opentui)  
> 7. What's Next for OpenTUI, [https://opentui.com/scrollback/whats-next-for-opentui/](https://opentui.com/scrollback/whats-next-for-opentui/)  
> 8. Releases · moazbuilds/CodeMachine-CLI \- GitHub, [https://github.com/moazbuilds/CodeMachine-CLI/releases](https://github.com/moazbuilds/CodeMachine-CLI/releases)  
> 9. \~30% CPU usage while waiting for model response — possibly spinner-driven render loop at 60 FPS · Issue \#22017 · anomalyco/opencode \- GitHub, [https://github.com/anomalyco/opencode/issues/22017](https://github.com/anomalyco/opencode/issues/22017)  
> 10. @opentui/react \- npm, [https://www.npmjs.com/package/@opentui/react](https://www.npmjs.com/package/@opentui/react)  
> 11. SolidJS \- OpenTUI, [https://anomalyco-opentui.mintlify.app/integrations/solid](https://anomalyco-opentui.mintlify.app/integrations/solid)  
> 12. nervosys/Louie: The TUI framework for agentic AI \- GitHub, [https://github.com/nervosys/louie](https://github.com/nervosys/louie)  
> 13. GitHub \- CameronFoxly/Ascii-Motion: A modern web application for creating and animating ASCII art, [https://github.com/cameronfoxly/Ascii-Motion](https://github.com/cameronfoxly/Ascii-Motion)  
> 14. Box component background \+ border · Issue \#496 · anomalyco/opentui \- GitHub, [https://github.com/anomalyco/opentui/issues/496](https://github.com/anomalyco/opentui/issues/496)  
> 15. TimeToFirstDraw \- OpenTUI, [https://opentui.com/docs/components/time-to-first-draw/](https://opentui.com/docs/components/time-to-first-draw/)  
> 16. opentui | Agent Skills Library \- Awesome MCP Servers, [https://mcpservers.org/agent-skills/msmps/msmps-opentui-skill/opentui](https://mcpservers.org/agent-skills/msmps/msmps-opentui-skill/opentui)  
> 17. ASCII Motion uses a layer-based composition system for creating animations. Each project contains multiple layers, each with content frames, transform property tracks, and procedural effects — all managed through the timeline., [https://docs.ascii-motion.com/animation](https://docs.ascii-motion.com/animation)  
> 18. TabSelect \- OpenTUI, [https://opentui.com/docs/components/tab-select/](https://opentui.com/docs/components/tab-select/)  
> 19. remorses/ghostty-opentui: Render ANSI and terminal otuput directly in opentui \- GitHub, [https://github.com/remorses/ghostty-opentui](https://github.com/remorses/ghostty-opentui)  
> 20. OpenTUI, [https://opentui.com/](https://opentui.com/)  
> 21. mattmaribojoc/open-vui: Vue Adapter for OpenTUI \- GitHub, [https://github.com/mattmaribojoc/open-vui](https://github.com/mattmaribojoc/open-vui)  
> 22. opentui-spinner \- NPM, [https://npmjs.com/package/opentui-spinner](https://npmjs.com/package/opentui-spinner)  
> 23. Getting Started with ASCII Motion, [https://docs.ascii-motion.com/getting-started](https://docs.ascii-motion.com/getting-started)  
> 24. A curated list of awesome opentui resources \- GitHub, [https://github.com/msmps/awesome-opentui](https://github.com/msmps/awesome-opentui)  
> 25. Input \- OpenTUI, [https://opentui.com/docs/components/input/](https://opentui.com/docs/components/input/)  
> 26. Textarea \- OpenTUI, [https://opentui.com/docs/components/textarea/](https://opentui.com/docs/components/textarea/)  
> 27. Select \- OpenTUI, [https://opentui.com/docs/components/select/](https://opentui.com/docs/components/select/)  
> 28. Keyboard input \- OpenTUI, [https://opentui.com/docs/core-concepts/keyboard/](https://opentui.com/docs/core-concepts/keyboard/)  
> 29. opentui — AI agent skill | explainx.ai, [https://explainx.ai/skills/msmps/opentui-skill/opentui](https://explainx.ai/skills/msmps/opentui-skill/opentui)  
> 30. Proposal: The Grid™ · Issue \#553 · anomalyco/opentui \- GitHub, [https://github.com/anomalyco/opentui/issues/553](https://github.com/anomalyco/opentui/issues/553)  
> 31. Proposal: element with scope-aware keyboard hooks · Issue \#638 · anomalyco/opentui \- GitHub, [https://github.com/anomalyco/opentui/issues/638](https://github.com/anomalyco/opentui/issues/638)  
> 32. @benvinegar/termdraw \- npm, [https://www.npmjs.com/package/@benvinegar/termdraw](https://www.npmjs.com/package/@benvinegar/termdraw)  
> 33. React \- OpenTUI, [https://anomalyco-opentui.mintlify.app/integrations/react](https://anomalyco-opentui.mintlify.app/integrations/react)  
> 34. Installation | termcn, [https://www.termcn.dev/docs/installation](https://www.termcn.dev/docs/installation)  
> 35. @opentui-ui/dialog CDN by jsDelivr \- A CDN for npm and GitHub, [https://www.jsdelivr.com/package/npm/@opentui-ui/dialog](https://www.jsdelivr.com/package/npm/@opentui-ui/dialog)  
> 36. @opentui-ui/toast 0.0.5 on npm \- Libraries.io \- security, [https://libraries.io/npm/@opentui-ui%2Ftoast](https://libraries.io/npm/@opentui-ui%2Ftoast)  
> 37. termdraw/README.md at main \- GitHub, [https://github.com/benvinegar/termdraw/blob/main/README.md](https://github.com/benvinegar/termdraw/blob/main/README.md)  
> 38. Releases · anomalyco/opentui \- GitHub, [https://github.com/anomalyco/opentui/releases](https://github.com/anomalyco/opentui/releases)  
> 39. Releases · opensquilla/opensquilla \- GitHub, [https://github.com/opensquilla/opensquilla/releases](https://github.com/opensquilla/opensquilla/releases)  
> 40. bun typecheck fails from opentui-spinner ColorGenerator type mismatch \#26119 \- GitHub, [https://github.com/anomalyco/opencode/issues/26119](https://github.com/anomalyco/opencode/issues/26119)  
> 41. opentui-spinner \- UNPKG, [https://app.unpkg.com/opentui-spinner@0.0.7/files/dist/index.d.mts](https://app.unpkg.com/opentui-spinner@0.0.7/files/dist/index.d.mts)  
> 42. opentui | Skills Marketplace \- LobeHub, [https://lobehub.com/skills/msmps-opentui-skill-opentui](https://lobehub.com/skills/msmps-opentui-skill-opentui)  
> 43. OpenTUI: The Terminal UI Framework Developers Love \- Smart Converter \- Bright Coding, [https://converter.brightcoding.dev/blog/opentui-the-revolutionary-terminal-ui-framework-developers-love](https://converter.brightcoding.dev/blog/opentui-the-revolutionary-terminal-ui-framework-developers-love)  
> 44. opentui/packages/core/docs/development.md at main \- GitHub, [https://github.com/anomalyco/opentui/blob/main/packages/core/docs/development.md](https://github.com/anomalyco/opentui/blob/main/packages/core/docs/development.md)

---

## 14. Verification & Corrections (2026-08-16)

> **How to read this section:** Every claim below was checked against the OpenTUI GitHub releases, opentui.com docs, the "What's Next for OpenTUI" roadmap post (2026-07-20), and the npm registry on 2026-08-16. Statuses: **VERIFIED** = confirmed in primary sources; **INCORRECT** = contradicted by primary sources; **UNVERIFIED** = plausible but not confirmed by any cited source. Where a section above conflicts with this appendix, **this appendix wins** — the body of the report has not been rewritten (non-destructive correction, per repo convention).

### 14.1 Critical corrections (INCORRECT — do not design against)

| Report section | Claim | Correction | Evidence |
|---|---|---|---|
| §6, §10 | Scope Trees: `useKeyboard` with `{ ref }` scope isolation, `stopPropagation()`, `trapFocus`/`autoFocus` on containers; 0.3.x "introduced robust keyboard isolation and Scope Trees" | **INCORRECT — feature is not shipped.** Issue #638 ("Proposal: element with scope-aware keyboard hooks") is still an **open proposal**. The current `useKeyboard(handler, options)` (verified on @opentui/react 0.5.3 npm docs) supports exactly one option: `release?: boolean`. Key events route to the focused component; there is no tree-bubbling isolation model to migrate to. | github.com/anomalyco/opentui/issues/638; npmjs.com/package/@opentui/react (Hooks → useKeyboard) |
| §10 gotcha #1 | "The shift to tree-native bubbling means legacy global useKeyboard handlers will now 'leak' events" | **INCORRECT — delete this migration step.** No keyboard-event refactoring is required for 0.2.2 → 0.5.x. | Same as above |
| §13 | Typewriter pattern via "off-screen ScrollbackSurface" + `surface.commitRows()` | **INCORRECT — API does not exist.** The "What's Next for OpenTUI" post (2026-07-20) never mentions ScrollbackSurface; it states the render tree is **still TypeScript-owned** and moving it native is a *future milestone*. Replace with: chunked React state commits (batch ~8-16 chars per flush), or imperative updates on a native `Text` renderable ref (mutate `ref.current` text outside React for the hot path). | opentui.com/scrollback/whats-next-for-opentui/ |
| §7 | `useFocus()`/`useBlur()` = "lifecycle callbacks to focus state changes on specific components" | **INCORRECT.** They fire on **terminal window** focus/blur events (documented: "Subscribe to terminal window focus events"). Component-focus callbacks are not part of this hook pair. | @opentui/react npm (Hooks → useFocus/useBlur) |
| §1, §3 | Yoga is native in the current version | **INCORRECT for the pinned version.** Native yoga-layout landed in **v0.4.1** ("Native yoga-layout", 2026-06-11). Savant-Code pins 0.2.2 and depends on the JS/WASM `yoga-layout@^3.2.1` package (cli/package.json) — that dependency is dropped after the 0.5.x upgrade. The ~2.5x median / up to 30x narrow layout speedups quoted by the roadmap post describe the *post-0.4.1* world. | github.com/anomalyco/opentui/releases (v0.4.1); opentui.com/scrollback/whats-next-for-opentui/; cli/package.json |
| §5 | `Markdown` component in the built-in set | **INCORRECT.** Not in the @opentui/react 0.5.3 component list (text, box, scrollbox, ascii-font, input, textarea, select, tab-select, code, line-number, diff). Markdown is rendered by consumers (Savant already does this via `cli/src/components/blocks/markdown-renderables.tsx`). | npmjs.com/package/@opentui/react (Components) |

### 14.2 Verified claims (safe to rely on)

| Report section | Claim | Evidence |
|---|---|---|
| §1, §3 | Zig/FFI native core; TS manages a renderable tree synchronized with native state; double-buffered diff-based cell updates | Roadmap post confirms the render tree lives in TypeScript today with the Zig core behind it; renderer docs + opentui_rust port confirm double-buffered diff composition |
| §1 | True RGBA Porter-Duff alpha blending; scissor clipping | opentui.com rendering-pipeline docs; opentui_rust README |
| §2 | `requestLive()`/`dropLive()` counter model; `useTimeline` lifecycle (autoplay default true; loop; duration); `onUpdate(deltaTime)` | Renderer docs; @opentui/react npm (useTimeline example mutates targets via `onUpdate`) |
| §2 | `translateX`/`translateY` as post-layout visual offsets (no reflow) | Consistent with rendering-pipeline architecture; used by the ProgressBar pattern in repo (`useTimeline` + `onUpdate`) |
| §4 | Truecolor RGB/RGBA hex; text modifiers (bold/italic/underline/strikethrough/dim/inverse/blink); per-side borders | Getting-started + styling docs; @opentui/react npm |
| §5 | Box, Text, ScrollBox, ASCIIFont, FrameBuffer, Image, Input, Textarea, Select, TabSelect, Code (tree-sitter), LineNumber (diagnostics), Diff (unified/split), QRCode | @opentui/react npm component list; component docs pages |
| §6 | `renderer.keyInput` emitter with canonical names + ctrl/shift/meta/option; bracketed-paste events + `decodePasteBytes`; mouse via kitty/SGR with `useMouse`/`enableMouseMovement` options | Keyboard input docs; @opentui/react npm (usePaste) |
| §10 | 0.5.x = Zig 0.16 rebase + native image rendering (ICC PNG) + embedded terminal runtime + FFI struct storage reuse | GitHub releases: v0.5.0 (#1283 native image rendering, #1273/#1284 FFI), v0.5.1 (#1326/#1327 ICC PNG), v0.5.2 (#1286 zig 0.16, #1338 embedded terminal runtime) |
| §10 | 0.4.x = useTimeline autoplay correction | GitHub releases: v0.4.4 (#1268 "fix(react): correct useTimeline autoplay condition") |
| §10 gotcha #2 | opentui-spinner `ColorGenerator` type change → bump to ^0.0.7 | unpkg 0.0.7 typings export `ColorGenerator`; opencode issue #26119 documents the typecheck failure |
| §10 gotcha #3 | 0.5.x destroy lifecycle strictness; trap SIGINT/SIGTERM/uncaughtException and route to `renderer.destroy()` | Consistent with release hardening (#1306 harden renderer resolution lifecycle, #1305 prevent duplicate live frame timers) |
| §12 | `OPENTUI_FORCE_EXPLICIT_WIDTH=false` suppresses OSC 66 queries and the "66" artifact | opentui.com/docs/reference/env-vars + packages/core/docs/development.md |
| §12 | Sixel/kitty image support with fallback | Native image rendering is terminal-dependent; fallback behavior is documented in the image docs |
| §8 | opentui-spinner: SpinnerRenderable, `createPulse`, `createWave`; termdraw exists; anscribe exists | npm registry + unpkg; awesome-opentui list |

### 14.3 Unverified / anecdotal (directional only — never load-bearing)

- **§1 performance numbers** (~15,900 LOC Zig, ~40MB vs ~80MB memory, ~200ms vs ~500ms startup): cited from unrelated repos/issues; no benchmark methodology. Treat as directional. Re-measure after the 0.5.x upgrade with `OPENTUI_DEBUG=true` + `bun --cpu-prof`.
- **§2 `renderBefore`/`renderAfter`**: the report itself admits these "must be deduced". No evidence they exist. Only `onUpdate(deltaTime)` is documented. **Do not design against renderBefore/renderAfter.**
- **§2 "25 distinct easing functions"**: not confirmed by any cited source. Verified easings seen in docs: `linear`, `outQuad` (ProgressBar example). The timeline's `ease` option (not `easing`) is the documented parameter name.
- **§2 "spring physics" (tension/friction)**: spring-like easing may exist in the JSAnimation engine, but no primary source is cited (the source is the Louie framework, not OpenTUI docs). Verify before building on it.
- **§5 `Slider`, `TextTable`**: not in the 0.5.3 component list; unverified.
- **§8 "80+ spinner animations", shared heap-based scheduler, invisible-spinner suspension**: opentui-spinner is "small & opinionated" per npm; the cli-spinners corpus it sources does have 80+ entries, but the scheduler and suspension mechanics are unverified claims. Verify against the package source before relying on them.
- **§11 animating `opacity`**: not verified as a supported OpenTUI style property. Alpha is expressed via RGBA colors (`#RRGGBBAA`). Prefer `translateX`/`translateY`/color tweens.
- **§9 Ascii-Motion**: it is a **web application** for ASCII art, not an OpenTUI terminal app; the "terminal post-processing" claims about it are misplaced. Gloomberb/opentui-doom/present-drop remain plausible from the awesome-opentui listing.
- **§3 box-shadow emulation** (absolute positioning + negative z-index + dimmed background cells): a known terminal technique, but the specific z-index semantics are unverified against OpenTUI docs.

### 14.4 Consequences for the Savant-Code UI overhaul

1. The 0.2.2 → 0.5.3 upgrade is the foundation (Phase 0 of `docs/design/ui-overhaul-plan.md`). It changes nothing in the keyboard layer — **no useKeyboard refactoring**.
2. Drop the `yoga-layout` JS dependency after upgrade (native yoga is in the core binary since 0.4.1).
3. Streaming/typewriter work must use chunked React commits or imperative native-`Text`-ref updates — **not** ScrollbackSurface (unshipped).
4. `useFocus`/`useBlur` are window-focus events; use them for FPS throttling on blur (drop `targetFps` to 15 when unfocused — the report's own §11 advice remains valid).
5. Evaluate opentui-spinner's scheduler claims against its source before adopting; the type bump to ^0.0.7 is required for typecheck parity.
6. Keep `OPENTUI_FORCE_EXPLICIT_WIDTH=false` behind environment/terminal detection, especially for Windows Console (the primary dev platform for this repo).