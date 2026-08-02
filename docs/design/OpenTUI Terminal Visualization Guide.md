# **Architecting Interactive Data Visualizations in OpenTUI: A Comprehensive Developer Guide**

The evolution of terminal user interfaces has reached a critical inflection point with the introduction of the OpenTUI framework. By leveraging a high-performance native core written in Zig, C ABI bindings, and advanced reconcilers for declarative UI frameworks like React and SolidJS, OpenTUI allows developers to construct complex, highly interactive terminal applications1. For artificial intelligence coding agents operating strictly within the command-line interface, the ability to present structured tabular data and interactive 3D visualizations transforms the terminal from a simple text stream into a rich, data-dense command center.  
This technical report provides an exhaustive implementation guide for integrating interactive data visualization features—specifically, responsive tables and 3D WebGPU-powered graphs—into an OpenTUI-based application. The analysis dissects the package architecture, layout constraints, event routing, and rendering loops necessary to achieve 60 frames per second within a standard terminal emulator.

## **Package Architecture, Runtimes, and Setup Prerequisites**

To effectively render high-performance user interface components alongside WebGPU-accelerated graphics in the terminal, the application architecture must strictly adhere to OpenTUI’s runtime constraints and package ecosystem. OpenTUI operates on a component-based architecture backed by a Yoga Flexbox layout engine executed at the native Zig layer1. The native core, written in Zig (specifically version 0.15.2 for recent builds), exposes a C ABI that facilitates near-instantaneous layout calculations and buffer rendering1.  
The OpenTUI monorepo separates concerns across distinct, highly specialized packages. For an AI coding agent requiring text interfaces, keyboard multiplexing, and 3D rendering, the installation and orchestration of several specific packages are required.

| Package | Architectural Role | Subsystem Responsibilities |
| :---- | :---- | :---- |
| @opentui/core | Core Dependency | Provides the imperative command-line interface renderer, standard layout components (Box, Text, ScrollBox), the Zig-native Foreign Function Interface (FFI) bindings, standard buffers, and Tree-sitter client utilities1. |
| @opentui/react | Declarative Reconciler | The official React renderer root (createRoot). Supplies React context hooks (useRenderer, useKeyboard) and JSX intrinsic elements mapping to native constructs1. |
| @opentui/solid | Declarative Reconciler | The official SolidJS alternative to React, providing granular reactivity without a virtual DOM overhead, suited for high-frequency streaming updates1. |
| @opentui/keymap | Input Subsystem | A host-agnostic command, keybinding, and sequence engine. Manages the Kitty keyboard protocol, disambiguation, and complex terminal input parsing1. |
| @opentui/three | Graphics Subsystem | Connects Three.js’s WebGPU renderer to OpenTUI optimized buffers. Exports the ThreeRenderable and ThreeCliRenderer constructs alongside the THREE namespace11. |

To initialize the environment for a React-based application featuring 3D graphics, the specific installation command requires the base runtime and the required peer dependencies:

Bash  
bun add @opentui/core @opentui/react @opentui/keymap @opentui/three react bun-webgpu

### **Runtime Limitations and Execution Environments**

The integration of WebGPU within a terminal environment imposes strict runtime limitations that developers must navigate. While standard @opentui/core applications can execute within Node.js (specifically version 26.4.0) using the \--experimental-ffi and \--allow-ffi flags2, the @opentui/three package relies exclusively on the Bun runtime11.  
The @opentui/three package requires Bun version 1.3.0 or higher11. It imports bun-webgpu directly to bridge the WebGPU application programming interface to the terminal’s character output buffer via a low-level CLICanvas implementation11. Node.js is entirely unsupported for the 3D graphics subsystem; therefore, the execution environment for any AI coding agent utilizing these features must be standardized on Bun. Attempting to load @opentui/three outside of Bun will result in unresolved module errors during the compilation of the native canvas bindings11.  
Furthermore, to ensure optimal keyboard event parsing for interactive data visualizations, the architecture must account for the limitations of legacy terminal emulators. OpenTUI implements the Kitty keyboard protocol, which resolves legacy terminal input ambiguities10. This protocol allows the keymap engine to differentiate between unmodified keys and complex modifiers (for example, distinguishing Tab from Ctrl+I, or capturing Shift+Arrow for zooming actions)10.  
A secondary compatibility issue arises with older terminal emulators regarding explicit character width detection. OpenTUI utilizes OSC 66 escape sequences to query the terminal for character widths, which is critical for precise Flexbox layouts. On unsupported terminals (such as older versions of GNOME Terminal, Konsole, or xterm), this results in visual artifacts containing the number "66"13. Developers can bypass this limitation by explicitly disabling the query via the environment variable OPENTUI\_FORCE\_EXPLICIT\_WIDTH=false, which forces the engine to fall back to standard width calculation algorithms13.

