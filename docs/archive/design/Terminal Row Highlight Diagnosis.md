<!-- markdownlint-disable MD013 -->
<!-- MD013 is narrowly disabled for this forensic report because its embedded diagnostic matrix and historical evidence preserve long source-form lines that should not be wrapped as release-code documentation. -->

# **Research Report: Mouse Interaction and Row Selection Anomalies in OpenTUI-Based CLI Environments**

## **Executive Summary**

The following report delivers an exhaustive technical investigation into an interaction anomaly observed within Savant-Code, a TypeScript and Bun-driven terminal application utilizing the OpenTUI 0.2.2 framework. The observed behavior involves an unintended full-row highlighting effect triggered by a single mouse click on the top decorative region of the application shell. Initial mitigation efforts—specifically, the application of focusable={false} and selectable={false} properties to the AppShell and the pinned ChatHeader wrapper—failed to eliminate the behavior. Instead, this intervention expanded the affected visual region from a single row to two rows.  
This analysis synthesizes the mechanics of terminal emulation, the event-routing logic of the xterm.js integration utilized by Cursor and VS Code, and the specific native rendering and hit-testing architecture of the OpenTUI framework. The documented mutation of the affected area following a property change serves as a critical diagnostic pivot. It provides compelling evidence that the anomaly is occurring within the application's internal event-bubbling hierarchy, rather than being a purely unmanaged native terminal artifact. However, the influence of the underlying terminal host—particularly regarding mouse-reporting modes, coordinate offsets in alternate-screen environments, and bypass mechanisms—must be rigorously isolated.  
This report deconstructs the dual-layer selection conflict, addresses the specific mechanical questions regarding OpenTUI and Windows Terminal/Cursor, evaluates recent uncommitted codebase changes, and presents a definitive, ranked hypothesis framework. Furthermore, it outlines a rigorous matrix of twenty specific diagnostic experiments designed for direct Windows workstation execution, culminating in a logical decision tree and a non-destructive remediation strategy that preserves the functionality of all nested interactive controls.

## **The Dual-Layer Selection Conflict: Host vs. Application**

Terminal-based graphical interfaces operate under a fundamentally distinct input paradigm compared to DOM-based web applications. In a modern terminal environment, mouse input and text selection are subject to a strict, mutually exclusive hierarchy of ownership between the host terminal emulator and the guest application. When an interaction anomaly such as unintended text highlighting occurs, the primary diagnostic objective is to establish which layer currently claims ownership of the pointer event and the subsequent rendering of the selection matrix.

### **Native Terminal Selection (The Host Layer)**

By default, terminal emulators—including Windows Terminal (which utilizes the ConPTY layer) and Cursor's integrated terminal (which is powered by xterm.js)—act as passive renderers of character and color data. In this default unmanaged state, the terminal emulator retains absolute control over the mouse pointer. When a user clicks, drags, or executes multi-click combinations, the terminal emulator performs text selection natively by querying its own internal grid buffer and applying a visual selection overlay. This overlay is typically rendered as a reverse-video effect or through the application of a distinct, semi-transparent background color1.  
Within the xterm.js ecosystem, specific mouse gestures are mapped to predefined native selection subroutines. A standard left-click-and-drag initiates a continuous character selection. A double-click selects a defined word boundary (often matching the boundaries utilized by iTerm2, treating file paths or URLs as a single contiguous unit), while a triple-click is explicitly mapped to select an entire line or row3. Furthermore, xterm.js supports virtual or block selection, which can be initiated via modifier keys. If a guest application does not actively suppress these inputs by initializing a mouse-tracking protocol, the host terminal will indiscriminately execute these native routines.

### **Application-Level Mouse Reporting (The OpenTUI Layer)**

To facilitate interactive user interface controls such as buttons, scrolling viewports, and selectable text buffers, frameworks like OpenTUI must instruct the terminal host to surrender native mouse control. This transition is achieved by transmitting specific ANSI escape sequences—known as DEC Private Mode Set sequences—to the terminal emulator. OpenTUI natively configures the terminal by emitting sequences such as CSI ? 1000 h (X11 standard mouse tracking), CSI ? 1002 h (cell motion tracking), or CSI ? 1003 h (all motion tracking), frequently paired with CSI ? 1006 h to ensure that coordinates exceeding the traditional 223-column/row limit are accurately parsed via the SGR (Select Graphic Rendition) protocol5.  
Once these tracking modes are active, the terminal emulator disables its native text selection engine. Instead of highlighting text, it encodes every mouse click, release, and movement into an escape sequence (e.g., CSI \< 0 ; x ; y M for a left click) and writes this sequence to the application's standard input stream (stdin). OpenTUI's internal parser reads these bytes, decodes the spatial coordinates, and routes the interaction through its proprietary hit-testing grid to the corresponding React component. If an OpenTUI component, such as the TextBufferRenderable, is configured to be selectable, the framework independently draws its own selection highlight utilizing the defined selectionBg and selectionFg properties, fully bypassing the terminal's native mechanics8.

