# Complex Studio — Project Context Index & Working Rules

This document serves as the master index for Complex Studio's persistent project context and defines the operational rules for ongoing development.

---

## 1. Project Context Documents

| File | Purpose & Contents |
|---|---|
| [00_CONTEXT_INDEX.md](00_CONTEXT_INDEX.md) | Context index, evidence discipline, development & communication rules, workflow principles |
| [01_PROJECT_OVERVIEW.md](01_PROJECT_OVERVIEW.md) | Core application purpose, tech stack (React, TS, Vite, Math.js, Three.js), feature capabilities, run/build commands |
| [02_ARCHITECTURE.md](02_ARCHITECTURE.md) | Detailed source file map, worker-based data flow, 3D surface geometry pipeline (5-stage filtering), fitting & camera framing, numerical limits |
| [03_KNOWN_ISSUES.md](03_KNOWN_ISSUES.md) | Formally documented issues with evidence levels, including ISSUE-001 (Robust 3D fitting geometry clipping) and uniform grid limits |
| [04_DEVELOPMENT_HISTORY.md](04_DEVELOPMENT_HISTORY.md) | Architectural origins, design decisions confirmed from code/docs, deliberate scope boundaries |
| [05_ROADMAP.md](05_ROADMAP.md) | Active investigation next steps and potential future capabilities |
| [06_CHANGELOG.md](06_CHANGELOG.md) | Chronological log of meaningful investigations, fixes, and architectural adjustments |

### Primary Project References
* [README.md](../README.md) — Public-facing user documentation and quickstart guide
* [package.json](../package.json) — NPM dependencies and build scripts
* Source Code in [`../src/`](../src/) — Authoritative source of truth for all behavior

---

## 2. Evidence Discipline

Throughout all project documentation, discussion, and future development, always maintain strict evidential clarity:

* **CONFIRMED** — directly established from source code inspection, verified mathematical derivation, or automated testing.
* **OBSERVED** — runtime behavior seen during user interaction or test execution.
* **HYPOTHESIS** — plausible explanation or causal theory not yet definitively proven.
* **PROPOSED** — suggested modification, design alternative, or bug fix.

> [!IMPORTANT]
> Never turn a hypothesis into a confirmed fact without verification.

---

## 3. Current Confirmed 3D Issue Summary

