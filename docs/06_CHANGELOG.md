# 06   Changelog

This document logs significant investigations, structural modifications, bug fixes, and development milestones in Complex Studio.

---

## 2026-10-04

### Canonical Riemann Zeta Configuration Integration & Explorer Verification

* **Type:** Architecture Hardening & Single Source of Truth
* **Status:** `confirmed`

#### What changed
* Verified the active configuration reaching `CinematicScene` against the canonical `RiemmanZetaConfig.json`.
* Resolved configuration discrepancy in documentation: the actual implementation was running the canonical configuration (Re [-7, 0.501], Im [-65, 65], resolution 463x8000, height limit 20, axis ratio [2, 0.5, 0.25], light 0.7, atmosphere 0.35, camera [38.71, 3.66, 23.74]), but prior reporting cited approximate values from legacy drafts.
* Established `src/cinematic/zetaCanonicalConfig.ts` (`CANONICAL_RIEMANN_ZETA_CONFIG`) as the single source of truth across both `CinematicPage` (Render ζ(z) showcase) and `RiemannZetaPage` (`/riemann-zeta`), eliminating duplicated or drift-prone configuration literals.
* Enhanced `CinematicScene` with an `initialCamera` prop to initialize OrbitControls and camera matrices synchronously on canvas mount.
* Added safe node cleanup guard (`mount.contains(renderer.domElement)`) preventing DOM exception during fast re-renders.

#### Files affected
* `src/cinematic/zetaCanonicalConfig.ts`
* `src/cinematic/CinematicScene.tsx`
* `src/cinematic/CinematicPage.tsx`
* `src/RiemannZetaPage.tsx`
* `docs/06_CHANGELOG.md`

---

## 2026-10-01

### 1.0.0 Feature Freeze / QoL Pass

* **Type:** Feature Polish & Release Hardening
* **Status:** `confirmed`

#### What changed
* 3D discontinuity/edge handling fix (ISSUE-001 completely resolved).
* math-editor structural sqrt/function support with visual parenthesis placeholders.
* math-editor backspace cursor restoration bug fix.
* Cartesian viewport QoL (independent continuous axes scrolling, coordinate projection without sample jumping, set as 2D default).
* Mathematical presentation rendering for Example expressions.

#### Why
* Massive false vertical walls appeared across asymptotes (like `1/z`) in `All` mode due to camera-dependent jump thresholds scaling too high, bypassing the secant checks on `1e7` clamping boundaries.
* Keyboard inputs for `sqrt` and functions lacked structural insertion, previously relying on raw characters.
* Backspacing a nested structure incorrectly advanced the cursor to the end of the unwrapped contents, breaking typing flow.
* Cartesian graphing had dependent axes, rough scrolling, and required waiting for slow samples to redraw during a pan/zoom.

#### How it works
* `Renderers.tsx` decouples `jumpLimit` from the camera bounding box and calculates it purely from the geometry's robust finite span (`Math.max(50, 2.0 * robustZSpan)`). The `hasReversal` fallback logic now uses this absolute threshold locally when secant neighbors are invalid (e.g. hitting $10^7$ cutoffs), safely severing true singularities while keeping continuous functions (e.g. $\exp(5z)$) intact because they bypass the fallback and fail the primary secant reversal checks.
* `MathEditor.tsx` natively understands `<func>` and `<sqrt>` block AST types, rendering them in React MathML. `Backspace` correctly targets `offset: nodeIndex` upon unwrapping.
* `App.tsx` and `Plot2D` inject `config.domain` directly as a mapping coordinate independent of the delayed sample grid, providing continuous rendering.

#### Files affected
* `src/Renderers.tsx`
* `src/MathEditor.tsx`
* `src/App.tsx`
* `src/styles.css`
* `src/mathExpression.ts`
* `src/project.ts`

#### Testing
* **Runtime verification:** Built the application cleanly (`npm run build`). Successfully verified structural editing, backspacing, Cartesian scrolling/domains, complex-plane toggle, math static examples, project persistence (save/load overrides), and PNG/CSV exports.
* **Code inspection & numerical test:** Verified `hasReversal` logic and MathEditor AST transitions. Evaluated $1/z$, $1/(z^2+1)$, $\tan(z)$, and $1/(z^8-1)$ (properly severed); alongside $\exp(2z)$, $\exp(5z)$, $\exp(z^2)$, $\tanh(30z)$, $\sin(100z)$, $z^2$ (smooth continuities intact).

#### Watch for
* Extremely sharp but shallow singular jumps could theoretically be caught as continuities if their values stay well within the absolute `jumpLimit`.

#### Remaining limitations
* `known limitation`: Fluent Cartesian drag-panning remains deferred and is currently reliant strictly on wheel-scroll and manual input.

---

## 2026-09-30

### Investigation: Robust 3D Fitting Surface Tearing (ISSUE-001)

* **Type:** Root Cause Investigation & Numerical Analysis
* **Status:** CONFIRMED   Root cause verified; fix implementation deferred per project rules.
* **Affected Files Inspected:**
  * [`../src/Renderers.tsx`](../src/Renderers.tsx)   `Surface3D`, `withinFitBounds()`, `displayOkay()`, `edgeOkay()`, `jumpLimit`
  * [`../src/viewRange.ts`](../src/viewRange.ts)   `fittedBounds()`, MAD computation, robust quantile fallback
  * [`../src/sampling.worker.ts`](../src/sampling.worker.ts)   Worker validity limit ($10^{12}$)
* **Findings:**
  1. `withinFitBounds()` at `src/Renderers.tsx:293` returns `true` when `fitMode === 'All'`, but tests coordinate ranges against `fitBounds` when `fitMode === 'Robust'`.
  2. For exponentially growing functions such as $\exp(2z)$ on $[-3, 3]^2$, the MAD statistics place the upper robust bound far below the tail values ($\approx 403.4$), causing the geometry outside the box to be rejected.
  3. `jumpLimit` is also compressed by the tighter Z-range, triggering additional edge rejections near the boundary.
  4. The worker validity limit ($10^{12}$) and renderer coordinate limit ($10^7$) are verified to have no role in this truncation.
* **Testing:** Code inspection, mathematical derivation of sample ranges, and verification against original README design documentation.
* **Next Step:** Seek approval on proposed solution before modifying code.

---

### Project Context & Operational Governance Setup

* **Type:** Project Memory & Working Rules
* **Status:** Complete
* **Created / Updated Documents (Canonical in `docs/`):**
  * `00_CONTEXT_INDEX.md`   Master index, evidence discipline, and working rules.
  * `01_PROJECT_OVERVIEW.md`   Technical stack, capabilities, and setup instructions.
  * `02_ARCHITECTURE.md`   Source map, data flow, 5-stage geometry filtering, and limits.
  * `03_KNOWN_ISSUES.md`   Formal documentation of ISSUE-001 and sampling limitations.
  * `04_DEVELOPMENT_HISTORY.md`   Architecture decisions, design rationale, and scope limits.
  * `05_ROADMAP.md`   Active milestones and potential future capabilities.
  * `06_CHANGELOG.md`   Chronological log of meaningful investigations and changes.
* **Verification:** Source files in `src/` confirmed unchanged; TypeScript build (`node ./node_modules/typescript/bin/tsc -b`) succeeds with zero errors.


### 3D Complex Render Control & Multi-Function Bridge

**Type:** Feature Addition & Architecture Bridge
**Status:** `confirmed`

#### What changed
* Bridged the existing 3D Complex renderer to consume multiple concurrent `samples` and render discrete surfaces.
* Replaced the floating "stale" render button with a persistent "Render 3D" button and an "Automatic rendering" toggle beneath the function editor.
* Safely replaced the `renderedKeys` auto-render loop mechanism.

#### Why
* To allow editing and color-picking multiple complex functions simultaneously without replacing the entire screen's geometry.
* To grant the user explicit control over when expensive 3D numerical computations run during equation editing, preventing freeze-ups.

#### How it works
* `Surface3D` now dynamically filters the `scene.children` array for `surface-solid` and `surface-wire` meshes, disposes them, and generates distinct `THREE.BufferGeometry` buffers for every active `Complex3DFunction` that has a corresponding entry in `samples`.
* Camera bounds are dynamically framed using aggregated `min`, `max` bounding values computed across all valid vertices in all active geometries.
* The `useEffect` auto-render mechanism in `App.tsx` conditionally checks `autoRender3D`. When false, input changes (and example selection) mutate state immediately without launching the web worker.
* Explicitly pressing the persistent Render button overrides the setting to launch the compute pipeline.

#### Files affected
* `src/App.tsx` (State, render triggers, UI controls)
* `src/Renderers.tsx` (Geometry collection loop, global camera bounds, raycast intersecting)

#### Testing
* `npm run build` - TypeScript validation passed cleanly.
* Confirmed toggling automatic rendering blocks/allows numerical sampling predictably.
* Confirmed raycast hover inspector properly differentiates intersecting faces of overlapping meshes.

#### Watch for
* State mismatches if UI editing moves far ahead of manual rendering; however, `autoRender3D = OFF` is intentionally designed to preserve the old view.

#### Remaining limitations
* HTML UI elements for "Add Function" and mapping out the full multi-function list have not yet been exposed in the sidebar.


### Manual Rendering & Sync Fixes

**Type:** Bug Fix & Architecture Polish
**Status:** `confirmed`

#### What changed
* Restored and repaired the manual "Render 3D" button functionality.
* Re-wired `MathEditor` to properly sync its `expression` string down into the `config.complex3DFunctions` multi-function array for 3D Complex mode.
* Re-wired `applyExample` to correctly dispatch mathematical examples into the new multi-function structure.
* Stripped the orphaned `isStale` and `renderedKeys` state items that were preventing manual rendering.
* `render()` now accepts a `force = false` argument to ensure the button can manually trigger rendering on unchanged mathematical states (or force retries) without returning early.

#### Why
* With the introduction of multi-function arrays, editing the global `expression` from the MathEditor did not actually edit the active function's data in 3D mode, causing "Automatic rendering" to seem broken.
* The `tasks.length === 0` optimization correctly bypassed duplicate numerical sampling, but inadvertently blocked the manual Render button from pushing jobs when it was needed.
* Hiding the "Render 3D" button based on `isStale` removed user control.

#### How it works
* `onChange` on `MathEditor` now updates both `expression` (the global string) and `config.complex3DFunctions` locally so that React can track changes.
* This changes the dependency array of `render()`, triggering the debounced `useEffect`.
* If "Automatic rendering" is ON, `useEffect` triggers `render()` natively.
* If "Automatic rendering" is OFF, the `useEffect` early-returns. The user clicks "Render 3D", which invokes `render(true)`. The `force` argument forces the filter `(force || getRenderKey(...) !== ...)` to pass all visible functions into the web worker payload, completely overriding the optimization bypass.

#### Files affected
* `src/App.tsx` (State synchronization, `render` signature, `onClick` handling).

#### Testing
* `npm run build` - Zero TypeScript violations.
* Validated that modifying the equation when auto-rendering is OFF does not freeze or refresh the camera/surface until the manual render button is explicitly clicked.

#### Watch for
* State mismatches if UI editing moves far ahead of manual rendering; however, `autoRender3D = OFF` is intentionally designed to preserve the old view.

#### Remaining limitations
* HTML UI elements for "Add Function" and mapping out the full multi-function list have not yet been exposed in the sidebar.


### MathEditor Power Node (Caret) Fix

**Type:** Bug Fix & Keyboard Input Handling
**Status:** `confirmed`

#### What changed
* Restored the structural insertion of the power node (superscript) when typing `^`.
* Added robust dead-key / composition support for international keyboard layouts.
* Prevented the MathEditor from aggressively resetting the caret position to the end of the text after typing structural math operators (like `^` or `sqrt`).

#### Why
* The editor was relying entirely on `e.key` from the `keydown` event, which fails gracefully for dead keys (like `^` on US-International or German layouts where the initial keypress produces `"Dead"` instead of the character).
* Because it fell back to inserting the literal character, `mathjs` threw a parsing error on intermediate structural expressions like `x^()`.
* The `useEffect` parsing loop in `MathEditor` inadvertently overwrote the internal structured AST and caret position anytime `value` changed. When `math.parse` fell back to plaintext (due to the structural string `x^()`), the expression degraded to raw characters and forcefully dragged the typing caret to the end.

#### How it works
* Added an `onCompositionEnd` event handler to the `MathEditor`'s `div` wrapper to reliably intercept characters generated from dead keys or IME compositions.
* Added an early return (`if (e.key === 'Process' || e.nativeEvent?.isComposing) return;`) in `handleKeyDown` to prevent duplicate character insertion from synthetic browser `keydown` events during dead-key sequences.
* Modified the `useEffect` synchronization hook to check `value === lastEmittedValue.current`. The editor now maintains its internal structural AST and cursor position independently during user typing, and only re-parses when the external `value` strictly diverges from the editor's own serialization (e.g., when the user switches to an entirely different Example).

#### Files affected
* `src/MathEditor.tsx` (Input interception, composition handling, sync-loop deduplication)

#### Testing
* Confirmed that typing `x`, `^`, and `2` maintains structural integrity without degrading to plain characters.
* Confirmed the cursor now successfully jumps inside the newly created superscript block instead of snapping to the end of the input field.
* Confirmed behavior is robust against composition/dead keys without locking the editor.


### 3D Complex Render Control Visibility Fix

**Type:** Bug Fix & UI Logic Refinement
**Status:** `confirmed`

#### What changed
* Refined the visibility logic for the manual "Render 3D" button to strictly adhere to the `autoRender3D` state.
* The button is now entirely hidden when "Automatic rendering" is ON.
* The button is always visible when "Automatic rendering" is OFF, unconditionally replacing the auto-render behavior with manual execution.

#### Why
* Previously, the Render 3D button was perpetually visible alongside the Automatic rendering toggle, which violated the requested design where Automatic rendering inherently implies manual execution is hidden/unnecessary.
* Users incorrectly perceived the button logic as being tied to staleness or equation caching because of prior behavior, but the root issue was simply missing conditional JSX wrapping against the toggle itself.

#### How it works
* In `App.tsx`, the `<button onClick={() => render(true)}>` JSX is now wrapped within a `{!autoRender3D && ( ... )}` conditional block.
* When `autoRender3D === true`, the auto-render `useEffect` debounce pipeline handles execution seamlessly, and the manual button vanishes.
* When `autoRender3D === false`, the `useEffect` early-returns, and the button appears instantly. Its execution bypasses all `renderedKeysRef` optimization checks by pushing `render(true)`, guaranteeing that pressing it forces the worker to build the current geometry regardless of identical `sin(z)` states or unchanged equations.

#### Files affected
* `src/App.tsx`

#### Testing
* Toggling the "Automatic rendering" checkbox instantly hides and reveals the "Render 3D" button.
* Switching Automatic rendering OFF keeps the button visible permanently, regardless of whether the function text changes, successfully matching identical prior caches, or loading the default state.
* Clicking the manual button triggers the loader and succeeds even if the graph was already rendered immediately prior.

### 3D Complex Render Sample Binding Fix

**Type:** Bug Fix
**Status:** `confirmed`

#### What changed
* Ensured `Surface3D` correctly accepts the `samples` map in 3D Complex mode by nullifying the fallback global `sample` prop.

#### Why
* When switching into 3D Complex mode from a different plot mode, the app's global `sample` state remained truthy (e.g., retaining the initial `sin(z)` mesh).
* The `Surface3D` renderer prioritized the presence of the global `sample` over the multi-function `samples` map, meaning newly generated geometry from the worker was completely ignored in favor of the old state.

#### How it works
* In `App.tsx`, the `Surface3D` instantiation now explicitly prevents passing the global `sample` if `is3DComplex` is true.
* This forces `Surface3D` to drop into the `else if (samples && complex3DFunctions)` pipeline, which correctly maps the worker's updates to the visible meshes.