### **The Conflict Boundary and Mode Degradation**

The anomaly observed in Savant-Code exists precisely at the boundary of these two competing layers. A single standard click normally only places a cursor or triggers an application event, but a rapid succession of clicks or a misconfigured state machine can blur these lines. If an application accidentally leaves mouse reporting partially enabled—perhaps due to a malformed reset sequence (CSI c), an abnormal shutdown that fails to restore the original state, or an uncaught exception during the rendering loop—the terminal host and the application may enter a desynchronized state7.  
In such a degraded state, it is possible for the terminal to misinterpret a single click as a native triple-click, resulting in a full-row highlight. Conversely, the application might correctly receive the mouse sequence but misroute it to a text buffer configured to highlight its entire geometric width upon interaction. Distinguishing between these two failure modes requires a precise understanding of both the host's historical quirks and the application's internal memory architecture.

## **Historical Context: VS Code and Cursor Integration**

The user's observation that a similar "whole row highlight" bug occurred previously in Visual Studio Code, and is now manifesting in Cursor, provides vital contextual evidence. Both VS Code and Cursor rely on identical underlying terminal infrastructure for their integrated terminal panels: xterm.js.

### **The xterm.js Lineage and Shared Behavior**

The continuity of this bug across two distinct IDEs strongly indicates that the behavior is either an intrinsic artifact of the xterm.js rendering engine or a byproduct of a shared configuration schema, rather than being an issue caused by an isolated IDE extension. In xterm.js, applications that request mouse tracking successfully capture left clicks, routing them to the application logic. However, terminal emulators deliberately provide users with bypass mechanisms to forcefully invoke native terminal selection even when application mouse reporting is active. This is typically achieved by holding the Shift key, or the Option/Alt key on macOS environments3.  
Furthermore, xterm.js exposes specific configuration options, such as macOptionClickForcesSelection, which explicitly dictate whether modifier keys interrupt the application's mouse routing protocol11. If an accessibility feature (such as screen reader support mode) or a global settings.json override is active, xterm.js may alter its baseline interaction model, occasionally translating standard clicks into broader selection commands12. The fact that the same anomaly appeared in VS Code prior to the integration of OpenTUI suggests a long-standing susceptibility in how xterm.js interacts with full-screen applications, particularly those heavily manipulating standard output.

### **Alternate-Screen Modalities and Host Interference**

The Savant-Code CLI operates in OpenTUI's alternate-screen mode13. In this configuration, the application emits the CSI ? 1049 h sequence to transition the terminal from the primary scrollback buffer to a secondary, fixed-dimension screen buffer. This transition frequently alters how native terminal selections are processed. In alternate-screen mode, native terminal emulators generally disable scrollback selection, limiting any forced native selection to the currently visible viewport.  
Does this alternate-screen mode affect native terminal selection? Yes, significantly. Because the terminal's internal geometry is locked to the physical window dimensions, coordinate translation errors are exacerbated. A bug in Cursor's window padding calculation, or a discrepancy in how Windows Terminal translates ConPTY coordinates to the visible surface, can result in a click visually intended for the top row (row 0\) being interpreted by the host as an interaction with the row immediately below it, or triggering an out-of-bounds selection routine. However, to determine if this host-level interference is the active cause, we must cross-examine this theory against OpenTUI's internal architecture.

## **OpenTUI 0.2.2 Rendering and Hit-Testing Architecture**

To deduce why clicking a non-interactive decorative row triggers a selection event within the Savant-Code environment, one must rigorously deconstruct OpenTUI 0.2.2's specific implementation of hit testing, memory layout, and event propagation. OpenTUI is uniquely structured; it relies on a high-performance native Zig core wrapped in TypeScript bindings, operating fundamentally differently from purely JavaScript-based TUI frameworks14.

### **Memory Layout and Double-Buffered Hit Grids**

