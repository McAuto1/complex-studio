import { all, create, type MathNode } from 'mathjs';
import { normalizeExpression } from './mathExpression';
import { detectCartesianBreaks, detectCartesianCandidates } from './asymptotes';

const math = create(all, { predictable: true });
const workerPostMessage = (message: unknown, transfer?: Transferable[]) =>
  (self as unknown as { postMessage: (data: unknown, transfer?: Transferable[]) => void }).postMessage(message, transfer);
type Job = {
  id: number; expression: string; mode: 'surface' | 'domain' | 'cartesian';
  xmin: number; xmax: number; ymin: number; ymax: number; resolution: number; resolutionY?: number; enhance?: boolean;
};

self.onmessage = (event: MessageEvent<Job>) => {
  const job = event.data;
  try {
    const normalized = normalizeExpression(job.expression);
    const compiled = math.parse(normalized) as MathNode;
    const evaluate = compiled.compile();
    const nx = job.mode === 'cartesian' ? job.resolution : job.resolution;
    const ny = job.mode === 'cartesian' ? 1 : job.resolutionY ?? job.resolution;
    const size = nx * ny;
    const re = new Float32Array(size); const im = new Float32Array(size); const valid = new Uint8Array(size);
    const xCoordinates = new Float64Array(nx);
    const evaluateAt = (x: number, y: number) => {
      try {
        const output = evaluate.evaluate({ x, y, t: 0, z: math.complex(x, y), i: math.complex(0, 1) });
        const value = math.isComplex(output) ? output : math.complex(output as number);
        if (Number.isFinite(value.re) && Number.isFinite(value.im) && Math.abs(value.re) < 1e12 && Math.abs(value.im) < 1e12) {
          return { x, re: value.re, im: value.im, valid: 1 };
        }
      } catch { /* An undefined point becomes a hole in the sampled curve. */ }
      return { x, re: NaN, im: NaN, valid: 0 };
    };
    for (let j = 0; j < ny; j++) {
      const y = ny === 1 ? 0 : job.ymin + (job.ymax - job.ymin) * j / (ny - 1);
      for (let k = 0; k < nx; k++) {
        const x = job.xmin + (job.xmax - job.xmin) * k / Math.max(1, nx - 1);
        if (j === 0) xCoordinates[k] = x;
        const idx = j * nx + k;
        const value = evaluateAt(x, y);
        re[idx] = value.re; im[idx] = value.im; valid[idx] = value.valid;
      }
    }
    let curve: CurveSamples | undefined;
    if (job.mode === 'cartesian') {
      let curveX = xCoordinates;
      let curveRe = re;
      let curveIm = im;
      let curveValid = valid;
      if (job.enhance && nx > 3) {
        const candidates = detectCartesianCandidates({ x: curveX, re: curveRe, im: curveIm, valid: curveValid });
        const difficult: number[] = [];
        for (let i = 0; i < candidates.length && difficult.length < 24; i++) if (candidates[i]) difficult.push(i);
        if (difficult.length) {
          const additional: ReturnType<typeof evaluateAt>[] = [];
          const refine = (left: number, right: number, depth: number) => {
            if (depth === 0 || additional.length >= 192) return;
            const middle = (left + right) / 2;
            const value = evaluateAt(middle, 0); additional.push(value);
            refine(left, middle, depth - 1); refine(middle, right, depth - 1);
          };
          for (const i of difficult) refine(curveX[i], curveX[i + 1], 3);
          const points: ReturnType<typeof evaluateAt>[] = [];
          for (let i = 0; i < nx; i++) points.push({ x: curveX[i], re: curveRe[i], im: curveIm[i], valid: curveValid[i] });
          points.push(...additional); points.sort((a, b) => a.x - b.x);
          curveX = new Float64Array(points.length); curveRe = new Float32Array(points.length);
          curveIm = new Float32Array(points.length); curveValid = new Uint8Array(points.length);
          points.forEach((point, i) => { curveX[i] = point.x; curveRe[i] = point.re; curveIm[i] = point.im; curveValid[i] = point.valid; });
        }
      }
      const curveSample = { x: curveX, re: curveRe, im: curveIm, valid: curveValid };
      curve = { ...curveSample, breaks: detectCartesianBreaks(curveSample) };
    }
    const buffers: Transferable[] = [re.buffer, im.buffer, valid.buffer];
    if (curve) buffers.push(curve.x.buffer, curve.re.buffer, curve.im.buffer, curve.valid.buffer, curve.breaks.buffer);
    const transfer = [...new Set(buffers)];
    workerPostMessage({ id: job.id, type: 'result', resolution: job.resolution, rows: ny, re, im, valid, curve }, transfer);
  } catch (error) {
    workerPostMessage({ id: job.id, type: 'error', message: error instanceof Error ? error.message : 'Invalid expression' });
  }
};

export type CurveSamples = { x: Float64Array; re: Float32Array; im: Float32Array; valid: Uint8Array; breaks: Uint8Array };
export type SampleResult = { id: number; type: 'result'; resolution: number; rows: number; re: Float32Array; im: Float32Array; valid: Uint8Array; curve?: CurveSamples };
export type SampleError = { id: number; type: 'error'; message: string };
export type SampleMessage = SampleResult | SampleError;
