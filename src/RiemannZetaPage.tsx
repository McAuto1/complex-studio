import { useState, useRef } from 'react';
import CinematicScene, { CinematicSceneRef, SceneConfig } from './cinematic/CinematicScene';
import { CANONICAL_RIEMANN_ZETA_CONFIG } from './cinematic/zetaCanonicalConfig';
import { Link } from './router';
import { SiteHeader, SiteFooter } from './App';
import { Sparkles, Maximize2, RotateCcw, ArrowRight, Compass, ShieldAlert, Cpu } from 'lucide-react';

// Explicit conversion from canonical configuration source of truth to SceneConfig
export const ZETA_EXPLORER_CONFIG: SceneConfig = {
  expression: CANONICAL_RIEMANN_ZETA_CONFIG.mathematical.expression,
  heightMode: CANONICAL_RIEMANN_ZETA_CONFIG.mathematical.heightMode,
  heightScale: CANONICAL_RIEMANN_ZETA_CONFIG.mathematical.heightScale,
  resolutionX: CANONICAL_RIEMANN_ZETA_CONFIG.mathematical.customResX,
  resolutionZ: CANONICAL_RIEMANN_ZETA_CONFIG.mathematical.customResZ,
  heightLimitMode: CANONICAL_RIEMANN_ZETA_CONFIG.mathematical.heightLimitMode,
  customHeightLimit: CANONICAL_RIEMANN_ZETA_CONFIG.mathematical.customHeightLimit,
  surfaceColor: CANONICAL_RIEMANN_ZETA_CONFIG.appearance.surfaceColor,
  colorMode: CANONICAL_RIEMANN_ZETA_CONFIG.appearance.colorMode,
  lightBrightness: CANONICAL_RIEMANN_ZETA_CONFIG.appearance.lightBrightness,
  atmosphere: CANONICAL_RIEMANN_ZETA_CONFIG.appearance.atmosphere,
  showWrappedGrid: CANONICAL_RIEMANN_ZETA_CONFIG.presentation.showWrappedGrid,
  wrappedGridDensity: CANONICAL_RIEMANN_ZETA_CONFIG.presentation.wrappedGridDensity,
  showCriticalLine: CANONICAL_RIEMANN_ZETA_CONFIG.presentation.showCriticalLine,
  showCriticalStrip: CANONICAL_RIEMANN_ZETA_CONFIG.presentation.showCriticalStrip,
  showKnownZeros: CANONICAL_RIEMANN_ZETA_CONFIG.presentation.showKnownZeros,
  domain: CANONICAL_RIEMANN_ZETA_CONFIG.mathematical.domain,
};