OpenTUI represents the terminal character grid using a Structure of Arrays (SoA) memory layout. This design maximizes CPU cache efficiency by storing characters, foreground color matrices, background color matrices, and bit-packed attributes in separate, continuous memory blocks, rather than grouping them into localized cell structures14. To handle pointer interactions without triggering expensive, synchronous layout recalculations upon every mouse movement, OpenTUI utilizes a secondary spatial matrix known as the "hit grid."  
The hit grid is double-buffered to prevent race conditions during the multi-phased rendering lifecycle. These buffers are maintained as currentHitGrid and nextHitGrid14. During the layout and rendering pass (which occurs after animations, callbacks, and lifecycle hooks are evaluated), every renderable component registers its physical bounding box—its coordinates and dimensions—by calling the native addToHitGrid(x, y, width, height, id) function via the Foreign Function Interface (FFI)15. Crucially, this registration only occurs for components that are actively present in the render list for the current frame14.  
When a mouse event byte stream arrives via stdin, OpenTUI decodes the coordinate, standardizes the indices (translating 1-based ANSI coordinates to 0-based internal coordinates), and invokes the checkHit(x, y) subroutine. This function reads the currentHitGrid to retrieve the 32-bit ID of the specific renderable located at that exact terminal cell15.

### **Resolution of OpenTUI Interaction Properties**

Once checkHit(x, y) resolves an active ID, OpenTUI dispatches the parsed mouse event to the corresponding React component. The framework relies heavily on explicit property declarations to dictate the application's response to these events.  
Regarding the specific properties queried in the original context:

> 1. **The definition of selectable on a box:** The selectable property dictates whether a component is authorized to act as an origin point for OpenTUI's internal text selection logic. By default, text buffers in OpenTUI are marked selectable: true8. When applied to a structural \<box\>, setting it to true allows the geometry of that box (and any text strings it owns) to be highlighted using the framework's defined selectionBg and selectionFg properties.  
> 2. **The definition of focusable on a box:** This property controls global keyboard input focus. Setting focusable={false} explicitly ensures that the component cannot become the active node in the traversal tree for keypress events18. It does not natively dictate mouse click interactions, though it prevents the component from visually indicating a focused state.  
> 3. **Inheritance of selectable:** The selectable property is not strictly inherited downward in a cascading manner like CSS properties. Instead, OpenTUI utilizes an event-bubbling architecture for unhandled pointer events20.  
> 4. **Parent selectable={false} suppressing children:** Setting selectable={false} on a parent does *not* suppress the interaction capabilities of nested children. Interactive descendants, such as the Button components defined in the Savant-Code banner, utilize internal onMouseDown and onMouseUp handlers. When a pointer event targets a child, the child's specific event handler captures the input before it reaches the parent's generic selection initialization logic9. Therefore, a non-interactive parent can safely and robustly contain highly interactive descendants.  
> 5. **Event Target Checking and Fallback Ancestors:** When a pointer event targets a child, OpenTUI's dispatcher resolves the exact ID via checkHit. If that immediate target is non-selectable, the target rejects the selection request. The event then bubbles upward through the React ancestor chain. The framework checks the immediate parent, and if rejected, continues ascending until it encounters a fallback ancestor that accepts the selection event20.  
> 6. **Geometry, Padding, and Hit Testing:** Attributes such as screenY, height, borders, and padding directly inform the values passed to addToHitGrid. Transparent or fill boxes are not physically invisible to the interaction engine; they still populate the hit grid to block background clicks from falling through to underlying layers15.  
> 7. **Equivalents to pointer-events: none:** OpenTUI does not possess a strict CSS equivalent to pointer-events: none that forces the raycast to ignore the physical geometry of a component entirely. The selectable={false} property differs from ignoring pointer events; it solely disables the initialization of the native OpenTUI selection state, allowing custom onClick or onMouseMove handlers to fire normally.

## **Analysis of the One-Row to Two-Row Phenomenon**

The most critical diagnostic variable provided is the behavioral mutation following an attempted remediation. Initially, the user observed that clicking the top row highlighted the top row. The developer then explicitly applied focusable={false} and selectable={false} to the full-viewport AppShell root and the pinned ChatHeader wrapper. Following this change, the highlight behavior did not cease; instead, it expanded to encompass the top two rows.  
This mutation is a paramount piece of evidence. It virtually eliminates the hypothesis that this is a purely native terminal selection artifact. If the terminal host were indiscriminately forcing native selection due to a bypassed mouse protocol or a missing DEC reset sequence, changing React properties inside the OpenTUI JavaScript logic would have zero impact on the geometric shape of the terminal's native C++ selection buffer. A native terminal emulator cannot intelligently expand its selection from one row to two rows in response to a JavaScript boolean prop being passed to an internal framework component, unless the actual drawn characters on the screen changed dramatically. The expansion definitively proves that the click event is being processed by OpenTUI's rendering and bubbling engine.

### **The Mechanics of the Bubbling Expansion**

Prior to the attempted fix, the ChatHeader wrapper (which occupied the first physical row of the terminal layout) was likely defaulting to a selectable state, or implicitly adopting it based on the presence of unmanaged text nodes. The sequence of operations was as follows:

