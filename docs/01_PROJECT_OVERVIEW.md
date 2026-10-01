# 01 — Project Overview

## What is Complex Studio?

Complex Studio is a browser-based mathematical visualization workbench for real and complex functions. It evaluates expressions via Math.js, samples them in a dedicated Web Worker off the main thread, and renders interactive 2D plots (Canvas 2D) and 3D surfaces (WebGL via Three.js).

## Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | React | 18.3.1 | Application shell, state management, toolbar & sidebar UI |
| Language | TypeScript (strict) | ~5.7.2 | Type safety across samples, configurations, and renderer contracts |
| Bundler | Vite | 6.0.5 | Fast ESM dev server and production asset compilation |
| Math Engine | Math.js | 14.2.1 | Complex arithmetic, transcendental functions, AST parsing & evaluation |
| 3D Graphics | Three.js | 0.171.0 | WebGL scene graph, buffer geometry, shaders/materials, OrbitControls |
| Icons | Lucide React | 0.468.0 | Minimalist interface iconography |
| Styling | Pure CSS | — | Responsive layout with dark theme ([`../src/styles.css`](../src/styles.css)) |

## Development Setup

**Requirements:** Node.js 20+ and npm (or pnpm).

```sh
npm install
npm run dev       # Development server with hot module reload (Vite)
npm run build     # Production build (tsc -b && vite build)
npm run preview   # Local preview of the production build
```

* Dev server flags: `--configLoader runner --host 0.0.0.0`
* TypeScript configuration: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, target `ES2022`, module resolution `Bundler`, `react-jsx`.

## Core Capabilities

### 1. Visualization Modes

#### 2D Views (Canvas 2D)
* **Cartesian graph**: Plots $\text{Re}(f(x))$ along the real axis with adaptive jump breaks and optional symlog scaling.
* **Domain coloring**: Maps complex input points to colors where $\text{Hue} = \arg(f(z))$ and $\text{Lightness} = |f(z)|$.
* **Magnitude heatmap**: Visualizes $|f(z)|$ with logarithmic intensity scaling.
* **Phase coloring**: Visualizes $\arg(f(z))$ on the $[-\pi, \pi]$ cyclic spectrum.
* **Contour map**: Generates log-magnitude contour lines via 2D cell marching.
* **Complex vector field**: Overlays directional arrows showing the magnitude and phase angle of $f(z)$.

#### 3D Views (WebGL / Three.js)
* **Interactive surface mesh**: Vertex-colored height-field surface supporting arbitrary spatial mappings for $X, Y, Z$:
  * $\text{Re}(z), \text{Im}(z), \text{Re}(f), \text{Im}(f), |f(z)|, \arg(f)$
* **Wireframe overlay**: Optional semi-transparent triangle grid overlay.
* **Interactive lighting**: Directional key/fill lights and ambient hemisphere lighting.
* **Projection switching**: Seamless toggling between Perspective and Orthographic projection.

### 2. Expression Input & Parsing
* Plain text mathematical notation parsed by Math.js.
* LaTeX translation supporting `\frac`, `\sqrt`, `\sin`, `\cos`, `\exp`, `|z|`, and common complex shorthand like `iy \to i*y`.
* Non-editable live **MathML preview** showing the parsed AST structure before evaluation.
* Variables supported in evaluator scope: `x`, `y`, `z` ($x + iy$), `t` (reserved parameter, currently 0), and imaginary constant `i`.
* Curated example gallery for both complex and real function families.

### 3. Numerical Sampling Engine
* Executed in a Web Worker ([`../src/sampling.worker.ts`](../src/sampling.worker.ts)) to keep the user interface responsive.
* Progressive two-tier execution: fast low-res preview immediately followed by full-resolution refinement.
* Validity filtering with typed arrays (`Float32Array`, `Float64Array`, `Uint8Array`) transferred using zero-copy `Transferable` buffers.

### 4. Camera & Fitting Policies
* **Robust**: Computes median-absolute-deviation (MAD) bounds to frame the primary body of the function while suppressing outlier skew. *(Note: currently also clips mesh geometry—see [03_KNOWN_ISSUES.md](03_KNOWN_ISSUES.md)).*
* **All**: Evaluates and fits to the complete finite range of data without geometric clipping.
* **Manual**: Permits explicit configuration of vertical boundaries (2D) or camera distance (3D).
* Camera view presets (Top, Front, Side, Reset/Fit) and persistent view tracking.

### 5. Data I/O & Persistence
* Versioned `.cstudio` project files (JSON format version 1) saving visualization parameters, domain ranges, quality, and 3D camera matrices.
* Backward compatibility for legacy unversioned project configurations.
* Sampled data export to CSV format (`x, y, real, imaginary, magnitude, phase`).
* Viewport screenshot capture to PNG format.
