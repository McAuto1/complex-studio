import { forwardRef, useEffect, useImperativeHandle, useRef, type PointerEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { fittedBounds, inverseSymlog, symlog, type Range, cartesianView } from './viewRange';
import type { CameraSnapshot, DisplayOptions, FitMode, Mapping, SavedCamera } from './project';
import type { CurveSamples } from './sampling.worker';

export type PlotMode = 'cartesian' | 'domain' | 'magnitude' | 'phase' | 'contours' | 'vector';
type QuantityKey = Mapping;
export type AxisMap = { x: QuantityKey; y: QuantityKey; z: QuantityKey };
export type RenderSample = {
  id: number; type: 'result'; resolution: number; rows: number; re: Float32Array; im: Float32Array;
  valid: Uint8Array; mode: 'surface' | 'domain' | 'cartesian';
  domain: { xmin: number; xmax: number; ymin: number; ymax: number };
  expression: string; dataKey: string; curve?: CurveSamples;
};
export type CameraView = { kind: 'default' | 'top' | 'front' | 'side'; key: number };
type ColorConfig = { contrast: number; saturation: number; logMagnitude: boolean; contours: boolean };
const quantity = (map: QuantityKey, x: number, y: number, re: number, im: number) => {
  if (map === 'inputRe') return x;
  if (map === 'inputIm') return y;
  if (map === 'outputRe') return re;
  if (map === 'outputIm') return im;
  if (map === 'magnitude') return Math.hypot(re, im);
  return Math.atan2(im, re);
};
function hsv(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6); const f = h * 6 - i; const p = v * (1 - s); const q = v * (1 - f * s); const t = v * (1 - (1 - f) * s);
  switch (i % 6) { case 0: return [v, t, p]; case 1: return [q, v, p]; case 2: return [p, v, t]; case 3: return [p, q, v]; case 4: return [t, p, v]; default: return [v, p, q]; }
}
function lightness(re: number, im: number, log: boolean, contrast: number) {
  const mag = Math.hypot(re, im);
  const level = log ? Math.log1p(mag) / (1 + Math.log1p(mag)) : mag / (1 + mag);
  return Math.max(0.025, Math.min(1, Math.pow(level, 1 / Math.max(.25, contrast))));
}
function domainColor(re: number, im: number, color: ColorConfig): [number, number, number] {
  const [r, g, b] = hsv((Math.atan2(im, re) + Math.PI) / (2 * Math.PI), color.saturation, lightness(re, im, color.logMagnitude, color.contrast));
  return [r, g, b];
}

function drawContourLines(ctx: CanvasRenderingContext2D, sample: RenderSample, width: number, height: number) {
  const { resolution: n, rows: m, re, im, valid } = sample;
  const mags = Array.from({ length: valid.length }, (_, k) => valid[k] ? Math.log1p(Math.hypot(re[k], im[k])) : NaN).filter(Number.isFinite).sort((a, b) => a - b);
  if (!mags.length) return;
  const ceiling = mags[Math.floor(mags.length * .92)] || 1;
  ctx.save(); ctx.strokeStyle = 'rgba(243,246,255,.72)'; ctx.lineWidth = 1; ctx.globalAlpha = .55;
  for (let band = 1; band <= 9; band++) {
    const level = ceiling * band / 10; ctx.beginPath();
    for (let y = 0; y < m - 1; y++) for (let x = 0; x < n - 1; x++) {
      const ids = [y * n + x, y * n + x + 1, (y + 1) * n + x + 1, (y + 1) * n + x];
      if (ids.some((id) => !valid[id])) continue;
      const vals = ids.map((id) => Math.log1p(Math.hypot(re[id], im[id])));
      const points: [number, number][] = [];
      for (let edge = 0; edge < 4; edge++) {
        const next = (edge + 1) % 4; const a = vals[edge]; const b = vals[next];
        if ((a < level && b >= level) || (b < level && a >= level)) {
          const t = Math.abs(b - a) < 1e-10 ? .5 : (level - a) / (b - a);
          const p0 = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]][edge];
          const p1 = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]][next];
          points.push([((p0[0] + (p1[0] - p0[0]) * t) / (n - 1)) * width, (1 - (p0[1] + (p1[1] - p0[1]) * t) / (m - 1)) * height]);
        }
      }
      if (points.length >= 2) { ctx.moveTo(points[0][0], points[0][1]); ctx.lineTo(points[1][0], points[1][1]); }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function getSensibleTicks(min: number, max: number, targetCount: number = 6): number[] {
  const range = max - min;
  if (range <= 0 || !Number.isFinite(range)) return [min];
  const rawStep = range / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let stepMultiplier = 1;
  if (normalized <= 1.5) stepMultiplier = 1;
  else if (normalized <= 3.5) stepMultiplier = 2;
  else if (normalized <= 7.5) stepMultiplier = 5;
  else stepMultiplier = 10;
  const step = stepMultiplier * magnitude;
  const ticks: number[] = [];
  let current = Math.ceil(min / step) * step;
  while (current <= max + 1e-9) {
    ticks.push(current);
    current += step;
  }
  return ticks;
}