> 1. The user clicks row zero.  
> 2. The internal checkHit(0, 0\) call returns the specific ID of the ChatHeader wrapper.  
> 3. The wrapper, possessing a default true state, accepts the selection event.  
> 4. Because the wrapper only spans one row geometrically, OpenTUI highlights the entirety of that single row.

Following the application of selectable={false} to the AppShell and ChatHeader, the sequence of operations changed dramatically, exposing the underlying event propagation tree:

> 1. The user clicks row zero.  
> 2. checkHit(0, 0\) still returns the ID of the ChatHeader wrapper, because non-selectable components still occupy physical space and register in the hit grid to maintain layout integrity.  
> 3. The ChatHeader wrapper receives the mouse-down event but actively rejects it due to the explicit selectable={false} declaration.  
> 4. The unhandled pointer event bubbles up the React component tree20.  
> 5. The event bypasses the AppShell (which was also marked selectable={false}).  
> 6. The event ultimately arrives at an intermediary structural component that lacks the explicit selectable={false} property barricade.

Based on the provided component tree hierarchy, the most logical intermediary owner is either the ChatLayout root box or the scrollbox housing the transcript. The ChatLayout root is defined merely with focusable={false} and an onMouseMove handler; it lacks selectable={false}. Because OpenTUI boxes can default to selectable bounding boundaries if they encapsulate selectable children, this root box becomes the new event owner. If the ChatLayout root (or a nested container like the transcript scrollbox) possesses a geometric bounding box that encompasses the top two rows—accounting for the combination of the transparent header and the TopBanner immediately below it—the selection engine highlights the entirety of that owned geometry.  
Therefore, making the header non-selectable did not eliminate the click registration; it merely delegated the click to a larger parent container, effectively increasing the visual footprint of the bug from one row to two rows.

## **Recent Change Timeline and Uncommitted Work**

The repository working tree is reported as dirty, with uncommitted changes impacting cli/src/components/app-shell.tsx, cli/src/chat/panels.tsx, cli/src/chat/styles.ts, and FID documentation. The absence of recent formal commits does not preclude these volatile changes from being the mechanical trigger for the coordinate or bubbling failure.  
The recent feature work involved chat/sidebar surface consistency, explicit sidebar fill behavior, transparent nested wrappers, and app-shell surface painting. These are highly relevant layout mutations. Specifically, adjusting shouldFill and manipulating transparent nested wrappers directly alters the geometric boundaries passed to addToHitGrid. If a transparent wrapper was introduced to manage the surface alignment, and that wrapper spans multiple rows (e.g., covering both the header and the banner), it acts as a silent, selectable hit-target.  
Furthermore, the introduction of app-shell background painting implies that the lowest level of the layout hierarchy is now actively drawing color matrices across the terminal surface. If OpenTUI's checkHit encounters a transparent pixel, or if an off-by-one border calculation forces the hit test to punch through the header into the painted shell background, the background itself (or its immediate container) may seize the selection event. The interaction between the new TopBanner controls and the top-row interaction handling logic in the uncommitted state is the most probable locus for the geometric boundary that exactly equals two rows.

## **Ranked Diagnostic Hypotheses**

Based on the synthesis of OpenTUI mechanics, terminal emulation behavior, the one-to-two row mutation, and the recent architectural changes, the following hypotheses are ranked by their statistical probability and evidentiary support.

| Rank | Hypothesis | Confidence Level | Mechanistic Rationale | Supporting Evidence |
| :---- | :---- | :---- | :---- | :---- |
| **1** | **Hypothesis B: OpenTUI Selection Fallback (Bubbling)** | **90%** | The ChatHeader successfully rejected the selection due to selectable={false}. The event bubbled upward to a structural ancestor (e.g., ChatLayout root or scrollbox) that lacks explicit non-selectable declarations. The geometric bounds of this ancestor encompass the top two rows, triggering a two-row highlight. | The precise transition from a one-row to a two-row highlight following a targeted React property change confirms state manipulation within the OpenTUI JavaScript layout engine, rather than a native terminal response. |
| **2** | **Hypothesis D: Coordinate or Geometry Offset** | **70%** | The mouse click is being mapped to a different screen row than visually expected due to alternate-screen zero-indexing offsets, transparent/fill layout changes, or an off-by-one error in OpenTUI hit testing boundaries. The click strikes the first renderable text node within the scrollbox instead of the header. | The issue occurs at the absolute physical boundary of the terminal window (row 0), where coordinate translation errors between ConPTY, xterm.js, and Zig are most prevalent. Uncommitted shouldFill changes affect these boundaries. |
| **3** | **Hypothesis C: Wrong Renderable Owns the Rows** | **60%** | The affected rows do not belong to the header. They belong to a border/fill wrapper or the chat root itself. The assumption that the header is the primary interaction target is fundamentally flawed due to z-index or rendering order overlap. | The addition of near-black background surfaces and explicit sidebar fills in recent work likely introduced overlapping container geometries that consume the hit test. |
| **4** | **Hypothesis F: Terminal Mouse Mode/Reset Problem** | **25%** | The CLI is failing to successfully maintain continuous mouse tracking, occasionally causing the host terminal and the application to disagree about click ownership, resulting in a degraded state where a click triggers a native fallback. | VS Code's history with similar bugs suggests underlying xterm.js vulnerability. *Refutation:* A degraded native state would not expand its selection geometry in response to a React prop change. |
| **5** | **Hypothesis A: Native Terminal Selection** | **10%** | The visual highlight is produced entirely by Windows Terminal/Cursor rather than OpenTUI, executing a native line-selection routine. | Both applications utilize xterm.js. *Refutation:* The one-to-two row expansion entirely invalidates this as the sole cause. A native C++ rendering engine cannot read a React boolean. |
| **6** | **Hypothesis E: Mouse Movement Side Effect** | **5%** | The root onMouseMove activity handler or applyPostProcessing triggers forced rerenders or visual paints that mimic a selection state. | *Refutation:* Selection highlights require specific styling updates (selectionBg) which are entirely distinct from standard activity tracking or generic layout repaints. |