## **Designing High-Performance Interactive Tables**

Rendering structured tabular data in a terminal introduces unique layout challenges, particularly when dealing with dynamic content emitted by an AI agent. Historically, terminal tables constructed via Markdown components or naive column-major Flexbox containers in OpenTUI resulted in severe content truncation3. When table cells utilized a forced height: 1 and overflow: "hidden", any text exceeding the column width was silently discarded, fundamentally compromising data integrity for the end user3.  
The OpenTUI ecosystem addresses this through two primary paradigms: the structural row-major Flexbox approach, and the newly introduced native TextTable renderable. By rewriting table layouts from column-major to row-major, each row becomes a flex-row container. Leveraging Yoga's default alignItems: "stretch" property automatically synchronizes cell heights across a given row based on the tallest wrapped content, eliminating the truncation issue entirely3. Additionally, recent updates to the core package introduced the TextTable component and columnar selection capabilities, providing native support for complex grid layouts14.

### **Handling Scrolling and Focus State Management**

When tabular data exceeds the height of the terminal viewport, the table must be enclosed within a ScrollBox8. However, maintaining the scroll state dynamically introduces complexities. Historically, the ScrollBox component suffered from a bug where manual user scrolling set a \_hasManualScroll flag that permanently disabled sticky-scroll behaviors, causing the viewport to randomly jump to the top of the buffer upon subsequent renders16.  
To alleviate this, OpenTUI introduced the scrollChildIntoView method on the ScrollBoxRenderable17. This native method eliminates the need for developers to manually calculate relative viewport positions and apply error-prone scroll deltas. It automatically computes the necessary translation to ensure a focused descendant remains visible during keyboard navigation18.

### **Implementing the Declarative React Table Component**

The following TypeScript implementation demonstrates a robust, interactive row-major data table. It utilizes React bindings to map raw terminal inputs via useKeyboard to selection states, ensuring the active row is highlighted and kept within the scroll viewport via scrollChildIntoView.

TypeScript  
import React, { useState, useEffect, useRef } from "react";  
import { Box, Text, ScrollBox, useKeyboard } from "@opentui/react";  
import type { ScrollBoxRenderable } from "@opentui/core";

export interface TableColumn {  
  key: string;  
  header: string;  
  flexBasis: string | number;  
}

export interface InteractiveTableProps {  
  data: Record\<string, any\>\[\];  
  columns: TableColumn\[\];  
  onRowSelect?: (rowData: Record\<string, any\>) \=\> void;  
}

