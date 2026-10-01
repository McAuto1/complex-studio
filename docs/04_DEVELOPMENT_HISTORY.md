# 04 — Development History

## Project Genesis & Evolution

Complex Studio was engineered as a high-performance web-based laboratory for complex analysis, functional visualization, and numerical experimentation. 

According to application patch notes in [`../src/infoContent.ts`](../src/infoContent.ts):
> **Phase 1:** *Robust view fitting, clearer display controls, project files, and expression preview.*

---

## Architectural & Design Decisions (CONFIRMED from Codebase)

### 1. Offloading Evaluation to Web Workers
* **Decision:** CPU evaluation of arbitrary expressions is delegated to [`../src/sampling.worker.ts`](../src/sampling.worker.ts).
* **Rationale:** Math.js AST evaluation for grids up to $1024 \times 1024$ (over 1 million complex numbers) is computationally intensive. Executing this on the main thread would freeze the UI, disrupting camera orbit animations and slider interactions.
* **Progressive Pipeline:** A fast low-res pass (e.g. $36 \times 36$) provides instantaneous visual feedback upon typing, followed immediately by refinement to the user-selected quality level.

### 2. Standardized AST Compilation via Math.js
* **Decision:** Rely on Math.js rather than rolling a custom expression engine.
* **Rationale:** Complex number semantics, branch cut conventions, trigonometric extensions to $\mathbb{C}$, and constants ($\pi, i, e$) are already established and mathematically sound.
* **LaTeX Pre-processor:** [`../src/mathExpression.ts`](../src/mathExpression.ts) converts familiar LaTeX expressions (`\frac`, `\sqrt`, `|z|`) into standard Math.js syntax while leaving the compiler untouched.

### 3. Separation of 2D Canvas and 3D WebGL
* **Decision:** Canvas 2D for domain coloring / Cartesian curves; Three.js for 3D surfaces.
* **Rationale:** Domain coloring and contour mapping operate naturally on raw pixel buffers (`ImageData`), whereas spatial height-fields require matrix transformations, depth testing, lighting, and GPU-driven triangle rasterization.

### 4. Intentional Coupling of Robust Fitting to Geometry
* **Decision:** In the initial design, Robust fitting was coded to both position the camera and omit triangles outside the calculated bounding box.
* **Evidence:** Confirmed by [`../README.md`](../README.md) (line 43) and [`../src/Renderers.tsx`](../src/Renderers.tsx) (lines 288-300).
* **Evolutionary Note:** While intended to truncate unbounded poles (like $1/z$), it introduces severe tearing on smooth rapidly growing functions like $\exp(2z)$, which motivates the active investigation documented in [03_KNOWN_ISSUES.md](03_KNOWN_ISSUES.md).

### 5. Preserved Input Domain Axes
* **Decision:** Spatial axes mapped to $\text{Re}(z)$ or $\text{Im}(z)$ bypass MAD-based robust clamping via `preserveAxes`.
* **Rationale:** The user explicitly defines the domain $[-3, 3]$; truncating the input grid domain would mislead the user about the evaluation boundary. Only the dependent output axis is clipped.

### 6. Robust Cartesian Auto-Scaling (symlog)
* **Decision:** When vertical dynamic range exceeds 50:1, [`../src/viewRange.ts`](../src/viewRange.ts) automatically engages a symmetric logarithm ($\text{asinh}$) scale for 2D Cartesian curves.
* **Rationale:** Permits visualizing functions with extreme spikes without flattening the informative behavior near zero.

---

## Scope Boundaries (CONFIRMED from [`../README.md`](../README.md))

The following capabilities are explicitly outside the current scope:
* Computer Algebra System (symbolic differentiation, integration, series expansion).
* Adaptive non-uniform quadtree/octree mesh subdivision.
* Parametric curves ($z(t)$) and implicit algebraic surfaces ($F(x,y,z) = 0$).
* WebGL fragment-shader evaluation (arbitrary user expressions cannot be safely JIT-compiled into GLSL in this architecture).
* 3D mesh file export (OBJ/STL).
