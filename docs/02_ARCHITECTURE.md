# 02 — Architecture

## Source File Map

```
src/
├── App.tsx                 # Application shell: UI state, worker orchestration, project I/O, point inspection
├── Renderers.tsx           # Plot2D (Canvas 2D) and Surface3D (Three.js WebGL scene and mesh builder)
├── sampling.worker.ts      # Web Worker: expression compilation, grid evaluation, typed array serialization
├── viewRange.ts            # fittedBounds() for 3D camera/bounds, cartesianView() for 2D auto-ranging & symlog
├── asymptotes.ts           # Cartesian singularity/jump detection (candidates for refinement, breaks for plotting)
├── project.ts              # AppConfig types, .cstudio serialization, validation, defaults, camera snapshots
├── mathExpression.ts       # normalizeExpression() LaTeX/notation rewriting, EXAMPLES gallery definitions
├── MathPreview.tsx         # Live MathML rendering of parsed AST (read-only)
├── InformationPanel.tsx    # Modal overlay displaying about/documentation content
├── infoContent.ts          # Static copy and metadata for InformationPanel
├── styles.css              # Global styles, dark theme tokens, layout structure
├── main.tsx                # React root mount entry point
└── mathml.d.ts             # TypeScript JSX type definitions for MathML elements
```

---

## Data Flow & Life Cycle

```
User Input (Expression, Domain, Presets, Axis Mapping, Fit Mode)
  │
  ▼
App.tsx — computes target resolutions, creates background Web Worker
  │
  ├── 1. Preview Phase (low-resolution e.g. 36×36 surface, 180×1 curve, 96×96 domain)
  │     ▼
  │   sampling.worker.ts — evaluates f(z) on uniform grid
  │     │ Transfers: Float32Array re, im; Uint8Array valid (+ CurveSamples for Cartesian)
  │     ▼
  │   App.tsx — wraps into RenderSample state
  │     ▼
  │   Renderers.tsx — immediate interactive visual feedback
  │
  └── 2. Refinement Phase (selected quality preset up to 200×200 surface or 1024×1024 custom)
        ▼
      sampling.worker.ts — re-evaluates grid at full density
        │ Transfers: full-resolution buffers (zero-copy Transferable)
        ▼
      App.tsx — updates RenderSample, terminates worker
        ▼
      Renderers.tsx — updates high-detail geometry / canvas
```

---

## Key Subsystems & Architectural Relationships

### 1. Expression Parser & Worker Sampler ([`../src/sampling.worker.ts`](../src/sampling.worker.ts))
* Input expression string is preprocessed by `normalizeExpression()` in [`../src/mathExpression.ts`](../src/mathExpression.ts).
* Parsed and compiled via Math.js: `math.parse(normalized).compile()`.
* Grid points computed uniformly:
  $$x_k = x_{\min} + \frac{x_{\max} - x_{\min}}{\max(1, n_x - 1)} \cdot k, \quad y_j = y_{\min} + \frac{y_{\max} - y_{\min}}{\max(1, n_y - 1)} \cdot j$$
* Evaluated with scope `{ x, y, t: 0, z: math.complex(x, y), i: math.complex(0, 1) }`.
* **Numerical Validity Gate (Worker limit: `1e12`):**
  $$\text{valid} = 1 \iff \text{isFinite}(\text{re}) \land \text{isFinite}(\text{im}) \land |\text{re}| < 10^{12} \land |\text{im}| < 10^{12}$$
  Points exceeding $10^{12}$ are converted to $\text{NaN}$ and marked $\text{valid} = 0$.

### 2. 3D Surface Geometry Pipeline ([`../src/Renderers.tsx`](../src/Renderers.tsx): `Surface3D`)
Building the Three.js `BufferGeometry` involves a 5-stage acceptance filter:

1. **Worker Validity Gate** ([`../src/sampling.worker.ts:28`](../src/sampling.worker.ts#L28)): Checks `valid[k] === 1` ($|\text{val}| < 10^{12}$).
2. **Renderer Coordinate Clamp** ([`../src/Renderers.tsx:282`](../src/Renderers.tsx#L282)):
   $$\text{position}[3k + a] = (\text{valid}[k] \land \text{isFinite}(v) \land |v| < 10^7) \;?\; v \;:\; \text{NaN}$$
3. **Finite Vertex Gate `okay(k)`** ([`../src/Renderers.tsx:286`](../src/Renderers.tsx#L286)):
   Verifies that $\text{valid}[k] = 1$ and all 3 spatial coordinates are non-$\text{NaN}$.
4. **Fit Bounds Gate `withinFitBounds(k)`** ([`../src/Renderers.tsx:293`](../src/Renderers.tsx#L293)):
   ```typescript
   const withinFitBounds = (k: number) =>
     fitMode === 'All' ||
     [0, 1, 2].every((axis) =>
       position[k * 3 + axis] >= fitBounds.min[axis] &&
       position[k * 3 + axis] <= fitBounds.max[axis]
     );
   ```
   * Under `fitMode === 'All'`, returns `true` unconditionally (no vertex clipping).
   * Under `fitMode === 'Robust'`, **rejects any vertex outside `fitBounds`**.
5. **Edge & Jump Filter `edgeOkay(a, b)`** ([`../src/Renderers.tsx:295`](../src/Renderers.tsx#L295)):
   Requires both endpoints to satisfy `displayOkay(k) = okay(k) && withinFitBounds(k)`.
   Additionally checks vertical jump:
   $$|Z_a - Z_b| < \text{jumpLimit}, \quad \text{where } \text{jumpLimit} = 12 \cdot \frac{\text{ranges}[2]}{\max(1, n-1, m-1)}$$
   Because $\text{ranges}[2]$ is derived from `fitBounds`, a narrower Robust range strictly shrinks `jumpLimit`.

**Triangle Indexing:**
Each grid quad `(a, b, c, d)` is divided into two triangles `(a, c, b)` and `(b, c, d)`. A triangle is only indexed if all 3 edges pass `edgeOkay`.

### 3. Bounds & Camera Calculation ([`../src/viewRange.ts`](../src/viewRange.ts): `fittedBounds`)
* **All Mode:** Computes the exact $[\min, \max]$ envelope across all valid vertices.
* **Robust Mode:**
  * Strided sampling up to 8192 vertices.
  * For non-preserved axes: computes `center = median(values)`, `MAD = median(|values - center|)`.
  * Sets bounds to $[\text{center} - 4 \cdot \text{MAD}, \text{center} + 4 \cdot \text{MAD}]$.
  * Caps maximum span to `2 * max(domain.width, domain.height)`.
* **Preserved Axes:** Input domain axes ($\text{Re}(z), \text{Im}(z)$) always retain full domain bounds regardless of fit mode. Output axes ($\text{Re}(f), \text{Im}(f), |f|, \arg(f)$) are subjected to the fitting policy.

### 4. 2D Cartesian Engine ([`../src/Renderers.tsx`](../src/Renderers.tsx): `Plot2D` & [`../src/asymptotes.ts`](../src/asymptotes.ts))
* Uses `cartesianView()` in [`../src/viewRange.ts`](../src/viewRange.ts).
* Automatic symmetric-log (`symlog`) scaling activated when dynamic range $\max / \text{median} > 50$, preventing narrow spikes from crushing the main curve.
* Discontinuity detection:
  * `detectCartesianCandidates()` triggers local bisection refinement in the worker (up to depth 3, max 192 extra samples).
  * `detectCartesianBreaks()` flags sign/secant reversals to break `CanvasRenderingContext2D` paths.

### 5. Project Serialization ([`../src/project.ts`](../src/project.ts))
* Strict schema validation in `normalizeConfig()` and `deserializeProject()`.
* Clamps all loaded parameters to prevent corrupted files from crashing WebGL or Web Worker contexts.
* Captures camera position, target vector, and orthographic zoom/height into `.cstudio` JSON format.

---

## Numerical Limits & Thresholds

| Name | Value | File & Line | Scope / Effect |
|---|---|---|---|
| Worker Validity Threshold | $10^{12}$ | [`../src/sampling.worker.ts:28`](../src/sampling.worker.ts#L28) | Output values $\ge 10^{12}$ marked invalid (`valid = 0`) |
| Renderer Coordinate Clamp | $10^7$ | [`../src/Renderers.tsx:282`](../src/Renderers.tsx#L282) | Position components $\ge 10^7$ replaced with `NaN` |
| Robust MAD Multiplier | $4.0$ | [`../src/viewRange.ts:78`](../src/viewRange.ts#L78) | Robust bounding box half-width = $4 \times \text{MAD}$ |
| Robust Max Span Multiplier | $2.0$ | [`../src/Renderers.tsx:288`](../src/Renderers.tsx#L288) | Robust range cannot exceed $2 \times$ input domain span |
| Jump Limit Multiplier | $12.0$ | [`../src/Renderers.tsx:291`](../src/Renderers.tsx#L291) | Triangle edges rejected if $\Delta Z \ge 12 \times \text{typical step}$ |
| Quantile Fallback Range | $0.02 \dots 0.98$ | [`../src/viewRange.ts:82`](../src/viewRange.ts#L82) | Fallback if $\text{MAD} \approx 0$ |
| Project Domain Coordinate Clamp | $\pm 10^9$ | [`../src/project.ts:99`](../src/project.ts#L99) | Sanitizes loaded project domain boundaries |
| Project Camera Vector Clamp | $\pm 10^9$ | [`../src/project.ts:76`](../src/project.ts#L76) | Sanitizes loaded camera position/target coordinates |
| Project Manual Y Clamp | $\pm 10^{12}$ | [`../src/project.ts:129`](../src/project.ts#L129) | Sanitizes loaded manual 2D Cartesian vertical ranges |