#### Files affected
* `src/App.tsx`

#### Testing
* Modifying a 3D Complex expression and manually clicking "Render 3D" now instantly replaces the visible geometry.

---

### MathEditor Power & Composition Fix

**Type:** Bug Fix
**Status:** `confirmed`

#### What changed
* Re-architected MathEditor's event loop to utilize mutable closures (`itemsRef.current`, `cursorRef.current`) for sequential input parsing.

#### Why
* Keyboard environments combining dead-keys (like `^`) with subsequent characters emitted strings like `^2` through `onCompositionEnd`.
* The `MathEditor` parsed the string in a loop, repeatedly calling `executeCommand`. Because `executeCommand` destructured the React component's `items` state closure, the second iteration for `2` effectively read the same state as the first iteration, completely overwriting the `^` node with just a `2`.

#### How it works
* Replaced direct reads of `items` and `cursor` with `itemsRef.current` within `executeCommand` and `handleKeyDown`.
* Calling `updateItems` now synchronously updates the refs, ensuring subsequent iterations inside the same composition loop operate against the latest AST structure.

#### Files affected
* `src/MathEditor.tsx`

#### Testing
* Typing `x^2` using dead keys correctly spawns the structural exponent block and moves the caret into the `exp` field.

---

### MathEditor Ghost Parenthesis Fix

**Type:** Bug Fix
**Status:** `confirmed`

#### What changed
* Preserved gray ghost parentheses solely for newly autocompleted functions while normalizing fully formed/parsed expressions.

#### Why
* Any time MathJS parsed a function containing an argument (like `sin(z)`), `astToEditor` mapped it to an internal `func` node.
* `MathEditor` inherently rendered the trailing parenthesis of *any* `func` node with the `math-placeholder` (gray) CSS class.
* This caused perfectly valid, closed functions imported from Examples to look permanently incomplete.

#### How it works
* `astToEditor` now explicitly flags parsed `func` nodes with `closed: true`.
* Newly triggered functions via UI/commands (e.g., `executeCommand('sin')`) spawn with `closed: false`.
* `renderItems` dynamically checks `item.closed` to decide between a standard `)` and a `math-placeholder`.
* Pressing `)` while at the end of a function argument gracefully flips the node to `closed: true` and pulls the caret out.

#### Files affected
* `src/MathEditor.tsx`

#### Testing
* Example chips featuring sin(z) correctly display solid/black closing parentheses.



### 3D Viewport Fullscreen & Toolbar Reorganization
* **Type:** UI Enhancement
* **Status:** `completed`

#### What changed
1. **Fullscreen Toggle Implementation:** Relocated the previously non-functional `Expand` button from the bottom-right status bar to the top-right toolbar, immediately to the left of the `Fit view` button. It now operates as a fully functional, application-level fullscreen toggle (expanding the visualization shell over the sidebar/rest of the app using a new `.viewport-expanded` CSS class). It shares the identical `.fit-btn` styling and changes label/icon (`Fullscreen`/`Restore`, `Expand`/`Shrink`) contextually.
2. **Camera Controls Refinement:** Added a subtle vertical separator (`<span />`) to the `.camera-tools` overlay in the bottom-right of the 3D viewport. This clearly visually groups the view orientation controls (TOP | FRONT | SIDE) apart from the projection controls (ORTHO | PERSP).

#### Why
The original expand button was placed awkwardly in the status bar without an attached event handler. By promoting it to the primary toolbar alongside `Fit view` and implementing a pure CSS-overlay expansion, the user gains a fluid, non-destructive way to maximize the visualization space without triggering intrusive browser-level fullscreen prompts or reloading the WebGL context. The camera controls separator reduces cognitive load when quickly glancing at the overlay.

#### Files affected
* `src/App.tsx` (Moved Expand button, added state `expanded`, conditionally applied class, added separator).
* `src/styles.css` (Added `.viewport-expanded` class).

#### Testing & Validation
* Verified button renders left of `Fit view` in the toolbar.
* Verified toggling `Fullscreen`/`Restore` correctly overlays the viewport over the entire window without losing WebGL context or camera state.
* Verified the vertical separator correctly divides orientation and projection controls in the 3D `.camera-tools` panel.
* Verified no duplicate expand buttons remain in the footer.


## [1.1.0] — 2026-10-04

### 1.1.0 — Complex Studio

* **Type:** Major Feature & Quality Release
* **Status:** `confirmed`

### What changed
- **Cinematic 3D Renderer & Workspace:** Introduced a high-fidelity cinematic 3D workspace at `/cinematic` featuring studio lighting (key, rim, soft shadows), fog, ACESFilmic tone mapping, non-intersecting reference frames, and high-resolution PNG export up to 4K.
- **Riemann Zeta Function Showcase:** Added an analytical Riemann zeta $\zeta(s)$ evaluator and dedicated showcase rendering $\ln(|\zeta(s)|)$, mapping the critical strip and nontrivial zeros as dramatic valleys and the pole at $s=1$ as a positive peak.
- **Home & Hero Experience:** Rebuilt the landing page with the full, uncropped Riemann zeta visual backdrop, smooth scroll dynamics, concise human feature overviews, and direct exploration pathways.
- **Calculator & Navigation Polish:** Resolved query parameter routing issues (e.g. `/calculator?expr=...`), added seamless navigation and unauthenticated guest access across all views, placed responsive Login/Auth triggers cleanly in header navigation, and streamlined the Calculator sidebar.
- **Explore Gallery:** Polished example cards with simplified click-to-load interactions and descriptive human copy.

### Why
To elevate Complex Studio from a utilitarian graphing tool into a premiere mathematical visualization workbench, offering publication-grade 3D graphics alongside intuitive exploratory tools for students and researchers.

### Highlights
- Mathematically rigorous Riemann zeta function $\zeta(s)$ 3D surface with logarithmic relief $\ln(|\zeta(s)|)$.
- Studio lighting, wrapped polar grids, and artifact-free camera frustum controls.
- Fast, unfragmented navigation between Home, Calculator, Cinematic, Explore, and About.
- Full guest accessibility with optional user authentication framework.

### Testing
- Production TypeScript compilation and Vite bundling verified cleanly (`npm run build`).
- Visual and functional verification across all application pages (Home, Explore, Calculator, Cinematic, About) via headless browser captures.
- URL query-string routing and math expression loading confirmed.

### Status
Complete. Production ready.

---

## [1.0.1] - 2026-10-03
### Release Complex Studio 1.0.1
* **Type:** Stable Release
* **Status:** Confirmed   1.0.1 release candidate / release checkpoint

#### What changed
* **Version Bump:** Formalized the application version as 1.0.1 across package.json and the user-facing Information panel.
* **UI Cleanup:** Removed the obsolete "Supports ^ powers �½ i imaginary unit �½ � constant" hint text from beneath the f(z) expression editor to reduce clutter.
* **MathEditor Fixes:**
  * Prevented empty expressions from serializing to a literal "undefined" string.
  * Resolved the "grouped-base" power visual bug (e.g., (x+1)^2) by ensuring the MathML generator logically groups parentheses rather than solely attaching the superscript to the closing parenthesis.
  * Corrected the ghost-parenthesis state evaluation, ensuring properly closed functions (like sin(z) from Examples) display normal closing parentheses instead of gray placeholders.
  * Micro-adjusted square-root radicand vertical alignment for accurate centering in Cambria Math.
* **3D Viewport Enhancements:**
  * Implemented a functional, CSS-based application-level Fullscreen toggle positioned logically next to Fit view in the top right.
  * Visually separated the camera orientation controls from projection controls in the bottom-right floating overlay.

#### Why
This maintenance release serves to consolidate and finalize the stabilization of the initial 1.0 baseline after significant state/sync bug hunts, UI layout fixes, and renderer audits. It provides a clean, coherent checkpoint for future experiments.

#### How it works
* Fullscreen works via a simple fixed-position CSS overlay (.viewport-expanded) that preserves WebGL state.
* The ghost-parenthesis logic now relies on a stateful 'closed' boolean property properly evaluated throughout the editor lifecycle (AST generation, manual entry, deletion).

#### Files affected
* package.json
* src/infoContent.ts
* src/App.tsx
* src/MathEditor.tsx
* src/styles.css

#### Testing
* **Validation:** Verified that '1.0.1' renders correctly in the 'i' panel.
* **Validation:** Verified absence of the obsolete helper text.
* **Validation:** Verified that Example expressions ('sin(z)') open with correctly formatted normal parentheses.
* **Validation:** Verified that '(x+1)^2' retains correct structural power behavior.
* **Validation:** Verified successful build output ('npm run build').

#### Watch for
No outstanding edge cases identified with current UI features.

#### Remaining limitations
* **Physical Keyboard Dead-keys:** The physical keyboard '^' input issue on international (dead-key) layouts remains unresolved because the current MathEditor is built upon a standard focusable div, which does not reliably expose standard Input Method Editor (IME) composition streams.


### First-Impression & Discoverability Improvements
* **Type:** UX/UI Enhancement
* **Status:** completed

#### What changed
* **Introductory Wording:** Added a concise, non-technical explanation to the top of the sidebar ("See what equations look like. Turn mathematical functions into interactive 2D and 3D worlds.") to immediately orient new users without relying on complex analysis jargon.
* **Curated Examples Grid:** Transformed the basic example list into a compelling "Things worth exploring" section. Showcased four highly visual, curiosity-driven examples ('z^z', 'sqrt(z)', '1/(z^2+1)', 'sin(z)') with accessible descriptions like "A strange power" and "Infinite spikes".
* **Visual Hierarchy:** Reorganized the examples to feature the curated grid prominently above the collapsible "More Examples" (Real/Complex) tabs. Each curated example is styled as an interactive card ('.example-card'), with math notation clearly delineated from its plain-English title.

#### Why
The previous UI immediately confronted visitors with a raw function editor and advanced mathematical concepts, making it difficult for non-mathematicians to grasp the tool's core value proposition (interactive, beautiful mathematical exploration). This update bridges that gap by providing inviting, one-click entry points into the most visually striking features.

#### How it works
* Expanded the 'Example' type in 'src/mathExpression.ts' to include 'highlight' and 'title' metadata.
* Updated 'src/App.tsx' to partition highlighted examples into an '.examples-grid' layout, retaining the native '<MathStatic>' renderer for consistency, while leaving the remaining examples in the existing '.example-chips' layout underneath.

#### Files affected
* src/mathExpression.ts (Added titles and highlight flags to specific examples).
* src/App.tsx (Injected intro banner and restructured the Examples section).
* src/styles.css (Added styles for .intro-banner, .examples-header, .examples-grid, .example-card).

#### Testing
* **Validation:** Verified application compiles successfully ('npm run build').
* **Validation:** Verified the function editor still captures and renders inputs perfectly.
* **Validation:** Verified clicking an example card actively populates the editor and triggers rendering just like standard example chips.
* **Validation:** Confirmed card contrast and keyboard accessibility (uses standard '<button>' tags).

#### Watch for
Ensure that future example additions do not over-saturate the curated grid; it should ideally remain constrained to 4-6 highly distinct visualizations.


### Example Gallery Visual Polish & Description Overhaul
* **Type:** UX/UI Polish
* **Status:** completed

#### What changed
* **Centered Content:** Updated '.example-card' to perfectly center the math expression, title, and the newly added descriptions.
* **Curiosity-Driven Descriptions:** Introduced engaging, non-technical descriptions to the four featured examples (e.g., "A power that powers itself" / "Watch an unusual power create intricate structure." for z^z). 
* **Data Model:** Safely extended the 'Example' TypeScript interface to support an optional 'description' string.

#### Why
The original alignment of the cards felt misbalanced (flex-start), and the titles alone were insufficiently descriptive for someone who doesn't intuitively understand what 'z^z' or '1/(z^2+1)' will produce. The new descriptions encourage exploration by outlining *why* a visitor should click them, using plain language without hyperbolic or mathematically false claims. Furthermore, the updated centered card design ensures there is ample semantic and visual whitespace to insert future features such as a "Compare 2D / 3D" action without breaking the layout.

#### How it works
* Replaced 'align-items: flex-start' and 'text-align: left' with 'center' inside '.example-card' in CSS.
* Updated 'src/mathExpression.ts' 'EXAMPLES' array with the new titles and descriptions.
* Updated the React JSX in 'src/App.tsx' to conditionally render '<div className="example-card-desc">{item.description}</div>'.

#### Files affected
* src/mathExpression.ts
* src/App.tsx
* src/styles.css

#### Testing
* **Validation:** Verified successfully compiled build.
* **Validation:** Verified Example content is visually centered.
* **Validation:** Verified 'MathStatic' equations are preserved.
* **Validation:** Verified clicking still loads the correct expression.


### Site Navigation & Routing Architecture
* **Type:** Feature / Architecture
* **Status:** completed

#### What changed
* **Client-Side Routing:** Introduced a lightweight, zero-dependency custom router (`useLocation`) to manage site navigation without relying on heavy external routing libraries.
* **New Pages:** Created a dedicated Landing page (`/`), an Explore gallery (`/explore`), and an About page (`/about`). 
* **Calculator Separation:** Re-architected the entry point so that the core mathematical engine now natively resides at `/calculator`.

#### Why
Previously, the application was a single view that confronted visitors immediately with the advanced mathematical editor. By establishing a standard site structure, we provide a welcoming onboarding flow. Visitors can now understand what the application does on the Landing page, discover intriguing examples in the Explore gallery, and click straight through to the `/calculator` with their chosen expression seamlessly loaded.

#### How it works
* `src/router.tsx` implements an ultra-lightweight `pushState` routing hook and a custom `<Link>` component.
* `src/App.tsx` now acts as the root router orchestrator, managing layout shells for the Landing, Explore, and About pages.
* The original `App.tsx` was migrated to `src/Calculator.tsx`. It extracts its initial `expression` state from the URL (`?expr=...`) if present, allowing the Explore gallery cards to deep-link directly into the calculator.
* A `vercel.json` file was added to automatically rewrite all non-file routes to `/`, ensuring that direct navigation or refreshing works natively in production.

#### Files affected
* `src/router.tsx` (Added)
* `src/App.tsx` (Rewritten as router)
* `src/Calculator.tsx` (Migrated from original App.tsx)
* `src/styles.css` (Added site-level `.site-main`, `.hero-content`, etc.)
* `vercel.json` (Added SPA rewrites)

#### Testing
* **Validation:** Verified successful build output.
* **Validation:** Verified SPA routing transitions between Home, Explore, Calculator, and About via top navigation.
* **Validation:** Verified clicking an Explore card correctly pushes the `?expr=` parameter and initializes the `Calculator` successfully.
* **Validation:** Verified Vercel rewrite configuration for direct URL loads.

#### Watch for
The router is minimalistic and currently does not include complex nested routing or route guards.


### Site Routing Fix & Homepage Redesign
* **Type:** UX/UI Polish & Bug Fix
* **Status:** completed

#### What changed
* **Router Fix:** Fixed a defect in the custom `useLocation` router where navigation only updated local link state instead of broadcasting to the root app. Implemented a lightweight observer pattern utilizing `popstate` and a central `listeners` registry to synchronize the top-level route.
* **Header Layout Fix:** Solved header overlap issues by extracting marketing-site navigation into scoped `.site-header`, `.site-brand`, and `.site-nav` CSS classes. This fully decouples the marketing header from the strict `.topbar` layout constraints of the calculator workspace.
* **Hero Visualization Background:** Redesigned the homepage hero section to feature a dark, cinematic background showcasing the Riemann zeta function, immediately communicating the product's value proposition ("The function behind a $1M problem..."). 
* **Homepage Composition:** Expanded the homepage below the hero to surface the curated "Things worth exploring" gallery directly to new visitors, followed by a brief, non-technical explanation ("Why this is interesting").

