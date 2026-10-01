# 05 — Roadmap

This roadmap tracks active engineering objectives and future architectural candidates for Complex Studio.

---

## Active Milestone: Resolution of 3D Robust Fitting Geometry Tearing (ISSUE-001)

### Status: Root Cause Confirmed — Awaiting Solution Selection & Approval

* **Problem Statement:** In 3D mode with `fitMode === 'Robust'`, the MAD-derived bounding box is used to drop vertices and triangle edges, producing broken, torn surfaces on functions with rapid growth such as $\exp(2z)$.
* **Investigation Deliverables:**
  * [x] Complete source code trace of sampling and rendering pipelines.
  * [x] Identification of `withinFitBounds()` at [`../src/Renderers.tsx:293`](../src/Renderers.tsx#L293) as the filtering point.
  * [x] Verification that worker $10^{12}$ and renderer $10^7$ thresholds are uninvolved.
  * [x] Identification of `jumpLimit` reduction as an amplifying factor.
  * [x] Formulation of candidate solutions (decoupling geometry from camera framing, soft bounds, or height capping).
* **Next Steps:**
  1. Present proposed architectural solution for user review.
  2. Implement approved minimal change.
  3. Validate against continuous functions, poles ($1/z$, $\tan(z)$), exponential tails, and polynomials.
  4. Update changelog and test reports.

---

## Future Enhancement Candidates (Drawn from Documented Scope & Architecture)

### Short-Term Refinements
* **Enhanced Pole Suppression:** Develop a clean distinction between true asymptotic poles (where tearing/holes are mathematically desirable to avoid artificial connecting walls) and rapid continuous growth (where tearing is undesirable).
* **Extended Built-in Examples:** Add illustrative complex analysis examples (Riemann surface approximations, Mobius transforms, modular forms).

### Mid-Term Capabilities
* **Time-Parameter Animation:** The worker evaluator already binds `t: 0`. Implementing an animation timeline / slider in [`../src/App.tsx`](../src/App.tsx) would allow visualizing 1-parameter families $f(z, t)$ without modifying the worker contract.
* **Direct 3D Mesh Export:** Export generated Three.js `BufferGeometry` directly to `.OBJ` or `.STL` files for 3D printing or external visualization.

### Long-Term Research Directions
* **Adaptive Sampling:** Non-uniform subdivision to resolve branch cuts and steep gradients without blowing up memory on smooth regions.
* **Parametric & Implicit Surface Support:** Visualizing space curves and complex implicit varieties.