export const InteractiveTable: React.FC\<InteractiveTableProps\> \= ({ data, columns, onRowSelect }) \=\> {  
  const \[selectedIndex, setSelectedIndex\] \= useState(0);  
  const scrollBoxRef \= useRef\<ScrollBoxRenderable\>(null);

  // Map terminal inputs to state changes using the OpenTUI Keymap engine  
  useKeyboard((key) \=\> {  
    if (key.name \=== "down" || key.name \=== "j") {  
      setSelectedIndex((prev) \=\> Math.min(prev \+ 1, data.length \- 1));  
    }  
    if (key.name \=== "up" || key.name \=== "k") {  
      setSelectedIndex((prev) \=\> Math.max(prev \- 1, 0));  
    }  
    if (key.name \=== "return" || key.name \=== "enter") {  
      if (onRowSelect && data\[selectedIndex\]) {  
        onRowSelect(data\[selectedIndex\]);  
      }  
    }  
  });

  // Ensure the selected row remains visible within the ScrollBox viewport  
  useEffect(() \=\> {  
    if (scrollBoxRef.current) {  
      const rowId \= \`table-row-${selectedIndex}\`;  
      // Leverage the native scrollChildIntoView method for automatic viewport calculation  
      scrollBoxRef.current.scrollChildIntoView(rowId);  
    }  
  }, \[selectedIndex\]);

  return (  
    \<Box   
      flexDirection="column"   
      borderStyle="single"   
      borderColor="\#444444"   
      width="100%"   
      flex={1}  
    \>  
      {/\* Table Header Row \*/}  
      \<Box flexDirection="row" borderBottomStyle="single" borderColor="\#666666" paddingBottom={1}\>  
        {columns.map((col) \=\> (  
          \<Box key={\`header-${col.key}\`} flexBasis={col.flexBasis} flexShrink={1} paddingRight={1}\>  
            \<Text bold fg="\#00FF88"\>{col.header}\</Text\>  
          \</Box\>  
        ))}  
      \</Box\>

      {/\* Scrollable Table Body \*/}  
      \<ScrollBox   
        ref={scrollBoxRef}   
        flexDirection="column"   
        flex={1}   
        overflow="hidden"  
      \>  
        {data.map((row, index) \=\> {  
          const isSelected \= index \=== selectedIndex;  
          return (  
            \<Box  
              key={\`row-${index}\`}  
              id={\`table-row-${index}\`}  
              flexDirection="row"  
              backgroundColor={isSelected ? "\#224433" : "transparent"}  
              paddingTop={1}  
              paddingBottom={1}  
            \>  
              {columns.map((col) \=\> (  
                \<Box key={\`cell-${index}-${col.key}\`} flexBasis={col.flexBasis} flexShrink={1} paddingRight={1}\>  
                  {/\* Text automatically wraps within the cell bounds \*/}  
                  \<Text fg={isSelected ? "\#FFFFFF" : "\#CCCCCC"}\>  
                    {String(row\[col.key\])}  
                  \</Text\>  
                \</Box\>  
              ))}  
            \</Box\>  
          );  
        })}  
      \</ScrollBox\>  
    \</Box\>  
  );  
};

This component leverages the fundamental strengths of the Yoga Flexbox engine natively compiled in Zig. By delegating the calculation of wrapped text strings and proportional flex-shrinking to the core library, the JavaScript runtime overhead is minimized, allowing the AI agent to stream massive datasets into the state without blocking the event loop1.

## **Orchestrating 3D WebGPU Visualizations**

Visualizing multi-dimensional data—such as vector embeddings, neural network topographies, or machine learning performance metrics—requires graphics capabilities that transcend traditional ASCII art. The @opentui/three package fulfills this requirement by proxying a headless Three.js WebGPU instance into an OpenTUI OptimizedBuffer11.

### **The Architecture of Terminal WebGPU Rendering**

The graphics subsystem introduces two primary integration patterns for managing the WebGPU canvas within the terminal grid. Understanding the distinction between these constructs is critical for architectural stability.

| Integration Construct | Initialization Requirement | Layout Management | Ideal Use Case |
| :---- | :---- | :---- | :---- |
| ThreeCliRenderer | Manual (await engine.init()) | Explicit buffer targeting; requires manual dimensional math. | Full-screen applications bypassing the Flexbox layout tree11. |
| ThreeRenderable | Automatic via lifecycle hooks | Managed by Yoga Flexbox; automatic resize event binding. | Embedding graphs within complex layouts alongside text components11. |

For an AI coding agent operating within a split-pane layout (where text output coexists with visual data), the ThreeRenderable is the superior architectural choice. It defers WebGPU initialization until a physical frame buffer layout is allocated and automatically handles canvas resizing based on Yoga node dimensions11.  
A unique complexity of rendering 3D graphics in a terminal is the coordinate system mapping. In standard WebGPU applications, aspect ratios are derived from dense, square pixel dimensions. In OpenTUI, the aspect ratio is fundamentally tied to the rectangular dimensions of terminal cells11. The ThreeRenderable utilizes a custom property, CELL\_ASPECT\_RATIO, combined with the CLI renderer's native layout engine to deduce the exact pixel aspect ratio required to prevent stretching or squashing of the 3D geometry11. When the autoAspect property is enabled, the ThreeRenderable observes internal layout resize events emitted by Yoga, automatically updating the perspective camera's field of view and invoking updateProjectionMatrix()11.

### **Bridging WebGPU to the React Reconciler**

Since ThreeRenderable relies on imperative class instantiation at the core level, it must be bridged into the declarative React ecosystem using the useRenderer() hook8 and a generic container \<Box\> referenced via React's useRef.  
The following implementation details a 3D Scatter Plot component. It configures the WebGPU scene, populates it with instanced geometries, and maps terminal keyboard inputs to camera translations for interactive panning and zooming.

TypeScript  
import React, { useEffect, useRef } from "react";  
import { Box, useRenderer, useKeyboard } from "@opentui/react";  
import { RGBA } from "@opentui/core";  
import { THREE, ThreeRenderable } from "@opentui/three";  
import type { BoxRenderable } from "@opentui/core";

export interface ScatterPlot3DProps {  
  dataPoints: { x: number; y: number; z: number; color?: number }\[\];  
}

export const ScatterPlot3D: React.FC\<ScatterPlot3DProps\> \= ({ dataPoints }) \=\> {  
  const containerRef \= useRef\<BoxRenderable\>(null);  
  const renderer \= useRenderer();  
    
  // Persist Three.js instances across React reconciliations  
  const sceneRef \= useRef(new THREE.Scene());  
  const cameraRef \= useRef(new THREE.PerspectiveCamera(45, 1, 0.1, 1000));  
  const threeViewRef \= useRef\<ThreeRenderable | null\>(null);

  // Initialize the WebGPU Scene and Geometry  
  useEffect(() \=\> {  
    if (\!containerRef.current) return;

    const scene \= sceneRef.current;  
    const camera \= cameraRef.current;

    // Configure Environmental Lighting  
    scene.add(new THREE.AmbientLight(new THREE.Color(0.8, 0.8, 0.8), 1));  
    const light \= new THREE.DirectionalLight(new THREE.Color(1, 1, 1), 1.5);  
    light.position.set(5, 5, 5);  
    scene.add(light);

    // Construct Geometry for Data Points  
    const geometry \= new THREE.SphereGeometry(0.1, 16, 16);  
      
    // Clear previous mesh data on re-render  
    scene.clear();  
    scene.add(new THREE.AmbientLight(new THREE.Color(0.8, 0.8, 0.8), 1));  
    scene.add(light);

    dataPoints.forEach((point) \=\> {  
      const material \= new THREE.MeshPhongMaterial({   
        color: new THREE.Color(point.color || 0x00FF88)   
      });  
      const mesh \= new THREE.Mesh(geometry, material);  
      mesh.position.set(point.x, point.y, point.z);  
      scene.add(mesh);  
    });

    camera.position.set(0, 0, 5);

    // Instantiate the native ThreeRenderable integration  
    const threeRenderable \= new ThreeRenderable(renderer, {  
      width: "100%",  
      height: "100%",  
      scene,  
      camera,  
      autoAspect: true, // Automatically recalculate projection matrix on Flexbox resize  
      renderer: {  
        focalLength: 8,  
        alpha: true,  
        backgroundColor: RGBA.fromValues(0, 0, 0, 0), // Transparent background overlays TUI  
      },  
    });

    // Append the native construct to the layout tree  
    containerRef.current.add(threeRenderable);  
    threeViewRef.current \= threeRenderable;

    // Native teardown logic to prevent memory leaks and dangling frame callbacks  
    return () \=\> {  
      if (threeViewRef.current) {  
        threeViewRef.current.destroy();  
      }  
      scene.clear();  
    };  
  }, \[renderer, dataPoints\]);

  // Terminal Input Handling for 3D Camera Manipulation  
  useKeyboard((key) \=\> {  
    const camera \= cameraRef.current;  
    const moveSpeed \= 0.5;

    // Pan camera based on modifier-free arrow keys  
    if (key.name \=== "left") camera.position.x \-= moveSpeed;  
    if (key.name \=== "right") camera.position.x \+= moveSpeed;  
    if (key.name \=== "up") camera.position.y \+= moveSpeed;  
    if (key.name \=== "down") camera.position.y \-= moveSpeed;

    // Zoom via Kitty Protocol modifier sequences  
    // The engine translates complex terminal bytes into standard modifier boolean flags  
    if (key.shift && key.name \=== "up") {  
      camera.position.z \= Math.max(0.5, camera.position.z \- moveSpeed);  
    }  
    if (key.shift && key.name \=== "down") {  
      camera.position.z \+= moveSpeed;  
    }  
  });

  return (  
    \<Box   
      ref={containerRef}   
      width="100%"   
      height="100%"   
      borderStyle="single"   
      borderColor="\#5555AA"   
    /\>  
  );  
};

This integration allows the WebGPU renderer to sit alongside traditional terminal elements. Beyond simple meshes, @opentui/three supports highly complex simulations out of the box, including sprite particle generators (SpriteParticleGenerator), physics-backed explosions via optional adapters like Rapier (RapierPhysicsWorld) or Planck, and procedural texture generation11. This capability allows AI agents to render sophisticated visual feedback loops directly in the developer's local environment.

## **Layout Engineering and Performance Optimization**

Integrating intensive text-rendering algorithms—such as Tree-sitter powered syntax highlighting—with WebGPU compute pipelines places substantial strain on the host terminal emulator. The architecture bridges standard input/output streams, Zig native memory management, JavaScript garbage collection, and GPU driver synchronization. If the Yoga Flexbox layouts and rendering loops are not meticulously managed, the application will exhibit layout thrashing, visual artifacting, or catastrophic stuttering.

### **Preventing Flexbox Layout Thrashing**

Layout thrashing occurs when the Yoga layout engine is forced to synchronously recalculate dimensions across the entire application tree in response to continuous micro-mutations. In OpenTUI, standard text layout requires CPU-bound calculations to measure string width against ANSI escape codes and complex Unicode grapheme clusters9.  
When combining heavy tabular data with a ThreeRenderable, it is critical to lock the flex basis of parent containers to prevent cascading redraws. The ThreeRenderable explicitly bypasses standard auto-resize loops; during initialization, it forces the underlying engine's autoResize property to off because OpenTUI layout resize events invoke the WebGPU setSize() method directly11.  
If a developer places the 3D graph inside a \<Box\> that scales fluidly based on the sibling table's content, every single table mutation (such as a cell expanding due to a wrapped string emitted by the AI) will force a Yoga layout recalculation1. This, in turn, triggers a WebGPU texture reallocation and projection matrix recalculation, severely degrading performance.  
To prevent this, absolute percentage sizes or strict flex proportions must be enforced between the text and 3D interfaces.

TypeScript  
// Stable Dual-Pane Layout Implementation  
export const AgentDashboard: React.FC \= () \=\> {  
  return (  
    \<Box flexDirection="row" width="100%" height="100%"\>  
      {/\* Data Table locked strictly to 40% width \*/}  
      \<Box width="40%" height="100%" overflow="hidden"\>  
        \<InteractiveTable data={analyticsData} columns={tableColumns} /\>  
      \</Box\>  
        
      {/\* 3D Graph locked strictly to 60% width \*/}  
      \<Box width="60%" height="100%"\>  
        \<ScatterPlot3D dataPoints={embeddingVectors} /\>  
      \</Box\>  
    \</Box\>  
  );  
};

### **Render Loop Synchronization and Concurrency Management**

OpenTUI manages a highly optimized rendering loop through OptimizedBuffer swaps11. The ThreeCliRenderer leverages the low-level CLICanvas to draw directly into these buffers11. A critical performance constraint in this architecture relates to frame scheduling: overlapping or concurrent drawScene() calls are explicitly unsupported11.  
If the React component forces a state update that invokes a synchronous render request while the WebGPU device is still finalizing the previous frame buffer, the ThreeCliRenderer will safely skip the execution and emit a warning to the console11. While this architectural safeguard prevents process crashes and memory corruption across the FFI boundary, it results in dropped frames and visual jitter. To alleviate this, external data streams (such as AI token generation) should be decoupled from the rendering loop. High-frequency WebGPU animations should rely strictly on the native renderer.setFrameCallback(async (deltaMs) \=\> { ... }) lifecycle rather than declarative React useEffect timers11.  
Additionally, rendering text nodes that are transiently detached from the render tree (for example, during a list re-keying operation in React or Solid) historically caused the requestRender propagation to fail silently, resulting in frozen streams20. Developers must ensure that streaming data architectures retain stable component identities to prevent the reconciler from detaching and re-attaching text buffers unnecessarily.

### **Managing WebGPU Supersampling Trade-offs**

To mitigate the naturally low resolution of terminal character cells, the @opentui/three package supports advanced anti-aliasing via Super Sampling11. By default, the superSample property is configured to SuperSampleType.GPU, utilizing the SuperSampleAlgorithm.STANDARD algorithm11.  
When GPU supersampling is active, the internal WebGPU render dimensions are effectively doubled relative to the output terminal width and height11. While this produces dramatically cleaner 3D edges by aggregating color data across fragments, it quadruples the fragment shader workload. If the AI coding agent is executing on constrained hardware—such as remote cloud development environments without dedicated graphical processing units—this computational overhead can severely throttle the terminal output.  
Developers should aggressively monitor the application's frames-per-second performance. If degradation occurs, the supersampling type can be cycled programmatically via engine.toggleSuperSampling() (transitioning from gpu to cpu or none), or initialized as "none" during the ThreeRenderable configuration11. Furthermore, ensuring the background color utilizes an opaque alpha channel (e.g., RGBA.fromValues(0, 0, 0, 1)) unless absolute transparency is strictly necessary over underlying text reduces the compositor's blending overhead during the buffer swap11.

## **Synthesis and Architectural Outlook**

The convergence of the Zig-powered OpenTUI core, declarative reconcilers, and Bun's native WebGPU bindings represents a paradigm shift in command-line interface development. Developers are now empowered to author terminal-based AI coding agents with capabilities that historically required heavyweight, Electron-based desktop clients1.  
The construction of interactive Flexbox data tables necessitates a row-major structural design to circumvent legacy cell truncation, while leveraging native methods like scrollChildIntoView ensures resilient navigation states devoid of scroll-jumping anomalies3. Concurrently, the integration of 3D WebGPU visualizations via ThreeRenderable demands an acute awareness of terminal architecture. Proper camera aspect synchronization, explicit Flexbox dimensional constraints to prevent Yoga layout thrashing, and a measured approach to WebGPU supersampling overhead are paramount for maintaining 60 frames per second11. Mastering the interplay between these interdisciplinary subsystems enables the deployment of unprecedented, high-fidelity data visualization directly within the developer's standard command-line environment.

#### **Works cited**

> 1. README.md \- anomalyco/opentui \- GitHub, [https://github.com/anomalyco/opentui/blob/main/README.md](https://github.com/anomalyco/opentui/blob/main/README.md)  
> 2. Getting started \- OpenTUI, [https://opentui.com/docs/getting-started/](https://opentui.com/docs/getting-started/)  
> 3. Markdown table cells truncate content instead of word-wrapping · Issue \#711 \- GitHub, [https://github.com/anomalyco/opentui/issues/711](https://github.com/anomalyco/opentui/issues/711)  
> 4. fix(solid): handle ScrollBox parent mismatch in getParentNode \#2146 \- GitHub, [https://github.com/anomalyco/opentui/actions/runs/22013980008/workflow?pr=680](https://github.com/anomalyco/opentui/actions/runs/22013980008/workflow?pr=680)  
> 5. fix(markdown): render checkbox inline with list item text · anomalyco/opentui@17ebde9, [https://github.com/anomalyco/opentui/actions/runs/22174874652/workflow?pr=708](https://github.com/anomalyco/opentui/actions/runs/22174874652/workflow?pr=708)  
> 6. Merge remote-tracking branch 'upstream/main' into move-3d-to-separate-package · anomalyco/opentui@4dfd1ae \- GitHub, [https://github.com/anomalyco/opentui/actions/runs/23297379106/workflow?pr=793](https://github.com/anomalyco/opentui/actions/runs/23297379106/workflow?pr=793)  
> 7. Package entrypoints \- OpenTUI, [https://opentui.com/docs/reference/package-entrypoints](https://opentui.com/docs/reference/package-entrypoints)  
> 8. @opentui/react \- npm, [https://www.npmjs.com/package/@opentui/react](https://www.npmjs.com/package/@opentui/react)  
> 9. opentui/bun.lock at main \- GitHub, [https://github.com/anomalyco/opentui/blob/main/bun.lock](https://github.com/anomalyco/opentui/blob/main/bun.lock)  
> 10. Keyboard input \- OpenTUI, [https://opentui.com/docs/core-concepts/keyboard/](https://opentui.com/docs/core-concepts/keyboard/)  
> 11. Three.js WebGPU \- OpenTUI, [https://opentui.com/docs/reference/three](https://opentui.com/docs/reference/three)  
> 12. anomalyco/opentui at peerlist \- GitHub, [https://github.com/anomalyco/opentui?ref=peerlist](https://github.com/anomalyco/opentui?ref=peerlist)  
> 13. opentui/packages/core/docs/development.md at main \- GitHub, [https://github.com/anomalyco/opentui/blob/main/packages/core/docs/development.md](https://github.com/anomalyco/opentui/blob/main/packages/core/docs/development.md)  
> 14. columnar selection in TextTables and Markdown table options · anomalyco/opentui@9046df7 \- GitHub, [https://github.com/anomalyco/opentui/actions/runs/22411813071](https://github.com/anomalyco/opentui/actions/runs/22411813071)  
> 15. introduce TextTable renderable (\#731) · anomalyco/opentui ... \- GitHub, [https://github.com/anomalyco/opentui/actions/runs/22324656657](https://github.com/anomalyco/opentui/actions/runs/22324656657)  
> 16. ScrollBox \_hasManualScroll is never reset, breaking stickyScroll behavior · Issue \#530 · anomalyco/opentui \- GitHub, [https://github.com/anomalyco/opentui/issues/530](https://github.com/anomalyco/opentui/issues/530)  
> 17. scrollbox: add scrollChildIntoView method · anomalyco/opentui@1f3fa05 \- GitHub, [https://github.com/anomalyco/opentui/actions/runs/23050727869/job/66950982106?pr=724](https://github.com/anomalyco/opentui/actions/runs/23050727869/job/66950982106?pr=724)  
> 18. Add \`scrollChildIntoView\` method to ScrollBoxRenderable · Issue \#716 · anomalyco/opentui, [https://github.com/anomalyco/opentui/issues/716](https://github.com/anomalyco/opentui/issues/716)  
> 19. Releases · anomalyco/opentui \- GitHub, [https://github.com/anomalyco/opentui/releases](https://github.com/anomalyco/opentui/releases)  
> 20. Streaming text freeze: TextNodeRenderable.requestRender() silently drops renders when the node is transiently detached (parent \=== null) · Issue \#1147 · anomalyco/opentui \- GitHub, [https://github.com/anomalyco/opentui/issues/1147](https://github.com/anomalyco/opentui/issues/1147)  
> 21. CodeRenderable streaming content updates stall when renderer is idle · Issue \#963 · anomalyco/opentui \- GitHub, [https://github.com/anomalyco/opentui/issues/963](https://github.com/anomalyco/opentui/issues/963)  
> 22. remorses/ghostty-opentui: Render ANSI and terminal otuput directly in opentui \- GitHub, [https://github.com/remorses/ghostty-opentui](https://github.com/remorses/ghostty-opentui)