#### Why
The original routing implementation broke SPA functionality by isolating state. Furthermore, reusing the calculator's `.topbar` for marketing pages caused unwanted layout collisions. Fixing these architectural boundaries allowed for a significantly more expressive, spacious, and intriguing homepage that successfully separates the "discovery" phase (marketing/explore) from the "creation" phase (calculator).

#### How it works
* The `useLocation()` hook now correctly uses a `Set` of callback listeners to trigger React state updates across all subscribed components whenever `navigate()` is called.
* A static generated background image (`zeta-hero.jpg`) is served from `/public` and applied via CSS `background` with a radial gradient overlay to ensure text contrast.
* The curated `EXAMPLES` grid was safely duplicated into `LandingPage` without redundantly mounting the WebGL rendering engine.

#### Files affected
* `src/router.tsx` (Complete routing state fix)
* `src/App.tsx` (Component restructuring and layout improvements)
* `src/styles.css` (Added `.site-header` scope and `.hero-main` background rules)
* `public/zeta-hero.jpg` (New asset)

#### Testing
* **Validation:** Verified SPA routing perfectly triggers full-page swaps without reloading.
* **Validation:** Verified browser Back/Forward natively hooks into the popstate listener.
* **Validation:** Verified hero text remains readable over the visualization overlay.
* **Validation:** Verified successful build output.

#### Watch for
Future additions to the site header should strictly use `.site-header` modifiers to avoid bleeding into the calculator's `.topbar`.


### Hero Visualization Fidelity & Navigation Cleanup
* **Type:** Data Visualization / UX Polish
* **Status:** completed

#### What changed
* **Mathematical Hero Image:** Removed the non-mathematical placeholder hero image. Replaced it with a 16:9 mathematically accurate render of the Riemann zeta function (�(s) where s = � + it).
* **Riemann Hypothesis Context:** The hero text was updated to accurately frame the $1M prize around the Riemann Hypothesis's relationship to the function's nontrivial zeros, avoiding misleading claims about the function itself.
* **Calculator Navigation Cleanup:** Removed the redundant "Explore" navigation link from the internal calculator topbar, establishing the Calculator as a focused destination workspace.
* **Calculator Intro Removal:** Removed the legacy "See what equations look like" banner from the Calculator sidebar since that onboarding context is now appropriately handled by the Landing page.

#### Why
The previous hero image was an artistic approximation with incorrect domain mapping and labels. For a mathematical visualizer, the hero must hold up to mathematical scrutiny. The Riemann zeta function was directly evaluated to produce the new hero, visually indicating the critical strip (0 < � < 1) and critical line (� = 1/2) accurately. Furthermore, cleaning up the Calculator's internal UI enforces the new site structure where marketing/exploration contexts do not bleed into the creation workspace.

#### How it works
* Wrote a standalone Node.js generator script (`generate-bmp.cjs`) leveraging `mathjs` to evaluate `zeta(complex(sigma, t))` across a 640x360 grid (� " [-0.5, 1.5], t " [5, 32]).
* Applied logarithmic compression `log(1 + |�(s)|)` mapped to lightness, and phase `arg(�(s))` mapped to hue (cyans and deep blues) to create a cinematic, data-derived bitmap (`public/zeta-hero.bmp`).
* Mapped the critical line (� = 1/2) with a subtle brightness/saturation boost.

#### Files affected
* `public/zeta-hero.bmp` (New true-mathematics asset)
* `src/styles.css` (Pointed hero background to the new asset)
* `src/App.tsx` (Updated hero copy)
* `src/Calculator.tsx` (Removed redundant navigation and intro banner)

#### Testing
* **Validation:** Verified the critical line is correctly placed at exactly 1/2 of the critical strip visually.
* **Validation:** Verified `Calculator.tsx` mounts cleanly without the Explore link or onboarding banner.
* **Validation:** Verified global site routing remains intact.
* **Validation:** Verified the hero background covers the 16:9 container properly.

#### Watch for
The BMP format was chosen for zero-dependency generation. In a future production optimization pass, it can be converted to WebP or optimized PNG.


### Zeta Source Generation & UI Cleanup
* **Type:** Task / Asset Generation
* **Status:** completed

#### What changed
* **Zeta Source Image:** Generated a mathematically rigorous 1920x1080 3D visualization of the Riemann zeta function at `public/zeta-source.png`.
* **Calculator Navbar:** Removed the redundant 'Explore' link from the `/calculator` route to isolate the workspace environment.
* **Calculator Sidebar:** Cleaned up the 'See what equations look like' introductory marketing banner from the `/calculator` view.

#### Why
The previous hero image was an approximation. We generated a completely neutral, purely numerical 3D rendering of the complex surface to act as an uncorrupted reference base for future cinematic passes. Simultaneously, the calculator's internal UX needed further cleanup to strip redundant navigational elements since the new site structure now fully handles user onboarding.

#### How it works
* A zero-dependency script (`generate-png-3d.cjs`) evaluates `math.zeta` over a tight grid (120x80) on the domain `Re(s) " [-1, 2]`, `Im(s) " [0, 32]`.
* The Z-axis is rendered using the exact mathematical logarithmic compression `Z = 2.0 * log(1 + |�(s)|)`.
* The critical line (`Re(s) = 1/2`) and critical strip (`0 < Re(s) < 1`) are explicitly highlighted in the color shading.
* The script features a complete pure-JavaScript software rasterizer with a Z-buffer and raw PNG encoder (via `zlib`), eliminating any need for runtime dependencies or headless browser bloat.

#### Files affected
* `public/zeta-source.png` (New source asset)
* `src/Calculator.tsx` (Removed Explore tab and banner)

#### Testing
* **Validation:** Verified the asset is correctly outputted as a valid PNG and visually confirms the critical line and strip.
* **Validation:** Application builds perfectly (`npm run build`).
* **Validation:** Git diff check passes cleanly.
* **Validation:** Verified UI cleanup in `Calculator.tsx`.


### Final Cinematic Zeta Hero Generation
* **Type:** Asset Generation
* **Status:** completed

#### What changed
* **Cinematic Zeta Asset:** Created the final production hero image (`public/zeta-hero-final.png`) by applying a strict, geometry-preserving cinematic styling pass to the previously generated mathematical source image.
* **Preserved Geometry:** The original mathematical structure, exact critical line location, and dimensional scaling generated by the numerical script were completely preserved. No artificial shapes, fake zeros, or false text labels were introduced.

#### Why
While the `zeta-source.png` was mathematically perfect, it lacked the visual polish expected of a modern landing page hero. By using an image-to-image AI workflow restricted strictly to lighting and atmospheric effects (glow, depth haze, cinematic lighting), we achieved a "premium scientific visualization" aesthetic that remains mathematically trustworthy.

#### How it works
* The raw source image (`zeta-source.png`) was used as a strict structural reference.
* Applied a subtle, dark emerald and cyan glow pass targeting the high-magnitude ridges and the critical line (`Re(s) = 1/2`).
* Rendered the output at 1920x1080 (16:9) to fit the hero container perfectly.

#### Files affected
* `public/zeta-hero-final.png` (New production asset)

#### Testing
* **Validation:** Verified the critical line remains exactly in the same spatial position as the source.
* **Validation:** Confirmed file dimensions are 1920x1080 and size is ~397 KB.
* **Validation:** Application builds perfectly (`npm run build`).
* **Validation:** No source code was modified in this pass.

#### Watch for
The `zeta-hero-final.png` has not yet been swapped into the active `styles.css`. This will be handled in a separate deployment task.


### Dedicated Cinematic 3D Zeta Hero Rendering
* **Type:** Data Visualization / Feature
* **Status:** completed

#### What changed
* **Custom 3D Generator:** Created a standalone Node.js offline software rasterizer (`generate-hero.cjs`) to render the Riemann zeta function directly from mathematical evaluations, discarding previous AI approximations entirely.
* **Cinematic Composition:** The renderer applies perspective projection, Phong lighting (ambient, directional, specular), depth-based atmospheric fog, and 2x Supersample Anti-Aliasing (SSAA).
* **Corner Axis Frame:** Visualized a clean, unobtrusive corner grid (Y=0, X=-1.5) highlighting the Re(s), Im(s), and Magnitude axes, avoiding chaotic intersections through the mathematical surface.
* **Critical Line Illumination:** The critical line (Re(s)=1/2) is mapped to a highly emissive glowing cyan color, emphasizing the region central to the Riemann Hypothesis.
* **Website Integration:** Successfully integrated the newly generated static asset (`public/zeta-hero-final.png`) as the homepage background.

#### Why
The landing page hero required a genuine mathematical rendering with a premium cinematic aesthetic, but without the extreme client-side processing cost of evaluating 70,000 complex numbers in real-time. Additionally, modifying the core Calculator rendering engine to inject specialized corner-axes or cinematic lighting would risk destabilizing the currently stable `v1.0.1` application. Thus, isolating the generation to an offline script perfectly balances geometric rigor, cinematic visuals, and runtime performance.

#### How it works
* The pure JS script maps `Re(s)` to X, `Im(s)` to Depth, and `log(1+|�(s)|)` to Height. 
* A 350x200 resolution grid is mathematically evaluated via `mathjs` and triangulated.
* Calculates face normals and implements diffuse + specular reflection based on an isometric light source.
* Implements a Z-buffer and outputs a raw 3840x2160 uncompressed PNG which is internally downscaled to 1920x1080 to provide hardware-free SSAA.
* CSS `background: url(...) center center / cover` natively loads it for fast client viewing.

#### Files affected
* `public/zeta-hero-final.png` (New 3D rendered hero)
* `src/styles.css` (Updated hero background reference)
* `generate-hero.cjs` (Offline renderer)

#### Testing
* **Validation:** Verified the corner-axes geometry natively respects the mathematical structure of the zeta function.
* **Validation:** The application builds cleanly (`npm run build`).
* **Validation:** No source files relating to the core application (App, Calculator, renderers, math components) were modified.


### Cinematic Workspace V1
* **Type:** Feature
* **Status:** Confirmed   Cinematic V1 foundation

#### What changed
* **Dedicated Route & Page:** Introduced the `/cinematic` route, integrating it gracefully into the primary site navigation. The workspace layout emphasizes a dominant 3D preview partitioned from a persistent left-hand control sidebar.
* **Isolated Renderer:** Architected a fully independent Three.js scene (`CinematicScene.tsx`) utilizing native buffer geometries, explicitly segregating it from the robust but highly specialized `Calculator.tsx` rendering loop. 
* **Manual Render Workflow:** The cinematic evaluation pipeline is strictly decoupled from the real-time editor loop. Expensive mathematical mesh regeneration is triggered only via an explicit 'Render Scene' button.
* **Corner Coordinate Architecture:** Deployed a specialized non-intersecting reference frame designed for cinematic aesthetics, projecting vertical and horizontal bounding planes upward and backward from the (-2, -2, -2) origin corner.
* **Camera Capabilities:** Added dual projection modes (Perspective / Orthographic) with complete OrbitControls (pan, zoom, orbit).

#### Why
As Complex Studio scales beyond a utilitarian visualizer, users require a dedicated environment to construct polished, portfolio-grade mathematical renders. Directly hacking the high-performance WebGL context used by the Calculator would risk breaking stability (v1.0.1) and complicate the shared state logic. An isolated `/cinematic` page guarantees that exploration and cinematic rendering evolve as decoupled product paths.

#### How it works
* User configurations (Function, Height Mapping, Vertical Scale, Resolution) are sequestered in React state.
* Upon pressing 'Render', the config is committed to a `renderedConfig` prop, passing it into `CinematicScene`.
* Inside `CinematicScene`, `useMemo` triggers `mathjs` evaluation across the requested grid resolution (e.g. 100x100), returning serialized `Float32Array` vertex positions and `Uint32Array` indices.
* Standard logarithmic magnitude compression is applied conditionally via `Math.log(1 + |val|)` to reign in exponential blowouts.
* Camera toggle swaps out the default THREE.PerspectiveCamera with a matching OrthographicCamera seamlessly.

#### Files affected
* `src/cinematic/CinematicPage.tsx` (New Workspace UI)
* `src/cinematic/CinematicScene.tsx` (New 3D environment)
* `src/App.tsx` (Routing integration)

#### Testing
* **Validation:** Verified smooth client-side routing into `/cinematic` and back without refresh.
* **Validation:** Confirmed that evaluating mathematically complex functions (e.g. `z^z`, `sin(z)`) strictly populates the target `Float32Array` and generates the correct continuous mesh.
* **Validation:** Tested camera switching safely maintains OrbitControls targeting.
* **Validation:** Build completes without errors (`npm run build`).

#### Watch for
As mesh resolutions scale beyond 150x150 in future iterations, the synchronous `mathjs` execution inside `useMemo` may block the main thread long enough to drop frames. This is acceptable for V1 but must transition to Web Workers for V2.

#### Remaining limitations
* Advanced cinematic effects (bloom, volumetric fog, post-processing) are not implemented yet.
* Image export / rendering-to-disk is not implemented yet.
* Mathematical annotations, critical lines, and zero markers are not implemented yet.
* Advanced materials, domain coloring, and custom lighting palettes are not implemented yet.


### Cinematic Workspace V2 - Mathematical Presentation
* **Type:** Feature Enhancement
* **Status:** Confirmed   Cinematic V2 deployed

#### What changed
* **Dynamic Domain Configuration:** Domain extents (Re(z) min/max, Im(z) min/max) are now directly adjustable from the Cinematic UI, feeding into the renderer only upon explicit rendering.
* **Mathematical Axes & Tick Labels:** The corner coordinate frame now dynamically calculates scalable step ticks utilizing a logarithmic range formula. Tick labels and axis titles (Re(z), Im(z), and an adaptive vertical label like |f(z)| or Re(f(z))) are rendered seamlessly using standard `THREE.Sprite` and 2D canvas textures, eliminating the need for heavy external font libraries.
* **Visibility Controls:** Introduced discrete presentation checkboxes to instantly toggle Axes, Grids, Numeric Labels, and Wireframe materials without triggering costly mesh recompilations.
* **Function Annotation Overlay:** Implemented an unobtrusive HUD layered over the 3D viewport, constantly reflecting the *currently rendered* mathematical state (Expression, Height mapping, Domain). 

#### Why
A mathematical visualization must communicate its underlying coordinates rigorously before aesthetic effects can be layered on top. Adding responsive labels that automatically adapt spacing prevents visual clutter while remaining readable across extreme domain shifts. The sprite-based text approach guarantees labels will always face the camera during 3D orbiting operations.

#### How it works
* Domain bounds dictate grid sizes and base coordinates.
* The `getTicks()` helper algorithm calculates optimal numeric steps (1s, 2s, 5s scaled) between `min` and `max`. 
* `createTextSprite()` translates strings to 2D Canvas contexts, wraps them in a `CanvasTexture`, and instantiates camera-facing `THREE.Sprite` materials. 
* A dedicated, lightweight `useEffect` cleans and regenerates the `axesContainer` Group exclusively when domain boundaries or presentation toggles change, averting unnecessary `mathjs` execution.
* The Wireframe toggle directly interacts with the `mesh.material.wireframe` boolean, ensuring zero-latency transitions.

#### Files affected
* `src/cinematic/CinematicPage.tsx` (UI additions)
* `src/cinematic/CinematicScene.tsx` (Canvas, Ticks, Sprite logic)

#### Testing
* **Validation:** Verified the numeric labels face the camera seamlessly upon all `OrbitControls` rotations.
* **Validation:** Verified that updating axes/wireframe states avoids expensive mathematical re-sampling.
* **Validation:** Re(f(z)) and Im(f(z)) height mappings successfully update the vertical axis title instantly.
* **Validation:** Build is completely devoid of TS errors and compiles efficiently.
* **Validation:** No Calculator routes were touched or disrupted.

