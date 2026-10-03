import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { all, create } from 'mathjs';
import { Auth } from './Auth';
import {
  Activity, Box, Check, ChevronDown, CircleHelp, Code2, Download, Expand, Shrink,
  Eye, Grid2X2, ImageDown, Info, LoaderCircle, Maximize2, MousePointer2,
  RotateCcw, Save, Settings2, Sparkles, Upload,
} from 'lucide-react';
import { EXAMPLES, normalizeExpression } from './mathExpression';
import { Plot2D, Surface3D, type CameraView, type PlotMode, type RenderSample } from './Renderers';
import type { SampleMessage } from './sampling.worker';
import { InformationPanel } from './InformationPanel';
import { MathEditor, MathStatic } from './MathEditor';
import { DEFAULT_CONFIG, deserializeProject, serializeProject, type AppConfig, type DisplayOptions, type FitMode, type Mapping, type Quality } from './project';

const math = create(all, { predictable: true });
const QUALITY: Record<Exclude<Quality, 'Custom'>, { surface: number; domain: number }> = {
  'Very Low': { surface: 44, domain: 96 }, Low: { surface: 68, domain: 160 },
  Medium: { surface: 104, domain: 256 }, High: { surface: 152, domain: 384 }, 'Very High': { surface: 200, domain: 512 },
};
const QUANTITIES: { value: Mapping; label: string }[] = [
  { value: 'inputRe', label: 'Re(z)' }, { value: 'inputIm', label: 'Im(z)' },
  { value: 'outputRe', label: 'Re(f)' }, { value: 'outputIm', label: 'Im(f)' },
  { value: 'magnitude', label: '|f(z)|' }, { value: 'phase', label: 'arg(f)' },
];
function download(filename: string, content: string | Blob) {
  const url = URL.createObjectURL(typeof content === 'string' ? new Blob([content], { type: 'application/json' }) : content);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function fmt(n: number) { return Number.isFinite(n) ? Number(n.toPrecision(5)).toString() : 'undefined'; }

export default function App() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [autoRender3D, setAutoRender3D] = useState(true);

  const activeD = useMemo(() => {
    if (config.dimension === '2D') return config.plotMode === 'cartesian' ? config.cartesian2DDomain : config.complex2DDomain;
    return config.plotMode === 'cartesian' ? config.cartesian3DDomain : config.complex3DDomain;
  }, [config.dimension, config.plotMode, config.cartesian2DDomain, config.complex2DDomain, config.cartesian3DDomain, config.complex3DDomain]);

  const updateActiveDomain = useCallback((overrides: Partial<{ xmin: number; xmax: number; ymin: number; ymax: number }>) => {
    setConfig(prev => {
      const key = prev.dimension === '2D' ? (prev.plotMode === 'cartesian' ? 'cartesian2DDomain' : 'complex2DDomain') : (prev.plotMode === 'cartesian' ? 'cartesian3DDomain' : 'complex3DDomain');
      return { ...prev, [key]: { ...prev[key], ...overrides } };
    });
  }, []);
  const [expression, setExpression] = useState(DEFAULT_CONFIG.expression);
  const [sample, setSample] = useState<RenderSample | null>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Ready');
  const [hover, setHover] = useState<{ x: number; y: number; re: number; im: number } | null>(null);
  const [cameraView, setCameraView] = useState<CameraView>({ kind: 'default', key: 0 });
  const [details, setDetails] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fitRequest, setFitRequest] = useState(0);
  const [cameraRestoreRequest, setCameraRestoreRequest] = useState(0);
  const loadInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceCaptureRef = useRef<(() => string | null) | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const renderAreaRef = useRef<HTMLDivElement>(null);
  const [exampleGroup, setExampleGroup] = useState('Complex');
  const [manualRender, setManualRender] = useState(false);
  const [domainStrs, setDomainStrs] = useState({
    xmin: String(DEFAULT_CONFIG.complex3DDomain.xmin),
    xmax: String(DEFAULT_CONFIG.complex3DDomain.xmax),
    ymin: String(DEFAULT_CONFIG.complex3DDomain.ymin),
    ymax: String(DEFAULT_CONFIG.complex3DDomain.ymax)
  });

  const update = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => setConfig((c) => ({ ...c, [key]: value }));
  const updateDomain = (key: 'xmin' | 'xmax' | 'ymin' | 'ymax', value: number) => updateActiveDomain({ [key]: value });
  const updateResolution = (key: keyof AppConfig['resolution'], value: number) => setConfig((c) => ({ ...c, quality: 'Custom', resolution: { ...c.resolution, [key]: Math.max(16, Math.min(1024, value)) } }));
  const updateAxis = (key: keyof AppConfig['axes'], value: Mapping) => setConfig((c) => ({ ...c, axes: { ...c.axes, [key]: value } }));
  const updateColor = (key: keyof AppConfig['color'], value: AppConfig['color'][keyof AppConfig['color']]) => setConfig((c) => ({ ...c, color: { ...c.color, [key]: value } }));
  const updateDisplay = (key: keyof DisplayOptions, value: boolean) => setConfig((c) => ({ ...c, display: { ...c.display, [key]: value } }));
  const updateManualY = (key: 'min' | 'max', value: number) => setConfig((c) => {
    if (!Number.isFinite(value)) return c;
    const next = { ...c.manualY, [key]: value };
    return next.min < next.max ? { ...c, manualY: next } : c;
  });

  useEffect(() => {
    const isCartesian = config.dimension === '2D' && config.plotMode === 'cartesian';
    const fmt = (v: number) => String(Number(v.toPrecision(5)));
    setDomainStrs({
      xmin: fmt(activeD.xmin),
      xmax: fmt(activeD.xmax),
      ymin: fmt(isCartesian ? config.manualY.min : activeD.ymin),
      ymax: fmt(isCartesian ? config.manualY.max : activeD.ymax)
    });
  }, [activeD.xmin, activeD.xmax, activeD.ymin, activeD.ymax, config.manualY.min, config.manualY.max, config.dimension, config.plotMode]);

  const handleDomainChange = (key: 'xmin' | 'xmax' | 'ymin' | 'ymax', val: string) => {
    setDomainStrs(s => ({ ...s, [key]: val }));
    if (!manualRender) {
      const num = Number(val);
      if (!isNaN(num) && val.trim() !== '' && val !== '-' && val !== '.') {
        const isCartesian = config.dimension === '2D' && config.plotMode === 'cartesian';
        if (isCartesian && (key === 'ymin' || key === 'ymax')) {
          setConfig(c => ({ ...c, fitMode: 'Manual', manualY: { ...c.manualY, [key === 'ymin' ? 'min' : 'max']: num } }));
        } else {
          updateDomain(key, num);
        }
      }
    }
  };

  const applyManualRender = () => {
    const isCartesian = config.dimension === '2D' && config.plotMode === 'cartesian';
    const xmin = Number(domainStrs.xmin) || activeD.xmin;
    const xmax = Number(domainStrs.xmax) || activeD.xmax;
    const ymin = Number(domainStrs.ymin) || (isCartesian ? config.manualY.min : activeD.ymin);
    const ymax = Number(domainStrs.ymax) || (isCartesian ? config.manualY.max : activeD.ymax);

    setConfig(c => {
      const d = c.dimension === '2D' ? (c.plotMode === 'cartesian' ? c.cartesian2DDomain : c.complex2DDomain) : (c.plotMode === 'cartesian' ? c.cartesian3DDomain : c.complex3DDomain);
      const domainKey = c.dimension === '2D' ? (c.plotMode === 'cartesian' ? 'cartesian2DDomain' : 'complex2DDomain') : (c.plotMode === 'cartesian' ? 'cartesian3DDomain' : 'complex3DDomain');
      const nextD = { ...d, xmin, xmax };
      if (isCartesian) {
        return { ...c, [domainKey]: nextD, fitMode: 'Manual', manualY: { min: ymin, max: ymax } };
      } else {
        nextD.ymin = ymin;
        nextD.ymax = ymax;
        return { ...c, [domainKey]: nextD };
      }
    });
  };

  useEffect(() => {
    const el = renderAreaRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (config.dimension !== '2D' || config.plotMode !== 'cartesian') return;
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const xCanvas = (e.clientX - rect.left) * dpr;
      const yCanvas = (e.clientY - rect.top) * dpr;
      const margin = { l: 62 * dpr, r: 24 * dpr, t: 26 * dpr, b: 48 * dpr };
      const width = rect.width * dpr;
      const height = rect.height * dpr;
      const pw = width - margin.l - margin.r;
      const ph = height - margin.t - margin.b;

      let mouseDataX = activeD.xmin + (activeD.xmax - activeD.xmin) / 2;
      if (xCanvas >= margin.l && xCanvas <= width - margin.r) {
        mouseDataX = activeD.xmin + (xCanvas - margin.l) / pw * (activeD.xmax - activeD.xmin);
      }

      let mouseDataY = config.manualY.min + (config.manualY.max - config.manualY.min) / 2;
      if (yCanvas >= margin.t && yCanvas <= height - margin.b) {
        mouseDataY = config.manualY.max - (yCanvas - margin.t) / ph * (config.manualY.max - config.manualY.min);
      }

      const newXmin = mouseDataX - (mouseDataX - activeD.xmin) * zoomFactor;
      const newXmax = mouseDataX + (activeD.xmax - mouseDataX) * zoomFactor;
      const newYmin = mouseDataY - (mouseDataY - config.manualY.min) * zoomFactor;
      const newYmax = mouseDataY + (config.manualY.max - mouseDataY) * zoomFactor;

      setConfig(c => {
        const d = c.dimension === '2D' ? (c.plotMode === 'cartesian' ? c.cartesian2DDomain : c.complex2DDomain) : (c.plotMode === 'cartesian' ? c.cartesian3DDomain : c.complex3DDomain);
        const domainKey = c.dimension === '2D' ? (c.plotMode === 'cartesian' ? 'cartesian2DDomain' : 'complex2DDomain') : (c.plotMode === 'cartesian' ? 'cartesian3DDomain' : 'complex3DDomain');
        return { ...c, [domainKey]: { ...d, xmin: newXmin, xmax: newXmax }, manualY: { min: newYmin, max: newYmax } };
      });
    };

    let isDragging = false;
    let lastX = 0; let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (config.dimension !== '2D' || config.plotMode !== 'cartesian') return;
      if (e.button !== 0) return;
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging || config.dimension !== '2D' || config.plotMode !== 'cartesian') return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      const rect = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = rect.width * dpr;
      const height = rect.height * dpr;
      const margin = { l: 62 * dpr, r: 24 * dpr, t: 26 * dpr, b: 48 * dpr };
      const pw = width - margin.l - margin.r;
      const ph = height - margin.t - margin.b;

      setConfig(c => {
        const d = c.dimension === '2D' ? (c.plotMode === 'cartesian' ? c.cartesian2DDomain : c.complex2DDomain) : (c.plotMode === 'cartesian' ? c.cartesian3DDomain : c.complex3DDomain);
        const domainKey = c.dimension === '2D' ? (c.plotMode === 'cartesian' ? 'cartesian2DDomain' : 'complex2DDomain') : (c.plotMode === 'cartesian' ? 'cartesian3DDomain' : 'complex3DDomain');
        const xRange = d.xmax - d.xmin;
        const xDelta = (dx * dpr / pw) * xRange;
        const yRange = c.manualY.max - c.manualY.min;
        const yDelta = (dy * dpr / ph) * yRange;
        return { ...c, fitMode: 'Manual', [domainKey]: { ...d, xmin: d.xmin - xDelta, xmax: d.xmax - xDelta }, manualY: { min: c.manualY.min + yDelta, max: c.manualY.max + yDelta } };
      });
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      el.releasePointerCapture(e.pointerId);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    };
  }, [config.dimension, config.plotMode, activeD, config.manualY]);

  const requestFit = () => { setFitRequest((value) => value + 1); setCameraView((view) => ({ kind: 'default', key: view.key + 1 })); };

  const render = useCallback(() => {
    const source = expression.trim();
    if (!source) { setError('Enter a function to render.'); return; }
    setError(''); setRendering(true); setStatus('Preparing preview…'); setHover(null);
    workerRef.current?.terminate();
    const worker = new Worker(new URL('./sampling.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    const isSurface = config.dimension === '3D';
    const mode = isSurface ? 'surface' : config.plotMode === 'cartesian' ? 'cartesian' : 'domain';
    const cap = config.quality === 'Custom' ? { surface: config.resolution.x, domain: config.resolution.x } : QUALITY[config.quality];
    const finalResolution = config.quality === 'Custom'
      ? { x: config.resolution.x, y: mode === 'cartesian' ? 1 : config.resolution.y }
      : { x: mode === 'surface' ? cap.surface : mode === 'cartesian' ? Math.max(400, cap.domain) : cap.domain, y: mode === 'cartesian' ? 1 : mode === 'surface' ? cap.surface : cap.domain };
    const previewResolution = mode === 'surface' ? { x: 36, y: 36 } : mode === 'cartesian' ? { x: 180, y: 1 } : { x: 96, y: 96 };
    let stage: 'preview' | 'final' = 'preview';
    let jobId = 1;
    const post = (resolution: number, resolutionY: number) => worker.postMessage({
      id: jobId++, expression: source, mode,
      xmin: activeD.xmin, xmax: activeD.xmax,
      ymin: activeD.ymin, ymax: activeD.ymax, resolution, resolutionY,
      enhance: mode === 'cartesian' && config.display.asymptoteEnhancement,
    });
    worker.onmessage = (event: MessageEvent<SampleMessage>) => {
      const message = event.data;
      if (message.type === 'error') {
        setError(message.message.replace(/^Error: ?/, '')); setStatus('Expression error'); setRendering(false); worker.terminate(); workerRef.current = null; return;
      }
      const frame: RenderSample = { ...message, mode, domain: { ...activeD }, expression: source, dataKey: JSON.stringify([source, activeD]) };
      setSample(frame);
      if (stage === 'preview' && (finalResolution.x !== previewResolution.x || finalResolution.y !== previewResolution.y)) {
        stage = 'final'; setStatus('Refining visualization…'); post(finalResolution.x, finalResolution.y);
      } else {
        setStatus(`${message.resolution.toLocaleString()} × ${message.rows.toLocaleString()} samples · ${mode === 'surface' ? 'surface' : mode === 'cartesian' ? 'curve' : 'domain'}`);
        setRendering(false); worker.terminate(); workerRef.current = null;
      }
    };
    worker.onerror = () => { setError('The expression could not be evaluated. Check the syntax and try again.'); setStatus('Expression error'); setRendering(false); worker.terminate(); workerRef.current = null; };
    post(previewResolution.x, previewResolution.y);
  }, [expression, config.dimension, config.plotMode, config.quality, activeD, config.resolution, config.display.asymptoteEnhancement]);

  // Every input change starts a new job. Cleanup terminates stale work immediately.
  useEffect(() => {
    if (config.dimension === '3D' && !autoRender3D) return;
    const timer = window.setTimeout(() => render(), 140);
    return () => { window.clearTimeout(timer); workerRef.current?.terminate(); workerRef.current = null; };
  }, [render, config.dimension, autoRender3D]);

  const compiled = useMemo(() => {
    try { return math.parse(normalizeExpression(expression)).compile(); } catch { return null; }
  }, [expression]);
  const inspect = useCallback((x: number, y: number) => {
    if (!compiled) return;
    try {
      const raw = compiled.evaluate({ x, y, t: 0, z: math.complex(x, y), i: math.complex(0, 1) });
      const out = math.isComplex(raw) ? raw : math.complex(raw as number);
      if (Number.isFinite(out.re) && Number.isFinite(out.im)) setHover({ x, y, re: out.re, im: out.im });
      else setHover(null);
    } catch { setHover(null); }
  }, [compiled]);

  const applyExample = (expr: string) => {
    setExpression(expr);
    if (exampleGroup === 'Real') {
      setConfig((c) => ({ ...c, dimension: expr.includes('y') ? '3D' : '2D', plotMode: expr.includes('y') ? 'domain' : 'cartesian', axes: { x: 'inputRe', y: 'inputIm', z: 'outputRe' } }));
    } else setConfig((c) => ({ ...c, dimension: '3D', plotMode: 'domain', axes: { x: 'inputRe', y: 'inputIm', z: 'outputRe' } }));
  };

  const save = () => download('complex-studio-project.cstudio', JSON.stringify(serializeProject({ ...config, expression }), null, 2));
  const load = async (file?: File) => {
    if (!file) return;
    try {
      const loaded: unknown = JSON.parse(await file.text());
      const project = deserializeProject(loaded);
      setConfig(project); setExpression(project.expression); setError('');
      if (project.camera) setCameraRestoreRequest((value) => value + 1);
      else setFitRequest((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read that project file.');
    }
  };

  const exportCsv = () => {
    if (!sample) return;
    const { resolution: n, rows: ny, re, im, valid } = sample;
    const rows = ['x,y,real,imaginary,magnitude,phase'];
    for (let j = 0; j < ny; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i; const x = sample.domain.xmin + (sample.domain.xmax - sample.domain.xmin) * i / Math.max(1, n - 1);
      const y = ny === 1 ? 0 : sample.domain.ymin + (sample.domain.ymax - sample.domain.ymin) * j / Math.max(1, ny - 1);
      rows.push(`${x},${y},${valid[k] ? re[k] : ''},${valid[k] ? im[k] : ''},${valid[k] ? Math.hypot(re[k], im[k]) : ''},${valid[k] ? Math.atan2(im[k], re[k]) : ''}`);
    }
    download('complex-studio-data.csv', new Blob([rows.join('\n')], { type: 'text/csv' }));
  };
  const screenshot = () => {
    const source = config.dimension === '3D' ? surfaceCaptureRef.current?.() : canvasRef.current?.toDataURL('image/png');
    if (!source) return;
    const a = document.createElement('a'); a.href = source; a.download = 'complex-studio.png'; a.click();
  };

  const activeExamples = EXAMPLES.filter((e) => e.group === exampleGroup);
  const currentDataKey = JSON.stringify([expression, activeD]);
  const baseDensity = config.quality === 'Custom'
    ? config.resolution
    : { x: config.dimension === '3D' ? QUALITY[config.quality].surface : config.plotMode === 'cartesian' ? Math.max(400, QUALITY[config.quality].domain) : QUALITY[config.quality].domain, y: config.dimension === '3D' ? QUALITY[config.quality].surface : config.plotMode === 'cartesian' ? 1 : QUALITY[config.quality].domain };
  const magnitude = hover ? Math.hypot(hover.re, hover.im) : 0;
  const phase = hover ? Math.atan2(hover.im, hover.re) : 0;
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Activity size={17} strokeWidth={2.4} /></div><div><strong>Complex Studio</strong><span>MATHEMATICAL VISUALIZER</span></div></div>
      <div className="topbar-center"><span className="live-dot" /> INTERACTIVE LAB <span className="topbar-divider" /> <span className="topbar-muted">COMPLEX ANALYSIS</span></div>
      <div className="top-actions">
          <Auth />
        <button className="icon-btn" title="Save Project (.cstudio)" aria-label="Save Project" onClick={save}><Save size={15} /></button>
        <button className="icon-btn" title="Open Project (.cstudio or legacy JSON)" aria-label="Open Project" onClick={() => loadInput.current?.click()}><Upload size={15} /></button>
        <button className="icon-btn" title="Export sample data as CSV" onClick={exportCsv}><Download size={15} /></button>
        <button className="icon-btn" title="Save screenshot" onClick={screenshot}><ImageDown size={15} /></button>
        <button className="icon-btn" title="About and announcements" aria-label="About Complex Studio" onClick={() => setInfoOpen(true)}><Info size={15} /></button>
        <input ref={loadInput} type="file" accept="application/json,.json,.cstudio" hidden onChange={(e) => { void load(e.target.files?.[0]); e.currentTarget.value = ''; }} />
      </div>
    </header>

    <div className="workspace">
      <aside className="sidebar">
        <div className="side-scroll">
          <section className="control-section function-section">
            <div className="section-heading"><span className="section-index">01</span><span>FUNCTION</span><button className="tiny-help" title="Use math notation like sin(z), z^2, exp(z), or LaTeX such as \frac{1}{z}"><CircleHelp size={14} /></button></div>
            <label className="field-label" htmlFor="function-input">f(z) <span>COMPLEX → COMPLEX</span></label>
            <MathEditor value={expression} onChange={setExpression} onEnter={() => void render()} />
            {error && <div className="error-message"><Info size={13} /> <span>{error}</span></div>}

              {config.dimension === '3D' && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', color: '#8895a7' }}>
                    <input type="checkbox" checked={autoRender3D} onChange={(e) => setAutoRender3D(e.target.checked)} />
                    Automatic rendering
                  </label>
                  {!autoRender3D && (
                    <button style={{ alignSelf: 'flex-start', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }} onClick={() => void render()}>Render 3D</button>
                  )}
                </div>
              )}
            <div className="examples-label"><span>EXAMPLES</span><div className="segmented mini-segments"><button className={exampleGroup === 'Complex' ? 'selected' : ''} onClick={() => setExampleGroup('Complex')}>Complex</button><button className={exampleGroup === 'Real' ? 'selected' : ''} onClick={() => setExampleGroup('Real')}>Real</button></div></div>
            <div className="example-chips">{activeExamples.map((item) => <button key={item.expression} title={item.label} className={expression === item.expression ? 'active' : ''} onClick={() => applyExample(item.expression)}><MathStatic expression={item.expression} /></button>)}</div>
          </section>

          <section className="control-section">
            <div className="section-heading"><span className="section-index">02</span><span>VISUALIZATION</span></div>
            <div className="segmented view-segments"><button className={config.dimension === '2D' ? 'selected' : ''} onClick={() => update('dimension', '2D')}><Grid2X2 size={14} /> 2D</button><button className={config.dimension === '3D' ? 'selected' : ''} onClick={() => update('dimension', '3D')}><Box size={14} /> 3D</button></div>
            {config.dimension === '2D' && <label className="select-row mode-select"><span>View</span><select value={config.plotMode} onChange={(e) => update('plotMode', e.target.value as PlotMode)}><option value="cartesian">Cartesian graph</option><option value="domain">Domain coloring</option><option value="magnitude">Magnitude heatmap</option><option value="phase">Phase coloring</option><option value="contours">Contour map</option><option value="vector">Complex vector field</option></select><ChevronDown size={14} /></label>}
            {config.dimension === '3D' ? <>
              <div className="mapping-title"><span>SPATIAL MAPPING</span><span className="mapping-note">Choose what each axis shows</span></div>
              <div className="mapping-grid">
                {(['x', 'y', 'z'] as const).map((axis) => <label className="mapping-row" key={axis}><span className={`axis-token axis-${axis}`}>{axis.toUpperCase()}</span><select value={config.axes[axis]} onChange={(e) => updateAxis(axis, e.target.value as Mapping)}>{QUANTITIES.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}</select><ChevronDown size={12} /></label>)}
              </div>
            </> : <div className="mode-description"><Sparkles size={14} /> {config.plotMode === 'cartesian' ? 'Plotting Re(f) along the real axis' : config.plotMode === 'vector' ? 'Output values shown as complex vector arrows' : 'Complex input mapped to color and intensity'}</div>}
          </section>

          <section className="control-section">
            <div className="section-heading"><span className="section-index">03</span><span>DOMAIN</span><button className="reset-domain" title="Reset domain" onClick={() => updateActiveDomain(DEFAULT_CONFIG.complex3DDomain)}><RotateCcw size={13} /></button></div>
            <div className="domain-grid">
              {config.dimension === '2D' && config.plotMode === 'cartesian' ? (
                <><span className="domain-name">X</span><input aria-label="X minimum" type="number" step="0.5" value={domainStrs.xmin} onChange={(e) => handleDomainChange('xmin', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { applyManualRender(); void render(); } }} /><span className="domain-to">to</span><input aria-label="X maximum" type="number" step="0.5" value={domainStrs.xmax} onChange={(e) => handleDomainChange('xmax', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { applyManualRender(); void render(); } }} /><span className="domain-name">Y</span><input aria-label="Y minimum" type="number" step="0.5" value={domainStrs.ymin} onChange={(e) => handleDomainChange('ymin', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { applyManualRender(); void render(); } }} /><span className="domain-to">to</span><input aria-label="Y maximum" type="number" step="0.5" value={domainStrs.ymax} onChange={(e) => handleDomainChange('ymax', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { applyManualRender(); void render(); } }} /></>
              ) : (
                <><span className="domain-name">Re(z)</span><input aria-label="Real minimum" type="number" step="0.5" value={domainStrs.xmin} onChange={(e) => handleDomainChange('xmin', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { applyManualRender(); void render(); } }} /><span className="domain-to">to</span><input aria-label="Real maximum" type="number" step="0.5" value={domainStrs.xmax} onChange={(e) => handleDomainChange('xmax', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { applyManualRender(); void render(); } }} /><span className="domain-name">Im(z)</span><input aria-label="Imaginary minimum" type="number" step="0.5" value={domainStrs.ymin} onChange={(e) => handleDomainChange('ymin', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { applyManualRender(); void render(); } }} /><span className="domain-to">to</span><input aria-label="Imaginary maximum" type="number" step="0.5" value={domainStrs.ymax} onChange={(e) => handleDomainChange('ymax', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { applyManualRender(); void render(); } }} /></>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', fontSize: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#8895a7', cursor: 'pointer' }}><input type="checkbox" checked={manualRender} onChange={(e) => setManualRender(e.target.checked)} /> Manual Render</label>
              {manualRender && <button style={{ background: '#252d38', border: 'none', color: '#fff', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }} onClick={() => { applyManualRender(); void render(); }}>Render</button>}
            </div>
            <div className="density-grid"><label><span>Samples · Re</span><input aria-label="Real axis sample count" type="number" min="16" max="1024" value={baseDensity.x} onChange={(e) => updateResolution('x', Number(e.target.value))} /></label><label><span>Samples · Im</span><input aria-label="Imaginary axis sample count" type="number" min="16" max="1024" value={baseDensity.y} disabled={config.dimension === '2D' && config.plotMode === 'cartesian'} onChange={(e) => updateResolution('y', Number(e.target.value))} /></label></div>
          </section>

          <section className="control-section quality-section">
            <div className="section-heading"><span className="section-index">04</span><span>RENDER QUALITY</span><span className="gpu-pill"><Sparkles size={10} /> GPU</span></div>
            <label className="select-row"><span>Quality</span><select value={config.quality} onChange={(e) => update('quality', e.target.value as Quality)}>{Object.keys(QUALITY).map((q) => <option key={q}>{q}</option>)}<option>Custom</option></select><ChevronDown size={14} /></label>
            <div className="quality-scale"><span>PREVIEW</span><span>DETAIL</span></div><input className="quality-range" type="range" min="1" max="5" value={config.quality === 'Custom' ? 3 : Object.keys(QUALITY).indexOf(config.quality) + 1} onChange={(e) => update('quality', Object.keys(QUALITY)[Number(e.target.value) - 1] as Quality)} />
            <div className="quality-foot"><span><span className="green-dot" /> Progressive preview</span><span>{config.quality === 'Custom' ? 'Custom' : `${QUALITY[config.quality].surface} × ${QUALITY[config.quality].surface}`}</span></div>
          </section>

          <section className="control-section appearance-section">
            <button className="appearance-toggle" aria-expanded={details} onClick={() => setDetails((v) => !v)}><span><Settings2 size={14} /> DISPLAY & FIT</span><ChevronDown size={14} className={details ? 'rotate' : ''} /></button>
            {details && <div className="appearance-options">
              <label className="select-row compact-setting" title="Robust fitting limits outlier-driven ranges; All includes the complete finite range"><span>Auto fit</span><select value={config.fitMode} onChange={(e) => update('fitMode', e.target.value as FitMode)}><option>Robust</option><option>All</option><option>Manual</option></select><ChevronDown size={14} /></label>
              {config.fitMode === 'Manual' && config.dimension === '2D' && config.plotMode === 'cartesian' && <div className="manual-range"><label>Y min<input aria-label="Manual vertical minimum" type="number" value={config.manualY.min} onChange={(e) => updateManualY('min', Number(e.target.value))} /></label><label>Y max<input aria-label="Manual vertical maximum" type="number" value={config.manualY.max} onChange={(e) => updateManualY('max', Number(e.target.value))} /></label></div>}
              {config.fitMode === 'Manual' && config.dimension === '3D' && <label className="range-label manual-distance" title="Camera distance from the fitted surface center">Camera distance <input type="number" min="1" max="100000" value={config.manualCameraDistance} onChange={(e) => update('manualCameraDistance', Math.max(1, Number(e.target.value) || 1))} /></label>}
              {config.dimension === '2D' ? <div className="color-options display-options">
                <label title="Show the plot reference grid"><input type="checkbox" checked={config.display.show2DGrid} onChange={(e) => updateDisplay('show2DGrid', e.target.checked)} /> Show grid</label>
                <label title="Show tick marks, values, and axis labels"><input type="checkbox" checked={config.display.show2DLabels} onChange={(e) => updateDisplay('show2DLabels', e.target.checked)} /> Labels & ticks</label>
                <label title="Show the phase and magnitude color key"><input type="checkbox" checked={config.display.show2DLegend} onChange={(e) => updateDisplay('show2DLegend', e.target.checked)} /> Color legend</label>
                {config.plotMode === 'cartesian' && <label title="Evaluate extra real samples around likely jumps or asymptotes"><input type="checkbox" checked={config.display.asymptoteEnhancement} onChange={(e) => updateDisplay('asymptoteEnhancement', e.target.checked)} /> Asymptote enhancement</label>}
              </div> : <div className="color-options display-options">
                <label title="Show the coordinate axes"><input type="checkbox" checked={config.display.show3DAxes} onChange={(e) => updateDisplay('show3DAxes', e.target.checked)} /> Show axes</label>
                <label title="Show the floor reference grid"><input type="checkbox" checked={config.display.show3DGrid} onChange={(e) => updateDisplay('show3DGrid', e.target.checked)} /> Show grid</label>
                <label title="Show the mapped X, Y, and Z labels"><input type="checkbox" checked={config.display.show3DAxisLabels} onChange={(e) => updateDisplay('show3DAxisLabels', e.target.checked)} /> Axis labels</label>
                <label title="Show the colored surface"><input type="checkbox" checked={config.display.show3DSurface} onChange={(e) => updateDisplay('show3DSurface', e.target.checked)} /> Surface</label>
                <label title="Overlay triangle edges on the surface"><input type="checkbox" checked={config.display.show3DWireframe} onChange={(e) => updateDisplay('show3DWireframe', e.target.checked)} /> Wireframe</label>
                <label title="Show the phase and magnitude color key"><input type="checkbox" checked={config.display.show3DLegend} onChange={(e) => updateDisplay('show3DLegend', e.target.checked)} /> Color legend</label>
              </div>}
              <div className="color-options color-toggles"><label><input type="checkbox" checked={config.color.logMagnitude} onChange={(e) => updateColor('logMagnitude', e.target.checked)} /> Log magnitude</label><label><input type="checkbox" checked={config.color.contours} onChange={(e) => updateColor('contours', e.target.checked)} /> Contour bands</label></div>
              <label className="range-label">Contrast <input type="range" min="0.4" max="2.8" step="0.1" value={config.color.contrast} onChange={(e) => updateColor('contrast', Number(e.target.value))} /></label>
              <label className="range-label">Saturation <input type="range" min="0" max="1" step="0.05" value={config.color.saturation} onChange={(e) => updateColor('saturation', Number(e.target.value))} /></label>
            </div>}
          </section>
          <div className="sidebar-footer"><span>Built for complex analysis</span><button title="Math syntax and notation" onClick={() => setDetails(true)}><Code2 size={13} /> Syntax</button></div>
        </div>
      </aside>

      <main className={`viewport-shell ${expanded ? 'viewport-expanded' : ''}`}>
        <div className="viewport-toolbar"><div className="viewport-title"><span className="viewport-symbol">{config.dimension === '3D' ? 'ℂ' : 'ℝ'}</span><div><strong>{config.dimension === '3D' ? 'Complex surface' : config.plotMode === 'cartesian' ? 'Cartesian graph' : config.plotMode === 'vector' ? 'Complex vector field' : 'Complex domain'}</strong><span>{expression || 'No function'} <b>·</b> {config.dimension === '3D' ? `${QUANTITIES.find((q) => q.value === config.axes.x)?.label} × ${QUANTITIES.find((q) => q.value === config.axes.y)?.label} → ${QUANTITIES.find((q) => q.value === config.axes.z)?.label}` : config.plotMode}</span></div></div>
          <div className="toolbar-right"><span className={`render-state ${rendering ? 'is-rendering' : ''}`}>{rendering ? <LoaderCircle size={13} className="spin" /> : <span className="state-check"><Check size={10} /></span>}{status}</span><button className="fit-btn" title={expanded ? "Restore viewport" : "Expand viewport"} onClick={() => setExpanded(!expanded)}>{expanded ? <Shrink size={14} /> : <Expand size={14} />}<span>{expanded ? 'Restore' : 'Fullscreen'}</span></button><button className="fit-btn" title="Fit the current visualization using the selected fit policy" onClick={requestFit}><Maximize2 size={14} /><span>Fit view</span></button></div>
        </div>
        <div className="viewport-content">
          <div className="render-area" ref={renderAreaRef}>
            {config.dimension === '3D' ? <Surface3D sample={sample?.mode === 'surface' ? sample : null} axes={config.axes} color={config.color} display={config.display} camera={config.camera} projection={config.projection} cameraView={cameraView} fitMode={config.fitMode} manualCameraDistance={config.manualCameraDistance} dataKey={currentDataKey} fitRequest={fitRequest} cameraRestoreRequest={cameraRestoreRequest} onCamera={(camera) => update('camera', camera)} onInspect={inspect} onLeave={() => setHover(null)} onReset={() => requestFit()} onCapture={(fn) => { surfaceCaptureRef.current = fn; }} /> : <Plot2D ref={canvasRef} sample={sample && sample.mode !== 'surface' ? sample : null} plotMode={config.plotMode} color={config.color} display={config.display} fitMode={config.fitMode} manualY={config.manualY} viewDomain={activeD} onInspect={inspect} onLeave={() => setHover(null)} />}
            {error && <div className="render-error"><div className="error-orbit">!</div><strong>Unable to render expression</strong><span>{error}</span><button onClick={() => { setError(''); void render(); }}>Try again</button></div>}
            {!sample && !error && <div className="render-loading"><LoaderCircle size={22} className="spin" /><span>Preparing your visualization</span></div>}
            {((config.dimension === '2D' && config.display.show2DLegend && config.plotMode !== 'cartesian') || (config.dimension === '3D' && config.display.show3DLegend)) && <div className="legend-panel"><div className="legend-head"><span>DOMAIN COLORING</span><span className="legend-circled">i</span></div><div className="phase-wheel"><div className="phase-wheel-center">arg<br /><small>f(z)</small></div></div><div className="legend-caption"><span>−π</span><div className="magnitude-ramp" /><span>π</span></div><div className="magnitude-legend"><span>0</span><div className="mag-bar" /><span>∞</span></div><div className="legend-foot"><span>Hue = phase</span><span>Lightness = magnitude</span></div></div>}
            {hover && <div className="inspect-card"><div className="inspect-head"><MousePointer2 size={12} /><span>POINT INSPECTOR</span></div><div className="inspect-row"><span>z</span><strong>{fmt(hover.x)} {hover.y < 0 ? '−' : '+'} {fmt(Math.abs(hover.y))}i</strong></div><div className="inspect-row"><span>f(z)</span><strong>{fmt(hover.re)} {hover.im < 0 ? '−' : '+'} {fmt(Math.abs(hover.im))}i</strong></div><div className="inspect-separator" /><div className="inspect-pairs"><div><span>MAGNITUDE</span><strong>{fmt(magnitude)}</strong></div><div><span>ARGUMENT</span><strong>{fmt(phase)} <small>rad</small></strong></div></div></div>}
            <div className="viewport-bottom-left"><span className="bottom-chip"><Eye size={12} /> {config.dimension === '3D' ? 'Orbit · Pan · Zoom' : 'Move cursor to inspect'}</span><span className="bottom-chip"><span className="green-dot" /> {config.quality}</span></div>
            {config.dimension === '3D' && <div className="camera-tools"><button title="Top view" onClick={() => setCameraView({ kind: 'top', key: cameraView.key + 1 })}>TOP</button><button title="Front view" onClick={() => setCameraView({ kind: 'front', key: cameraView.key + 1 })}>FRONT</button><button title="Side view" onClick={() => setCameraView({ kind: 'side', key: cameraView.key + 1 })}>SIDE</button><span /><button title="Toggle perspective / orthographic projection" className="projection-btn" onClick={() => update('projection', config.projection === 'perspective' ? 'orthographic' : 'perspective')}>{config.projection === 'perspective' ? 'PERSP' : 'ORTHO'}</button><span /><button title="Reset view" onClick={() => setCameraView({ kind: 'default', key: cameraView.key + 1 })}><RotateCcw size={13} /></button></div>}
          </div>
        </div>
        <footer className="statusbar"><span><span className="green-dot" /> {rendering ? 'Computing samples in background' : 'Ready'}</span><span className="status-right"><span>ℂ → ℂ</span><b>·</b><span>{sample ? `${sample.resolution.toLocaleString()} × ${sample.rows.toLocaleString()}` : '—'}</span><b>·</b><span>{config.dimension === '3D' ? 'WebGL' : 'Canvas 2D'}</span></span></footer>
      </main>
    </div>
    {infoOpen && <InformationPanel onClose={() => setInfoOpen(false)} />}
  </div>;
}