export default function RiemannZetaPage() {
  const [isActivated, setIsActivated] = useState(false);
  const sceneRef = useRef<CinematicSceneRef>(null);

  const handleActivate = () => {
    setIsActivated(true);
    const stageEl = document.getElementById('zeta-viewport-stage');
    if (stageEl) {
      stageEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleResetCamera = () => {
    if (sceneRef.current) {
      sceneRef.current.setCameraState({
        mode: CANONICAL_RIEMANN_ZETA_CONFIG.camera.mode,
        position: CANONICAL_RIEMANN_ZETA_CONFIG.camera.position,
        target: CANONICAL_RIEMANN_ZETA_CONFIG.camera.target,
        zoom: CANONICAL_RIEMANN_ZETA_CONFIG.camera.zoom,
      });
    }
  };

  return (
    <div className="site-page zeta-page">
      <SiteHeader />

      <main className="site-main zeta-main">
        {/* 1. HERO SECTION */}
        <div className="zeta-hero">
          <div className="zeta-hero-eyebrow">
            <Compass size={15} />
            <span>Analytical Number Theory & Complex Analysis</span>
          </div>
          <h1 className="zeta-hero-title">Riemann Zeta Function — Interactive 3D Visualization</h1>
          <p className="zeta-hero-lead">
            Complex Studio visualizes the complex Riemann zeta function &zeta;(s) as an illuminated three-dimensional landscape.
            By projecting its logarithmic magnitude ln(|&zeta;(s)|) across the complex plane, nontrivial zeros reveal themselves
            as profound valleys alongside the critical strip, while the fundamental pole at s = 1 rises as an asymptotic peak.
          </p>

          <div className="zeta-hero-actions">
            {!isActivated ? (
              <button
                className="btn-primary zeta-cta-btn"
                onClick={handleActivate}
                aria-label="Explore the Riemann Zeta Function 3D visualization"
              >
                <Sparkles size={16} />
                <span>Explore the Riemann Zeta Function</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <div className="zeta-activated-badge">
                <span className="live-dot" />
                <span>Cinematic 3D Renderer Active (463 &times; 8000 resolution)</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. INTERACTIVE RENDERER STAGE */}
        <section id="zeta-viewport-stage" className="zeta-stage-container">
          <div className="zeta-viewport-shell">
            {isActivated ? (
              <>
                <CinematicScene
                  ref={sceneRef}
                  config={ZETA_EXPLORER_CONFIG}
                  cameraMode={CANONICAL_RIEMANN_ZETA_CONFIG.camera.mode}
                  wireframe={CANONICAL_RIEMANN_ZETA_CONFIG.appearance.wireframe}
                  showGrid={CANONICAL_RIEMANN_ZETA_CONFIG.presentation.showGrid}
                  showAxes={CANONICAL_RIEMANN_ZETA_CONFIG.presentation.showAxes}
                  showNumericLabels={CANONICAL_RIEMANN_ZETA_CONFIG.presentation.showNumericLabels}
                  showAxisLabels={CANONICAL_RIEMANN_ZETA_CONFIG.presentation.showAxisLabels}
                  labelsAlwaysVisible={CANONICAL_RIEMANN_ZETA_CONFIG.presentation.labelsAlwaysVisible}
                  numericLabelSize={CANONICAL_RIEMANN_ZETA_CONFIG.presentation.numericLabelSize}
                  axisTitleSize={CANONICAL_RIEMANN_ZETA_CONFIG.presentation.axisTitleSize}
                  tickSpacingMode={CANONICAL_RIEMANN_ZETA_CONFIG.presentation.tickSpacingMode}
                  manualTickStep={CANONICAL_RIEMANN_ZETA_CONFIG.presentation.manualTickStep}
                  axisRatio={[
                    CANONICAL_RIEMANN_ZETA_CONFIG.presentation.customRatio.re,
                    CANONICAL_RIEMANN_ZETA_CONFIG.presentation.customRatio.height,
                    CANONICAL_RIEMANN_ZETA_CONFIG.presentation.customRatio.im,
                  ]}
                  groundMagnitudeAtZero={CANONICAL_RIEMANN_ZETA_CONFIG.presentation.groundMagnitudeAtZero}
                  initialCamera={{
                    position: CANONICAL_RIEMANN_ZETA_CONFIG.camera.position,
                    target: CANONICAL_RIEMANN_ZETA_CONFIG.camera.target,
                    zoom: CANONICAL_RIEMANN_ZETA_CONFIG.camera.zoom,
                  }}
                />
                <div className="zeta-viewport-overlay">
                  <div className="zeta-overlay-legend">
                    <span className="legend-title">Mapping: h(s) = ln|&zeta;(s)|</span>
                    <span className="legend-strip">Critical Line: Re(s) = 1/2</span>
                  </div>
                  <div className="zeta-overlay-controls">
                    <button
                      className="zeta-tool-btn"
                      onClick={handleResetCamera}
                      title="Reset Camera to Zeta Preset"
                      aria-label="Reset camera orientation"
                    >
                      <RotateCcw size={14} />
                      <span>Reset View</span>
                    </button>
                    <Link
                      href="/cinematic"
                      className="zeta-tool-btn"
                      title="Open in full Cinematic workspace for custom lighting & 4K export"
                    >
                      <Maximize2 size={14} />
                      <span>Studio Controls</span>
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <div className="zeta-placeholder-backdrop">
                <img
                  src="/ComplexStudioBackground.jpg"
                  alt="Riemann Zeta Function Landscape Preview"
                  className="zeta-preview-bg"
                />
                <div className="zeta-placeholder-content">
                  <div className="placeholder-badge">
                    <Cpu size={14} />
                    <span>On-Demand High-Fidelity Geometry</span>
                  </div>
                  <h3>High-Resolution Analytic Mesh</h3>
                  <p>
                    Rendering this surface computes over 3.7 million complex evaluations across &sigma; &isin; [&minus;7, 0.501] and
                    t &isin; [&minus;65, 65]. To ensure an immediate page load and respect your device&apos;s CPU/GPU, the WebGL scene is
                    initialized on demand.
                  </p>
                  <button
                    className="btn-primary zeta-cta-btn"
                    onClick={handleActivate}
                    aria-label="Explore the Riemann Zeta Function"
                  >
                    <Sparkles size={16} />
                    <span>Explore the Riemann Zeta Function</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
          {isActivated && (
            <div className="zeta-stage-caption">
              <span>Interactive Controls: Left-drag to Orbit • Right-drag to Pan • Scroll to Zoom</span>
            </div>
          )}
        </section>

        {/* 3. MATHEMATICAL EXPLANATION SECTIONS */}
        <div className="zeta-article-body">
          {/* SECTION: WHAT IS THE RIEMANN ZETA FUNCTION? */}
          <section className="zeta-section">
            <h2>What is the Riemann Zeta Function?</h2>
            <p>
              The Riemann zeta function, denoted as &zeta;(s), is a fundamental complex-valued function of a complex
              variable s = &sigma; + it. Originally studied by Leonhard Euler for real values, Bernhard Riemann extended the function
              to the entire complex plane in his landmark 1859 paper.
            </p>
            <p>
              For Re(s) &gt; 1, &zeta;(s) is defined by the absolutely convergent Dirichlet series and Euler product over primes:
            </p>
            <div className="zeta-equation-block">
              &zeta;(s) = &sum;<sub>n=1</sub><sup>&infin;</sup> 1 / n<sup>s</sup> = &prod;<sub>p prime</sub> (1 &minus; p<sup>&minus;s</sup>)<sup>&minus;1</sup>
            </div>
            <p>
              This direct connection to the primes establishes &zeta;(s) as the core cornerstone of modern analytic number theory.
              Through analytic continuation and Riemann&apos;s functional reflection equation, &zeta;(s) is extended meromorphically to the entire complex plane
              with a single simple pole at s = 1 having residue 1.
            </p>
          </section>

          {/* SECTION: THE CRITICAL STRIP AND ZEROS */}
          <section className="zeta-section">
            <h2>The Critical Strip and the Nontrivial Zeros</h2>
            <p>
              The zeros of &zeta;(s) partition into two fundamentally distinct categories:
            </p>
            <ul className="zeta-bullets">
              <li>
                <strong>Trivial Zeros:</strong> Located on the negative real axis at the negative even integers:
                s = &minus;2, &minus;4, &minus;6, &hellip;. These arise naturally from the poles of the gamma factor in Riemann&apos;s functional equation.
              </li>
              <li>
                <strong>Nontrivial Zeros:</strong> All other zeros lie strictly within the <strong>critical strip</strong> defined by:
                <div className="zeta-equation-inline">0 &lt; Re(s) &lt; 1</div>
              </li>
            </ul>
            <p>
              The vertical symmetry line bisecting this strip, Re(s) = 1/2, is called the <strong>critical line</strong>.
              The famous <strong>Riemann Hypothesis</strong> conjectures that <em>all</em> nontrivial zeros lie precisely on this critical line.
              The distribution of these zeros dictates the error term in the Prime Number Theorem and governs the fluctuations of primes.
            </p>
          </section>

          {/* SECTION: HOW THE 3D VISUALIZATION WORKS */}
          <section className="zeta-section">
            <h2>How the 3D Visualization Works: Logarithmic Magnitude</h2>
            <p>
              Directly plotting the raw magnitude |&zeta;(s)| is visually ineffective because the function exhibits vast dynamic
              ranges—it blows up toward infinity at the pole s = 1 and fluctuates by orders of magnitude along the imaginary direction t,
              causing most details to flatten against the coordinate floor.
            </p>
            <p>
              To make the landscape legible, Complex Studio applies a logarithmic magnitude transformation:
            </p>
            <div className="zeta-equation-block">
              h(s) = ln(|&zeta;(s)|)
            </div>
            <p>
              This visualization mapping yields clear mathematical interpretations:
            </p>
            <div className="zeta-mapping-grid">
              <div className="mapping-card">
                <strong>|&zeta;(s)| &gt; 1</strong>
                <span>Produces positive elevation (h &gt; 0), highlighting peaks and asymptotic growth.</span>
              </div>
              <div className="mapping-card">
                <strong>|&zeta;(s)| = 1</strong>
                <span>Maps exactly to the zero-elevation baseline plane (h = 0).</span>
              </div>
              <div className="mapping-card">
                <strong>|&zeta;(s)| &rarr; 0 (Zeros)</strong>
                <span>
                  As |&zeta;(s)| approaches zero, ln(|&zeta;(s)|) &rarr; &minus;&infin;. Nontrivial zeros appear as dramatic, canyon-like valleys.
                </span>
              </div>
              <div className="mapping-card">
                <strong>s &rarr; 1 (Pole)</strong>
                <span>
                  The pole approaches +&infin;, capped smoothly by custom height limits to preserve surrounding topological relief.
                </span>
              </div>
            </div>
            <p className="zeta-subtext">
              Note: This transformation is purely a visual coordinate mapping for spatial comprehension. The underlying values and complex argument
              arg(&zeta;(s)) (rendered through cyclic hue coloring) remain mathematically authentic.
            </p>
          </section>

          {/* SECTION: IMPORTANT DISCLAIMER */}
          <section className="zeta-disclaimer-box">
            <div className="disclaimer-header">
              <ShieldAlert size={18} className="icon-warning" />
              <h3>Mathematical Scope & Educational Disclaimer</h3>
            </div>
            <p>
              This 3D visualizer is an interactive exploratory and pedagogical instrument designed to provide qualitative intuition
              and geometric insight into the topology of the Riemann zeta function. It computes high-precision numerical approximations
              via Borwein's algorithm and analytic reflection. <strong>It does not prove or disprove the Riemann Hypothesis.</strong>
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