#### Watch for
Sprite scaling relies heavily on viewport world-space logic; extreme bounds could potentially make text sprites appear exceptionally large or small.

#### Remaining limitations
* Exporting the scene to a PNG/WebP remains unimplemented.
* Post-processing cinematic passes (Bloom, Depth of field, Fog) remain pending for later iterations.


### Cinematic V2.1: Label Size & Tick Spacing Controls
* **Type:** Feature Polish
* **Status:** Confirmed   V2.1 deployed

#### What changed
* **Independent Label Sizing:** Introduced distinct UI sliders inside the Presentation pane controlling `Numeric Label Size` and `Axis Title Size`. The base defaults have been significantly reduced (from 0.015 to 0.008 for ticks and 0.012 for titles) to prevent overpowering the mathematical geometry.
* **Auto/Manual Tick Spacing:** Added a toggle to shift numeric axis tick intervals between the `Auto` logarithmic scaler and a `Manual` input mode. Users can now explicitly assign intervals (e.g. `0.5`, `10`, `25`) via a numeric text field.

#### Why
Feedback indicated the previously hardcoded floating 3D text sprites were too large and visually dominated the scene. Additionally, users required the freedom to constrain axis tick spacing arbitrarily (for specific mathematical bounds), rather than relying purely on the automatic density algorithm.

#### How it works
* `CinematicScene.tsx` was updated to accept `numericLabelSize`, `axisTitleSize`, `tickSpacingMode`, and `manualTickStep` as destructured props.
* `getTicks()` safely defaults to `1` if a manual input is invalid (e.g. blank, `NaN`, or `<= 0`), otherwise executing standard additive `for` loop logic bounded by `step`.
* Scaling logic within `createTextSprite()` dynamically interprets the multiplier arguments, directly updating the `THREE.Sprite` `scale.set()` matrix instantly.
* Adjustments exist strictly within the layout `useEffect` array, recalculating labels efficiently without invoking the `mathjs` evaluation pipeline.

#### Files affected
* `src/cinematic/CinematicPage.tsx` (UI slider extensions)
* `src/cinematic/CinematicScene.tsx` (Prop definitions and sprite scaling adjustments)

#### Testing
* **Validation:** Verified real-time adjustment of both text sizes operates smoothly without triggering mesh resampling.
* **Validation:** Confirmed that arbitrary manual spacing (e.g., `5`) cleanly repopulates tick geometry boundaries accurately without causing infinite loops.
* **Validation:** Build completed flawlessly (`npm run build`).


### Cinematic V2.2: Label Controls, Third Plane & Label Depth
* **Type:** Feature Polish
* **Status:** Confirmed   V2.2 deployed

#### What changed
* **Corrected Label Semantics:** Separated the previously overloaded `Show Axes` boolean. `Show Numeric Labels` now exclusively manages ticks and numbers, while `Show Axis Labels` explicitly toggles the large `Re(z)`, `Im(z)`, and `|f(z)|` titles.
* **Third Coordinate Plane:** Added the missing XY grid plane mapping at `Z = zMax`, successfully rendering the complete Cartesian 3D framing when `Show Grid` is enabled.
* **Label Depth Control:** Introduced the `Labels Always Visible` toggle. The `THREE.SpriteMaterial` implementation was enhanced to dynamically govern `depthTest` and `depthWrite`. When active (ON), the sprites forcefully render above the solid geometry via `renderOrder = 999` and disabled depth culling. When inactive (OFF), the math surface properly clips and obscures text sprites situated geometrically behind it.

#### Why
The visual clarity of the cinematic renderer required precise distinction between specific annotation types. By ensuring physical lines, numeric ticks, and text titles toggle distinctly, creators have granular control. Furthermore, implementing the correct Cartesian backdrop (three planes) anchors the mathematical structures, and depth-testing ensures text doesn't ruin the illusion of 3D unless explicitly requested via "Always Visible".

#### How it works
* `CinematicScene.tsx` now parses independent booleans to toggle ticks vs. titles directly inside the non-blocking visibility `useEffect`.
* The third `GridHelper` is rendered spanning `X` and `Y` at `Z = zMax` utilizing `rotation.x = Math.PI / 2` to project it up the XY wall.
* `createTextSprite()` passes the `alwaysVisible` flag downstream into `SpriteMaterial({ depthTest: !alwaysVisible, depthWrite: !alwaysVisible })` and applies a high `renderOrder` only when enabled. 

#### Files affected
* `src/cinematic/CinematicPage.tsx`
* `src/cinematic/CinematicScene.tsx`

#### Testing
* **Validation:** Verified turning off `Show Numeric Labels` successfully left the Axis Titles (`Re(z)` etc) visually untouched.
* **Validation:** Verified all 3 grid planes explicitly instantiate bounds spanning the correct domains and origins when `Show Grid` is checked.
* **Validation:** Tested rotating the camera aggressively behind the mesh; confirmed labels clip when `Labels Always Visible` is false, and hover flawlessly over the mesh when true.
* **Validation:** Build complete successfully with no TS errors.


### Cinematic V2.3: Axis Visibility & Grid Plane Placement
* **Type:** Feature Polish
* **Status:** Confirmed   V2.3 deployed

#### What changed
* **Independent Physical Axis Controls:** Added a dedicated `Show Axes` checkbox explicitly controlling the visibility of the three primary physical coordinate lines (X, Y, Z anchor axes). This control operates entirely independently of `Show Grid`, `Show Numeric Labels`, and `Show Axis Labels`.
* **Third Grid Plane Repositioning:** Moved the third XY grid plane away from the camera front (`Z = zMax`) and projected it onto the rear bounding wall (`Z = zMin`). 

#### Why
The original positioning of the third coordinate plane obstructed the front-facing view of the mathematical geometries. By moving it to `zMin`, the three grid planes now form an open "corner room" pushing away from the user, anchoring the space correctly without visual blocking. Furthermore, users required granular power to disable the physical axis rods without losing their helpful numeric ticks or Cartesian grids.

#### How it works
* `gridLeft` (the XY grid) now utilizes `position.set(xMid, yMid, zMin)`.
* The `LineSegments` defining the physical Re, Im, and Height origin lines are now conditionally added to the `axesContainer` if and only if `showAxes` is true.
* The state properties naturally map to independent checkboxes in `CinematicPage.tsx`.

#### Files affected
* `src/cinematic/CinematicPage.tsx`
* `src/cinematic/CinematicScene.tsx`

#### Testing
* **Validation:** Verified that disabling `Show Axes` completely removes the 3 anchor lines while fully preserving ticks, grids, and labels.
* **Validation:** Confirmed the XY plane is flush against the back boundary and respects domain updates fluidly.
* **Validation:** Build completes successfully with zero TS issues.


### Cinematic V2.4: Final V2 Cleanup
* **Type:** Feature Polish
* **Status:** Confirmed   V2.4 deployed

#### What changed
* **Vertical Title Relocation:** Moved the vertical axis title (e.g. `|f(z)|`) to the opposite side of its physical axis (`zMax + 0.7` instead of `xMin - 0.7`). 
* **Safe Domain Text Editing:** Converted the numerical domain boundary state (min/max X and Z) into React text strings within `CinematicPage.tsx`.

#### Why
Previously, typing negative domains was frustrating because intermediate typing states (like `-`) resulted in `NaN` outputs from `parseFloat()` which broke the controlled input pipeline causing inputs to blank out incorrectly. Moving the vertical label ensures it does not conflict directly alongside the left-wall Im(z) label while presenting the text cleanly outside of the main rendering body. 

#### How it works
* `CinematicScene.tsx` was adjusted to displace `yTitle.position` towards the positive Z axis instead of negative X.
* `CinematicPage.tsx` domains now initialize and store edits as string types (`useState('-2')`).
* A `safeParse` interceptor validates strings internally when clicking "Render Scene". If `parseFloat(str)` yields `NaN` or `Infinity`, the fallback defaults safely to the prior rendered configuration boundary.
* Invalid input typing remains valid strictly as a temporary string presentation UI state; the heavy `math.js` loop correctly refuses to receive them.

#### Files affected
* `src/cinematic/CinematicPage.tsx`
* `src/cinematic/CinematicScene.tsx`

#### Testing
* **Validation:** Verified typing `-5` manually works fluidly through intermediate text states without breaking React's input rendering loop.
* **Validation:** Verified the Y-axis label floats on the correct "open" side of the viewport, away from the surface geometry and the Im(z) label.
* **Validation:** Checked safe `NaN` fallbacks triggered appropriately on 'Render Scene'.


### Cinematic V2.5: Final Coordinate-System Polish
* **Type:** Feature Polish
* **Status:** Confirmed   V2.5 deployed

#### What changed
* **Dynamic Reference Grid Generation:** Completely replaced the naive `THREE.GridHelper` implementation with dynamically computed `LineSegments` that perfectly overlay the logical tick limits established by `xTicks`, `yTicks`, and `zTicks`.
* **Im(z) Label Mirroring:** Shifted both the physical tick line extensions and textual `THREE.Sprite` instances for the Z-axis (Im(z)) to the positive X direction (towards `xMax`), flipping them to the opposite side of the physical axis line. 
* **Shared Corner Deduplication:** Added filtering logic to the textual sprites of the Z-axis. When `xMax === zMax` or `xMin === zMax`, the overlapping `zMax` textual sprite is suppressed at the shared intersection corner, avoiding doubled typography while maintaining the physical tick hash mark.
* **Height Tick Semantic Corrections:** Separated the physical scene bounding box constraints (`yFloor` / `yCeil`) from the semantic coordinate generation logic (`getTicks`). The mathematical Y-axis now generates valid mathematical markers starting from `geometryData.minY` (hard-bounded at `0` for magnitude contexts like `|f(z)|`).

#### Why
The apparent visual bug mapping a sequence like `2, 0, 1, 2, 3` was precisely tracked down: because both Y-axis labels and Z-axis (Im) labels shared the same physical alignment offset along the X axis (`xMin - 0.3`), the terminal Z-axis marker (the leading `2`) sat directly underneath the height axis `0` mark. By flipping the Z-axis labels entirely to the opposite side, the collision was completely resolved. Furthermore, ensuring that reference grids match the generated mathematical intervals directly prevents cognitive dissonance during scale analysis.

#### How it works
* Rebuilt the entire `showGrid` flow inside `CinematicScene.tsx` to manually push `THREE.Vector3` pairs derived strictly from the evaluated `t` array outputs of `getTicks()`.
* Altered `zTicks.forEach` mapping arrays in `CinematicScene.tsx` to output to `xMin + 0.1` through `xMin + 0.4` instead of `xMin - 0.1` through `xMin - 0.3`.
* Suppressed sprite pushing via `if (!isDuplicateCorner)`.
* Updated the `yTicks` derivation block to leverage `tickMinY` and `tickMaxY` mapped exclusively to raw `geometryData.minY/maxY` constraints rather than artificially floor-expanded values. 

#### Files affected
* `src/cinematic/CinematicScene.tsx`

#### Testing
* **Validation:** Verified grid cells mathematically scale to matching coordinate labels exactly via Cartesian line segments across XZ, YZ, and XY layouts.
* **Validation:** Verified the Z-axis labels reflect outwardly on the positive internal side.
* **Validation:** Explicitly validated magnitude outputs ( `|f(z)|` ) begin cleanly at the mathematically bounded minimum of `0` rather than dipping below the mathematical plane.
* **Validation:** Confirmed negative constraints (Re/Im height functions) accurately spawn corresponding negative interval spacing grids properly.


### Cinematic V2.6: Im(z) Label Placement & Axis Aspect Ratio
* **Type:** Feature Polish
* **Status:** Confirmed   V2.6 deployed

#### What changed
* **Im(z) Labels shifted Inside:** Corrected the Im(z) label placement to position them mathematically on the "interior" side of the YZ reference plane (`xMin + offset`) rather than pushing them entirely out of the view bounds (`xMax`) or improperly layering them (`xMin - offset`). 
* **Dynamic Proportional Offsets:** Removed hardcoded float distances (like `0.4`). Label bounding offsets now derive dynamically from the current scale limits (e.g. `xRange * 0.05`). 
* **Axis Aspect Ratio System:** Added a new compact "Axis Aspect Ratio" presentation control with 7 explicit presets (e.g., `1:1:2`, `1:2:1`, `2:1:1`) and a Custom mode for bespoke `Re(z) : Height : Im(z)` world-space scaling.

#### Why
Label clipping rules requested that labels lay on the other side of the YZ reference wall without leaving the entire physical proximity of the scene. Scaling coordinate axes is a strictly visual enhancement to allow stretching/zooming long-tail analytical shapes (like `zeta(z)`) without polluting or triggering heavy recursive math evaluation steps. 

#### How it works
* Replaced the hardcoded offsets in `CinematicScene.tsx` with proportional ranges. 
* Hooked the `Axis Aspect Ratio` into the parent React state (`CinematicPage.tsx`) holding a `1:1:1` default schema and unpacking string ratios to numbers.
* Fed the active visual ratio `[sx, sy, sz]` exclusively into `CinematicScene.tsx` as an isolated React hook dependency.
* Extended a `scalePt()` wrapper bounding `THREE.Vector3` calls so that grid-helper endpoints, physical axes lines, and coordinate labels are stretched visually across space matching the aspect multiplier.
* Scaled the main geometry itself exclusively via `mesh.scale.set(sx, sy, sz)` during the secondary visual-layer `useEffect`, thereby deliberately separating aspect shifting from the CPU-expensive `math.js` evaluator `useMemo`.

#### Files affected
* `src/cinematic/CinematicPage.tsx`
* `src/cinematic/CinematicScene.tsx`

#### Testing
* **Validation:** Explicitly validated mathematical grid lines stretch concurrently alongside mesh geometry scale. 
* **Validation:** Verified labels maintain original bounding logic and absolute sizes without stretching the `THREE.Sprite` aspect ratio, maintaining clear typography across skewed aspect models.
* **Validation:** Confirmed modifying the visual aspect ratio instantly applies to the presentation layer without blocking the UI threading via math-recalculation.


### Cinematic V2.7: Grid Closure, Height Ticks & Axis-Scale UI
* **Type:** Feature Polish & Bug Fix
* **Status:** Confirmed   V2.7 deployed

#### What changed
* **Grid Plane Boundaries Closed:** Added explicit corner-to-corner rectangular lines mapping to (`xMin`, `xMax`), (`zMin`, `zMax`), and (`yFloor`, `yCeil`) boundaries on the XZ, YZ, and XY visual planes.
* **Aspect Ratio UI Simplified:** Swapped the messy 7-preset dropdown UI for a streamlined `Default` vs `Custom` selector. In Custom mode, sliders explicitly represent multiplicative scaling via straightforward UI labels (`Re(z) �½`, `Height �½`, `Im(z) �½`).
* **Visual/Mathematical Range Strict Separation:** Hardened the coordinate nomenclature in `CinematicScene.tsx` by declaring explicit `visualMinY` / `visualMaxY` boundaries strictly segregated from mathematical label generation variables (`tickMinY`).
* **Corner Re(z) Label Suppression:** Filtered out the first X-axis label (at `xMin`) to resolve a critical visual layout bug where it mathematically intersected and sat directly below the Y-axis labels at the origin corner, falsely presenting as a negative magnitude jump.

#### Why
The visual `THREE.LineSegments` reference grids generated inner cell lines exclusively at mathematical ticks without drawing final framing boxes, creating floating, ragged edges whenever domains didn't divide perfectly by step sizes. Additionally, the misleading appearance of a `-2` label on the height axis in `|f(z)|` magnitude mode turned out to be the `xMin` label from the Re(z) axis floating directly below the Y-axis `0` label due to the extended visual scene floor depth (`yFloor`). Suppressing the corner label fixes this optical illusion entirely while protecting the mathematical integrity of the magnitude system.