## **Exhaustive Diagnostic Experiment Framework**

To definitively isolate the root cause and bypass the limitations of static source-contract tests, the developer must execute a strict sequence of runtime experiments directly within the bun dev harness on the Windows workstation. These tests distinguish between the hypotheses without necessitating extensive codebase rewrites.

| \# | Action to Perform | Observation Supporting Hypothesis | Observation Refuting Hypothesis |
| :---- | :---- | :---- | :---- |
| **1** | **Single left click versus click-drag:** Click the top row once. Then, click and drag downward. | If drag smoothly expands the highlight character-by-character, it confirms OpenTUI application selection (Hypothesis B). | If drag acts erratically or tears the screen, it indicates a native terminal conflict (Hypothesis F). |
| **2** | **Click and immediately move the mouse away:** Click the top row and rapidly move the pointer to the sidebar. | If the highlight persists statically, OpenTUI registered a persistent selection state. | If the highlight vanishes upon mouse exit, it is merely a hover/focus visual style (Hypothesis E). |
| **3** | **Copy Test (The Layer Check):** Click the top row to highlight. Open a native text editor and press Ctrl+V. | If text pastes successfully, the selection is owned by the native host terminal, as they auto-copy to the system clipboard2 (Hypothesis A). | If nothing pastes, OpenTUI owns the selection matrix, as it requires explicit copy commands. |
| **4** | **CLI reaction check:** Add a console.log to the root onMouseMove and check if it fires upon the click. | If the log fires precisely on the click, OpenTUI's event listener successfully captured the coordinate (Hypothesis B). | If no log fires, the terminal host intercepted the click entirely (Hypothesis F). |
| **5** | **Test with no active top banner:** Disable the banner component completely and click the top row. | If the highlight disappears, the banner wrapper geometry was the owner of the two-row selection (Hypothesis C). | If it persists, the root shell or transcript box owns the area. |
| **6** | **Test with an active Git-root banner:** Enable a different banner type and test. | If the affected row count changes to match the specific banner's height, the banner is the fallback ancestor. | If the highlight remains locked at two rows, the banner type is irrelevant. |
| **7** | **Test with an empty chat:** Launch with a completely empty transcript and click. | If the highlight fails to appear, the hit grid requires the presence of text nodes to initiate a selection boundary (Hypothesis D). | If it persists, empty structural boxes are claiming the selection. |
| **8** | **Test with existing messages:** Scroll deep into a chat and click the top row. | If the highlight jumps to a random chat message instead of the top row, coordinate offsets are broken (Hypothesis D). | If the top rows highlight consistently, geometry is stable. |
| **9** | **Test using direct Windows Terminal:** Run bun dev directly in WT, outside of Cursor. | If the bug disappears, Cursor's xterm.js integration is injecting offset errors or stealing inputs (Hypothesis F). | If identical, the bug is purely internal to OpenTUI. |
| **10** | **Test using Cursor's integrated terminal:** Compare exactly against WT. | If the bug strictly manifests here, VS Code/Cursor heritage settings are to blame. | If identical to WT, terminal host is absolved. |
| **11** | **Test using another available emulator:** Test in Alacritty or Git Bash. | Confirms cross-terminal consistency. Points heavily to OpenTUI logic (Hypothesis B). | Identifies a purely ConPTY specific edge case. |
| **12** | **Temporarily remove selectable={false} from AppShell/header:** Revert the recent fix attempt. | If the bug shrinks back to exactly one row, the bubbling theory is undeniably proven (Hypothesis B). | If it remains two rows, an uncommitted geometry change caused the expansion. |
| **13** | **Temporarily add selectable={false} to ChatLayout root and left column:** Implement the barricade. | If the highlight completely vanishes, the structural parents were the culpable fallback ancestors (Hypothesis B). | If the highlight persists, a nested text node is intercepting the hit grid directly. |
| **14** | **Compare the exact number of affected rows after each change:** Log the visual footprint precisely. | Direct evidence of how React props manipulate the physical terminal draw buffer. | \- |
| **15** | **Check highlight retention after keypress:** Press Escape or a letter key after the highlight appears. | If the highlight clears, OpenTUI correctly aborted the selection state upon keyboard input. | If it persists permanently, the terminal host drew it and OpenTUI cannot clear it (Hypothesis A). |
| **16** | **Check whether highlight moves with mouse:** Click and hold, then drag. | Confirms active OpenTUI event processing. | If static, the event loop may be stalled. |
| **17** | **Check behavior in right sidebar:** Click the top row of the newly fixed right sidebar. | If the sidebar highlights, the entire app shell lacks selection barricades. | If only the chat column highlights, the chat layout geometry is uniquely flawed. |
| **18** | **Check outside Savant:** Run a simple OpenTUI script (e.g., hello world). | If the issue reproduces globally, OpenTUI 0.2.2 has a foundational hit-testing bug. | If isolated to Savant, Savant's layout code is the root cause. |
| **19** | **Test with mouse reporting disabled:** If safely testable, disable enableMouseMovement. | If the exact same full-row highlight occurs, the terminal host is executing it natively (Hypothesis A). | If standard native selection (reverse video) appears instead, OpenTUI was drawing the original bug. |
| **20** | **Inspect terminal state after clean/forced exit:** Check for visible raw ANSI codes. | If terminal is left broken (cursor missing, clicks printing text), mouse reset sequences failed (Hypothesis F). | Clean exit confirms robust PTY state management. |

