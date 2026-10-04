import { useState, useEffect } from 'react';
import CinematicPage from './cinematic/CinematicPage';
import Calculator from './Calculator';
import { useLocation, Link } from './router';
import { Navigation } from './Navigation';
import { Auth } from './Auth';
import { Activity, Sparkles, Compass, Box, Layers, ArrowRight } from 'lucide-react';
import { EXAMPLES } from './mathExpression';
import { MathStatic } from './MathEditor';

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-brand">
        <Link href="/home" className="site-brand-link">
          <div className="site-brand-mark"><Activity size={17} strokeWidth={2.4} /></div>
          <div className="site-brand-text">
            <strong>Complex Studio</strong>
            <span>MATHEMATICAL VISUALIZER</span>
          </div>
        </Link>
      </div>
      <div className="site-header-nav" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Auth />
        <Navigation className="site-nav" />
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <div className="site-brand-mark"><Activity size={15} strokeWidth={2.4} /></div>
          <div className="site-brand-text">
            <strong>Complex Studio</strong>
            <span>MATHEMATICAL VISUALIZER</span>
          </div>
        </div>
        <div className="footer-bottom-note">
          <span>© {new Date().getFullYear()} Complex Studio — Interactive Visualizer for Real and Complex Functions</span>
        </div>
      </div>
    </footer>
  );
}

