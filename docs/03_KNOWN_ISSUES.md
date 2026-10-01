# 03 — Known Issues

This document records confirmed bugs, investigated behaviors, and open technical limitations in Complex Studio.

---

## ISSUE-001: Robust 3D Fitting Clips Geometry Rather Than Only Camera Framing

* **Status:** CONFIRMED from source code
* **Severity:** High (causes noticeable tearing and truncation on smooth functions)
* **Date Identified:** 2026-09-30
* **Affects:** 3D Surface Rendering when `fitMode === 'Robust'`

### 1. Summary
When viewing 3D surfaces such as $\exp(2z)$ or $\exp(z)$ under the default `Robust` auto-fit mode, the resulting mesh appears visibly truncated or torn where values grow rapidly. Under `All` auto-fit mode, the mesh is fully intact and continuous, but the camera is positioned far away.

### 2. Confirmed Root Cause
In [`src/Renderers.tsx`](../src/Renderers.tsx#L293), the vertex acceptance function `withinFitBounds()` directly couples the fitting mode to geometry generation:

```typescript
// src/Renderers.tsx:293-294
const withinFitBounds = (k: number) =>
  fitMode === 'All' ||
  [0, 1, 2].every((axis) =>
    position[k * 3 + axis] >= fitBounds.min[axis] &&
    position[k * 3 + axis] <= fitBounds.max[axis]
  );
const displayOkay = (k: number) => okay(k) && withinFitBounds(k);
```

* **When `fitMode === 'All'`:** `withinFitBounds()` always evaluates to `true`, so all finite sampled vertices are preserved.
* **When `fitMode === 'Robust'`:** Any vertex with coordinates outside `fitBounds` is marked invalid (`displayOkay = false`).

This cascades through two subsequent rejection mechanisms:
1. **Triangle Omission:** [`edgeOkay(a, b)`](../src/Renderers.tsx#L295) requires `displayOkay` on all endpoints. If a single vertex falls outside the robust bounding box, both triangles sharing that quad vertex are omitted.
2. **Jump Limit Shrinkage:** [`jumpLimit`](../src/Renderers.tsx#L291) is calculated from `ranges[2]` (the fitted Z-span). Because Robust fitting shrinks `ranges[2]`, `jumpLimit` drops proportionally, causing borderline adjacent vertices with steep gradients to fail the jump test and dropping additional triangles.

### 3. Ruled-Out Hypotheses (Confirmed from Code & Numbers)
* **Worker `1e12` Validity Threshold ([`src/sampling.worker.ts:28`](../src/sampling.worker.ts#L28)):**
  For $\exp(2z)$ over the domain $[-3, 3] \times [-3, 3]$, the maximum magnitude is $|\exp(6 + 6i)| = \exp(6) \approx 403.4$. This is eight orders of magnitude below $10^{12}$. The worker marks all samples as `valid: 1`.
* **Renderer `1e7` Coordinate Limit ([`src/Renderers.tsx:282`](../src/Renderers.tsx#L282)):**
  The value $403.4$ is far below $10^7$. No vertices are replaced with `NaN` by this clamp.

### 4. Code Locations Involved

| File | Lines | Mechanism |
|---|---|---|
| [`../src/Renderers.tsx`](../src/Renderers.tsx) | 288–289 | Calls `fittedBounds()` with `fitMode === 'All' ? 'All' : 'Robust'` |
| [`../src/Renderers.tsx`](../src/Renderers.tsx) | 291 | Computes `jumpLimit` from `ranges[2]` |
| [`../src/Renderers.tsx`](../src/Renderers.tsx) | 293–294 | `withinFitBounds()` checks coordinates against `fitBounds` |
| [`../src/Renderers.tsx`](../src/Renderers.tsx) | 295–300 | `edgeOkay()` filters triangle indices based on `displayOkay` and `jumpLimit` |
| [`../src/viewRange.ts`](../src/viewRange.ts) | 43–97 | `fittedBounds()` computes MAD-based bounds: $\text{center} \pm 4 \cdot \text{MAD}$ |

### 5. Historical Context
The project's original [README.md](../README.md) (line 43) states:
> *"In 3D, Robust fitting uses median-absolute-deviation bounds, limits mapped-axis spans to twice the input-domain span, and omits triangles outside those display bounds while retaining their original samples..."*

This confirms the behavior was initially intentional (designed to suppress divergent poles), but it causes undesirable geometric tearing on smooth functions with exponential growth.

### 6. Proposed Fix Directions (For Future Implementation)
* **Option A (Decouple Camera from Geometry):** Let `withinFitBounds()` always return `true` (or only apply coordinate/worker limits), reserving `fitBounds` solely for camera target, camera distance, and near/far plane positioning.
* **Option B (Separate Geometry Bounds from Camera Bounds):** Use full data range for geometry inclusion and jump limit, but robust bounds for camera framing.
* **Option C (Soft Clipping / Margin):** Apply an expanded margin (e.g. $1.5\times$ or $2\times$ robust bounds) for mesh inclusion.
* **Option D (Clamped Surface / Capping):** Clamp out-of-bound vertex heights to the boundary instead of dropping triangles.

*(Note: Per development instructions, do not implement a fix until specifically approved.)*

---

## ISSUE-002: Uniform Grid Resolution Constraints on Sharp Features

* **Status:** CONFIRMED (Documented limitation)
* **Severity:** Low / Informational
* **Scope:** 2D Domain Coloring & 3D Surface Meshing

### Summary
The sampling worker evaluates a uniform rectangular grid. High-frequency oscillations, essential singularities (e.g. $\exp(1/z)$ near $z=0$), or branch cuts with steep gradients may exhibit aliasing or jagged boundaries unless resolution is manually increased via the Custom quality preset.