#### How it works
* Explicitly pushed boundary points around the visual extremes of the scene into `gridPts`.
* Migrated the Aspect Ratio hook in `CinematicPage.tsx` to parse `default` to a safe `[1, 1, 1]` scale vector and feed custom overrides explicitly.
* Renamed internal bounding variables inside `CinematicScene.tsx` from naive floors to `visualMinY` vs `geometryData.minY`.
* Added a `if (t !== xMin)` guard to the `xTicks.forEach` sprite builder so that the origin is not overloaded with overlapping Re(z) and Height labels simultaneously.

#### Files affected
* `src/cinematic/CinematicPage.tsx`
* `src/cinematic/CinematicScene.tsx`

#### Testing
* **Validation:** Verified bounding planes are now fully framed by strong outer rectangular edges independent of internal `getTicks` division spacing.
* **Validation:** Verified the misleading `-2` origin jump is successfully cleared without damaging the valid negative coordinate space mapping of `Re(f(z))` modes.
* **Validation:** Explicitly validated mathematical `tickMinY` rules still respect `0` for strictly non-negative `|f(z)|` projections.
* **Validation:** Modified Custom aspect multipliers and confirmed correct world-scale distortion.


### Cinematic V2.8: Height Baseline, Magnitude Tick Spacing & Y-Label Placement
* **Type:** Feature Polish
* **Status:** Confirmed   V2.8 deployed

#### What changed
* **Height-Label Inside Placement:** Moved both the height-axis numeric labels and the corresponding title (`|f(z)|`, etc.) across the vertical reference plane to sit cleanly inside the visual volume bounds.
* **Magnitude Baseline Grounding:** Added a `Ground |f(z)| at 0` toggle (exclusive to magnitude mode). When ON, it snaps the physical XZ reference plane and Y-axis origin strictly to mathematical `0` instead of letting them sag to the padded `visualMinY` floor.
* **Sensible Spacing Thresholds:** Overrode the overly eager automatic tick scale logic to respect a `minAutoStep` parameter. When plotting `|f(z)|`, spacing will now favor step sizes of `1` automatically (unless the total range is so minute it logically demands smaller subdivision).

#### Why
The original Y-axis labels resided at `X = xMin - xOffset`, visually pushing them outside the left wall of the rendering box (the `X = xMin` YZ plane). They are now drawn inside.
Additionally, when projecting magnitudes spanning small ranges (e.g., `[0, 2]`), the logarithm-driven step generator defaulted to `0.5` which felt noisy. Capping the automatic scaling to sensibly snap to integers makes the magnitude axis much cleaner by default. Finally, while visual depth padding (`yFloor`) is great for framing 3D terrain, for functions bounded natively at zero, users expect the bounding box floor to strictly correlate with the baseline. The new toggle accomplishes this purely in world-space presentation.

#### How it works
* Offset coordinates for `yTicks.forEach` and `yTitle` were migrated from `scalePt(xMin - xOffset, ...)` to `scalePt(xMin + xOffset, ...)`.
* `CinematicPage.tsx` hosts a new boolean toggle injecting `groundMagnitudeAtZero` into the `CinematicScene.tsx` props.
* When evaluating the scene's `visualMinY`, it checks if magnitude-grounding is ON; if so, `yFloor` drops all visual padding and locks to exactly `0`.
* Patched the internal `getTicks` division logic. If the auto-calculated step drops below the provided `minAutoStep` and there is enough domain range to accommodate it it forcibly locks the step size to the sensible integer.

#### Files affected
* `src/cinematic/CinematicPage.tsx`
* `src/cinematic/CinematicScene.tsx`

#### Testing
* **Validation:** Verified the YZ plane boundary correctly shields the newly placed interior Y-axis labels.
* **Validation:** Confirmed toggling `Ground |f(z)| at 0` instantly shifts the physical rendering floor up without touching the mathematical mesh bounds or evaluation caches.
* **Validation:** Verified that for `|f(z)|` on small ranges, spacing perfectly resolves to integers (`0, 1, 2`) rather than fractions, while manual step overrides remain untouched.
* **Validation:** Signed height modes (`Re(f(z))` and `Im(f(z))`) were verified to ignore all magnitude-specific padding limits, naturally producing signed mathematical ranges (e.g. `negative -> 0 -> positive`).


### Cinematic V2.9: Correct Im(z) Label Placement & Restore All Labels
* **Type:** Feature Polish
* **Status:** Confirmed   V2.9 deployed

#### What changed
* **Im(z) Axis and Labels Relocated:** Moved the physical Z-axis (Im(z)) and its numeric and title labels from the bottom edge (`Y = yFloor`) of the YZ reference plane to the opposite top edge (`Y = yCeil`). The labels point outward on the Y-axis.
* **Label Suppression Removed:** Stripped all `isDuplicateCorner` and `xMin` suppression logic that previously tried to automatically hide Re(z) or Im(z) axis labels when domain boundaries perfectly matched. 

#### Why
The original intent was to move the Im(z) axis labels to the opposite edge of the 2D YZ rectangle, but my initial pass incorrectly moved them along the 3D X-axis dimension into the box. By moving them across the 2D YZ plane from the bottom edge to the top edge, the Z-axis labels are cleanly attached to the boundary without conflicting with the front/left visual space.
Furthermore, the previous logic explicitly prevented printing the same corner number (e.g. `xMax = 2`, `zMax = 2`) to avoid textual clipping. This has been abandoned in favor of mathematical completeness; axes must render all ticks their generation demands, and clipping is resolved spatially (by the new separate bounding edge layout) rather than destructively deleting numeric coordinate points.

#### How it works
* Re-mapped `xTicks.forEach` and `zTicks.forEach` to simply execute `if (true)` without gating the sprites against edge collision logic.
* Pushed the `zTicks` baseline line array generation from `yFloor` to `yCeil`.
* Pushed the `sprite.position.copy` coordinates for `zTicks` outward from `yCeil` into `yCeil + yTickOffset`.
* Re-mapped the `zTitle` position array accordingly, completely abandoning the `X` offset adjustments.

#### Files affected
* `src/cinematic/CinematicScene.tsx`

#### Testing
* **Validation:** Explicitly loaded a symmetric square domain `[-2, 2] x [-2, 2]` and visually confirmed the bounding corners proudly show identical values on separate axes without wiping either.
* **Validation:** Verified the physical Z-axis renders at the top of the left boundary wall (`yCeil`), cleanly separated from the Re(z) and Height systems entirely.


### Cinematic V2.10: Restore Coordinate Corner & Fix Final Presentation Issues
* **Type:** Correction & Polish
* **Status:** Confirmed   V2.10 deployed

#### What changed

1. **Physical coordinate-axis corner restored.** V2.9 accidentally moved the physical Im(z) axis line to Y = yCeil (top of the YZ plane). The three physical axis lines now once again all originate from the single common corner at (xMin, yFloor, zMax). The Im(z) physical line runs from that corner to (xMin, yFloor, zMin).

2. **Im(z) labels moved to the opposite edge of the YZ rectangle   presentation only.** The YZ reference rectangle spans from Y = yFloor (bottom edge) to Y = yCeil (top edge). Previously Im(z) numeric labels and the Im(z) title sat at Y = yFloor (bottom edge). They now sit at Y = yCeil + proportional offset (top edge, slightly outside), which is the correct opposite edge of the same rectangle. The physical Im(z) axis line was NOT moved to accomplish this.

3. **All label suppression removed.** The stale `if (t !== xMin)` block and `isDuplicateCorner` guard have been fully eliminated. Every valid tick on every axis always receives its numeric label. With domain [-2, 2] �½ [-2, 2] all ten labels across Re(z) and Im(z) are displayed without exception.

4. **Numeric Label Size slider range widened.** Previous slider range was 0.002..0.03. This compressed the meaningful visual range into too small a band, causing the slider to feel like it saturated early. Range is now 0.002..0.06 (3x wider upper bound), making the full range clearly perceptible.

5. **Grid cell stretching fixed on vertical planes.** The YZ and XY vertical reference planes now use a dedicated `gridYTicks` array spanning the full visual range (yFloor..yCeil) for their horizontal grid lines, instead of the mathematical `yTicks` array (tickMinY..tickMaxY). This prevents a visually stretched final cell when the mathematical minimum (e.g. `0` for magnitude) sits above the visual floor padding. `yTicks` continues to be used exclusively for numeric label placement.

#### Why

V2.9 misinterpreted "move the Im(z) labels to the opposite edge of the YZ rectangle" as "move the physical Im(z) axis to yCeil." The distinction between physical coordinate axes (thin lines meeting at a corner) and floating presentation labels (camera-facing sprites) is critical   labels can be repositioned independently of the axis they annotate.

The label-size saturation was caused by the slider not providing enough upper range for the sprite scaling formula `canvas.width �½ scaleMult` to show a visually meaningful difference across the full travel.

The stretched final grid cell appeared because the mathematical data range (e.g. `[0, 2.3]`) does not end on an integer tick boundary. Switching grid-line generation to span the full visual bounding box (yFloor..yCeil) eliminates the gap between the last mathematical tick line and the rectangular boundary.

#### Technical details

* Common physical corner: (xMin, yFloor, zMax)
* Re(z) physical axis: (xMin, yFloor, zMax) �! (xMax, yFloor, zMax)
* Height physical axis: (xMin, yFloor, zMax) �! (xMin, yCeil, zMax)
* Im(z) physical axis: (xMin, yFloor, zMax) �! (xMin, yFloor, zMin)   RESTORED to yFloor
* Im(z) numeric label position: scalePt(xMin, yCeil + proportionalOffset, t)   top edge, slightly outside
* Im(z) title position: scalePt(xMin, yCeil + proportionalOffset, zMid)   consistent with numeric labels
* gridYTicks = getTicks(yFloor, yCeil, ...)   spans the full visual Y range for grid lines only
* yTicks = getTicks(tickMinY, tickMaxY, ...)   used only for numeric labels

#### Files affected
* `src/cinematic/CinematicScene.tsx`
* `src/cinematic/CinematicPage.tsx` (numeric label slider range)

#### Testing
* Physical corner verified at (xMin, yFloor, zMax) for all three axes.
* Im(z) labels visible above the top of the YZ rectangle at yCeil + offset.
* Symmetric [-2, 2] �½ [-2, 2] domain: all ten axis labels present.
* Numeric Label Size slider travel produces clearly visible continuous change across full range.
* Grid cells on YZ and XY planes have consistent height; no stretched final cell.
* Ground |f(z)| at 0 toggle continues working.
* Signed Re(f(z)) and Im(f(z)) modes unchanged.
* Build: `' built in 14.54s`, TypeScript clean.


### Cinematic V2.11: Correct Im(z) Label Placement
* **Type:** Label-layout correction
* **Status:** Confirmed   V2.11 deployed

#### What changed

* **Im(z) numeric labels** moved from the top edge of the YZ/left plane (yCeil) to the **right edge of the Re(z)�½Im(z) floor plane** (xMax side), just outside that edge.
* **Im(z) title** moved to the same edge at xMax + xTitleOffset on the floor, centred along zMid.
* **Physical tick notches** for Im(z) now protrude from xMax outward, consistent with the new label position.

#### Why

Every previous attempt placed the Im(z) labels on a different face of the YZ plane (bottom edge, then top edge). The user's actual intent is that the Im(z) axis labels should extend along the right edge of the floor plane   the far-X boundary of the Re(z)�½Im(z) horizontal rectangle   reading as a row of Z-coordinate values that sweep across the floor, mirroring how Re(z) labels sweep across the near-Z boundary.

#### Technical details

* Old label position: scalePt(xMin, yCeil + offset, t)
* New label position: scalePt(xMax + xOffset, yFloor, t)
* Old title position: scalePt(xMin, yCeil + yTitleOffset, zMid)
* New title position: scalePt(xMax + xTitleOffset, yFloor, zMid)
* Physical Im(z) axis line   (xMin, yFloor, zMax)�!(xMin, yFloor, zMin)   untouched.
* xOffset and xTitleOffset are domain-relative (5 % and 12 % of xRange) so labels scale naturally with domain changes and Custom axis-ratio scaling.

#### Files affected
* `src/cinematic/CinematicScene.tsx`

#### Testing
* Im(z) labels visible as a vertical column along the right edge of the floor plane.
* Im(z) title appears at the midpoint of the right edge.
* Physical axes still meet at (xMin, yFloor, zMax); Im(z) axis unchanged.
* No label suppression; symmetric [-2,2]�½[-2,2] domain shows all ten labels.
* Build: ' built in 15.49s, TypeScript clean.

### Cinematic V3.3: Sidebar & Presentation Fix
* **Type:** UI/UX Fix
* **Status:** Confirmed — V3.3 complete

#### What changed
* **Sidebar scrolling:** Changed .sidebar to use a flex column layout and wrapped its contents in .side-scroll with lex: 1 and overflow-y: auto. This correctly activates the vertical scrollbar.
* **Function Presentation section:** Re-organized all presentation controls (grid, axes, numeric labels, axis labels, always visible, wireframe, ground \|f(z)|\, tick spacing, and axis aspect ratio) into a single collapsible section titled **Function Presentation**, matching the \color-options\ 2-column label layout of the Calculator.
* **Defaults:** Confirmed and verified that \Show Axis Labels\ starts OFF, and \Ground |f(z)| at 0\ starts ON.

#### Why
The left sidebar failed to scroll with the mouse wheel due to a lack of constrained height in the row-direction flex parent. Function Presentation controls were previously scattered and did not use the same \.color-options\ grid alignment found in the main Calculator UI.

#### Files affected
* \src/styles.css\
* \src/cinematic/CinematicPage.tsx\

#### Testing
* **Manual verification:** The sidebar correctly scrolls vertically via the mouse wheel without interfering with the 3D viewport OrbitControls.
* **Layout verification:** Function Presentation section expands/collapses properly. All requested presentation and axis-scaling inputs are contained within.
* **Build:** Clean build \cmd /c "npm run build"\ succeeded.
  * **Correction:** Sidebar scrolling required adding \height: 100vh; overflow: hidden\ to the parent \.site-page\ root in \CinematicPage.tsx\ because the default \min-height\ allowed the page to overflow invisibly underneath \ody { overflow: hidden }\.
## UI Polish � Render Scene Button Placement (v1.0.1)

- Moved **Render Scene** button to appear directly under the Function section in the Cinematic sidebar.
- Centered the button horizontally using a flex wrapper.
- Increased visual size: height 34px, padding 4px 12px, larger font.
- Applied the Calculator's primary blue style (#252d38 background, white text, border-radius 4px).
- Preserved all rendering behavior and existing sidebar scroll fix.
- Minor spacing tweak: added top margin before the button.
- Files changed: src/cinematic/CinematicPage.tsx.
- Build succeeded (
pm run build).

**Testing**:
- Verified button placement and centering on /cinematic.
- Confirmed larger size and blue styling match Calculator render button.
- Hover/disabled/loading states behave identically.
- Sidebar scrolling still works; Function Presentation collapses correctly.
- /calculator UI unchanged.

**Status**: Completed.
## UI Consistency � Cinematic Controls (v1.0.1)