function LandingPage() {
  const highlighted = EXAMPLES.filter(e => e.highlight);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    // Check if user prefers reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    let ticking = false;
    const handleScroll = () => {
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(currentScroll);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Run once on mount in case already scrolled
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Compute smooth, visible scroll kinematics
  const maxScroll = 450;
  const progress = Math.min(Math.max(scrollY / maxScroll, 0), 1);
  const imageOpacity = Math.max(1 - progress * 0.75, 0.25);
  const contentOpacity = Math.max(1 - progress * 0.9, 0.1);
  const imageTranslateY = scrollY * 0.12;
  const contentTranslateY = -(scrollY * 0.22);
  const imageScale = 1 + progress * 0.04;

  return (
    <div className="site-page">
      <SiteHeader />
      
      {/* HERO SECTION */}
      <main className="site-main hero-main">
        <div className="hero-stage">
          <div 
            className="hero-image-wrapper"
            style={{
              opacity: imageOpacity,
              transform: `translate3d(0, ${imageTranslateY}px, 0) scale(${imageScale})`
            }}
          >
            <img 
              src="/ComplexStudioBackground.jpg" 
              alt="Riemann Zeta Landscape with Coordinate Grid" 
              className="hero-full-img"
            />
            <div className="hero-image-overlay" />
          </div>

          <div 
            className="hero-content"
            style={{
              opacity: contentOpacity,
              transform: `translate3d(0, ${contentTranslateY}px, 0)`
            }}
          >
            <div className="hero-eyebrow-badge">
              <span className="badge-dot" />
              <span className="badge-text">The function behind a million dollar problem</span>
            </div>
            <h1 className="hero-title">
              SEE WHAT<br />
              EQUATIONS LOOK LIKE.
            </h1>
            <p className="hero-subtitle">
              Turn mathematical formulas into interactive 2D graphs and 3D landscapes.<br />
              Explore zeros, poles, phase color palettes, and geometric manifolds.
            </p>
            <div className="hero-actions">
              <Link href="/cinematic" className="btn-primary hero-btn-cinematic">
                <Sparkles size={16} strokeWidth={2.2} />
                <span>Open Cinematic 3D</span>
              </Link>
              <Link href="/calculator" className="btn-secondary">
                Launch Calculator
              </Link>
              <Link href="/explore" className="btn-tertiary">
                Browse Examples
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* DEDICATED CINEMATIC SECTION */}
      <section className="home-cinematic-section">
        <div className="cinematic-feature-card">
          <div className="cinematic-feature-text">
            <div className="feature-eyebrow">
              <Box size={14} />
              <span>Cinematic 3D Renderer</span>
            </div>
            <h2>See mathematics as a 3D landscape.</h2>
            <p>
              Cinematic turns complex functions into interactive surfaces you can orbit, light, and explore. 
              See where a function rises toward poles, descends into valleys, changes phase color, or crosses zero — all while keeping the underlying mathematical coordinates visible.
            </p>
            <div className="cinematic-feature-badges">
              <span className="mini-badge">Directional Studio Lighting</span>
              <span className="mini-badge">Continuous Phase Palettes</span>
              <span className="mini-badge">Custom Axis Aspect Ratios</span>
              <span className="mini-badge">Log-Polar Reference Grid</span>
              <span className="mini-badge">Riemann Zeta Showcase</span>
            </div>
            <div className="cinematic-feature-actions">
              <Link href="/cinematic" className="btn-primary hero-btn-cinematic">
                <Sparkles size={16} />
                <span>Explore in Cinematic</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
          <div className="cinematic-feature-preview">
            <div className="preview-mesh-card">
              <div className="preview-header">
                <span className="formula-tag">z ↦ f(z)</span>
                <span className="status-live">Interactive 3D</span>
              </div>
              <div className="preview-details">
                <div className="stat-row">
                  <span className="label">Height Mapping</span>
                  <span className="val">Magnitude |f(z)|, Re(f), or Im(f)</span>
                </div>
                <div className="stat-row">
                  <span className="label">Color Encoding</span>
                  <span className="val">Phase Angle arg(f(z))</span>
                </div>
                <div className="stat-row">
                  <span className="label">Navigation</span>
                  <span className="val">Free Orbit, Zoom & Pan</span>
                </div>
                <div className="stat-row">
                  <span className="label">Grid Reference</span>
                  <span className="val">Log-Polar Coordinate Sheet</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THINGS WORTH EXPLORING */}
      <section className="home-examples-section">
        <div className="explore-header">
          <div className="section-eyebrow">Interactive Gallery</div>
          <h2>Things worth exploring</h2>
          <p>Hand-picked functions displaying remarkable geometry, branches, and singular behavior.</p>
        </div>
        <div className="site-examples-grid">
          {highlighted.map((item) => (
            <Link key={item.expression} href={`/calculator?expr=${encodeURIComponent(item.expression)}`} className="site-example-card">
              <div className="example-card-math"><MathStatic expression={item.expression} /></div>
              <div className="example-card-title">{item.title}</div>
              <div className="example-card-desc">{item.description}</div>
              <div className="example-card-footer">
                <span>Open in Calculator</span>
                <ArrowRight size={13} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* WHAT MAKES THIS INTERESTING */}
      <section className="home-why-section">
        <div className="why-box">
          <h3>Why explore functions visually?</h3>
          <p>
            Equations often hide dramatic structures that formulas alone make hard to imagine. 
            Complex Studio lets you see branch cuts, isolated poles, saddles, and zeros directly on the screen. 
            Inspect functions in the interactive Calculator, or view them as lit 3D landscapes in Cinematic.
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function ExplorePage() {
  const complexExamples = EXAMPLES.filter(e => e.group === 'Complex');
  const realExamples = EXAMPLES.filter(e => e.group === 'Real');

  return (
    <div className="site-page">
      <SiteHeader />
      <main className="site-main explore-main">
        {/* Explore Hero Banner */}
        <div className="explore-hero-card">
          <div className="explore-hero-content">
            <div className="explore-eyebrow">
              <Compass size={15} />
              <span>Curated Catalog</span>
            </div>
            <h1>Explore Mathematical Landscapes</h1>
            <p>
              Select any function to inspect its shape in the interactive Calculator or render it as an illuminated 3D surface in Cinematic.
            </p>
          </div>
          <div className="explore-hero-featured">
            <div className="featured-card">
              <div className="featured-tag">★ Flagship Showcase</div>
              <h3>Riemann Zeta Function ζ(s)</h3>
              <p>The mathematical landscape at the heart of the million-dollar Riemann Hypothesis.</p>
              <div className="featured-actions">
                <Link href="/cinematic" className="btn-primary hero-btn-cinematic">
                  <span>Open ζ(z) in Cinematic</span>
                  <ArrowRight size={14} />
                </Link>
                <Link href="/calculator?expr=zeta(z)" className="btn-secondary">
                  <span>Open in Calculator</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Complex Functions */}
        <div className="explore-section">
          <div className="explore-section-header">
            <div className="header-icon-title">
              <Layers size={18} className="icon-emerald" />
              <h2>Complex Plane Functions</h2>
            </div>
            <p>Maps from ℂ to ℂ displaying magnitude surfaces and continuous phase coloring.</p>
          </div>
          <div className="site-examples-grid">
            {complexExamples.map((item) => (
              <Link key={item.expression} href={`/calculator?expr=${encodeURIComponent(item.expression)}`} className="site-example-card">
                <div className="example-card-math"><MathStatic expression={item.expression} /></div>
                <div className="example-card-title">{item.title || item.label}</div>
                <div className="example-card-desc">{item.description}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Section: Real Functions */}
        <div className="explore-section" style={{ marginTop: '48px' }}>
          <div className="explore-section-header">
            <div className="header-icon-title">
              <Box size={18} className="icon-emerald" />
              <h2>Real-Valued Curves</h2>
            </div>
            <p>Classical functions f(x): ℝ → ℝ on the standard Cartesian plane.</p>
          </div>
          <div className="site-examples-grid">
            {realExamples.map((item) => (
              <Link key={item.expression} href={`/calculator?expr=${encodeURIComponent(item.expression)}`} className="site-example-card">
                <div className="example-card-math"><MathStatic expression={item.expression} /></div>
                <div className="example-card-title">{item.title || item.label}</div>
                <div className="example-card-desc">{item.description}</div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function AboutPage() {
  return (
    <div className="site-page">
      <SiteHeader />
      <main className="site-main about-main">
        <div className="about-card">
          <h2>About Complex Studio</h2>
          <p className="lead">
            Complex Studio is a mathematical visualizer built to make difficult functions easier to see.
          </p>
          <p>
            Instead of stopping at an algebraic equation, you can explore its shape, magnitude, phase, zeros, and singularities directly on your screen. 
            Calculator gives you an interactive 2D and 3D mathematical canvas, while Cinematic transforms functions into illuminated 3D landscapes with customizable lighting and reference coordinates.
          </p>
          <div className="about-grid">
            <div className="about-feature">
              <strong>Interactive Calculator</strong>
              <span>Fast formula parsing, 2D Cartesian and domain coloring views, 3D surface plots, and point inspection under your cursor.</span>
            </div>
            <div className="about-feature">
              <strong>Cinematic 3D Renderer</strong>
              <span>Orbitable 3D meshes with studio lighting, log-polar wrapped grids, analytic height limits, and high-resolution PNG export.</span>
            </div>
          </div>
          <div className="about-version">
            <span>Complex Studio • Mathematical Visualizer</span>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function App() {
  const [fullPath] = useLocation();
  const pathname = fullPath.split('?')[0];

  if (pathname === '/' || pathname === '' || pathname === '/home') return <LandingPage />;
  if (pathname === '/explore') return <ExplorePage />;
  if (pathname === '/cinematic') return <CinematicPage />;
  if (pathname === '/about') return <AboutPage />;
  if (pathname === '/calculator') return <Calculator />;

  return <LandingPage />;
}