export const Plot2D = forwardRef<HTMLCanvasElement, {
  sample: RenderSample | null; plotMode: PlotMode; color: ColorConfig; display: DisplayOptions;
  fitMode: FitMode; manualY: Range; viewDomain: { xmin: number; xmax: number; ymin: number; ymax: number };
  onInspect: (x: number, y: number) => void; onLeave: () => void;
}>(function Plot2D({ sample, plotMode, color, display, fitMode, manualY, viewDomain, onInspect, onLeave }, forwardedRef) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(forwardedRef, () => canvas.current as HTMLCanvasElement);
  useEffect(() => {
    const node = canvas.current; if (!node) return;
    const ctx = node.getContext('2d'); if (!ctx) return;
    const rect = node.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(rect.width * dpr)); const height = Math.max(1, Math.floor(rect.height * dpr));
    node.width = width; node.height = height; ctx.fillStyle = '#0b0e15'; ctx.fillRect(0, 0, width, height);
    if (!sample) return;
    const { resolution: n, rows: m, re, im, valid, domain, mode } = sample;
    if (mode === 'cartesian') {
      const margin = { l: 62 * dpr, r: 24 * dpr, t: 26 * dpr, b: 48 * dpr };
      const pw = width - margin.l - margin.r; const ph = height - margin.t - margin.b;
      const curve = sample.curve;
      const curveX = curve?.x ?? Float64Array.from({ length: n }, (_, i) => domain.xmin + (domain.xmax - domain.xmin) * i / Math.max(1, n - 1));
      const curveRe = curve?.re ?? re; const curveValid = curve?.valid ?? valid;
      const view = cartesianView(curveRe, curveValid, fitMode, manualY);
      const breaks = curve?.breaks ?? new Uint8Array(Math.max(0, curveRe.length - 1));
      const px = (x: number) => margin.l + (x - viewDomain.xmin) / (viewDomain.xmax - viewDomain.xmin) * pw;
      const mappedY = (y: number) => view.scale === 'symlog' ? symlog(y, view.threshold) : y;
      const py = (y: number) => margin.t + (view.range.max - mappedY(y)) / (view.range.max - view.range.min) * ph;
      ctx.strokeStyle = 'rgba(177,190,211,.12)'; ctx.lineWidth = 1 * dpr;
      ctx.fillStyle = '#8590a5'; ctx.font = `${11 * dpr}px Inter, sans-serif`;

      const xTicks = getSensibleTicks(viewDomain.xmin, viewDomain.xmax);
      for (const tick of xTicks) {
        const xx = px(tick);
        if (display.show2DGrid) { ctx.beginPath(); ctx.moveTo(xx, margin.t); ctx.lineTo(xx, margin.t + ph); ctx.stroke(); }
        if (display.show2DLabels) ctx.fillText(Number(tick.toPrecision(5)).toString(), xx - 9 * dpr, margin.t + ph + 19 * dpr);
      }

      const mappedTicks = getSensibleTicks(view.range.min, view.range.max);
      for (const mappedTick of mappedTicks) {
        const yy = margin.t + (view.range.max - mappedTick) / (view.range.max - view.range.min) * ph;
        if (display.show2DGrid) { ctx.beginPath(); ctx.moveTo(margin.l, yy); ctx.lineTo(margin.l + pw, yy); ctx.stroke(); }
        const physicalTick = view.scale === 'symlog' ? inverseSymlog(mappedTick, view.threshold) : mappedTick;
        if (display.show2DLabels) ctx.fillText(Number(physicalTick.toPrecision(5)).toString(), 9 * dpr, yy + 4 * dpr);
      }
      ctx.strokeStyle = 'rgba(204,216,234,.48)'; ctx.lineWidth = 1.25 * dpr;
      if (viewDomain.xmin <= 0 && viewDomain.xmax >= 0) { ctx.beginPath(); ctx.moveTo(px(0), margin.t); ctx.lineTo(px(0), margin.t + ph); ctx.stroke(); }
      if (view.range.min <= mappedY(0) && view.range.max >= mappedY(0)) { ctx.beginPath(); ctx.moveTo(margin.l, py(0)); ctx.lineTo(margin.l + pw, py(0)); ctx.stroke(); }
      ctx.save(); ctx.beginPath(); ctx.rect(margin.l, margin.t, pw, ph); ctx.clip();
      ctx.beginPath(); ctx.lineWidth = 2.5 * dpr; ctx.strokeStyle = '#87e2c2'; ctx.shadowColor = '#5fe8be'; ctx.shadowBlur = 12 * dpr;
      let down = true;
      for (let i = 0; i < curveRe.length; i++) {
        if (!curveValid[i]) { down = true; continue; }
        if (i > 0 && breaks[i - 1]) down = true;
        const xx = px(curveX[i]); const yy = py(curveRe[i]);
        if (down) { ctx.moveTo(xx, yy); down = false; } else ctx.lineTo(xx, yy);
      }
      ctx.stroke(); ctx.restore();
      if (display.show2DLabels) { ctx.fillStyle = '#aab4c5'; ctx.font = `${12 * dpr}px Inter, sans-serif`; ctx.fillText('x', margin.l + pw - 10 * dpr, margin.t + ph + 38 * dpr); ctx.textAlign = 'right'; ctx.fillText(`Re(f(x))${view.scale === 'symlog' ? ' · robust scale' : ''}`, margin.l + pw, margin.t + 14 * dpr); ctx.textAlign = 'left'; }
    } else {
      const image = ctx.createImageData(n, m);
      for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
        const source = (m - 1 - j) * n + i; const k = (j * n + i) * 4;
        if (!valid[source]) { image.data[k] = 10; image.data[k + 1] = 13; image.data[k + 2] = 20; image.data[k + 3] = 255; continue; }
        const mag = Math.hypot(re[source], im[source]); let rgb: [number, number, number];
        if (plotMode === 'magnitude' || plotMode === 'vector') {
          const level = lightness(re[source], im[source], color.logMagnitude, color.contrast); rgb = [level * .23, level * .78, level * 1.1];
        } else if (plotMode === 'phase') rgb = hsv((Math.atan2(im[source], re[source]) + Math.PI) / (2 * Math.PI), color.saturation, .92);
        else rgb = domainColor(re[source], im[source], color);
        image.data[k] = Math.min(255, rgb[0] * 255); image.data[k + 1] = Math.min(255, rgb[1] * 255); image.data[k + 2] = Math.min(255, rgb[2] * 255); image.data[k + 3] = 255;
        if (plotMode === 'domain' && color.contours) {
          const phaseBands = Math.log1p(mag) * 6; const stripe = Math.abs(phaseBands - Math.round(phaseBands));
          if (stripe < .08) { image.data[k] *= .57; image.data[k + 1] *= .57; image.data[k + 2] *= .57; }
        }
      }
      const offscreen = document.createElement('canvas'); offscreen.width = n; offscreen.height = m;
      offscreen.getContext('2d')?.putImageData(image, 0, 0);
      const padding = 24 * dpr; const imageW = width - 2 * padding; const imageH = height - 2 * padding;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(offscreen, padding, padding, imageW, imageH);
      if (plotMode === 'contours') drawContourLines(ctx, sample, imageW, imageH);
      if (display.show2DGrid) {
        ctx.strokeStyle = 'rgba(210,220,238,.2)'; ctx.lineWidth = dpr;
        for (let q = 1; q < 8; q++) {
          const xx = padding + imageW * q / 8; const yy = padding + imageH * q / 8;
          ctx.beginPath(); ctx.moveTo(xx, padding); ctx.lineTo(xx, padding + imageH); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(padding, yy); ctx.lineTo(padding + imageW, yy); ctx.stroke();
        }
      }
      if (display.show2DLabels) {
        ctx.fillStyle = '#a4adbd'; ctx.font = `${11 * dpr}px Inter, sans-serif`;
        ctx.fillText(`Re(z) ${domain.xmin} … ${domain.xmax}`, padding + 8 * dpr, height - 70 * dpr);
        ctx.save(); ctx.translate(15 * dpr, padding + imageH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`Im(z) ${domain.ymin} … ${domain.ymax}`, 0, 0); ctx.restore();
      }
      if (plotMode === 'vector') {
        let maxLogMagnitude = 0;
        for (let k = 0; k < valid.length; k++) if (valid[k]) maxLogMagnitude = Math.max(maxLogMagnitude, Math.log1p(Math.hypot(re[k], im[k])));
        const stepX = Math.max(1, Math.floor(n / 20)); const stepY = Math.max(1, Math.floor(m / 18));
        ctx.save(); ctx.strokeStyle = 'rgba(227,246,240,.88)'; ctx.fillStyle = 'rgba(227,246,240,.9)'; ctx.lineWidth = 1.05 * dpr; ctx.lineCap = 'round';
        for (let j = stepY; j < m; j += stepY) for (let i = stepX; i < n; i += stepX) {
          const k = j * n + i; if (!valid[k]) continue;
          const magnitude = Math.hypot(re[k], im[k]); if (magnitude < 1e-8) continue;
          const length = (3 + 7 * Math.log1p(magnitude) / Math.max(1, maxLogMagnitude)) * dpr;
          const sx = padding + (i / (n - 1)) * imageW; const sy = padding + (1 - j / (m - 1)) * imageH;
          const dx = re[k] / magnitude * length; const dy = -im[k] / magnitude * length;
          ctx.beginPath(); ctx.moveTo(sx - dx * .5, sy - dy * .5); ctx.lineTo(sx + dx * .5, sy + dy * .5); ctx.stroke();
          const angle = Math.atan2(dy, dx); ctx.beginPath(); ctx.moveTo(sx + dx * .5, sy + dy * .5);
          ctx.lineTo(sx + dx * .5 - Math.cos(angle - .55) * 3 * dpr, sy + dy * .5 - Math.sin(angle - .55) * 3 * dpr);
          ctx.lineTo(sx + dx * .5 - Math.cos(angle + .55) * 3 * dpr, sy + dy * .5 - Math.sin(angle + .55) * 3 * dpr); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    }
  }, [sample, plotMode, color, display, fitMode, manualY]);

  const pointer = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!sample) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (sample.mode === 'cartesian') {
      const ux = Math.max(0, Math.min(1, (event.clientX - rect.left - 62) / Math.max(1, rect.width - 86)));
      onInspect(sample.domain.xmin + ux * (sample.domain.xmax - sample.domain.xmin), 0);
    } else {
      const ux = Math.max(0, Math.min(1, (event.clientX - rect.left - 24) / Math.max(1, rect.width - 48)));
      const uy = Math.max(0, Math.min(1, (event.clientY - rect.top - 24) / Math.max(1, rect.height - 48)));
      onInspect(sample.domain.xmin + ux * (sample.domain.xmax - sample.domain.xmin), sample.domain.ymax - uy * (sample.domain.ymax - sample.domain.ymin));
    }
  };
  return <canvas ref={canvas} className="plot-canvas" onPointerMove={pointer} onPointerLeave={onLeave} aria-label="Mathematical plot" />;
});