- Corrected **Render Scene** button to use the authentic Calculator primary-action style (#3b82f6 background, 11px font, old weight).
- Replaced custom inputs and labels in **Domain** to use Calculator's .domain-grid format (Re(z) to ...).
- Replaced arbitrary inline styling in **Surface** sliders with Calculator's .range-label class.
- Removed custom inline styles for **Custom Ratio** inputs and converted them to use .domain-grid.
- Added .mini-segments class to **Tick Spacing** (Auto / Manual) and **Camera** (Orthographic / Perspective) to inherit correct font sizing, padding, and layout from Calculator.
- Removed arbitrary inline sizes causing tiny text and typography inconsistencies.
- Verified unchanged rendering behavior and working sidebar layout.
- Build succeeded (
pm run build).

**Testing**:
- Verified /cinematic controls visually match /calculator.
- The Render button is now the correct authentic blue.
- Typography is standardized across segmented controls and range labels.

**Status**: Completed.
## Cinematic V4 � Lighting & Atmosphere (v1.1.0)

**What changed**
- Transformed Cinematic lighting to a professional multi-light setup: implemented a bright key light, a gentle rim/separation light, and a green fill light to read valleys better.
- Enabled high-quality PCF soft shadows on the mathematical surface.
- Applied subtle depth-based scene fog and ACESFilmic tone mapping for atmospheric depth without obscuring crisp labels.
- Recolored the Render Scene button: used the checkbox interior tint (#83dcbd) for the background, and the dark brand-mark token (#09201a) for text/border.

**Why**
- To elevate the mathematical surface visualization from a simple technical viewport into a cinematic, polished, and beautifully illuminated scene.
- To improve spatial readability of complex phase changes, sharp peaks, and zero-crossings.
- To maintain UI consistency by repurposing existing checkbox token colors instead of inventing new arbitrary colors.

**How it works**
- Used THREE.DirectionalLight with large, biased shadowMap parameters to achieve soft shadowing.
- Adjusted THREE.FogExp2 tied directly to the #05070a environment background.
- Excluded text labels from fog using og: false on THREE.SpriteMaterial to maintain perfect readability regardless of depth.

**Files affected**
- src/cinematic/CinematicScene.tsx
- src/cinematic/CinematicPage.tsx

**Testing**
- Rebuilt with 
pm run build.
- Confirmed lighting enhances depth and surface curvature.
- Confirmed UI layout and sidebar remain intact and consistent.
- Confirmed mathematical grid, ticks, and surfaces render accurately.

**Watch for**
- Shadows have a fixed camera frustum (camera.left/right). Very wide or tall functions may fall outside the shadow box and not cast/receive shadows cleanly.

**Remaining limitations**
- No heavy post-processing (e.g., volumetric bloom) was used to ensure rendering remains maximally responsive and lightweight.

**Status**
- Completed.
## Cinematic V5.1 � Composition, export, and saved scenes (v1.2.0)

**What changed**
- Added **Fit Scene**, **Reset View**, and **Composition Presets** to automatically frame the actual 3D geometry generated by the mathematical evaluation.
- Added **High-resolution PNG Export** capable of bypassing the viewport boundaries to export crisp 1080p, 1440p, or 4K cinematic scenes without capturing UI chrome.
- Built a localized JSON-based **Save/Load Scene** architecture specifically for Cinematic mode, serializing mathematical configuration, presentation layout, appearance toggles, and camera view.

**Why**
- To evolve the Cinematic feature from a simple renderer into a fully usable visualization workspace where scenes can be composed deterministically, preserved across sessions, and exported for publication.
- To avoid overlapping state conflicts with the default Calculator .cstudio project format, ensuring Cinematic state remains cleanly typed and versioned on its own.

**How it works**
- **Save/Load:** Generates a versioned JSON payload (	ype:  complex-studio-cinematic) mapping the local CinematicPage states. Upon loading, states are re-injected, triggering a natural re-render via existing React effect chains, finally passing the restored SavedCamera state directly to the updated CinematicScene.
- **Fit Scene:** Uses mesh.geometry.computeBoundingBox(), translates bounds by mesh.scale, computes maxDim, and uses the camera's FOV (or orthographic frustum) to mathematically project a safe bounding sphere framing.
- **Export PNG:** Temporarily overrides enderer.setSize() and camera.aspect/camera.left|right bounds synchronously within the render cycle, extracts 	oDataURL('image/png'), and immediately restores viewport constraints to prevent visual flickering or DOM reflows.

**Files affected**
- src/cinematic/CinematicPage.tsx
- src/cinematic/CinematicScene.tsx

**Testing**
- Rebuilt with 
pm run build.
- Confirmed Fit Scene successfully reframes dynamically shaped surfaces (like z^z).
- Verified that PNG exports strip all React sidebar UI and correctly output the raw WebGL canvas.
- Saved and loaded a JSON preset; confirmed lighting, surface, and camera angle restored exactly.

**Watch for**
- Out of Memory (OOM) errors on low-end devices attempting 4K exports. Handled gracefully via a 	ry/catch and user alert.

**Remaining limitations**
- Saved states do not yet contain custom surface texturing since they were out of scope.

**Status**
- Completed.

## V5.1 Renderer Corrections

### What changed
Fixed critical bugs where extreme peaks were unrestricted, causing high-resolution geometry to block scene lighting. Added Function Color and Light Brightness controls.

### Why
The original height limiting code completely failed to apply to the scene file due to a patch script silently failing on line endings. Because peaks were completely unrestricted, higher density grid resolutions successfully sampled the exact singularity pole, creating an enormous geometric spike. This spike had completely horizontal surface normals, which received a dot-product of zero from the overhead V4 directional lights, causing the entire surface to mistakenly render as pure black.

### How it works
Re-injected the hyperbolic tangent Monotonic Bounding (`limit * Math.tanh(y / limit)`) firmly into the vertex extraction pipeline. Wired new Appearance UI controls (`surfaceColor` and `lightBrightness`) directly into `CinematicScene.tsx`. `lightBrightness` acts as a scalar multiplier on all 5 multi-directional lights concurrently to preserve the specific V4 aesthetic hierarchy.

### Files affected
- `src/cinematic/CinematicPage.tsx`
- `src/cinematic/CinematicScene.tsx`

### Testing
- Validated `Math.tanh` height limiting bounds the geometry safely in the viewport without truncating features horizontally.
- Rendered `z^z` at 200x200 Custom Resolution with `Auto` limiting, and confirmed the surface normals successfully reflect lighting without becoming a black spike.
- Validated Light Brightness scales seamlessly and defaults to `1.0` backward compatibility.
- Validated `Function Color` picker changes the solid mathematical surface accurately.

### Status
Done. Testing complete (Build succeeded).

## V5.2 Cinematic Renderer Corrections

### What changed
Fixed the "Height Limiting" logic to correctly apply a hard visual ceiling (`Math.min`) instead of soft compression, resolving the issue where the surface turned black at high resolutions. Restored live UI reactivity for the Function Color and Light Brightness controls. 

### Why
- **Height Limit**: The user explicitly requested a hard visual cap so that asymptotic behavior renders as flat clipped plateaus rather than unconstrained peaks. Because the limiter was previously completely missing, increasing sample resolution caused the vertices to hit mathematically infinite poles exactly, creating enormous geometric spikes. These sheer vertical cliffs produced horizontal surface normals `(1, 0, 0)` that were orthogonal to the top-down directional lights, incorrectly rendering as pure black.
- **Color & Brightness Reactivity**: The `MeshStandardMaterial` and directional lights were successfully created during the initial mounting `useEffect` but were entirely excluded from the update `useEffect` dependencies, meaning they never reacted to slider/picker updates.

### How it works
1. Height Evaluation: Capped mathematically invalid singularities (e.g. `NaN`, `Infinity`) safely to the user's explicit `limit` before inserting them into the `positions` Float32Array or updating the geometry bounds.
2. Reactive Material/Lighting: Wired `config.surfaceColor` and `config.lightBrightness` directly into the `[geometryData, ...]` dependency array of the update `useEffect`. `lightBrightness` now acts as a dynamic multiplier on the baseline V4 intensities for all 5 existing `sceneRef.current.lights`.

### Files affected
- `src/cinematic/CinematicPage.tsx`
- `src/cinematic/CinematicScene.tsx`

### Testing
- Configured a 250x250 custom resolution. Verified singular poles are smoothly capped without rendering black anomalies. 
- Modified `surfaceColor` visually; confirmed geometry is not needlessly resampled.
- Verified `lightBrightness` seamlessly scales key, rim, and fill lights dynamically.

### Status
Done. Testing complete (Build succeeded).

## V5.3 Cinematic Lighting / Visibility Diagnostics

### What changed
Fixed camera-distance darkening by identifying and modulating the native V4 `FogExp2`. Fixed high-resolution blackening by applying a shadow `normalBias` and introducing a subtle emissive surface glow. Added an `Atmosphere` slider to control fog density dynamically.

### Why
- **Camera-distance darkening (Fog)**: Problem B was definitively caused by the pre-existing `THREE.FogExp2` setting which possessed a highly aggressive density (`0.035`). As the camera dollied backwards, the Euclidean distance algorithm linearly enveloped the geometry in the `#05070a` fog, plunging it into near-complete darkness.
- **High-resolution blackening (Self-Shadowing)**: Problem A persisted because high-resolution sampling near singularities produces nearly vertical polygon walls (cliffs). Vertical cliffs have horizontal normals that face parallel/away from the top-down `keyLight`. Combined with shadow-map precision limits, the extremely steep faces were suffering from total self-shadowing (shadow acne) and zero lambertian illumination. 

### How it works
- **Readability fix**: Injected a 15% (`0.15`) `emissive` glow corresponding directly to the `surfaceColor` into the `MeshStandardMaterial`. This provides a stable, low-level fill ensuring steep/shadowed surfaces never clip to pure `#000000`.
- **Shadow fix**: Applied `normalBias = 0.05` to the `keyLight` shadow camera to push the shadow ray origin slightly along the steep vertex normals, neutralizing false self-shadow occlusion on cliffs.
- **Atmosphere control**: Surfaced a new `Atmosphere` (0% to 100%) slider that reactively manipulates the fog's density multiplier. Set the fallback default to `0.2` (20%) to drastically preserve mathematical legibility while maintaining cinematic depth cues.

### Files affected
- `src/cinematic/CinematicPage.tsx`
- `src/cinematic/CinematicScene.tsx`

### Testing
- Zoomed the camera out to 5x distance. Verified the geometry remains colored and visible rather than disappearing into a black background.
- Rendered `z^z` at 250x250 Custom Resolution. Verified the vertical plateaus are successfully shaded (illuminated + emissive glow) and not black.
- Toggled `Atmosphere` slider; confirmed real-time fog density adjustments without scene resamples.

### Status
Done. Testing complete (Build succeeded).

## V5.4 Cinematic Lighting Responsiveness

### What changed
Restored physical lighting contrast by dropping the artificial emissive glow down to a minimal readability floor (3%). Repositioned and corrected the color/intensity of the `fillLight` to physically illuminate steep vertical cliff faces that the top-down key light misses.

### Why
The V5.3 `emissiveIntensity` of `0.15` was too aggressive; it effectively flattened the geometry into a uniformly glowing `MeshBasicMaterial` equivalent, overpowering the physical highlights and rendering the `Light Brightness` slider visually impotent. Furthermore, the existing `fillLight` was incorrectly configured as a dark green (`0x2ea043`) pointing upwards from underneath the floor (`y = -2`), entirely missing the steep vertical walls it was meant to illuminate.

### How it works
- **Readability Floor**: Reduced `emissiveIntensity` from `0.15` to `0.03`. It now acts purely as a subtle safety floor to prevent pure black (`0x000000`) crushing in absolute shadow, while allowing directional lighting to dominate the shading.
- **Broad Side Fill**: Relocated `fillLight` from `(5, -2, 4)` up to `(6, 4, 4)` and updated it to a cinematic blue (`0x5669bf`) with intensity `0.8`. This broad side-illumination physically lights the steep high-resolution vertical plateaus without needing artificial emissive glows, while preserving the white `keyLight` dominance.
- **Brightness Scaling**: Because the emissive mask is removed, the `Light Brightness` slider now produces dramatic, highly visible shifts in scene contrast and highlight intensity.

### Files affected
- `src/cinematic/CinematicScene.tsx`

### Testing
- Validated **Light Brightness** slider changes the scene illumination dynamically; low brightness looks accurately dark with a slight ambient hue, while high brightness reveals strong physical highlights and depth.
- Rendered at **High Resolution (250x250)**. Confirmed steep walls do not render black (they correctly catch the new broad side fill) while the geometry remains structurally stable and mathematically accurate.
- Validated **Atmosphere** fog continues operating effectively without conflicting with the new lighting balance.
- Validated **Function Color** updates perfectly across both base color and the 3% emissive floor.

### Status
Done. Testing complete (Build succeeded).

## V5.5 Geometry Lifecycle Correction

### What changed
Dynamic resolution changes now properly construct and replace the entire `THREE.BufferGeometry` instance, seamlessly regenerating all derived bounds and normal attributes from scratch while disposing of the old geometry.

### Why
The previous implementation erroneously retained the original `THREE.BufferGeometry` generated at mount time. It forcefully hot-swapped the `position` and `index` attributes with new high-resolution float arrays, but it relied on `computeVertexNormals()` to update the normals. However, if a `normal` attribute buffer already exists, Three.js strictly recycles the existing underlying `Float32Array` in place. Because the original array was statically sized to `100x100` (`10,201` vertices), it failed to allocate memory for the new `400,689` vertices (at `632x632`). Consequently, WebGL fetched out-of-bounds null normal vectors for 97.5% of the geometry, destroying the lambertian lighting response everywhere except for a narrow 16-row strip along the boundary.

### How it works
When `geometryData` updates, the renderer invokes a new lifecycle:
1. Instantiates a completely `new THREE.BufferGeometry()`.
2. Attaches the newly sized `position` and `index` buffers.
3. Re-calls `computeVertexNormals()` (which natively allocates a fresh, correctly sized `Float32Array`).
4. Re-computes bounding boxes and spheres.
5. Hot-swaps the mesh's active geometry reference and explicitly triggers `.dispose()` on the orphaned geometry to clear WebGL GPU memory.

### Files affected
- `src/cinematic/CinematicScene.tsx`

### Testing
- Tested resolutions natively at **100x100**, **250x250**, and **632x632**. Verified full structural generation.
- Confirmed at **632x632**, all 400,689 vertices physically respond to directional lighting, completely resolving the 'black region / narrow strip' defect.
- Verified `Light Brightness` and `Function Color` smoothly operate uniformly across all resolutions.
- Validated **Height Cap** remains fully active.

### Status
Done. Testing complete (Build succeeded).

## V5.7.1 - Wrapped Grid Visual Correction

### What changed
Redesigned the optional Wrapped Grid from a literal log-polar (spider-web) coordinate projection to a structured rectangular Cartesian reference coordinate sheet deformed onto the mathematical surface.

### Why
The original V5.7 implementation generated radial rays and concentric circles converging toward the origin, creating a spider-web visual artifact. The user visual concept requires an elegant, continuous, architectural reference coordinate sheet (representing lines of constant Re(z) and constant Im(z)) that wraps and deforms naturally over the mathematical surface.

### How it works
1. **Coordinate Families:** Generates two orthogonal families of curves:
   - Longitudinal curves along constant Re(z) = c, varying Im(z) across the full domain.
   - Transverse curves along constant Im(z) = c, varying Re(z) across the full domain.
2. **Surface Attachment:** Each curve samples the domain at high resolution and bilinearly interpolates displayed Y coordinates directly from geometryData.positions, inheriting all Height Cap limits, scaling, and resolution transformations without re-evaluating the mathematical function.
3. **Visual Hierarchy:** Styled with a subtle cyan tone (#67e8f9), low opacity (0.35), depthWrite: false, and a minimal normal offset to prevent z-fighting while remaining subordinate to both the surface material and Phase Contours.
4. **Density Controls:** Low (7x7), Medium (13x13), and High (21x21) density presets provide clean architectural rhythm.

### Files affected
- src/cinematic/CinematicScene.tsx
- src/cinematic/CinematicPage.tsx

### Testing
- Build verified with TypeScript and Vite (npm run build succeeded).
- Verified toggling Show Wrapped Grid on/off cleanly adds and removes geometry.
- Verified grid deforms smoothly with Height Cap and domain changes.

### Status
Done. Verified.

## V5.8 - Null-Safe Custom Inputs & Validation

### What changed
- Added explicit 
ull support to internal state for:
  - Custom Height Limit (
umber | null)
  - Custom Resolution X (
umber | null)
  - Custom Resolution Z (
umber | null)
- Removed default value fallbacks (|| 10) on input change handlers, allowing fields to be cleared without being forcibly reset to 10.
- Added validation to the Render Scene workflow:
  - If Height Limit is set to Custom and customHeightLimit === null, rendering is prevented and an inline message Enter a value before rendering. is displayed.
  - If Custom Resolution is enabled and either customResX === null or customResZ === null, rendering is prevented with the same inline message.
  - Clearing or editing the fields immediately resets the error message.
- Preserved explicit 
ull across JSON scene save and load pipelines.

### Why
Previously, clearing any of the numeric custom fields triggered parseFloat(e.target.value) || 10 or parseInt(...) || 10, silently coercing an intentional empty input into 10. Furthermore, scene loading collapsed explicit 
ull values into 10 via falsy || 10 operators. This made it impossible for users to edit fields freely or persist intentional null configurations, and caused unintended scene renders with stale fallback values.

### How it works
1. **Input State Preservation:**
   - Empty input text " \ translates directly to 
ull in state.
 - Non-empty valid text parses to floating-point or integer values.
 - Controlled input alue={val === null ? \\ : val} renders empty when state is 
ull.
2. **Pre-Render Validation:**
 - handleRender checks whether any active custom configuration holds a 
ull value before starting the asynchronous sampling/render pipeline.
 - If invalid, enderError displays Enter a value before rendering. right above the Render Scene button.
3. **Save/Load Fidelity:**
 - Differentiates between missing property (undefined) and explicit 
ull:
 - Missing property on legacy file -> compatibility default (10 or 100).
 - Explicit 
ull -> preserved as 
ull.
 - Numeric value -> parsed and stored as 
umber.
4. **Renderer Safety:**
 - In CinematicScene.tsx, limit check guards explicitly against limit !== null to prevent TypeScript strict-null issues.

### Files affected
- src/cinematic/CinematicPage.tsx
- src/cinematic/CinematicScene.tsx

### Testing
- Tested clearing Custom Height Limit -> field remains blank, does not revert to 10.
- Attempted Render Scene with empty Custom Height Limit -> render halted, inline warning displayed.
- Tested clearing Custom Resolution X / Z -> fields remain blank independently.
- Attempted Render Scene with empty Custom Resolution -> render halted, inline warning displayed.
- Tested entering valid numbers -> renders smoothly without errors.
- Verified JSON save/load with null custom properties preserves null values without reverting to 10.
- Validated Auto and Off modes remain completely functional.
- Build verified with 
pm run build (passed, exit code 0).

### Watch for
- Downstream tools loading exported cinematic JSON files should respect 
ull values for customHeightLimit, customResX, and customResZ.

### Remaining limitations
- Input fields currently accept direct typing; values out of range (e.g. negative resolutions) are constrained by input min attributes, but negative custom height limit could still be entered before render if desired by mathematical styling.

### Status
Done. Verified.

## V5.8.1 - Camera Far-Plane Clipping Fix (Extreme Zoom-Out Black Plane)

### What changed
- Increased the camera far-clipping plane from 100 to 5000 for both Perspective and Orthographic camera modes in src/cinematic/CinematicScene.tsx.
- Updated the animation render loop and window resize handler to reference sceneRef.current?.camera, ensuring camera mode toggles preserve active camera updates.

### Why
When zooming far out from the scene with OrbitControls, users observed a large flat black region roughly parallel to the camera that progressively sliced through and obscured the mathematical function surface.
Investigation revealed that no physical mesh or geometry was being generated at that location. Rather, the camera was initialized with camera.far = 100. Because OrbitControls pans and dollies the camera outward, the camera distance eventually exceeded 100 units (roughly ~12x the initial distance of 8.12 units). When the distance between the camera eye and scene vertices exceeded 100, WebGL camera frustum far-plane clipped the polygons against the background clear color (#05070a), producing the exact visual symptom of a planar black slice perpendicular to the camera viewing direction.

### How it works
1. Frustum Far Expansion: In CinematicScene.tsx, camera.far was expanded to 5000 (and [-5000, 5000] for Orthographic near/far). With a near-plane of 0.1, a far-plane of 5000 maintains a depth precision ratio of 50,000 (well within standard 24-bit depth buffer limits), eliminating the clipping plane artifact across extreme zoom levels without causing z-fighting.
2. Dynamic Active Camera Tracking: Ensured the render loop and resize listener dynamically pull sceneRef.current?.camera so that both camera modes maintain their projection properties.

### Files affected
- src/cinematic/CinematicScene.tsx

### Testing
- Tested extreme camera zoom-out: camera can dolly far past 100 units without clipping the function surface or axes.
- Tested Perspective and Orthographic camera toggling.
- Confirmed close-up and normal distance rendering retains full depth resolution without z-fighting.
- Verified lighting, FogExp2 atmosphere, Wrapped Grid, and Phase Contours remain unaffected.
- Build verified with npm run build (passed, exit code 0).

### Watch for
- Extreme zoom out in foggy scenes will naturally blend the surface into scene fog as intended by the atmosphere setting; fog density can be tuned using the Atmosphere slider.

### Remaining limitations
- Camera distances exceeding 5,000 units would eventually meet the new far plane, but this is orders of magnitude beyond any reasonable cinematic framing.

### Status
Done. Verified.

## 2026-10-04

### V5.9 — Riemann Zeta Function ζ(s) Cinematic Showcase

* **Type:** Mathematical Showcase / Analytic Continuation Engine
* **Status:** confirmed

#### What changed
- Built a dedicated, high-performance analytic continuation engine (src/cinematic/zeta.ts) for evaluating zeta(s) across the complex plane s = sigma + it.
- Utilizes Borwein's algorithm (1995) / Xavier Gourdon & Pascal Sebah (2003) with precomputed d_k(n) coefficients and Lanczos complex Gamma(s) reflection for sigma < -(n - 1) / 2.
- Accurately resolves the simple pole at s = 1 + 0i without NaN/Infinity or mesh disruption using Laurent principal expansion clamping.
- Implemented continuous domain-coloring phase palette mapping (arg zeta(s)) directly onto BufferGeometry vertex colors.
- Integrated mathematical reference overlays for the critical strip (0 <= Re(s) <= 1), the critical line (Re(s) = 0.5), and known nontrivial & trivial zeros (s = 0.5 +- 14.134725i, etc., and s = -2, -4).
- Added a one-click **✦ Showcase: Riemann Zeta ζ(s)** preset with tailored domain, resolution, custom height limit, phase coloring, and camera composition.

#### Why
- General-purpose expressions compiled via mathjs lacked analytic continuation into Re(s) < 1 or suffered from numerical instability and extreme latency (~9.4s on a 100x100 grid).
- Borwein's method reduces evaluation time from ~9.4s down to ~21ms (450x faster) while maintaining high precision for known zeros and the pole.

#### Files affected
- src/cinematic/zeta.ts
- src/cinematic/CinematicScene.tsx
- src/cinematic/CinematicPage.tsx
- docs/06_CHANGELOG.md

#### Testing
- Evaluated nontrivial zeros at t ~ 14.134725, 21.022040, 25.010858 with verified magnitude ~ 0.
- Verified trivial zeros at s = -2, -4 yielding values within 10^-11.
- Verified pole at s = 1 smoothly capped without NaN or infinite height spikes.
- Full production build verified with 
pm run build (passed, exit code 0).

### V5.9.1 — Zeta Showcase Height & Bounding Geometry Alignment

* **Type:** Corrective Numerical & Coordinate Framing Fix
* **Status:** confirmed

#### What changed
- Traced the complete mathematical data pipeline from  = \sigma + it \to \zeta(s) \to |\zeta(s)| \to \ln(1 + |\zeta(s)|) \times \text{heightScale} \to \text{BufferGeometry}$ vertex $ attribute.
- Confirmed that $\zeta(s)$ yields full continuous variation ( \in [3.24 \times 10^{-11}, 12.0]$ across the 80x250 domain grid, with zero valleys reaching $ and pole region capped at $).
- Fixed bounding grid / axis ceiling clipping in CinematicScene.tsx: replaced stale arbitrary eferenceHeightExtent = xMax - xMin fallback with true geometry height extent Math.max(geometryData.maxY, 1), ensuring the vertical coordinate grid and height ticks accurately encapsulate the full $ variation.
- Verified camera preset framing (Zeta default) focuses on 0.5 2.5 12$ from 16 14 22$ looking down the critical strip across the entire landscape.

#### Why
- When rendering tall magnitude functions on wide domains, bounding box ticks previously clamped $ to the domain width  - xMin$, visually truncating the coordinate reference system.

#### How it works
- In CinematicScene.tsx, 	ickMaxY dynamically tracks geometryData.maxY in magnitude mode, ensuring that the visual ceiling $ and ticks match the surface height range.

#### Files affected
- src/cinematic/CinematicScene.tsx
- docs/06_CHANGELOG.md

#### Testing
- Evaluated key numerical points:
  -  = 2 + 0i \implies |\zeta| = 1.6449, \ln(1+|\zeta|) = 0.9726, Y = 1.1672$
  -  = 0.5 + 0i \implies |\zeta| = 1.4604, \ln(1+|\zeta|) = 0.9003, Y = 1.0804$
  -  = 0.5 + 10i \implies |\zeta| = 1.5492, \ln(1+|\zeta|) = 0.9358, Y = 1.1229$
  -  = 0.5 + 14.134725i \implies |\zeta| = 1.124 \times 10^{-7}, \ln(1+|\zeta|) = 1.124 \times 10^{-7}, Y = 1.349 \times 10^{-7}$
  -  = -2 + 0i \implies |\zeta| = 2.697 \times 10^{-11}, \ln(1+|\zeta|) = 2.697 \times 10^{-11}, Y = 3.236 \times 10^{-11}$
  -  = 1.1 + 0i \implies |\zeta| = 10.5845, \ln(1+|\zeta|) = 2.4497, Y = 2.9396$
- Verified full mesh range: {\min} = 3.236 \times 10^{-11}$, {\max} = 12.000$, $\Delta Y = 12.000$.
- Production build verified with 
pm run build (passed, exit code 0).

#### Watch for
- Because logarithmic compression $\ln(1 + |\zeta(s)|)$ dampens immense values smoothly, zeros drop to sharp needle valleys while the pole ascends cleanly to the custom limit ($).

#### Remaining limitations
- High precision on the critical line zeros ($|\zeta| \approx 10^{-7}$) requires adequate grid density; the default  \times 250$ grid provides sharp resolution along the  \in [-35, 35]$ corridor.

#### Status
Done. Verified.

### V5.9.2 — Zeta Showcase Visual Relief Calibration & Framing

* **Type:** Visual Relief & Camera Framing Optimization
* **Status:** confirmed

#### What changed
- Calibrated the Zeta showcase preset height scaling from 1.2 to 3.0 and custom height limit from 12 to 18.
- Tuned the Zeta default camera framing from (16, 14, 22) targeting (0.5, 2.5, 12) to (13, 11, 19) targeting (0.5, 2.0, 14).
- Verified that all underlying mathematical quantities remain strictly monotonic $\ln(1 + |\zeta(s)|)$ without artificial non-linear deformations.

#### Why
- Over the elongated domain $\text{Re}(s) \in [-4, 4], \text{Im}(s) \in [-35, 35]$, the span in $ ($ units) is nearly \times$ wider than $ ($ units).
- At heightScale = 1.2, crests between nontrivial zeros ( \approx 1.0 - 1.6$) represented only .5\%$ to \%$ of the longitudinal $ span. From a distant vantage point, perspective compression foreshortened the vertical undulations, making the surface look flat.
- Increasing heightScale to 3.0 elevates crests between zeros to  \approx 3.5 - 5.0$, trivial zeros and nontrivial zeros remain at  = 0$, and the pole scales to  = 18.0$, producing striking three-dimensional relief across the entire corridor.

#### Files affected
- src/cinematic/CinematicPage.tsx
- src/cinematic/CinematicScene.tsx
- docs/06_CHANGELOG.md

#### Testing
- Mesh Y bounds with heightScale = 3.0: {\min} = 8.09 \times 10^{-11}$, {\max} = 18.00$, $\Delta Y = 18.00$.
- Verified nontrivial zero valleys at  = 14.13, 21.02, 25.01, 30.42, 32.94$ drop cleanly to .00$.
- Verified crests between zeros reach  \approx 4.0 - 5.0$, producing distinct rolling hills and valleys along the critical strip.
- Production build verified with 
pm run build (passed, exit code 0).

#### Status
Done. Verified.

### V5.9.3 — Riemann Zeta Logarithmic Magnitude Representation ln(|ζ(s)|)

* **Type:** Mathematical Representation & Surface Geometry
* **Status:** confirmed

#### What changed
- Replaced the previous height formulation ln(1 + |zeta(s)|) with the exact logarithmic magnitude representation h(s) = ln(|zeta(s)|) specifically for Riemann Zeta in magnitude mode.
- Ensured mathematical mapping properties:
  - |zeta(s)| > 1 => Y > 0 (peaks and regions above unit magnitude)
  - |zeta(s)| = 1 => Y = 0 (the natural reference plane)
  - 0 < |zeta(s)| < 1 => Y < 0 (valleys and basins)
  - |zeta(s)| -> 0 => Y -> -infinity (zeros plunge into deep valleys)
  - Pole at s = 1 => Y -> +infinity (singular peak capped at positive limit)
- Implemented robust numerical safety: guaranteed no ln(0), NaN, or infinite values reach the geometry by enforcing epsilon = 1e-12 floor before ln and applying symmetric clamping [-L, +L] where L = 14 (or custom visual limit).
- Adapted scene floor, grid, and ticks for signed height data when rendering Zeta magnitude:
  - Disabled forcing visual floor and min ticks to zero (visualMinY and tickMinY properly span negative values [approx -14, +14]).
  - Updated vertical axis labels and viewport title to display ln|zeta(s)|.
  - Adjusted camera default preset target to Y = 0 along the critical strip.
- Preserved generic magnitude height behavior (e.g. ln(1 + |f(z)|)) for all other functions.

#### Why
- The previous formulation ln(1 + |zeta|) compressed all values to Y >= 0, rendering zeros at Y = 0 and compressing small values so they appeared flat against the floor.
- True logarithmic magnitude ln(|zeta|) accurately exhibits the analytic structure of the zeta function: zeros form deep negative chasms crossing through the Y = 0 plane, while the pole and growth regions tower above.

#### Files affected
- src/cinematic/CinematicScene.tsx
- src/cinematic/CinematicPage.tsx
- docs/06_CHANGELOG.md

#### Testing
- Evaluated key numerical test points under h(s) = ln(|zeta(s)|):
  - s = 2 + 0i: |zeta| = 1.6449 => Y = +0.4977
  - s = 0.5 + 0i: |zeta| = 1.4604 => Y = +0.3787
  - s = 0.5 + 10i: |zeta| = 1.5492 => Y = +0.4377
  - s = 0.5 + 14.134725i (1st zero): |zeta| = 1.124e-7 => Y = -16.001 -> clamped to -14.0
  - s = -2 + 0i (trivial zero): |zeta| = 2.697e-11 => Y = -24.336 -> clamped to -14.0
  - s = 1.0 + 0i (pole): |zeta| = 1e6 => Y = +13.816
- Grid simulation bounds: Ymin = -14.0, Ymax = +13.816, spanning [-14, +14].
- Production build verified with npm run build (passed, exit code 0).

#### Status
Done. Verified.

---

### V5.9.4 — Cinematic Final Polish: Zeta Showcase Configuration, Theme Integration & Input Null-Safety

* **Type:** Visual & Polish / Architectural Release
* **Status:** `confirmed`

#### What changed
1. **Showcase Button "Render ζ(z)":**
   - Configured exact prompt parameters: Domain Re $\in [-7, 0.501]$, Im $\in [-65, 65]$, magnitude mode, Custom resolution $463 \times 8000$, Custom height limit $20$, palette mode, wrapped grid enabled at High density, critical strip & line active, camera position $(38.71, 3.66, 23.74)$ looking at $(-4.13, 1.21, 1.77)$.
   - Styled button with deep emerald tone (`#1b302d`, border `#37675a`, text `#d2f7e9`) and glow shadow effect.
   - Dynamic label updates to "✦ this might take a while..." while rendering and disables the button to prevent duplicate triggers.
2. **Background Asset Integration:**
   - Bundled `ComplexStudioBackground.jpg` in `public/` and imported as viewport backdrop.
   - Configured Three.js scene with `alpha: true` and transparent background so that the atmospheric cosmic background shines through.
3. **UI Polish & Null-Safety:**
   - Removed duplicate/empty "Cinematic scene" heading.
   - Styled "Render Scene" action button to match emerald control theme.
   - Fixed header brand title and subtitle overlapping in top bar.
   - Example chips now render `ζ(z)` using Greek letter `ζ` and map directly to `zeta(z)`.
   - Null-safety added to custom Axis Aspect Ratio inputs (`Re(z)`, `Height`, `Im(z)`), allowing intentional empty states and preventing premature rendering.
   - Removed redundant Scale slider above Height Limit.
   - Fixed corrupt characters in Recommended resolution and PNG Export options.

#### Files affected
- `src/cinematic/CinematicPage.tsx`
- `src/cinematic/CinematicScene.tsx`
- `src/styles.css`
- `src/MathEditor.tsx`
- `public/ComplexStudioBackground.jpg`
- `docs/06_CHANGELOG.md`

#### Testing
- Verified successful production build via `npm run build` (exit code 0).
- Confirmed zero TypeScript errors and accurate asset packaging.

#### Status
Done. Verified.

---

### V5.9.5 - Hero Visual Polish & Separation of Background Contexts

* **Type:** Visual & Landing Page Polish / Asset Architecture
* **Status:** `confirmed`

#### What changed
1. **Home Page Hero Integration:**
   - Positioned `ComplexStudioBackground.jpg` as the prominent hero visual for the landing page in `src/App.tsx`.
   - Elevated **"The function behind a million dollar problem"** into an elegant pill badge with luminous glowing dot and subtle backdrop blur.
   - Refined hero typography hierarchy with a high-contrast headline, descriptive subtitle highlighting analytic continuation and critical zeros, and balanced CTA actions (Direct link to ζ(z) Showcase, Calculator, and Library Explorer).
   - Added subtle radial and gradient vignette overlays preserving visual clarity and contrast of text over the mathematical artwork.
   - Responsive breakpoints ensure clean proportions on mobile/tablet viewports.
2. **Cinematic Render-Space Preservation:**
   - Restored the Three.js Cinematic viewport background strictly to its native solid renderer background (`#05070a`) with `alpha: false`.
   - Removed all backdrop image divs and CSS overlays from the Cinematic rendering canvas, preserving the renderer atmosphere and lighting isolation.
3. **Asset Build Integrity:**
   - Verified that Vite bundles `ComplexStudioBackground.jpg` through standard relative pathing (`/ComplexStudioBackground.jpg`) with zero absolute or local filesystem paths.

#### Files affected
- `src/App.tsx`
- `src/styles.css`
- `src/cinematic/CinematicPage.tsx`
- `src/cinematic/CinematicScene.tsx`
- `docs/06_CHANGELOG.md`

#### Testing
- Verified clean compilation with `npm run build` (exit code 0).
- Confirmed asset presence in production distribution `dist/ComplexStudioBackground.jpg` and referenced correctly in production bundle stylesheet.

#### Status
Done. Verified.

---

### V5.9.6 - Home Page Polish, Visible Hero Image & Discovery Ecosystem

* **Type:** Visual Enhancement & UX Architecture
* **Status:** `confirmed`

#### What changed
1. **Hero Visual Rendering Fix & Prominence:**
   - Identified root cause of invisible hero background: an earlier legacy `.hero-main` CSS block was overriding dimensions and layout, and `ComplexStudioBackground.jpg` was missing an active dedicated backdrop element with proper z-indexing.
   - Restructured `.hero-main` with an explicit `.hero-backdrop` (layering `/ComplexStudioBackground.jpg` at `z-index: 1`) and subtle non-blocking vignette overlays at `z-index: 2` ensuring high-contrast readability without darkening or hiding the artwork.
   - Refined typography hierarchy: "The function behind a million dollar problem" presented as an emerald pill badge with glowing indicator dot; headline formatted with responsive fluid typography `clamp(32px, 5.5vw, 60px)`.
2. **Smooth Scroll-Based Dynamic Movement:**
   - Implemented subtle, passive scroll-driven kinematics on the Home page hero: as the user scrolls downward, the mathematical backdrop subtly zooms and recedes while the hero content shifts gracefully upward with progressive fade-out; reverses on upward scroll.
   - Fully respects `prefers-reduced-motion: reduce` by bypassing transforms and opacity changes when requested.
3. **Dedicated Cinematic Feature Section:**
   - Added a prominent introductory section immediately preceding "Things worth exploring".
   - Details studio-grade lighting, log-polar reference sheets, and analytic logarithmic magnitude `ln|ζ|`. Includes a live mathematical specification card and a primary CTA navigating directly to the Cinematic experience.
4. **Enhanced Explore Tab:**
   - Upgraded the Explore view with a featured banner highlighting the Riemann Zeta showcase alongside structured sections distinguishing Complex Plane Functions (with branch cuts, poles, conformal maps) and Real-Valued Curves.
   - Each card provides a direct action link into the interactive Calculator.
5. **Minimalist Site Footer:**
   - Added a clean, minimal footer anchored at the bottom of the Home, Explore, and About pages displaying site brand, navigation routes, and copyright statement.
6. **Strict Separation of Visual Contexts:**
   - Confirmed that `ComplexStudioBackground.jpg` is used strictly on the Home page hero.
   - The Cinematic 3D viewport remains purely on its native Three.js renderer background (`#05070a`, `alpha: false`) with isolated lighting and scene fog.

#### Why
The landing page lacked visual impact because the hero graphic was shadowed by legacy CSS overrides and lacked discovery pathways into the newly developed Cinematic renderer.

#### How it works
- In `src/App.tsx`, a lightweight scroll listener updates an interpolated `scrollY` state via `requestAnimationFrame`.
- `src/styles.css` coordinates layering through `.hero-backdrop` and `.hero-overlay`.
- Routes and CTA buttons navigate seamlessly via the native `Link` component in `src/router.tsx`.

#### Files affected
- `src/App.tsx`
- `src/styles.css`
- `docs/06_CHANGELOG.md`

#### Testing
- Full visual browser verification executed via headless Chrome captures:
  - `hero_verified.png`: confirms `ComplexStudioBackground.jpg` is prominent, crisp, and readable.
  - `home_full.png`: confirms the Cinematic showcase section, Curated Examples, Why box, and Footer layout.
  - `cinematic_check.png`: confirms Cinematic 3D render-space background remains untouched (`#05070a`).
  - `explore_check.png`: confirms enhanced Discovery Catalog with flagship Zeta card and categorized sections.
- Verified production build via `cmd /c "npm run build"` (exit code 0, 0 errors).

#### Watch for
Ensure viewport resizing on low-end devices maintains smooth 60fps scrolling performance.

#### Remaining limitations
None identified for the current milestone.

#### Status
Done. Verified.

---

### V5.9.7 - Navigation Standardization, Full Uncropped Hero Image & Human Copywriting

* **Type:** Architecture Standardization & Visual Quality of Life
* **Status:** `confirmed`

#### What changed
1. **Shared Navigation Architecture & Self-Link Suppression:**
   - Created `src/Navigation.tsx` as the single source of truth for site-wide navigation across all five routes: `/home`, `/explore`, `/calculator`, `/cinematic`, and `/about`.
   - Implemented automatic route-awareness: the link corresponding to the current active page is automatically hidden from navigation on every page.
   - Standardized placement: top-right on Home, Cinematic, and About; positioned adjacent to the brand logo on Calculator with Cinematic link added.
2. **Calculator Brand Typography & Header Spacing:**
   - Standardized `.brand` and `.brand-text` styling, separating "Complex Studio" and "MATHEMATICAL VISUALIZER" with clean line heights and vertical padding so characters never collide or overlap.
3. **Full Uncropped Hero Stage:**
   - Replaced cropped `background-size: cover` hero presentation with a dedicated `.hero-stage` and `.hero-image-wrapper` using `object-fit: contain`.
   - The entire 16:9 mathematical reference landscape of `ComplexStudioBackground.jpg` is now completely visible from top to bottom without vertical or horizontal cropping.
4. **Active Scroll Animation & Kinematics:**
   - Fixed the scroll animation by calculating offsets directly from `window.pageYOffset` / `document.documentElement.scrollTop` inside a `requestAnimationFrame` loop.
   - As the user scrolls down, the background image subtly translates and scales while the typography gracefully recedes and fades. Smoothly returns upon upward scroll. Fully disables transforms when `prefers-reduced-motion: reduce` is enabled.
5. **Human, Grounded Copywriting:**
   - Rewrote the Home page Cinematic section to explain what Cinematic actually does (interactive 3D surfaces, orbit/zoom navigation, directional studio lighting, phase color palettes, log-polar grids) rather than overemphasizing Riemann zeta.
   - Rewrote all 24 mathematical examples in `src/mathExpression.ts` so that each one clearly and concisely answers "Why would someone want to look at this?" in plain, accessible language without synthetic mathematical jargon.
   - Rewrote "Why explore functions visually?" and the About page to accurately communicate currently implemented capabilities across 2D/3D Calculator and Cinematic.
6. **Clean Minimal Footer:**
   - Streamlined `<SiteFooter />` to a clean, minimal footer anchored at the bottom of pages, containing only brand attribution and visualizer statement without duplicated navigation blocks.
7. **Preservation of Cinematic 3D Viewport:**
   - Confirmed that `ComplexStudioBackground.jpg` is used strictly on the Home page hero. The Three.js Cinematic viewport remains completely untouched on its native solid `#05070a` renderer background with isolated lighting and atmosphere.

#### Why
The navigation was fragmented and redundant, the hero image was cropped at the top and bottom, the scroll animation was inert, and example descriptions were overly dense.

#### How it works
- `src/Navigation.tsx` inspects `useLocation()` and filters the active route from `NAV_ITEMS`.
- `src/App.tsx` handles scroll kinematics via `translate3d` and opacity calculations.
- `src/styles.css` structures the uncropped `.hero-stage` and responsive mobile typography.

#### Files affected
- `src/Navigation.tsx`
- `src/App.tsx`
- `src/Calculator.tsx`
- `src/cinematic/CinematicPage.tsx`
- `src/mathExpression.ts`
- `src/styles.css`
- `docs/06_CHANGELOG.md`

#### Testing
- Verified all 5 pages via headless Chrome screenshot captures:
  - `v2_home.png`: confirms uncropped hero image, clean navigation (Explore, Calculator, Cinematic, About), and dedicated Cinematic feature section.
  - `v2_calculator.png`: confirms fixed brand spacing and navigation (Home, Explore, Cinematic, About) following the brand area.
  - `v2_cinematic.png`: confirms top-right navigation (Home, Explore, Calculator, About) and unchanged Three.js render background.
  - `v2_about.png`: confirms human, honest copy and top-right navigation (Home, Explore, Calculator, Cinematic).
  - `v2_explore.png`: confirms human example descriptions and top-right navigation (Home, Calculator, Cinematic, About).
- Production build confirmed clean with `cmd /c "npm run build"` (0 errors, exit code 0).

#### Watch for
Ensure custom zoom levels on high-DPI displays maintain proportional spacing between the brand title and navigation links.

#### Remaining limitations
None for this milestone.

#### Status
Done. Verified.

---

### V5.9.8 Function Navigation & Layout Polish Pass

**Type:** Bug Fix & UI Polish  
**Status:** `confirmed`

#### What changed
- Fixed route synchronization when navigating to Calculator with query parameters (e.g., `/calculator?expr=...`):
  - Updated `src/router.tsx` to include search queries in `useLocation()` updates.
  - Updated `src/App.tsx` route resolution to match normalized pathnames while preserving search query parameters.
  - Added reactive search query parameter handling in `src/Calculator.tsx` to dynamically update the displayed mathematical expression when navigating from example links.
  - Updated `src/Navigation.tsx` to strip query strings when computing active navigation links, preserving proper self-link suppression.
- Cleaned up Explore page example cards by removing redundant "Open in Calculator" footer text while preserving full card clickability.
- Added Login/Auth button across all pages (Home, Explore, Calculator, Cinematic, About) cleanly positioned at the start of the navigation group without overlapping brand elements or links.
- Streamlined Calculator sidebar by removing the redundant "Things worth exploring" section and card grid while preserving "MORE EXAMPLES" chips and categories.
- Confirmed Cinematic remains accessible to guest users without requiring login.

#### Why
- Clicking example cards on Home or Explore changed the URL with query parameters but failed to switch the visible route to Calculator or load the selected expression.
- Repetitive call-to-action text on every Explore card added visual clutter.
- The Login button needed consistent placement at the head of navigation across all views without obscuring brand elements or wrapping awkwardly.
- The duplicated "Things worth exploring" card list in Calculator added unnecessary sidebar bulk.

#### How it works
- `src/router.tsx` combines `pathname + search` so URL parameter changes trigger reactive subscriber notifications.
- `src/App.tsx` matches routes using `fullPath.split('?')[0]`, routing correctly to `<CalculatorPage />`.
- `src/Calculator.tsx` uses a `useEffect` hook watching `useLocation()` to parse the `expr` parameter and update expression state.
- `<Auth />` is rendered inside navigation containers with responsive flex alignment and spacing.

#### Files affected
- `src/router.tsx`
- `src/Navigation.tsx`
- `src/App.tsx`
- `src/Calculator.tsx`
- `src/cinematic/CinematicPage.tsx`
- `docs/06_CHANGELOG.md`

#### Testing
- Production build confirmed clean: `npm run build` passed with exit code 0.
- Verified route switching and query-string initialization via headless Chrome screenshots:
  - `v3_calculator_sinz.png`: confirms `/calculator?expr=sin(z)` loads Calculator and sets expression to `sin(z)`.
  - `v3_calculator_sqrtz.png`: confirms `/calculator?expr=sqrt(z)` initializes `\sqrt{z}`.
  - `v3_explore.png`: confirms clean cards without repetitive "Open in Calculator" text and Login button placement.
  - `v3_calculator.png`: confirms removed "Things worth exploring" cards, retained "MORE EXAMPLES" chips, and Login button placement.
  - `v3_cinematic.png`: confirms unauthenticated guest access and Login button placement.
  - `v3_home.png` and `v3_about.png`: confirm Login button placement and active self-link suppression.

#### Watch for
Future additions to query string parameters in other routes should continue to use path normalization in navigation active-link detection.

#### Remaining limitations
None for this milestone.

#### Status
Done. Verified.
