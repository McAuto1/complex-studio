import { useEffect } from 'react';
import { BookOpen, X } from 'lucide-react';
import { INFO_CONTENT } from './infoContent';

export function InformationPanel({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="info-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="info-dialog" role="dialog" aria-modal="true" aria-labelledby="info-title">
        <header className="info-dialog-header">
          <div className="info-dialog-icon"><BookOpen size={17} /></div>
          <div><h2 id="info-title">Complex Studio Reference</h2><span>Version {INFO_CONTENT.version}</span></div>
          <button className="icon-btn" aria-label="Close information" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="info-dialog-content">
          <p>{INFO_CONTENT.about}</p>

          <section>
            <h3>Getting Started</h3>
            <p>Complex Studio is an interactive workbench for exploring mathematical functions visually. Enter a function in the top left <strong>f(z)</strong> field, and the engine automatically evaluates it over a defined domain. Switch between 2D mode (for Cartesian plots and domain coloring) and 3D mode (for rendering complex surfaces).</p>
          </section>

          <section>
            <h3>Expressions / Math</h3>
            <p>The visual math editor supports standard structural notation. You can enter:</p>
            <ul>
              <li><strong>Basic arithmetic:</strong> <code>+</code>, <code>-</code>, <code>*</code>, <code>/</code>, <code>^</code> (powers)</li>
              <li><strong>Functions:</strong> <code>sin(z)</code>, <code>cos(z)</code>, <code>tan(z)</code>, <code>exp(z)</code>, <code>ln(z)</code>, <code>log(z)</code></li>
              <li><strong>Hyperbolic:</strong> <code>sinh(z)</code>, <code>cosh(z)</code>, <code>tanh(z)</code></li>
              <li><strong>Advanced:</strong> <code>gamma(z)</code>, square roots</li>
              <li><strong>Complex numbers:</strong> Use <code>i</code> for the imaginary unit (e.g., <code>z^2 + i</code>)</li>
              <li><strong>Constants:</strong> Use <code>pi</code> (or π), <code>e</code></li>
            </ul>
          </section>

          <section>
            <h3>Math Editor</h3>
            <p>The built-in editor provides a structured environment for math:</p>
            <ul>
              <li>Fractions and square roots auto-expand as you type.</li>
              <li>Use parentheses <code>()</code> to explicitly group operations.</li>
              <li>Use the <strong>Backspace</strong> key to logically unwrap structures (e.g., deleting a fraction removes the fraction block but preserves its numerator and denominator where possible).</li>
              <li>Use the on-screen function keyboard to quickly insert structures.</li>
            </ul>
          </section>

          <section>
            <h3>2D Visualization</h3>
            <p>In 2D mode, you can plot functions in two ways:</p>
            <ul>
              <li><strong>Cartesian:</strong> Standard real-valued X/Y plotting (useful for functions like <code>sin(x)</code>).</li>
              <li><strong>Domain Coloring:</strong> Plots complex functions on a flat plane.</li>
              <li><strong>Navigation:</strong> Use the Domain panel to manually set minimum/maximum bounds, or pan and zoom interactively.</li>
            </ul>
          </section>

          <section>
            <h3>3D Visualization</h3>
            <p>3D mode renders the function as a continuous surface. The rendering engine separates critical discontinuities and singularities to ensure a clean surface without asymptotic artifacts. Use the Robust Fit mode to prevent vertical spikes from breaking the camera view.</p>
          </section>

          <section>
            <h3>Complex / Domain Coloring</h3>
            <p>In domain coloring, every point in the 2D or 3D domain is assigned a color representing the complex output of the function. The <strong>hue</strong> (color) corresponds to the function's phase (angle), and the <strong>lightness/brightness</strong> indicates the magnitude (absolute value). This allows you to perceive all 4 dimensions (real/imaginary input and real/imaginary output) simultaneously.</p>
          </section>

          <section>
            <h3>Projects</h3>
            <p>You can save your current function, viewport, and settings as a local <code>.cstudio</code> project file by clicking the <strong>Save Project</strong> icon. You can also export the current sample data as a CSV file or capture the current viewport as a PNG screenshot.</p>
          </section>

          <section>
            <h3>Examples</h3>
            <p>Use the Examples catalog in the left panel to instantly load interesting Real and Complex functions and see how they are structured.</p>
          </section>

          <section>
            <h3>Account</h3>
            <p>The account system is currently used for sign-in and establishes the foundation for future cloud project syncing and extended capabilities. There are no paid features at this time.</p>
          </section>

          <section>
            <h3>Acknowledgements</h3>
            <ul>
              {INFO_CONTENT.acknowledgements.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}