export function Surface3D({ sample, axes, color, display, camera: savedCamera, projection, cameraView, fitMode, manualCameraDistance, dataKey, fitRequest, cameraRestoreRequest, onCamera, onInspect, onLeave, onReset, onCapture }: {
  sample: RenderSample | null; axes: AxisMap; color: ColorConfig; display: DisplayOptions; camera: SavedCamera;
  projection: 'perspective' | 'orthographic'; cameraView: CameraView; fitMode: FitMode; manualCameraDistance: number;
  dataKey: string; fitRequest: number; cameraRestoreRequest: number;
  onCamera: (camera: CameraSnapshot) => void; onInspect: (x: number, y: number) => void;
  onLeave: () => void; onReset: () => void; onCapture: (capture: () => string | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null); const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null); const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const perspectiveRef = useRef<THREE.PerspectiveCamera | null>(null); const orthographicRef = useRef<THREE.OrthographicCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null); const meshRef = useRef<THREE.Mesh | null>(null);
  const fitDistanceRef = useRef(9); const lastSubjectRef = useRef(''); const lastPolicyRef = useRef('');
  const lastFitRequestRef = useRef(fitRequest); const userInteractedRef = useRef(false);
  const lastCameraRestoreRequestRef = useRef(0);
  const sampleRef = useRef(sample); sampleRef.current = sample;
  const onInspectRef = useRef(onInspect); onInspectRef.current = onInspect;
  const onLeaveRef = useRef(onLeave); onLeaveRef.current = onLeave;
  const onResetRef = useRef(onReset); onResetRef.current = onReset;
  const onCameraRef = useRef(onCamera); onCameraRef.current = onCamera;
  const onCaptureRef = useRef(onCapture); onCaptureRef.current = onCapture;
  const snapshot = (active: THREE.PerspectiveCamera | THREE.OrthographicCamera, controls: OrbitControls): CameraSnapshot => ({
    position: { x: active.position.x, y: active.position.y, z: active.position.z },
    target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
    orthographicZoom: active instanceof THREE.OrthographicCamera ? active.zoom : 1,
    orthographicHeight: active instanceof THREE.OrthographicCamera ? active.top - active.bottom : fitDistanceRef.current * .96,
  });

  useEffect(() => {
    const element = host.current; if (!element) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#0b0e15');
    const camera = new THREE.PerspectiveCamera(43, 1, .01, 10000); camera.up.set(0, 0, 1); camera.position.set(6, 5, 7);
    const ortho = new THREE.OrthographicCamera(-5, 5, 5, -5, .01, 10000); ortho.up.set(0, 0, 1); ortho.position.copy(camera.position);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setSize(element.clientWidth, element.clientHeight); rendererRef.current = renderer;
    element.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .075; controls.screenSpacePanning = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE; controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN; controls.mouseButtons.RIGHT = THREE.MOUSE.DOLLY;
    controls.addEventListener('start', () => { userInteractedRef.current = true; });
    controls.addEventListener('end', () => { const active = cameraRef.current ?? camera; onCameraRef.current(snapshot(active, controls)); });
    controlsRef.current = controls; sceneRef.current = scene; cameraRef.current = camera; perspectiveRef.current = camera; orthographicRef.current = ortho;
    scene.add(new THREE.HemisphereLight('#b9d2ff', '#222b3c', 2.05));
    const key = new THREE.DirectionalLight('#ffffff', 2.6); key.position.set(5, 8, 6); scene.add(key);
    const fill = new THREE.DirectionalLight('#5669bf', 1); fill.position.set(-6, 2, -4); scene.add(fill);
    const grid = new THREE.GridHelper(10, 20, '#5a6980', '#293243'); grid.name = 'floor-grid'; grid.rotation.x = Math.PI / 2; scene.add(grid);
    const axesHelper = new THREE.AxesHelper(2.3); axesHelper.name = 'world-axes'; scene.add(axesHelper);
    const resize = new ResizeObserver(() => {
      if (!host.current) return;
      const w = host.current.clientWidth; const h = Math.max(1, host.current.clientHeight); const aspect = w / h;
      renderer.setSize(w, h); camera.aspect = aspect; camera.updateProjectionMatrix();
      const halfHeight = Math.max(1, fitDistanceRef.current * .48); ortho.left = -halfHeight * aspect; ortho.right = halfHeight * aspect; ortho.top = halfHeight; ortho.bottom = -halfHeight; ortho.updateProjectionMatrix();
    }); resize.observe(element);
    let frame = 0; const tick = () => { frame = requestAnimationFrame(tick); controls.update(); if (cameraRef.current) renderer.render(scene, cameraRef.current); }; tick();
    onCaptureRef.current(() => { try { return renderer.domElement.toDataURL('image/png'); } catch { return null; } });
    return () => { cancelAnimationFrame(frame); resize.disconnect(); controls.dispose(); renderer.dispose(); if (renderer.domElement.parentElement === element) element.removeChild(renderer.domElement); rendererRef.current = null; cameraRef.current = null; perspectiveRef.current = null; orthographicRef.current = null; };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const floorGrid = scene.getObjectByName('floor-grid'); if (floorGrid) floorGrid.visible = display.show3DGrid;
    const worldAxes = scene.getObjectByName('world-axes'); if (worldAxes) worldAxes.visible = display.show3DAxes;
  }, [display.show3DGrid, display.show3DAxes]);

  useEffect(() => {
    const controls = controlsRef.current; const previous = cameraRef.current;
    const next = projection === 'orthographic' ? orthographicRef.current : perspectiveRef.current;
    if (!controls || !previous || !next || previous === next) return;
    next.position.copy(previous.position); next.up.copy(previous.up); next.quaternion.copy(previous.quaternion);
    controls.object = next; cameraRef.current = next;
    if (next instanceof THREE.OrthographicCamera && host.current) {
      const aspect = host.current.clientWidth / Math.max(1, host.current.clientHeight); const halfHeight = Math.max(1, fitDistanceRef.current * .48);
      next.left = -halfHeight * aspect; next.right = halfHeight * aspect; next.top = halfHeight; next.bottom = -halfHeight;
    }
    next.updateProjectionMatrix(); controls.update(); onCameraRef.current(snapshot(next, controls));
  }, [projection]);

  useEffect(() => {
    const scene = sceneRef.current; const camera = cameraRef.current; const controls = controlsRef.current; if (!scene || !camera || !controls) return;
    const oldSolid = scene.getObjectByName('surface-solid') as THREE.Mesh | undefined;
    const oldWire = scene.getObjectByName('surface-wire') as THREE.Mesh | undefined;
    if (oldSolid) { scene.remove(oldSolid); (oldSolid.material as THREE.Material).dispose(); }
    if (oldWire) { scene.remove(oldWire); (oldWire.material as THREE.Material).dispose(); }
    if (oldSolid || oldWire) (oldSolid ?? oldWire)?.geometry.dispose();
    meshRef.current = null;
    if (!sample) return;
    const { resolution: n, rows: m, domain, re, im, valid } = sample; const count = n * m;
    const position = new Float32Array(count * 3); const colors = new Float32Array(count * 3); const values = new Float64Array(count);
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i; const x = domain.xmin + (domain.xmax - domain.xmin) * i / Math.max(1, n - 1); const y = domain.ymin + (domain.ymax - domain.ymin) * j / Math.max(1, m - 1);
      const vals = [quantity(axes.x, x, y, re[k], im[k]), quantity(axes.y, x, y, re[k], im[k]), quantity(axes.z, x, y, re[k], im[k])];
      for (let a = 0; a < 3; a++) position[k * 3 + a] = valid[k] && Number.isFinite(vals[a]) && Math.abs(vals[a]) < 1e7 ? vals[a] : NaN;
      values[k] = vals[2]; const rgb = valid[k] ? domainColor(re[k], im[k], color) : [0.04, 0.045, 0.06];
      colors[k * 3] = rgb[0]; colors[k * 3 + 1] = rgb[1]; colors[k * 3 + 2] = rgb[2];
    }
    const okay = (k: number) => Boolean(valid[k] && Number.isFinite(position[k * 3]) && Number.isFinite(position[k * 3 + 1]) && Number.isFinite(position[k * 3 + 2]));
    const preserveAxes: [boolean, boolean, boolean] = [axes.x === 'inputRe' || axes.x === 'inputIm', axes.y === 'inputRe' || axes.y === 'inputIm', axes.z === 'inputRe' || axes.z === 'inputIm'];
    const maxRobustSpan = 2 * Math.max(domain.xmax - domain.xmin, domain.ymax - domain.ymin);
    const fitBounds = fittedBounds(position, okay, fitMode === 'All' ? 'All' : 'Robust', count, preserveAxes, maxRobustSpan);

    // Always compute robust bounds purely for the discontinuity fallback scale
    const robustBounds = fitMode === 'Robust' ? fitBounds : fittedBounds(position, okay, 'Robust', count, preserveAxes, maxRobustSpan);
    const robustZSpan = Math.max(1e-9, robustBounds.max[2] - robustBounds.min[2]);
    const jumpLimit = Math.max(50, 2.0 * robustZSpan);

    const ranges = fitBounds.max.map((value, axis) => Math.max(1e-5, value - fitBounds.min[axis]));
    const indices: number[] = [];
    // Local secant reversal detection (same principle as asymptotes.ts detectCartesianBreaks).
    // A pole reverses the secant direction on both sides of the edge and creates a larger
    // spacing-normalized change across the suspected interval.  This replaces the former
    // global jumpLimit which, when derived from Robust fitBounds, was too small and tore
    // continuous surfaces like exp(2z).
    const hasReversal = (a: number, b: number): boolean => {
      const ai = a % n, aj = (a - ai) / n, bi = b % n, bj = (b - bi) / n;
      let before: number, lo: number, hi: number, after: number;
      if (ai === bi) { // vertical edge
        const jLo = Math.min(aj, bj), jHi = Math.max(aj, bj);
        if (jLo < 1 || jHi >= m - 1) return false;
        before = (jLo - 1) * n + ai; lo = jLo * n + ai; hi = jHi * n + ai; after = (jHi + 1) * n + ai;
      } else { // horizontal edge
        const iLo = Math.min(ai, bi), iHi = Math.max(ai, bi);
        if (iLo < 1 || iHi >= n - 1) return false;
        before = aj * n + iLo - 1; lo = aj * n + iLo; hi = aj * n + iHi; after = aj * n + iHi + 1;
      }
      if (!okay(before) || !okay(after)) {
        // Fallback: If neighboring samples exceed finite cutoffs or hit domain edges, we cannot test secants.
        // In this localized edge case, fallback to an absolute jumpLimit based on independent robust scaling
        // to prevent false walls across singularities without tying the threshold to camera framing.
        return Math.abs(values[lo] - values[hi]) > jumpLimit;
      }
      const s1 = values[lo] - values[before], s2 = values[hi] - values[lo], s3 = values[after] - values[hi];
      return s1 * s2 < 0 && s2 * s3 < 0 && Math.abs(s2) / Math.max(Math.abs(s1), Math.abs(s3), 1e-30) >= 1.04;
    };
    const edgeOkay = (a: number, b: number) => okay(a) && okay(b) && !hasReversal(a, b);
    for (let j = 0; j < m - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i; const b = a + 1; const c = (j + 1) * n + i; const d = c + 1;
      if (edgeOkay(a, c) && edgeOkay(c, b) && edgeOkay(b, a)) indices.push(a, c, b);
      if (edgeOkay(b, c) && edgeOkay(c, d) && edgeOkay(d, b)) indices.push(b, c, d);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(position, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    let hitMesh: THREE.Mesh | null = null;
    if (display.show3DSurface) {
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .08, side: THREE.DoubleSide });
      const solid = new THREE.Mesh(geometry, material); solid.name = 'surface-solid'; scene.add(solid); hitMesh = solid;
    }
    if (display.show3DWireframe) {
      const material = new THREE.MeshBasicMaterial({ color: '#a8ead2', wireframe: true, transparent: true, opacity: .48, depthWrite: false });
      const wire = new THREE.Mesh(geometry, material); wire.name = 'surface-wire'; wire.renderOrder = 1; scene.add(wire); hitMesh ??= wire;
    }
    meshRef.current = hitMesh;

    const subjectKey = JSON.stringify([dataKey, axes.x, axes.y, axes.z]);
    const policyKey = JSON.stringify([fitMode, manualCameraDistance]);
    const subjectChanged = subjectKey !== lastSubjectRef.current;
    const policyChanged = policyKey !== lastPolicyRef.current;
    const requested = fitRequest !== lastFitRequestRef.current;
    const restoreLegacyCamera = cameraRestoreRequest !== lastCameraRestoreRequestRef.current && savedCamera !== null && savedCamera !== undefined && 'offset' in savedCamera;
    if (sample.dataKey === dataKey && (requested || policyChanged || restoreLegacyCamera || (subjectChanged && !userInteractedRef.current) || (!lastSubjectRef.current && !userInteractedRef.current))) {
      const center = new THREE.Vector3(
        (fitBounds.min[0] + fitBounds.max[0]) / 2,
        (fitBounds.min[1] + fitBounds.max[1]) / 2,
        (fitBounds.min[2] + fitBounds.max[2]) / 2,
      );
      const span = Math.max(...ranges); const distance = fitMode === 'Manual' ? manualCameraDistance : Math.max(5, span * 2.5);
      fitDistanceRef.current = distance; controls.target.copy(center);
      if (restoreLegacyCamera && savedCamera !== null && savedCamera !== undefined && 'offset' in savedCamera) {
        camera.position.set(center.x + savedCamera.offset.x, center.y + savedCamera.offset.y, center.z + savedCamera.offset.z);
      } else camera.position.set(center.x + distance * .62, center.y + distance * .58, center.z + distance * .72);
      camera.near = Math.max(.01, span / 1000); camera.far = Math.max(1000, span * 100);
      if (camera instanceof THREE.OrthographicCamera) {
        const aspect = (host.current?.clientWidth ?? 1) / Math.max(1, host.current?.clientHeight ?? 1);
        camera.left = -distance * .48 * aspect; camera.right = distance * .48 * aspect; camera.top = distance * .48; camera.bottom = -distance * .48; camera.zoom = 1;
      } else camera.aspect = (host.current?.clientWidth ?? 1) / Math.max(1, host.current?.clientHeight ?? 1);
      camera.updateProjectionMatrix(); controls.update(); userInteractedRef.current = false;
      onCameraRef.current(snapshot(camera, controls));
    }
    if (sample.dataKey === dataKey) {
      lastSubjectRef.current = subjectKey; lastPolicyRef.current = policyKey; lastFitRequestRef.current = fitRequest;
      lastCameraRestoreRequestRef.current = cameraRestoreRequest;
    }
  }, [sample, axes, color.contrast, color.logMagnitude, color.saturation, display.show3DSurface, display.show3DWireframe, fitMode, manualCameraDistance, dataKey, fitRequest, cameraRestoreRequest]);

  useEffect(() => {
    if (cameraRestoreRequest > 0) userInteractedRef.current = true;
  }, [cameraRestoreRequest]);

  useEffect(() => {
    const camera = cameraRef.current; const controls = controlsRef.current; if (!camera || !controls) return;
    const target = controls.target; const distance = fitDistanceRef.current || camera.position.distanceTo(target) || 9;
    if (cameraView.kind === 'top') camera.position.set(target.x, target.y, target.z + distance);
    else if (cameraView.kind === 'front') camera.position.set(target.x, target.y + distance, target.z + distance * .15);
    else if (cameraView.kind === 'side') camera.position.set(target.x + distance, target.y, target.z + distance * .15);
    else camera.position.set(target.x + distance * .62, target.y + distance * .58, target.z + distance * .72);
    camera.updateProjectionMatrix(); controls.update();
    if (cameraView.key > 0) onCameraRef.current(snapshot(camera, controls));
  }, [cameraView.key, cameraView.kind]);

  useEffect(() => {
    const currentCamera = cameraRef.current; const controls = controlsRef.current; if (!currentCamera || !controls || !savedCamera) return;
    if ('position' in savedCamera) {
      currentCamera.position.set(savedCamera.position.x, savedCamera.position.y, savedCamera.position.z);
      controls.target.set(savedCamera.target.x, savedCamera.target.y, savedCamera.target.z);
      fitDistanceRef.current = savedCamera.orthographicHeight / .96;
      if (currentCamera instanceof THREE.OrthographicCamera) {
        const halfHeight = savedCamera.orthographicHeight / 2;
        const aspect = (host.current?.clientWidth ?? 1) / Math.max(1, host.current?.clientHeight ?? 1);
        currentCamera.left = -halfHeight * aspect; currentCamera.right = halfHeight * aspect;
        currentCamera.top = halfHeight; currentCamera.bottom = -halfHeight; currentCamera.zoom = savedCamera.orthographicZoom;
      }
    } else {
      currentCamera.position.copy(controls.target).add(new THREE.Vector3(savedCamera.offset.x, savedCamera.offset.y, savedCamera.offset.z));
    }
    currentCamera.updateProjectionMatrix(); controls.update();
  }, [savedCamera]);

  const pointer = (event: PointerEvent<HTMLDivElement>) => {
    const mesh = meshRef.current; const renderer = rendererRef.current; const camera = cameraRef.current; const source = sampleRef.current;
    if (!mesh || !renderer || !camera || !source) return;
    const rect = renderer.domElement.getBoundingClientRect(); const mouse = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(mouse, camera); const hit = ray.intersectObject(mesh, false)[0];
    if (!hit?.face) return;
    const n = source.resolution; const k0 = hit.face.a; const k1 = hit.face.b; const k2 = hit.face.c; const bary = hit.barycoord ?? new THREE.Vector3(1 / 3, 1 / 3, 1 / 3);
    const getInput = (k: number) => [source.domain.xmin + (source.domain.xmax - source.domain.xmin) * (k % n) / (n - 1), source.domain.ymin + (source.domain.ymax - source.domain.ymin) * Math.floor(k / n) / Math.max(1, source.rows - 1)];
    const p0 = getInput(k0); const p1 = getInput(k1); const p2 = getInput(k2);
    onInspectRef.current(p0[0] * bary.x + p1[0] * bary.y + p2[0] * bary.z, p0[1] * bary.x + p1[1] * bary.y + p2[1] * bary.z);
  };
  const label = (value: QuantityKey) => ({ inputRe: 'Re(z)', inputIm: 'Im(z)', outputRe: 'Re(f)', outputIm: 'Im(f)', magnitude: '|f(z)|', phase: 'arg(f)' })[value];
  return <div className="surface-host" ref={host} onPointerMove={pointer} onPointerLeave={() => onLeaveRef.current()} onDoubleClick={() => onResetRef.current()}>
    {display.show3DAxisLabels && <><div className="axis-label label-x">X · {label(axes.x)}</div><div className="axis-label label-y">Y · {label(axes.y)}</div><div className="axis-label label-z">Z · {label(axes.z)}</div></>}
    <div className="webgl-watermark">WEBGL · REAL-TIME SURFACE</div>
  </div>;
}
