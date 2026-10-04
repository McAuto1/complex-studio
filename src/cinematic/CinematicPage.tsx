import { useState, useRef, useMemo } from 'react';
import { Activity, Save, Upload, Maximize2, RotateCcw } from 'lucide-react';
import { Link } from '../router';
import { Navigation } from '../Navigation';
import { Auth } from '../Auth';
import { MathStatic } from '../MathEditor';
import CinematicScene from './CinematicScene';
import { CANONICAL_RIEMANN_ZETA_CONFIG } from './zetaCanonicalConfig';

const EXAMPLES = ['z^z', 'sqrt(z)', 'sin(z)', '1/(z^2+1)', 'exp(z)', 'ζ(z)'];

function CinematicHeader() {
  return (
    <header className="topbar">
      <div className="brand">
        <Link href="/home" className="brand-link">
          <div className="brand-mark"><Activity size={17} strokeWidth={2.4} /></div>
          <div className="brand-text">
            <strong>Complex Studio</strong><span>MATHEMATICAL VISUALIZER</span>
          </div>
        </Link>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Auth />
        <Navigation className="site-nav" />
      </div>
    </header>
  );
}

export default function CinematicPage() {
  const [expression, setExpression] = useState('z^z');
  const [heightMode, setHeightMode] = useState<'mag' | 'real' | 'imag'>('mag');
  const [heightScale, setHeightScale] = useState(1.5);
  const [resolution, setResolution] = useState(100);

  const sceneRef = useRef<any>(null);
  const [useCustomRes, setUseCustomRes] = useState(false);
  const [customResX, setCustomResX] = useState<number | null>(100);
  const [customResZ, setCustomResZ] = useState<number | null>(100);
  const [heightLimitMode, setHeightLimitMode] = useState<'Auto' | 'Off' | 'Custom'>('Auto');
  const [customHeightLimit, setCustomHeightLimit] = useState<number | null>(10);
  const [renderError, setRenderError] = useState<string | null>(null);


  const [xMin, setXMin] = useState('-2');
  const [xMax, setXMax] = useState('2');
  const [zMin, setZMin] = useState('-2');
  const [zMax, setZMax] = useState('2');

  const recRes = useMemo(() => {
    const w = parseFloat(xMax) - parseFloat(xMin) || 4;
    const h = parseFloat(zMax) - parseFloat(zMin) || 4;
    const density = 25;
    let recX = Math.round(w * density);
    let recZ = Math.round(h * density);
    const MIN_RES = 20;
    const MAX_TOTAL = 400000;
    recX = Math.max(MIN_RES, recX);
    recZ = Math.max(MIN_RES, recZ);
    if (recX * recZ > MAX_TOTAL) {
      const scale = Math.sqrt(MAX_TOTAL / (recX * recZ));
      recX = Math.floor(recX * scale);
      recZ = Math.floor(recZ * scale);
    }
    return { x: recX, z: recZ };
  }, [xMin, xMax, zMin, zMax]);


  const [cameraMode, setCameraMode] = useState<'perspective' | 'orthographic'>('perspective');
  const [wireframe, setWireframe] = useState(false);

  const [surfaceColor, setSurfaceColor] = useState('#0f7a7a');
  const [colorMode, setColorMode] = useState<'solid' | 'palette'>('solid');
  const [lightBrightness, setLightBrightness] = useState(1.0);
  const [atmosphere, setAtmosphere] = useState(0.2);


  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showNumericLabels, setShowNumericLabels] = useState(true);
  const [showAxisLabels, setShowAxisLabels] = useState(false);
  const [labelsAlwaysVisible, setLabelsAlwaysVisible] = useState(false);
  const [groundMagnitudeAtZero, setGroundMagnitudeAtZero] = useState(true);
  const [showWrappedGrid, setShowWrappedGrid] = useState(false);
  const [wrappedGridDensity, setWrappedGridDensity] = useState<'Low' | 'Medium' | 'High'>('Low');
  const [showCriticalLine, setShowCriticalLine] = useState(false);
  const [showCriticalStrip, setShowCriticalStrip] = useState(false);
  const [showKnownZeros, setShowKnownZeros] = useState(false);

  const [numericLabelSize, setNumericLabelSize] = useState(0.008);
  const [axisTitleSize, setAxisTitleSize] = useState(0.012);
  const [tickSpacingMode, setTickSpacingMode] = useState<'auto' | 'manual'>('auto');
  const [manualTickStep, setManualTickStep] = useState<number | string>(1);

  const [axisRatioMode, setAxisRatioMode] = useState('default');
  const [customRatio, setCustomRatio] = useState<{ re: number | null; height: number | null; im: number | null }>({ re: 1, height: 1, im: 1 });

  const activeRatio: [number, number, number] = axisRatioMode === 'custom'
    ? [customRatio.re ?? 1, customRatio.height ?? 1, customRatio.im ?? 1]
    : [1, 1, 1];

  const [presentationOpen, setPresentationOpen] = useState(true);

  // Render state
  const [renderedConfig, setRenderedConfig] = useState({
    expression: 'z^z',
    heightMode: 'mag' as 'mag' | 'real' | 'imag',
    heightScale: 1.5,
    resolutionX: 100, resolutionZ: 100, heightLimitMode: 'Auto' as 'Auto' | 'Off' | 'Custom', customHeightLimit: 10 as number | null | undefined, surfaceColor: '#0f7a7a', colorMode: 'solid' as 'solid' | 'palette', lightBrightness: 1.0, atmosphere: 0.2,
    showWrappedGrid: false as boolean | undefined, wrappedGridDensity: 'Low' as 'Low' | 'Medium' | 'High' | undefined,
    showCriticalLine: false as boolean | undefined, showCriticalStrip: false as boolean | undefined, showKnownZeros: false as boolean | undefined,
    domain: { xMin: -2, xMax: 2, zMin: -2, zMax: 2 }
  });

  const [isRendering, setIsRendering] = useState(false);

  
  const handleExportPNG = (preset: string) => {
    if (!sceneRef.current) return;
    try {
      let w = undefined, h = undefined;
      if (preset === '1080p') { w = 1920; h = 1080; }
      else if (preset === '1440p') { w = 2560; h = 1440; }
      else if (preset === '4k') { w = 3840; h = 2160; }
      const dataUrl = sceneRef.current.exportPNG(w, h);
      if (dataUrl) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `cinematic_${preset}_${Date.now()}.png`;
        a.click();
      }
    } catch(e) {
      alert("Failed to export image. Resolution may be too high for this device.");
    }
  };

  const saveScene = () => {
    if (!sceneRef.current) return;
    const cameraState = sceneRef.current.getCameraState();
    const payload = {
      type: "complex-studio-cinematic",
      version: 1,
      mathematical: { expression, domain: { xMin, xMax, zMin, zMax }, heightMode, heightScale, resolution, useCustomRes, customResX, customResZ, heightLimitMode, customHeightLimit },
      presentation: {
        showGrid, showAxes, showNumericLabels, showAxisLabels, labelsAlwaysVisible,
        showWrappedGrid, wrappedGridDensity,
        showCriticalLine, showCriticalStrip, showKnownZeros,
        numericLabelSize, axisTitleSize, tickSpacingMode, manualTickStep, axisRatioMode, customRatio, groundMagnitudeAtZero
      },
      appearance: { wireframe, surfaceColor, colorMode, lightBrightness, atmosphere },
      camera: { mode: cameraMode, position: cameraState.position, target: cameraState.target, zoom: cameraState.zoom }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cinematic_scene_${Date.now()}.json`;
    a.click();
  };

  const loadScene = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.type !== 'complex-studio-cinematic') throw new Error("Invalid format");
        
        if (data.mathematical) {
          if (data.mathematical.expression) setExpression(data.mathematical.expression);
          if (data.mathematical.domain) {
            setXMin(String(data.mathematical.domain.xMin)); setXMax(String(data.mathematical.domain.xMax));
            setZMin(String(data.mathematical.domain.zMin)); setZMax(String(data.mathematical.domain.zMax));
          }
          if (data.mathematical.heightMode) setHeightMode(data.mathematical.heightMode);
          if (data.mathematical.heightScale) setHeightScale(data.mathematical.heightScale);
          if (data.mathematical.resolution) setResolution(data.mathematical.resolution);
          if (data.mathematical.useCustomRes !== undefined) setUseCustomRes(data.mathematical.useCustomRes);
          if (data.mathematical.customResX) setCustomResX(data.mathematical.customResX);
          if (data.mathematical.customResZ) setCustomResZ(data.mathematical.customResZ);
          if (data.mathematical.heightLimitMode) setHeightLimitMode(data.mathematical.heightLimitMode);
          if (data.mathematical.customHeightLimit !== undefined) setCustomHeightLimit(data.mathematical.customHeightLimit === null ? null : Number(data.mathematical.customHeightLimit));
          
          setRenderedConfig({
            expression: data.mathematical.expression || 'z^z',
            heightMode: data.mathematical.heightMode || 'mag',
            heightScale: data.mathematical.heightScale || 1.5,
            resolutionX: data.mathematical.useCustomRes ? (data.mathematical.customResX !== undefined ? data.mathematical.customResX : 100) : (data.mathematical.resolution || 100),
            resolutionZ: data.mathematical.useCustomRes ? (data.mathematical.customResZ !== undefined ? data.mathematical.customResZ : 100) : (data.mathematical.resolution || 100),
            heightLimitMode: data.mathematical.heightLimitMode || 'Auto',
            customHeightLimit: data.mathematical.customHeightLimit !== undefined ? data.mathematical.customHeightLimit : 10,
            surfaceColor: data.appearance?.surfaceColor || '#0f7a7a',
            colorMode: data.appearance?.colorMode || 'solid',
            lightBrightness: data.appearance?.lightBrightness !== undefined ? Number(data.appearance.lightBrightness) : 1.0,
            atmosphere: data.appearance?.atmosphere !== undefined ? Number(data.appearance.atmosphere) : 0.2,
            showWrappedGrid: !!data.presentation?.showWrappedGrid,
            wrappedGridDensity: data.presentation?.wrappedGridDensity || 'Low',
            showCriticalLine: !!data.presentation?.showCriticalLine,
            showCriticalStrip: !!data.presentation?.showCriticalStrip,
            showKnownZeros: !!data.presentation?.showKnownZeros,
            domain: {
              xMin: Number(data.mathematical.domain?.xMin || -2),
              xMax: Number(data.mathematical.domain?.xMax || 2),
              zMin: Number(data.mathematical.domain?.zMin || -2),
              zMax: Number(data.mathematical.domain?.zMax || 2)
            }
          });
        }
        
        if (data.presentation) {
          setShowGrid(!!data.presentation.showGrid); setShowAxes(!!data.presentation.showAxes);
          setShowNumericLabels(!!data.presentation.showNumericLabels); setShowAxisLabels(!!data.presentation.showAxisLabels);
          setLabelsAlwaysVisible(!!data.presentation.labelsAlwaysVisible);
          setShowCriticalLine(!!data.presentation.showCriticalLine);
          setShowCriticalStrip(!!data.presentation.showCriticalStrip);
          setShowKnownZeros(!!data.presentation.showKnownZeros);
          if (data.presentation.numericLabelSize) setNumericLabelSize(data.presentation.numericLabelSize);
          if (data.presentation.axisTitleSize) setAxisTitleSize(data.presentation.axisTitleSize);
          if (data.presentation.tickSpacingMode) setTickSpacingMode(data.presentation.tickSpacingMode);
          if (data.presentation.manualTickStep) setManualTickStep(data.presentation.manualTickStep);
          if (data.presentation.axisRatioMode) setAxisRatioMode(data.presentation.axisRatioMode);
          if (data.presentation.customRatio) setCustomRatio(data.presentation.customRatio);
          if (data.presentation.groundMagnitudeAtZero !== undefined) setGroundMagnitudeAtZero(!!data.presentation.groundMagnitudeAtZero);
        }
        if (data.appearance) {
          setWireframe(!!data.appearance.wireframe);
          if (data.appearance.surfaceColor) setSurfaceColor(data.appearance.surfaceColor);
          if (data.appearance.colorMode) setColorMode(data.appearance.colorMode);
          if (data.appearance.lightBrightness !== undefined) setLightBrightness(Number(data.appearance.lightBrightness));
          if (data.appearance.atmosphere !== undefined) setAtmosphere(Number(data.appearance.atmosphere));
        }
        if (data.camera) {
          if (data.camera.mode) setCameraMode(data.camera.mode);
          setTimeout(() => { if (sceneRef.current) sceneRef.current.setCameraState(data.camera); }, 100);
        }
      } catch(err) {
        alert("Failed to load scene.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRender = () => {
    if (heightLimitMode === 'Custom' && customHeightLimit === null) {
      setRenderError('Enter a value before rendering.');
      return;
    }
    if (useCustomRes && (customResX === null || customResZ === null)) {
      setRenderError('Enter a value before rendering.');
      return;
    }
    if (axisRatioMode === 'custom' && (customRatio.re === null || customRatio.height === null || customRatio.im === null)) {
      setRenderError('Enter a value before rendering.');
      return;
    }
    setRenderError(null);
    setIsRendering(true);
    setTimeout(() => {
      const safeParse = (str: string, fallback: number) => {
        const val = parseFloat(str);
        if (isNaN(val) || !isFinite(val)) return fallback;
        return val;
      };

      const finalXMin = safeParse(xMin, renderedConfig.domain.xMin);
      let finalXMax = safeParse(xMax, renderedConfig.domain.xMax);
      const finalZMin = safeParse(zMin, renderedConfig.domain.zMin);
      let finalZMax = safeParse(zMax, renderedConfig.domain.zMax);

      if (finalXMin >= finalXMax) finalXMax = finalXMin + 1;
      if (finalZMin >= finalZMax) finalZMax = finalZMin + 1;

      setXMin(finalXMin.toString());
      setXMax(finalXMax.toString());
      setZMin(finalZMin.toString());
      setZMax(finalZMax.toString());

      setRenderedConfig({
        expression,
        heightMode,
        heightScale,
        resolutionX: useCustomRes ? customResX! : resolution,
        resolutionZ: useCustomRes ? customResZ! : resolution,
        heightLimitMode,
        customHeightLimit,
        surfaceColor,
        colorMode,
        lightBrightness,
        atmosphere,
        showWrappedGrid,
        wrappedGridDensity,
        showCriticalLine,
        showCriticalStrip,
        showKnownZeros,
        domain: { xMin: finalXMin, xMax: finalXMax, zMin: finalZMin, zMax: finalZMax }
      });
      setIsRendering(false);
    }, 10);
  };

  const handleZetaPreset = () => {
    setIsRendering(true);
    const { mathematical: m, presentation: p, appearance: a, camera: cam } = CANONICAL_RIEMANN_ZETA_CONFIG;

    setExpression(m.expression);
    setXMin(String(m.domain.xMin));
    setXMax(String(m.domain.xMax));
    setZMin(String(m.domain.zMin));
    setZMax(String(m.domain.zMax));
    setHeightMode(m.heightMode);
    setHeightScale(m.heightScale);
    setResolution(m.resolution);
    setUseCustomRes(m.useCustomRes);
    setCustomResX(m.customResX);
    setCustomResZ(m.customResZ);
    setHeightLimitMode(m.heightLimitMode);
    setCustomHeightLimit(m.customHeightLimit);

    setShowGrid(p.showGrid);
    setShowAxes(p.showAxes);
    setShowNumericLabels(p.showNumericLabels);
    setShowAxisLabels(p.showAxisLabels);
    setLabelsAlwaysVisible(p.labelsAlwaysVisible);
    setShowWrappedGrid(p.showWrappedGrid);
    setWrappedGridDensity(p.wrappedGridDensity);
    setShowCriticalLine(p.showCriticalLine);
    setShowCriticalStrip(p.showCriticalStrip);
    setShowKnownZeros(p.showKnownZeros);
    setNumericLabelSize(p.numericLabelSize);
    setAxisTitleSize(p.axisTitleSize);
    setTickSpacingMode(p.tickSpacingMode);
    setManualTickStep(p.manualTickStep);
    setAxisRatioMode(p.axisRatioMode);
    setCustomRatio(p.customRatio);
    setGroundMagnitudeAtZero(p.groundMagnitudeAtZero);

    setWireframe(a.wireframe);
    setSurfaceColor(a.surfaceColor);
    setColorMode(a.colorMode);
    setLightBrightness(a.lightBrightness);
    setAtmosphere(a.atmosphere);
    setCameraMode(cam.mode);

    setRenderedConfig({
      expression: m.expression,
      heightMode: m.heightMode,
      heightScale: m.heightScale,
      resolutionX: m.customResX,
      resolutionZ: m.customResZ,
      heightLimitMode: m.heightLimitMode,
      customHeightLimit: m.customHeightLimit,
      surfaceColor: a.surfaceColor,
      colorMode: a.colorMode,
      lightBrightness: a.lightBrightness,
      atmosphere: a.atmosphere,
      showWrappedGrid: p.showWrappedGrid,
      wrappedGridDensity: p.wrappedGridDensity,
      showCriticalLine: p.showCriticalLine,
      showCriticalStrip: p.showCriticalStrip,
      showKnownZeros: p.showKnownZeros,
      domain: m.domain
    });

    setTimeout(() => {
      sceneRef.current?.setCameraState({
        mode: cam.mode,
        position: cam.position,
        target: cam.target,
        zoom: cam.zoom
      });
      setIsRendering(false);
    }, 60);
  };

  return (
    <div className="site-page cinematic-page" style={{ height: '100vh', overflow: 'hidden' }}>
      <CinematicHeader />
      <div className="workspace">
        {/* Controls Sidebar */}
        <aside className="sidebar"><div className="side-scroll">
          
          {/* File I/O */}
          <div className="control-section" style={{ display: 'flex', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid #1a202a' }}>
            <button className="icon-btn" onClick={saveScene} title="Save Scene" style={{ flex: 1, padding: '6px', background: '#0e1117', border: '1px solid #292f3a', borderRadius: '4px', color: '#a0abbf', display: 'flex', justifyContent: 'center', gap: '6px', fontSize: '10px' }}><Save size={13} /> Save</button>
            <label className="icon-btn" title="Load Scene" style={{ flex: 1, padding: '6px', background: '#0e1117', border: '1px solid #292f3a', borderRadius: '4px', color: '#a0abbf', display: 'flex', justifyContent: 'center', gap: '6px', fontSize: '10px', cursor: 'pointer' }}>
              <Upload size={13} /> Load
              <input type="file" accept=".json" onChange={loadScene} style={{ display: 'none' }} />
            </label>
          </div>

          {/* Function */}
          <div className="control-section">
            <div className="section-heading">Function</div>
            <div className="function-input-wrap">
              <input
                type="text"
                value={expression}
                onChange={e => setExpression(e.target.value)}
                className="function-input"
              />
            </div>
            <div className="example-chips">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => setExpression(ex === 'ζ(z)' ? 'zeta(z)' : ex)}>
                  <MathStatic expression={ex} />
                </button>
              ))}
            </div>
            <div style={{ marginTop: '10px' }}>
              <button
                onClick={handleZetaPreset}
                disabled={isRendering}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  background: '#1b302d',
                  border: '1px solid #37675a',
                  borderRadius: '4px',
                  color: '#d2f7e9',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: isRendering ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: 'inset 0 0 0 1px #37675a, 0 0 14px rgba(116, 223, 182, 0.35)',
                  opacity: isRendering ? 0.7 : 1
                }}
              >
                <span>✦ {isRendering ? 'this might take a while...' : 'Render ζ(z)'}</span>
              </button>
            </div>
          </div>

          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '12px' }}>
            {renderError && (
              <div style={{ color: '#f87171', fontSize: '11px', textAlign: 'center', marginBottom: '6px' }}>
                {renderError}
              </div>
            )}
            <button
              onClick={handleRender}
              disabled={isRendering}
              style={{
                background: '#1b302d',
                border: '1px solid #37675a',
                color: '#d2f7e9',
                borderRadius: '4px',
                padding: '6px 14px',
                cursor: isRendering ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                fontWeight: 'bold',
                boxShadow: 'inset 0 0 0 1px #37675a',
                opacity: isRendering ? 0.7 : 1
              }}
            >
              {isRendering ? 'Sampling...' : 'Render Scene'}
            </button>
          </div>
          {/* Domain */}
          <div className="control-section">
            <div className="section-heading">Domain</div>
            <div className="domain-grid">
              <span className="domain-name">Re(z)</span>
              <input type="text" value={xMin} onChange={e => setXMin(e.target.value)} />
              <span className="domain-to">to</span>
              <input type="text" value={xMax} onChange={e => setXMax(e.target.value)} />
              <span className="domain-name">Im(z)</span>
              <input type="text" value={zMin} onChange={e => setZMin(e.target.value)} />
              <span className="domain-to">to</span>
              <input type="text" value={zMax} onChange={e => setZMax(e.target.value)} />
            </div>
          </div>

          {/* Surface */}
          <div className="control-section">
            <div className="section-heading">Surface</div>
            <div className="control-group" style={{ marginBottom: '12px' }}>
              <label className="field-label">Height Mapping</label>
              <select value={heightMode} onChange={e => setHeightMode(e.target.value as any)} className="select-row">
                <option value="mag">Magnitude |f(z)|</option>
                <option value="real">Real Re(f(z))</option>
                <option value="imag">Imaginary Im(f(z))</option>
              </select>
            </div>
            <div className="control-group" style={{ marginBottom: '12px' }}>
              <label className="field-label">Height Limit</label>
              <div className="segmented mini-segments" style={{ marginBottom: '8px' }}>
                <button onClick={() => setHeightLimitMode('Auto')} className={heightLimitMode === 'Auto' ? 'selected' : ''}>Auto</button>
                <button onClick={() => setHeightLimitMode('Custom')} className={heightLimitMode === 'Custom' ? 'selected' : ''}>Custom</button>
                <button onClick={() => setHeightLimitMode('Off')} className={heightLimitMode === 'Off' ? 'selected' : ''}>Off</button>
              </div>
              {heightLimitMode === 'Custom' && (
                <div className="domain-grid" style={{ gridTemplateColumns: 'auto 1fr' }}>
                  <span className="field-label" style={{ marginBottom: 0 }}>Max</span>
                  <input type="number" min="0.1" step="0.1" value={customHeightLimit === null ? '' : customHeightLimit} onChange={e => { const v = e.target.value.trim(); setCustomHeightLimit(v === '' ? null : parseFloat(v)); if (renderError) setRenderError(null); }} />
                </div>
              )}
            </div>

            <div className="control-group" style={{ marginBottom: '12px' }}>
              <label className="field-label">Resolution</label>
              <div className="segmented mini-segments" style={{ marginBottom: '8px' }}>
                <button onClick={() => setUseCustomRes(false)} className={!useCustomRes ? 'selected' : ''}>Slider</button>
                <button onClick={() => setUseCustomRes(true)} className={useCustomRes ? 'selected' : ''}>Custom</button>
              </div>
              {!useCustomRes ? (
                <label className="range-label"><span>Density</span><input type="range" min="20" max="250" step="10" value={resolution} onChange={e => setResolution(parseInt(e.target.value))} /><span>{resolution}</span></label>
              ) : (
                <>
                  <div className="domain-grid" style={{ gridTemplateColumns: 'auto 1fr auto 1fr', marginBottom: '8px' }}>
                    <span className="field-label" style={{ marginBottom: 0 }}>X</span>
                    <input type="number" min="10" max="2000" value={customResX === null ? '' : customResX} onChange={e => { const v = e.target.value.trim(); setCustomResX(v === '' ? null : parseInt(v, 10)); if (renderError) setRenderError(null); }} />
                    <span className="field-label" style={{ marginBottom: 0 }}>Z</span>
                    <input type="number" min="10" max="2000" value={customResZ === null ? '' : customResZ} onChange={e => { const v = e.target.value.trim(); setCustomResZ(v === '' ? null : parseInt(v, 10)); if (renderError) setRenderError(null); }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#929daf' }}>
                    <span>Recommended: {recRes.x} � {recRes.z}</span>
                    <button onClick={() => { setCustomResX(recRes.x); setCustomResZ(recRes.z); }} style={{ padding: '2px 6px', background: '#1c212b', border: '1px solid #2c3441', color: '#c6d0dc', borderRadius: '4px', cursor: 'pointer' }}>Use</button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Function Presentation */}
          <div className="control-section">
            <div 
              className="section-heading" 
              style={{ cursor: 'pointer', userSelect: 'none' }} 
              onClick={() => setPresentationOpen(!presentationOpen)}
            >
              Function Presentation
              <span style={{ marginLeft: 'auto', fontSize: '10px' }}>{presentationOpen ? '▼' : '▶'}</span>
            </div>
            
            {presentationOpen && (
              <>
                <div className="color-options">
                  <label><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /> Show Grid</label>
                  <label><input type="checkbox" checked={showAxes} onChange={e => setShowAxes(e.target.checked)} /> Coordinate Axes</label>
                  <label><input type="checkbox" checked={showNumericLabels} onChange={e => setShowNumericLabels(e.target.checked)} /> Numeric Labels</label>
                  <label><input type="checkbox" checked={showAxisLabels} onChange={e => setShowAxisLabels(e.target.checked)} /> Axis Labels</label>
                  <label><input type="checkbox" checked={labelsAlwaysVisible} onChange={e => setLabelsAlwaysVisible(e.target.checked)} /> Labels Always Visible</label>
                  <label><input type="checkbox" checked={showWrappedGrid} onChange={e => setShowWrappedGrid(e.target.checked)} /> Show Wrapped Grid</label>
                  <label>Wrapped Grid Density: 
                    <select value={wrappedGridDensity} onChange={e => setWrappedGridDensity(e.target.value as any)} style={{marginLeft:'4px'}}>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </label>
                  
                  {/* Zeta & Analytic Reference Overlays */}
                  <label><input type="checkbox" checked={showCriticalLine} onChange={e => setShowCriticalLine(e.target.checked)} /> Critical Line (Re = 1/2)</label>
                  <label><input type="checkbox" checked={showCriticalStrip} onChange={e => setShowCriticalStrip(e.target.checked)} /> Critical Strip (0 ≤ Re ≤ 1)</label>
                  <label><input type="checkbox" checked={showKnownZeros} onChange={e => setShowKnownZeros(e.target.checked)} /> Known Zeros (Nontrivial & Trivial)</label>

                <div className="control-group" style={{ marginBottom: '12px' }}>
                  <label className="field-label">Color Mode</label>
                  <div className="segmented mini-segments" style={{ marginBottom: '8px' }}>
                    <button onClick={() => setColorMode('solid')} className={colorMode === 'solid' ? 'selected' : ''}>Solid Color</button>
                    <button onClick={() => setColorMode('palette')} className={colorMode === 'palette' ? 'selected' : ''}>Phase Palette</button>
                  </div>
                </div>

                {colorMode === 'solid' && (
                  <div className="control-group" style={{ marginBottom: '12px' }}>
                    <label className="field-label">Function Color</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input type="color" value={surfaceColor} onChange={e => setSurfaceColor(e.target.value)} style={{ width: '32px', height: '32px', padding: 0, border: 'none', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }} />
                      <span style={{ fontSize: '11px', color: '#a0abbf', fontFamily: 'monospace' }}>{surfaceColor}</span>
                    </div>
                  </div>
                )}

                <div className="control-group" style={{ marginBottom: '12px' }}>
                  <label className="range-label"><span>Light Brightness</span><input type="range" min="0.1" max="3.0" step="0.1" value={lightBrightness} onChange={e => setLightBrightness(parseFloat(e.target.value))} /><span>{(lightBrightness * 100).toFixed(0)}%</span></label>
                </div>

                <div className="control-group" style={{ marginBottom: '12px' }}>
                  <label className="range-label"><span>Atmosphere (Fog)</span><input type="range" min="0" max="1.0" step="0.05" value={atmosphere} onChange={e => setAtmosphere(parseFloat(e.target.value))} /><span>{(atmosphere * 100).toFixed(0)}%</span></label>
                </div>


                  {renderedConfig.heightMode === 'mag' && (
                    <label><input type="checkbox" checked={groundMagnitudeAtZero} onChange={e => setGroundMagnitudeAtZero(e.target.checked)} /> Ground |f(z)| at 0</label>
                  )}
                </div>

                <div className="control-group" style={{ marginBottom: '12px' }}>
                  <label className="field-label">Axis Aspect Ratio</label>
                  <select value={axisRatioMode} onChange={e => setAxisRatioMode(e.target.value)} className="select-row" style={{ width: '100%' }}>
                    <option value="default">Default</option>
                    <option value="custom">Custom</option>
                  </select>
                  {axisRatioMode === 'custom' && (
                    <div className="domain-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '12px' }}>
                      <div>
                        <div className="field-label" style={{ marginBottom: '4px' }}>Re(z)</div>
                        <input type="number" min="0.1" step="0.1" value={customRatio.re === null ? '' : customRatio.re} onChange={e => { const v = e.target.value.trim(); setCustomRatio(prev => ({ ...prev, re: v === '' ? null : parseFloat(v) })); if (renderError) setRenderError(null); }} />
                      </div>
                      <div>
                        <div className="field-label" style={{ marginBottom: '4px' }}>Height</div>
                        <input type="number" min="0.1" step="0.1" value={customRatio.height === null ? '' : customRatio.height} onChange={e => { const v = e.target.value.trim(); setCustomRatio(prev => ({ ...prev, height: v === '' ? null : parseFloat(v) })); if (renderError) setRenderError(null); }} />
                      </div>
                      <div>
                        <div className="field-label" style={{ marginBottom: '4px' }}>Im(z)</div>
                        <input type="number" min="0.1" step="0.1" value={customRatio.im === null ? '' : customRatio.im} onChange={e => { const v = e.target.value.trim(); setCustomRatio(prev => ({ ...prev, im: v === '' ? null : parseFloat(v) })); if (renderError) setRenderError(null); }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="control-group" style={{ marginBottom: '12px' }}>
                  <label className="field-label">Numeric Label Size</label>
                  <input type="range" min="0.002" max="0.06" step="0.002" value={numericLabelSize} onChange={e => setNumericLabelSize(parseFloat(e.target.value))} className="quality-range" />
                </div>
                <div className="control-group" style={{ marginBottom: '12px' }}>
                  <label className="field-label">Axis Title Size</label>
                  <input type="range" min="0.002" max="0.04" step="0.001" value={axisTitleSize} onChange={e => setAxisTitleSize(parseFloat(e.target.value))} className="quality-range" />
                </div>
                <div className="control-group" style={{ marginBottom: '12px' }}>
                  <label className="field-label">Tick Spacing</label>
                  <div className="segmented mini-segments">
                    <button onClick={() => setTickSpacingMode('auto')} className={tickSpacingMode === 'auto' ? 'selected' : ''}>Auto</button>
                    <button onClick={() => setTickSpacingMode('manual')} className={tickSpacingMode === 'manual' ? 'selected' : ''}>Manual</button>
                  </div>
                  {tickSpacingMode === 'manual' && (
                    <div className="domain-grid" style={{ gridTemplateColumns: 'auto 1fr', marginTop: '8px' }}>
                      <span className="field-label" style={{ marginBottom: 0 }}>Step</span>
                      <input type="text" value={manualTickStep} onChange={e => setManualTickStep(e.target.value)} />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Camera */}
          <div className="control-section">
            <div className="section-heading">Camera</div>
            <div className="segmented mini-segments">
              <button onClick={() => setCameraMode('perspective')} className={cameraMode === 'perspective' ? 'selected' : ''}>Perspective</button>
              <button onClick={() => setCameraMode('orthographic')} className={cameraMode === 'orthographic' ? 'selected' : ''}>Orthographic</button>
            </div>
          </div>

          
          {/* Composition */}
          <div className="control-section">
            <div className="section-heading">Composition</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button className="fit-btn" onClick={() => sceneRef.current?.fitScene()} style={{ flex: 1, padding: '6px', background: '#0e1117', border: '1px solid #292f3a', borderRadius: '4px', color: '#a0abbf', display: 'flex', justifyContent: 'center', gap: '6px', fontSize: '10px' }}><Maximize2 size={13} /> Fit Scene</button>
              <button className="fit-btn" onClick={() => sceneRef.current?.resetView()} style={{ flex: 1, padding: '6px', background: '#0e1117', border: '1px solid #292f3a', borderRadius: '4px', color: '#a0abbf', display: 'flex', justifyContent: 'center', gap: '6px', fontSize: '10px' }}><RotateCcw size={13} /> Reset View</button>
            </div>
            <div className="control-group" style={{ marginBottom: '12px' }}>
              <label className="field-label">Presets</label>
              <select onChange={e => { if (e.target.value) sceneRef.current?.applyPreset(e.target.value); e.target.value = ''; }} className="select-row" style={{ width: '100%' }}>
                <option value="">Select preset...</option>
                <option value="Default">Default</option>
                <option value="Zeta default">Zeta default</option>
                <option value="Low angle">Low angle</option>
                <option value="High angle">High angle</option>
                <option value="Wide">Wide</option>
                <option value="Close">Close</option>
              </select>
            </div>
            <div className="control-group">
              <label className="field-label">Export PNG</label>
              <select onChange={e => { if (e.target.value) handleExportPNG(e.target.value); e.target.value = ''; }} className="select-row" style={{ width: '100%' }}>
                <option value="">Select resolution...</option>
                <option value="Viewport">Viewport</option>
                <option value="1080p">1920 � 1080</option>
                <option value="1440p">2560 � 1440</option>
                <option value="4k">3840 � 2160</option>
              </select>
            </div>
          </div>

          {/* Render Button moved to after Function section */}
        </div></aside>

        {/* 3D Viewport */}
        <main className="viewport-shell">
          <div className="viewport-toolbar">
            <div className="viewport-title">
              <div className="viewport-symbol"><Activity size={19} strokeWidth={2.4} /></div>
              <div>
                <strong>{renderedConfig.expression}</strong>
                <span>Height: {
                  (renderedConfig.expression.trim() === 'zeta(z)' || renderedConfig.expression.trim() === 'zeta(s)') && renderedConfig.heightMode === 'mag'
                    ? 'ln|ζ(s)|'
                    : renderedConfig.heightMode === 'mag'
                    ? '|f(z)|'
                    : renderedConfig.heightMode === 'real'
                    ? (renderedConfig.expression.trim() === 'zeta(z)' || renderedConfig.expression.trim() === 'zeta(s)' ? 'Re(ζ(s))' : 'Re(f(z))')
                    : (renderedConfig.expression.trim() === 'zeta(z)' || renderedConfig.expression.trim() === 'zeta(s)' ? 'Im(ζ(s))' : 'Im(f(z))')
                }</span>
                <span>Domain: [{renderedConfig.domain.xMin}, {renderedConfig.domain.xMax}] × [{renderedConfig.domain.zMin}, {renderedConfig.domain.zMax}]</span>
              </div>
            </div>
          </div>
          <CinematicScene
            ref={sceneRef}
            config={renderedConfig as any}
            cameraMode={cameraMode}
            wireframe={wireframe}
            showGrid={showGrid}
            showAxes={showAxes}
            showNumericLabels={showNumericLabels}
            showAxisLabels={showAxisLabels}
            labelsAlwaysVisible={labelsAlwaysVisible}
            numericLabelSize={numericLabelSize}
            axisTitleSize={axisTitleSize}
            tickSpacingMode={tickSpacingMode}
            manualTickStep={typeof manualTickStep === 'string' ? parseFloat(manualTickStep) || 1 : manualTickStep}
            axisRatio={activeRatio}
            groundMagnitudeAtZero={groundMagnitudeAtZero}
          />
        </main>
      </div>
    </div>
  );
}