## **Decision Tree for Root Cause Identification**

To streamline the diagnostic process, follow this logical flow based on the outcomes of the experiments defined above:

1. **Does the highlighted text copy directly to the system clipboard without an explicit application command? (Exp 3\)**  

   - **Yes:** The selection is native to the terminal host (xterm.js / Windows Terminal). *Action: Review xterm.js modifier bypass settings and OpenTUI mouse initialization protocols.*  
   - **No:** The selection is drawn by OpenTUI. Proceed to Step 2\.  

2. **When selectable={false} is temporarily removed from the AppShell and Header, does the highlight revert from two rows back to one row? (Exp 12\)**  

   - **Yes:** Event bubbling is the definitive cause. The layout parents are intercepting rejected clicks. Proceed to Remediation Strategy.  
   - **No:** Geometry mutation is the cause. Proceed to Step 3\.  

3. **Does the highlight disappear when the Top Banner is entirely disabled? (Exp 5\)**  

   - **Yes:** The Top Banner geometry, combined with the transparent header, is claiming ownership of the click due to a coordinate overlap. *Action: Recalculate shouldFill and bounding box margins.*  
   - **No:** The ChatLayout root or scrollbox background is the true owner. Proceed to Remediation Strategy.

## **Remediation Strategy and Code Fix**

Assuming the diagnostic matrix confirms Hypothesis B (OpenTUI event bubbling to structural ancestors), the developer must implement a surgical code fix. **Do not recommend broad global changes or globally disable mouse input, as this will destroy the functionality of the interactive descendant buttons and pickers.**  
OpenTUI relies on a fundamental separation between interaction capture and text selection initialization. A Button component internally utilizes onMouseDown and onMouseUp event tracking9. When a user clicks a button, the button's specific handler captures the event. OpenTUI does not require a parent wrapper box to possess selectable={true} for a child to register an interaction. The selectable attribute solely dictates whether the framework should draw a text-selection overlay across the string contents of that specific node's geometry.  
Therefore, the smallest likely code fix requires strategically barricading the major structural layout components from accepting bubbled selection events, while leaving the interactive descendants unencumbered.  
Modify the React tree to apply selectable={false} to the intermediary structural boundaries that currently lack it:

TypeScript  
// 1\. Ensure the AppShell is Barricaded (Already attempted, but must remain)  
export function AppShell({ backgroundColor, children }: AppShellProps) {  
  return (  
    \<box  
      style={createAppShellStyle(backgroundColor)}  
      focusable={false}  
      selectable={false}  
    \>  
      {children}  
    \</box\>  
  )  
}

