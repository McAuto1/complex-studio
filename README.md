# Complex Studio

Complex Studio is a browser-based mathematical visualization workbench for real and complex functions. It uses a real expression parser, evaluates samples in a Web Worker, and draws interactive 3D surfaces with WebGL through Three.js.

## Run it

Requirements: Node.js 20 or later and npm (or pnpm).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build:

```sh
npm run build
npm run preview
```

## Try these expressions

The examples menu includes the requested complex functions (`z`, `z^2`, `z^z`, `1/z`, `sin(z)`, `exp(z)`, `log(z)`, `1/(z^2-1)`, and more) and real functions (`x^2`, `sin(x)`, `sin(x*y)`, `x^2-y^2`). The default view is the complex surface for `sin(z)`.

Both plain notation and common LaTeX forms are accepted. For example:

```text
sin(z) / z       \\frac{\\sin(z)}{z}
e^z              e^{z}
sqrt(z)          \\sqrt{z}
abs(z)           |z|
sin(x + iy)      sin(x + i y)
```

The parser is Math.js, so the app supports its real and complex arithmetic, trigonometric, inverse trigonometric, exponential, logarithmic, and hyperbolic functions and constants. Math.js also supplies the complex Gamma function; the common capitalized spelling `Gamma(z)` is normalized to `gamma(z)`. The expression is compiled once per sample job. `x`, `y`, `z`, `t` (currently set to 0), and the imaginary unit `i` are available.

## Layout and controls

- Choose 2D or 3D. 2D includes Cartesian real-axis graphs, complex domain coloring, magnitude and phase views, contour maps, and complex vector fields.
- In 3D, map each spatial axis independently to `Re(z)`, `Im(z)`, `Re(f)`, `Im(f)`, `|f(z)|`, or `arg(f)`.
- Set the real and imaginary domain limits and their sample counts independently. Quality presets select common densities; editing a sample count switches to Custom.
- Domain coloring uses cyclic phase for hue and a logarithmic or linear magnitude transform for brightness. Contrast, saturation, and contour accents can be adjusted under Appearance & Color.
- Orbit with left drag, pan with middle drag, zoom with the wheel, double-click to refit, and use the Top / Front / Side / Fit controls. Switch between perspective and orthographic projection in the camera toolbar.
- Hover a graph or a visible surface point to inspect its input, complex output, magnitude, and argument.
- Save/load JSON visualization configurations; export sampled values as CSV; save a viewport screenshot as PNG.

## Architecture

```text
React controls
  ├─ expression / domain / quality / visual mappings
  └─ preview → final sample jobs
      ├─ Math.js expression parser and complex evaluator (sampling.worker.ts)
      ├─ uniform real/complex domain sampler (sampling.worker.ts)
      ├─ mapping, domain colors, and discontinuity-aware triangle assembly (Renderers.tsx)
      └─ Canvas 2D plots or Three.js WebGL surface
```

- `src/mathExpression.ts` normalizes common LaTeX and notation such as `\\frac`, `\\sqrt`, `\\sin`, `|z|`, and the common `iy` shorthand. The evaluator itself remains Math.js rather than a custom expression parser.
- `src/sampling.worker.ts` parses and compiles the user function, samples the domain off the UI thread, and returns typed arrays. Each new job terminates the old worker. A low-resolution preview is sent first, then replaced by the selected quality result.
- `src/Renderers.tsx` converts samples into 2D canvas plots or colored WebGL geometry. Invalid values and triangles with large neighboring output jumps are omitted so surfaces do not bridge poles and undefined regions.
- `src/App.tsx` owns UI state, sampling jobs, saved configurations, interaction inspection, and exports.

## Extending it

Add notation rewrites in `normalizeExpression` only where they are unambiguous, and rely on Math.js for expression syntax and function evaluation. Add new scalar quantities to the mapping type and `quantity` in `Renderers.tsx`, then expose them in the axis selector. New render modes can consume the same `RenderSample` values without changing the evaluator. The existing `t` input provides a path to a time slider or animation controller.

## Current scope

This is a visualization engine rather than a CAS. Sampling is uniform; quality changes progressively refine the entire grid, and discontinuities are handled with finite-value filtering and local triangle rejection. Automatic adaptive subdivision, parametric and implicit surfaces, volumetric rendering, animation controls, and direct 3D mesh-file export are not implemented yet. The surface renderer is GPU-backed, while arbitrary user expressions are evaluated on the CPU in a worker because Math.js functions cannot be compiled safely into general GLSL shaders.
