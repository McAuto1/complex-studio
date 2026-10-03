import Calculator from './Calculator';
import { useLocation, Link } from './router';
import { Activity } from 'lucide-react';
import { EXAMPLES } from './mathExpression';
import { MathStatic } from './MathEditor';

function SiteHeader() {
  const [path] = useLocation();
  return (
    <header className="site-header">
      <div className="site-brand">
        <Link href="/" className="site-brand-link">
          <div className="site-brand-mark"><Activity size={17} strokeWidth={2.4} /></div>
          <div className="site-brand-text"><strong>Complex Studio</strong><span>MATHEMATICAL VISUALIZER</span></div>
        </Link>
      </div>
      <div className="site-nav">
        <Link href="/explore" className={path === '/explore' ? 'active' : ''}>Explore</Link>
        <Link href="/calculator" className={path === '/calculator' ? 'active' : ''}>Calculator</Link>
        <Link href="/about" className={path === '/about' ? 'active' : ''}>About</Link>
      </div>
    </header>
  );
}

function LandingPage() {
  const highlighted = EXAMPLES.filter(e => e.highlight);
  return (
    <div className="site-page">
      <SiteHeader />
      <main className="site-main hero-main">
        <div className="hero-content">
          <div className="hero-eyebrow">The function behind a $1M problem.<br/><span style={{fontSize: "11px", color: "#aab8c5", fontWeight: 400, letterSpacing: "1px"}}>Explore the Riemann zeta function.</span></div>
          <h1>SEE WHAT<br />EQUATIONS LOOK LIKE.</h1>
          <p>Turn mathematical functions into<br />interactive 2D and 3D worlds.</p>
          <div className="hero-actions">
            <Link href="/explore" className="btn-primary">Explore</Link>
            <Link href="/calculator" className="btn-secondary">Open Calculator</Link>
          </div>
        </div>
      </main>

      <section className="home-examples-section">
        <div className="explore-header">
          <h2>Things worth exploring</h2>
        </div>
        <div className="site-examples-grid">
          {highlighted.map((item) => (
            <Link key={item.expression} href={`/calculator?expr=${encodeURIComponent(item.expression)}`} className="site-example-card">
              <div className="example-card-math"><MathStatic expression={item.expression} /></div>
              <div className="example-card-title">{item.title}</div>
              <div className="example-card-desc">{item.description}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-why-section">
        <h3>Why this is interesting</h3>
        <p>Equations can hide structures that are difficult to imagine from the formula alone. Complex Studio lets you see them.</p>
      </section>
    </div>
  );
}

function ExplorePage() {
  const highlighted = EXAMPLES.filter(e => e.highlight);
  return (
    <div className="site-page">
      <SiteHeader />
      <main className="site-main">
        <div className="explore-header">
          <h2>Things worth exploring</h2>
          <p>Show me interesting mathematical worlds.</p>
        </div>
        <div className="site-examples-grid">
          {highlighted.map((item) => (
            <Link key={item.expression} href={`/calculator?expr=${encodeURIComponent(item.expression)}`} className="site-example-card">
              <div className="example-card-math"><MathStatic expression={item.expression} /></div>
              <div className="example-card-title">{item.title}</div>
              <div className="example-card-desc">{item.description}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="site-page">
      <SiteHeader />
      <main className="site-main about-main">
        <h2>About Complex Studio</h2>
        <p>Complex Studio is a mathematical visualizer designed to turn equations into interactive 2D and 3D worlds.</p>
        <p>It allows you to explore functions using domain coloring, complex vector fields, and 3D surface mappings, helping to build an intuitive understanding of complex analysis.</p>
        <p>Current version: 1.0.1</p>
      </main>
    </div>
  );
}

export default function App() {
  const [path] = useLocation();

  if (path === '/') return <LandingPage />;
  if (path === '/explore') return <ExplorePage />;
  if (path === '/about') return <AboutPage />;
  if (path === '/calculator') return <Calculator />;

  return <LandingPage />;
}