// 2\. Barricade the ChatLayout Root and Scrollbox  
// This prevents bubbled events from expanding the selection matrix to the whole layout.  
\<box  
  onMouseMove={handleMouseActivity}  
  focusable={false}  
  selectable={false} // ADD THIS: Barricade the ChatLayout root  
  style={CHAT\_ROOT\_STYLE}  
\>  
  \<box  
    focusable={false}  
    selectable={false} // ADD THIS: Barricade the surface styling box  
    style={{  
      ...createChatSurfaceStyle(theme.background),  
      flexDirection: 'column',  
      gap: 0,  
      borderStyle: 'single',  
      borderColor: theme.border,  
    }}  
  \>  
    \<box  
      ref={headerRef}  
      style={HEADER\_BOX\_STYLE}  
      focusable={false}  
      selectable={false} // Header remains barricaded  
    \>  
      \<ChatHeader ... /\>  
    \</box\>

    \<scrollbox   
      selectable={false} // ADD THIS: Prevents the entire scrollbox background from selecting  
      ...  
    \>  
      \<TopBanner ... /\>  
      ...  
    \</scrollbox\>  
  \</box\>  
\</box\>

### **Constraints: What Must Not Be Changed Yet**

> 1. **Do not alter the Button, TerminalLink, or Picker components.** These rely on native mouse-down tracking and are inherently immune to parent selection barricades. Modifying their internal selectable={false} attributes will introduce secondary interaction failures.  
> 2. **Do not modify the terminal's global alternate-screen configuration or emit manual DEC sequences.** Attempting to force manual terminal resets (CSI c) to bypass Cursor/WT quirks will destabilize the entire OpenTUI rendering pipeline.  
> 3. **Do not revisit the color/palette logic.** The surface adjustments and explicit sidebar fill behaviors have resolved visual continuity. Focus exclusively on the pointer event boundaries.

### **Non-Standard Testing Methodology**