* **Subject:** 3D surface rendering for `exp(2z)` under `Robust` auto-fitting.
* **Confirmed Root Cause:** Robust fitting currently affects geometry acceptance/rendering, not merely camera framing. In [`src/Renderers.tsx`](../src/Renderers.tsx#L293), `withinFitBounds()` admits all vertices when `fitMode === 'All'`, but rejects any vertex falling outside the MAD-based fit bounds when `fitMode === 'Robust'`.
* **Visual Consequence:** The surface becomes visibly torn/truncated when a function possesses a rapidly growing tail.
* **Ruled Out:**
  * Web worker `1e12` threshold ([`src/sampling.worker.ts:28`](../src/sampling.worker.ts#L28)) is NOT responsible.
  * Renderer `1e7` coordinate clamp ([`src/Renderers.tsx:282`](../src/Renderers.tsx#L282)) is NOT responsible.
* **Contributing Factor:** `jumpLimit` ([`src/Renderers.tsx:291`](../src/Renderers.tsx#L291)) is derived from the tighter Robust Z-range, reducing the allowable step between neighboring vertices and causing additional edge rejection.
* **Status:** Documented in [03_KNOWN_ISSUES.md](03_KNOWN_ISSUES.md). Implementation deferred until authorized.

---

## 4. Development Rules

### Understand first, change second
Before modifying code:
1. Locate the relevant implementation.
2. Trace the data flow.
3. Identify related systems that could be affected.
4. Explain the current behavior.
5. State the proposed change.
6. Only then implement it.
For non-trivial changes, do not immediately rewrite large sections of code.

### Small targeted changes
Prefer the smallest change that correctly solves the identified problem. Do not perform unrelated refactors, formatting changes, dependency changes, or architecture rewrites unless explicitly requested or clearly necessary.

### Numerical / rendering caution
Treat sampling, numerical thresholds, fitting, geometry generation, triangle connectivity, discontinuity detection, and camera calculations as interconnected systems.
When changing one of these systems, explicitly consider whether the change affects:
* continuous functions
* singularities
* rapidly growing functions
* negative/positive ranges
* complex-valued outputs
* 2D rendering
* 3D rendering
* camera framing
* wireframes
* surface continuity
* asymptote detection

### Camera vs geometry
Always distinguish between:
1. Changing what geometry exists / is rendered.
2. Changing which geometry is used to calculate camera bounds.
3. Changing the camera position / zoom.
A fitting mode must never be assumed to be camera-only if its implementation also alters geometry acceptance.

### Testing
After meaningful code changes, use appropriate project checks:
* `npm run build` (or `node ./node_modules/typescript/bin/tsc -b`)
* `git diff --check` (where git is available)
For rendering changes, perform targeted runtime testing across representative mathematical functions (e.g. polynomials, exponentials, poles, trigonometric functions) rather than solely the original failing expression.

### Preserve compatibility
Do not break:
* Existing `.cstudio` project files and serialization/deserialization compatibility.
* Existing 2D visualization modes (Cartesian, domain coloring, magnitude, phase, contours, vector).
* Existing 3D visualization modes, coordinate axes, and wireframes.
* Asymptote/discontinuity detection behavior.
* Existing UI controls and options unless a requested change specifically requires it.
* Do not add dependencies unless there is a clear technical reason.

---

## 5. Communication Rules

For significant investigations, report:
1. What was inspected
2. What was confirmed
3. What was observed
4. What remains uncertain
5. Proposed solution(s)
6. Risks / tradeoffs
7. Testing plan

Before implementing a non-trivial change, present the proposed approach first unless explicitly instructed to proceed immediately.
When implementation is complete, report:
* Files changed
* What changed
* Why it changed
* Tests performed
* Test results
* Remaining limitations
* Whether documentation / changelog was updated
Never claim something was tested if it was not actually tested.

---

## 6. Change Management

Maintain [06_CHANGELOG.md](06_CHANGELOG.md) as living project memory.
For meaningful changes, record:
* Date
* Change description
* Rationale
* Affected files
* Testing conducted
* Limitations or caveats
* Status

Avoid verbose entries for trivial edits. When a bug is investigated, record the confirmed root cause once established. Do not rewrite historical entries merely for cosmetics.

---

## 7. Git Safety

Before substantial changes:
* Inspect working tree status.
* Inspect relevant diffs.
* Understand the current working state.
* Do not execute destructive Git operations (`reset --hard`, forced checkouts, cleaning uncommitted user files).
* Provide resulting diffs for review before concluding tasks.

---

## 8. Current Workflow

Follow this phased cycle for non-trivial modifications:

$$\text{INVESTIGATE} \longrightarrow \text{EXPLAIN FINDINGS} \longrightarrow \text{PROPOSE SOLUTION} \longrightarrow \text{SEEK APPROVAL} \longrightarrow \text{IMPLEMENT} \longrightarrow \text{TEST} \longrightarrow \text{REVIEW DIFF} \longrightarrow \text{UPDATE CHANGELOG} \longrightarrow \text{REPORT RESULTS}$$

For small, obvious changes explicitly requested for immediate implementation, exercise sound judgment and keep modifications strictly localized.

---

## 9. Important Project Principle

Complex Studio already contains substantial previous development and nuanced mathematical handling.

Do not treat existing behavior as accidental simply because an alternative implementation pattern exists. When proposing changes, preserve existing behavior unless there is clear evidence that it is incorrect or an explicitly requested feature requires modification.

**Goal:** Controlled, reliable evolution of an existing technical project—not repeated rewrites.
