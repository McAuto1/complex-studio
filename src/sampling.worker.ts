import { all, create, type MathNode } from 'mathjs';
import { normalizeExpression } from './mathExpression';

const math = create(all, { predictable: true });
const workerPostMessage = (message: unknown, transfer?: Transferable[]) =>
  (self as unknown as { postMessage: (data: unknown, transfer?: Transferable[]) => void }).postMessage(message, transfer);
type Job = {
  id: number; expression: string; mode: 'surface' | 'domain' | 'cartesian';
  xmin: number; xmax: number; ymin: number; ymax: number; resolution: number; resolutionY?: number;
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
    for (let j = 0; j < ny; j++) {
      const y = ny === 1 ? 0 : job.ymin + (job.ymax - job.ymin) * j / (ny - 1);
      for (let k = 0; k < nx; k++) {
        const x = job.xmin + (job.xmax - job.xmin) * k / Math.max(1, nx - 1);
        const idx = j * nx + k;
        try {
          const input = math.complex(x, y);
          const output = evaluate.evaluate({ x, y, t: 0, z: input, i: math.complex(0, 1) });
          const value = math.isComplex(output) ? output : math.complex(output as number);
          if (Number.isFinite(value.re) && Number.isFinite(value.im) && Math.abs(value.re) < 1e12 && Math.abs(value.im) < 1e12) {
            re[idx] = value.re; im[idx] = value.im; valid[idx] = 1;
          } else { re[idx] = NaN; im[idx] = NaN; }
        } catch { re[idx] = NaN; im[idx] = NaN; }
      }
    }
    workerPostMessage({ id: job.id, type: 'result', resolution: job.resolution, rows: ny, re, im, valid }, [re.buffer, im.buffer, valid.buffer]);
  } catch (error) {
    workerPostMessage({ id: job.id, type: 'error', message: error instanceof Error ? error.message : 'Invalid expression' });
  }
};

export type SampleResult = { id: number; type: 'result'; resolution: number; rows: number; re: Float32Array; im: Float32Array; valid: Uint8Array };
export type SampleError = { id: number; type: 'error'; message: string };
export type SampleMessage = SampleResult | SampleError;