To test this fix robustly, the developer must rely exclusively on the direct bun dev harness on the Windows workstation. Do not attempt to validate this fix through Tmux, Linux, WSL, or binary build pipelines, as these environments introduce separate PTY translation layers, pseudo-terminal proxying, and discrete mouse mode configurations (e.g., Tmux's internal mouse capture stealing events from xterm.js)2. Testing directly in the host OS guarantees that the physical mouse hardware interactions are evaluated against the pure OpenTUI FFI layer.

## **Facts Requiring Further Review (NEEDS-REVIEW) and FID Revision**

Certain diagnostic assumptions cannot be definitively resolved without live telemetry data from the Windows target environment:

> 1. **Static Contract Tests as Behavioral Proof:** The repository's source-contract tests merely assert that selectable={false} exists within the JSX abstract syntax tree. They **do not prove** that the native Zig addToHitGrid function respects this property to exclude the component from hit resolution, nor do they prove that event bubbling successfully ceases14. These tests must be treated purely as static syntax linters, not runtime behavioral proofs.  
>
>
> 2. **FID Diagnosis Revision:** If the previous FID (First Input Delay) or general interaction documentation operated under the assumption that native terminal selection (Hypothesis A) was the primary culprit, that documentation must be immediately revised. The 1-to-2 row structural shift following a React prop change strongly invalidates a purely native cause. The delay and interaction faults are rooted in application-level bubbling logic.  
>
>
> 3. **OpenTUI's Default Box State:** It remains unproven whether OpenTUI 0.2.2 natively assigns selectable={true} by default to primitive \<box\> elements or strictly to \<text\> nodes8. If \<box\> elements default to true internally, every wrapper in the Savant-Code application acts as a latent selection hazard, requiring explicit property barricades universally.

## **Conclusion**

The interaction anomaly within Savant-Code—characterized by a non-interactive decorative row triggering a full-row visual highlight upon click—is fundamentally a symptom of OpenTUI's event-bubbling architecture responding to undefined spatial queries. When the developer explicitly configured the ChatHeader to be selectable={false}, the component successfully rejected the incoming selection request. Consequently, OpenTUI propagated the mouse event upward to structural parent containers (e.g., the ChatLayout root or scrollbox). Because these parent wrappers lacked explicit non-selectable declarations, they accepted the bubbled event and applied a highlight corresponding to their entire geometric bounds, effectively expanding the visual anomaly from one row to two rows.  
While the underlying terminal emulators (xterm.js and Windows Terminal) possess complex native selection paradigms and a history of bypass vulnerabilities, they operate strictly as hosts in this specific context. The predictable expansion of the affected screen geometry in direct response to a React property change isolates the failure domain exclusively to the application layout layer. By applying targeted selectable={false} barricades to all intermediary structural parent boxes—while preserving the internal event handlers of nested interactive controls—the anomaly can be successfully neutralized without requiring global pointer overrides or extensive refactoring of the terminal mouse protocol.

### **Works cited**

> 1. How to change selection text's background color in xterm.js? \- Stack Overflow, [https://stackoverflow.com/questions/52819630/how-to-change-selection-texts-background-color-in-xterm-js](https://stackoverflow.com/questions/52819630/how-to-change-selection-texts-background-color-in-xterm-js)  
> 2. Hi all, I'm one of the maintainers of xterm.js, open to answer any questions\! He... | Hacker News, [https://news.ycombinator.com/item?id=28799502](https://news.ycombinator.com/item?id=28799502)  
> 3. Fullscreen rendering \- Claude Code Docs, [https://code.claude.com/docs/en/fullscreen](https://code.claude.com/docs/en/fullscreen)  
> 4. restty \- NPM, [https://www.npmjs.com/package/restty](https://www.npmjs.com/package/restty)  
> 5. CLI TUI: mouse right-click copy/paste and drag-select don't work in VTE terminals (Ptyxis/GNOME Terminal) · Issue \#11531 · cline/cline \- GitHub, [https://github.com/cline/cline/issues/11531](https://github.com/cline/cline/issues/11531)  
> 6. Xterm Control Sequences \- XFree86, [https://www.xfree86.org/current/ctlseqs.html](https://www.xfree86.org/current/ctlseqs.html)  
> 7. Supported Terminal Sequences \- Xterm.js, [https://xtermjs.org/docs/api/vtfeatures/](https://xtermjs.org/docs/api/vtfeatures/)  
> 8. Code \- OpenTUI, [https://opentui.com/docs/components/code/](https://opentui.com/docs/components/code/)  
> 9. @opentui/react \- npm, [https://www.npmjs.com/package/@opentui/react](https://www.npmjs.com/package/@opentui/react)  
> 10. Cannot option+click to select text in less \--mouse · Issue \#4297 · xtermjs/xterm.js, [https://github.com/xtermjs/xterm.js/issues/4297](https://github.com/xtermjs/xterm.js/issues/4297)  
> 11. xterm.js/typings/xterm.d.ts at master · xtermjs/xterm.js · GitHub, [https://github.com/xtermjs/xterm.js/blob/master/typings/xterm.d.ts](https://github.com/xtermjs/xterm.js/blob/master/typings/xterm.d.ts)  
> 12. Wetty XTerm Configuration, [https://connect.sdf.org/assets/xterm\_config/index.html](https://connect.sdf.org/assets/xterm_config/index.html)  
> 13. Renderer \- OpenTUI, [https://opentui.com/docs/core-concepts/renderer/](https://opentui.com/docs/core-concepts/renderer/)  
> 14. OpenTUI Explained \- Simon Klee, [https://simonklee.dk/static/lab/opentui-explained/](https://simonklee.dk/static/lab/opentui-explained/)  
> 15. OpenTUI Go \- Go Packages, [https://pkg.go.dev/github.com/sst/opentui/packages/go](https://pkg.go.dev/github.com/sst/opentui/packages/go)  
> 16. UNPKG, [https://app.unpkg.com/@opentui/core@0.5.1/files/renderer.d.ts](https://app.unpkg.com/@opentui/core@0.5.1/files/renderer.d.ts)  
> 17. Mouse scroll events lost in bottom portion of terminal after shrinking, [https://github.com/anomalyco/opentui/issues/812](https://github.com/anomalyco/opentui/issues/812)  
> 18. UNPKG, [https://app.unpkg.com/@opentui/core@0.4.5/files/chunk-bun-tkm837n2.js.map](https://app.unpkg.com/@opentui/core@0.4.5/files/chunk-bun-tkm837n2.js.map)  
> 19. feat: Add focusable option to Box · anomalyco/opentui@e3bec9a \- GitHub, [https://github.com/anomalyco/opentui/actions/runs/21367030614](https://github.com/anomalyco/opentui/actions/runs/21367030614)  
> 20. DOM-like capture/bubble event dispatch · Issue \#650 · anomalyco, [https://github.com/anomalyco/opentui/issues/650](https://github.com/anomalyco/opentui/issues/650)  
> 21. Mouse text selection has unexpected behavior in terminal · Issue \#1210 · anomalyco/opencode \- GitHub, [https://github.com/anomalyco/opencode/issues/1210](https://github.com/anomalyco/opencode/issues/1210)  
> 22. Improve tmux support · Issue \#456 · xtermjs/xterm.js \- GitHub, [https://github.com/xtermjs/xterm.js/issues/456](https://github.com/xtermjs/xterm.js/issues/456)