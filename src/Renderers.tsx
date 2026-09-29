import { forwardRef, useEffect, useImperativeHandle, useRef, type PointerEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type PlotMode = 'cartesian' | 'domain' | 'magnitude' | 'phase' | 'contours' | 'vector';
type QuantityKey = 'inputRe' | 'inputIm' | 'outputRe' | 'outputIm' | 'magnitude' | 'phase';
export type AxisMap = { x: QuantityKey; y: QuantityKey; z: QuantityKey };
export type RenderSample = {
  id: number; type: 'result'; resolution: number; rows: number; re: Float32Array; im: Float32Array;
  valid: Uint8Array; mode: 'surface' | 'domain' | 'cartesian';
  domain: { xmin: number; xmax: number; ymin: number; ymax: number };
};
export type CameraView = { kind: 'default' | 'top' | 'front' | 'side'; key: number };
type ColorConfig = { contrast: number; saturation: number; logMagnitude: boolean; contours: boolean; showGrid: boolean; wireframe: boolean };
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

export const Plot2D = forwardRef<HTMLCanvasElement, {
  sample: RenderSample | null; plotMode: PlotMode; color: ColorConfig; onInspect: (x: number, y: number) => void; onLeave: () => void;
}>(function Plot2D({ sample, plotMode, color, onInspect, onLeave }, forwardedRef) {
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
      const vals = Array.from({ length: n }, (_, k) => valid[k] ? re[k] : NaN).filter(Number.isFinite);
      let ymin = Math.min(0, ...vals); let ymax = Math.max(0, ...vals); if (ymin === ymax) { ymin -= 1; ymax += 1; }
      const pad = (ymax - ymin) * .08; ymin -= pad; ymax += pad;
      const px = (x: number) => margin.l + (x - domain.xmin) / (domain.xmax - domain.xmin) * pw;
      const py = (y: number) => margin.t + (ymax - y) / (ymax - ymin) * ph;
      ctx.strokeStyle = 'rgba(177,190,211,.12)'; ctx.lineWidth = 1 * dpr;
      ctx.fillStyle = '#8590a5'; ctx.font = `${11 * dpr}px Inter, sans-serif`;
      for (let i = 0; i <= 6; i++) {
        const xx = margin.l + pw * i / 6; ctx.beginPath(); ctx.moveTo(xx, margin.t); ctx.lineTo(xx, margin.t + ph); ctx.stroke();
        const tick = domain.xmin + (domain.xmax - domain.xmin) * i / 6; ctx.fillText(Number(tick.toPrecision(3)).toString(), xx - 9 * dpr, margin.t + ph + 19 * dpr);
        const yy = margin.t + ph * i / 6; ctx.beginPath(); ctx.moveTo(margin.l, yy); ctx.lineTo(margin.l + pw, yy); ctx.stroke();
        ctx.fillText(Number((ymax - (ymax - ymin) * i / 6).toPrecision(3)).toString(), 9 * dpr, yy + 4 * dpr);
      }
      ctx.strokeStyle = 'rgba(204,216,234,.48)'; ctx.lineWidth = 1.25 * dpr;
      if (domain.xmin <= 0 && domain.xmax >= 0) { ctx.beginPath(); ctx.moveTo(px(0), margin.t); ctx.lineTo(px(0), margin.t + ph); ctx.stroke(); }
      if (ymin <= 0 && ymax >= 0) { ctx.beginPath(); ctx.moveTo(margin.l, py(0)); ctx.lineTo(margin.l + pw, py(0)); ctx.stroke(); }
      ctx.beginPath(); ctx.lineWidth = 2.5 * dpr; ctx.strokeStyle = '#87e2c2'; ctx.shadowColor = '#5fe8be'; ctx.shadowBlur = 12 * dpr;
      let down = true;
      for (let i = 0; i < n; i++) {
        if (!valid[i]) { down = true; continue; }
        const xx = margin.l + pw * i / (n - 1); const yy = py(re[i]);
        if (down) { ctx.moveTo(xx, yy); down = false; } else ctx.lineTo(xx, yy);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#aab4c5'; ctx.font = `${12 * dpr}px Inter, sans-serif`; ctx.fillText('x', margin.l + pw - 10 * dpr, margin.t + ph + 38 * dpr); ctx.fillText('Re(f(x))', 15 * dpr, margin.t + 2 * dpr);
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
      if (color.showGrid) {
        ctx.strokeStyle = 'rgba(210,220,238,.2)'; ctx.lineWidth = dpr;
        for (let q = 1; q < 8; q++) {
          const xx = padding + imageW * q / 8; const yy = padding + imageH * q / 8;
          ctx.beginPath(); ctx.moveTo(xx, padding); ctx.lineTo(xx, padding + imageH); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(padding, yy); ctx.lineTo(padding + imageW, yy); ctx.stroke();
        }
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
  }, [sample, plotMode, color]);

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

export function Surface3D({ sample, axes, color, camera, projection, cameraView, onCamera, onInspect, onLeave, onReset, onCapture }: {
  sample: RenderSample | null; axes: AxisMap; color: ColorConfig; camera: { x: number; y: number; z: number } | null; projection: 'perspective' | 'orthographic'; cameraView: CameraView;
  onCamera: (position: { x: number; y: number; z: number }) => void; onInspect: (x: number, y: number) => void;
  onLeave: () => void;
  onReset: () => void;
  onCapture: (capture: () => string | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null); const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null); const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const perspectiveRef = useRef<THREE.PerspectiveCamera | null>(null); const orthographicRef = useRef<THREE.OrthographicCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null); const meshRef = useRef<THREE.Mesh | null>(null);
  const fitDistanceRef = useRef(9);
  const lastFitSampleRef = useRef<RenderSample | null>(null); const lastFitAxesRef = useRef('');
  const sampleRef = useRef(sample); sampleRef.current = sample;
  const onInspectRef = useRef(onInspect); onInspectRef.current = onInspect;
  const onLeaveRef = useRef(onLeave); onLeaveRef.current = onLeave;
  const onResetRef = useRef(onReset); onResetRef.current = onReset;
  const onCameraRef = useRef(onCamera); onCameraRef.current = onCamera;
  const onCaptureRef = useRef(onCapture); onCaptureRef.current = onCapture;
  useEffect(() => {
    const element = host.current; if (!element) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#0b0e15');
    const camera = new THREE.PerspectiveCamera(43, 1, .01, 10000); camera.up.set(0, 0, 1); camera.position.set(6, 5, 7);
    const ortho = new THREE.OrthographicCamera(-5, 5, 5, -5, .01, 10000); ortho.up.set(0, 0, 1); ortho.position.copy(camera.position);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setSize(element.clientWidth, element.clientHeight); rendererRef.current = renderer;
    element.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .075; controls.screenSpacePanning = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE; controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN; controls.mouseButtons.RIGHT = THREE.MOUSE.DOLLY;
    controls.addEventListener('end', () => { const active = cameraRef.current ?? camera; const offset = active.position.clone().sub(controls.target); onCameraRef.current({ x: offset.x, y: offset.y, z: offset.z }); });
    controlsRef.current = controls; sceneRef.current = scene; cameraRef.current = camera; perspectiveRef.current = camera; orthographicRef.current = ortho;
    scene.add(new THREE.HemisphereLight('#b9d2ff', '#222b3c', 2.05));
    const key = new THREE.DirectionalLight('#ffffff', 2.6); key.position.set(5, 8, 6); scene.add(key);
    const fill = new THREE.DirectionalLight('#5669bf', 1); fill.position.set(-6, 2, -4); scene.add(fill);
    const grid = new THREE.GridHelper(10, 20, '#5a6980', '#293243'); grid.name = 'floor-grid'; grid.rotation.x = Math.PI / 2; scene.add(grid);
    const axesHelper = new THREE.AxesHelper(2.3); axesHelper.name = 'world-axes'; scene.add(axesHelper);
    const resize = new ResizeObserver(() => {
      if (!host.current) return;
      const w = host.current.clientWidth; const h = Math.max(1, host.current.clientHeight); const aspect = w / h;
      renderer.setSize(w, h);
      camera.aspect = aspect; camera.updateProjectionMatrix();
      const halfHeight = Math.max(1, fitDistanceRef.current * .48); ortho.left = -halfHeight * aspect; ortho.right = halfHeight * aspect; ortho.top = halfHeight; ortho.bottom = -halfHeight; ortho.updateProjectionMatrix();
    }); resize.observe(element);
    let frame = 0; const tick = () => { frame = requestAnimationFrame(tick); controls.update(); if (cameraRef.current) renderer.render(scene, cameraRef.current); }; tick();
    onCaptureRef.current(() => { try { return renderer.domElement.toDataURL('image/png'); } catch { return null; } });
    return () => { cancelAnimationFrame(frame); resize.disconnect(); controls.dispose(); renderer.dispose(); if (renderer.domElement.parentElement === element) element.removeChild(renderer.domElement); rendererRef.current = null; cameraRef.current = null; perspectiveRef.current = null; orthographicRef.current = null; };
  }, []);

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
    next.updateProjectionMatrix(); controls.update();
  }, [projection]);

  useEffect(() => {
    const scene = sceneRef.current; const camera = cameraRef.current; const controls = controlsRef.current; if (!scene || !camera || !controls) return;
    const old = scene.getObjectByName('surface-mesh');
    if (old) { scene.remove(old); (old as THREE.Mesh).geometry.dispose(); ((old as THREE.Mesh).material as THREE.Material).dispose(); meshRef.current = null; }
    if (!sample) return;
    const { resolution: n, rows: m, domain, re, im, valid } = sample; const count = n * m;
    const position = new Float32Array(count * 3); const colors = new Float32Array(count * 3); const values = new Float64Array(count);
    const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i; const x = domain.xmin + (domain.xmax - domain.xmin) * i / (n - 1); const y = domain.ymin + (domain.ymax - domain.ymin) * j / (m - 1);
      const vals = [quantity(axes.x, x, y, re[k], im[k]), quantity(axes.y, x, y, re[k], im[k]), quantity(axes.z, x, y, re[k], im[k])];
      for (let a = 0; a < 3; a++) {
        const v = valid[k] && Number.isFinite(vals[a]) && Math.abs(vals[a]) < 1e7 ? vals[a] : NaN; position[k * 3 + a] = v;
        if (Number.isFinite(v)) { min[a] = Math.min(min[a], v); max[a] = Math.max(max[a], v); }
      }
      values[k] = vals[2]; const rgb = valid[k] ? domainColor(re[k], im[k], color) : [0.04, 0.045, 0.06];
      colors[k * 3] = rgb[0]; colors[k * 3 + 1] = rgb[1]; colors[k * 3 + 2] = rgb[2];
    }
    const finiteExtent = min.every(Number.isFinite) ? min : [-1, -1, -1]; const finiteMax = max.every(Number.isFinite) ? max : [1, 1, 1];
    const ranges = finiteExtent.map((v, i) => Math.max(1e-5, finiteMax[i] - v));
    const typical = Math.max(1e-4, ...ranges) / Math.max(1, n - 1); const jumpLimit = typical * 11;
    const indices: number[] = [];
    const okay = (k: number) => valid[k] && Number.isFinite(position[k * 3]) && Number.isFinite(position[k * 3 + 1]) && Number.isFinite(position[k * 3 + 2]);
    // Build only locally continuous triangles; invalid samples and abrupt jumps leave intentional holes at poles and cuts.
    const edgeOkay = (a: number, b: number) => okay(a) && okay(b) && Math.abs(values[a] - values[b]) < jumpLimit;
    for (let j = 0; j < m - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i; const b = a + 1; const c = (j + 1) * n + i; const d = c + 1;
      if (edgeOkay(a, b) && edgeOkay(a, c) && edgeOkay(b, d)) indices.push(a, c, b);
      if (edgeOkay(b, c) && edgeOkay(c, d) && edgeOkay(b, d)) indices.push(b, c, d);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(position, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .08, side: THREE.DoubleSide, wireframe: color.wireframe, transparent: false });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = 'surface-mesh'; scene.add(mesh); meshRef.current = mesh;
    const axisKey = `${axes.x}:${axes.y}:${axes.z}`;
    if (lastFitSampleRef.current !== sample || lastFitAxesRef.current !== axisKey) {
      const center = new THREE.Vector3((finiteExtent[0] + finiteMax[0]) / 2, (finiteExtent[1] + finiteMax[1]) / 2, (finiteExtent[2] + finiteMax[2]) / 2);
      controls.target.copy(center); const span = Math.max(...ranges); const distance = Math.max(5, span * 2.5); fitDistanceRef.current = distance; camera.position.set(center.x + distance * .62, center.y + distance * .58, center.z + distance * .72); camera.near = Math.max(.01, span / 1000); camera.far = Math.max(1000, span * 100);
      if (camera instanceof THREE.PerspectiveCamera) camera.aspect = (host.current?.clientWidth ?? 1) / Math.max(1, host.current?.clientHeight ?? 1);
      else { const aspect = (host.current?.clientWidth ?? 1) / Math.max(1, host.current?.clientHeight ?? 1); camera.left = -distance * .48 * aspect; camera.right = distance * .48 * aspect; camera.top = distance * .48; camera.bottom = -distance * .48; }
      camera.updateProjectionMatrix(); controls.update(); onCameraRef.current({ x: camera.position.x - center.x, y: camera.position.y - center.y, z: camera.position.z - center.z });
      lastFitSampleRef.current = sample; lastFitAxesRef.current = axisKey;
    }
    const grid = scene.getObjectByName('floor-grid'); if (grid) grid.visible = color.showGrid;
    const worldAxes = scene.getObjectByName('world-axes'); if (worldAxes) worldAxes.visible = color.showGrid;
  }, [sample, axes, color.wireframe, color.contrast, color.logMagnitude, color.saturation, color.showGrid]);

  useEffect(() => {
    const camera = cameraRef.current; const controls = controlsRef.current; if (!camera || !controls) return;
    const target = controls.target; const distance = fitDistanceRef.current || camera.position.distanceTo(target) || 9;
    if (cameraView.kind === 'top') camera.position.set(target.x, target.y, target.z + distance);
    else if (cameraView.kind === 'front') camera.position.set(target.x, target.y + distance, target.z + distance * .15);
    else if (cameraView.kind === 'side') camera.position.set(target.x + distance, target.y, target.z + distance * .15);
    else camera.position.set(target.x + distance * .62, target.y + distance * .58, target.z + distance * .72);
    camera.updateProjectionMatrix(); controls.update();
    if (cameraView.key > 0) { const offset = camera.position.clone().sub(target); onCameraRef.current({ x: offset.x, y: offset.y, z: offset.z }); }
  }, [cameraView.key, cameraView.kind]);

  useEffect(() => {
    const currentCamera = cameraRef.current; const controls = controlsRef.current; if (!currentCamera || !controls || !sample || !camera) return;
    currentCamera.position.copy(controls.target).add(new THREE.Vector3(camera.x, camera.y, camera.z)); controls.update();
  }, [sample?.id, camera?.x, camera?.y, camera?.z]);

  const pointer = (event: PointerEvent<HTMLDivElement>) => {
    const mesh = meshRef.current; const renderer = rendererRef.current; const camera = cameraRef.current; const source = sampleRef.current;
    if (!mesh || !renderer || !camera || !source) return;
    const rect = renderer.domElement.getBoundingClientRect(); const mouse = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(mouse, camera); const hit = ray.intersectObject(mesh, false)[0];
    if (!hit?.face) return;
    const n = source.resolution; const k0 = hit.face.a; const k1 = hit.face.b; const k2 = hit.face.c; const bary = hit.barycoord ?? new THREE.Vector3(1 / 3, 1 / 3, 1 / 3);
    const getInput = (k: number) => [source.domain.xmin + (source.domain.xmax - source.domain.xmin) * (k % n) / (n - 1), source.domain.ymin + (source.domain.ymax - source.domain.ymin) * Math.floor(k / n) / (source.rows - 1)];
    const p0 = getInput(k0); const p1 = getInput(k1); const p2 = getInput(k2);
    onInspectRef.current(p0[0] * bary.x + p1[0] * bary.y + p2[0] * bary.z, p0[1] * bary.x + p1[1] * bary.y + p2[1] * bary.z);
  };
  const label = (value: QuantityKey) => ({ inputRe: 'Re(z)', inputIm: 'Im(z)', outputRe: 'Re(f)', outputIm: 'Im(f)', magnitude: '|f(z)|', phase: 'arg(f)' })[value];
  return <div className="surface-host" ref={host} onPointerMove={pointer} onPointerLeave={() => onLeaveRef.current()} onDoubleClick={() => onResetRef.current()}><div className="axis-label label-x">X · {label(axes.x)}</div><div className="axis-label label-y">Y · {label(axes.y)}</div><div className="axis-label label-z">Z · {label(axes.z)}</div><div className="webgl-watermark">WEBGL · REAL-TIME SURFACE</div></div>;
}
