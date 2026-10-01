import type { FitMode } from './project';

export type Range = { min: number; max: number };
export type CartesianView = { range: Range; scale: 'linear' | 'symlog'; threshold: number };

export function quantile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.max(0, Math.min(sorted.length - 1, fraction * (sorted.length - 1)));
  const lower = Math.floor(position); const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function padded(min: number, max: number): Range {
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

export function cartesianView(values: ArrayLike<number>, valid: ArrayLike<number>, mode: FitMode, manual: Range): CartesianView {
  const finite: number[] = [];
  for (let i = 0; i < values.length; i++) if (valid[i] && Number.isFinite(values[i])) finite.push(values[i]);
  if (mode === 'Manual') return { range: manual.min < manual.max ? manual : { min: -5, max: 5 }, scale: 'linear', threshold: 1 };
  if (!finite.length) return { range: { min: -1, max: 1 }, scale: 'linear', threshold: 1 };
  if (mode === 'All') return { range: padded(Math.min(0, ...finite), Math.max(0, ...finite)), scale: 'linear', threshold: 1 };

  const magnitudes = finite.map(Math.abs).filter((value) => value > 0);
  const maximum = magnitudes.length ? Math.max(...magnitudes) : 0;
  const threshold = Math.max(1e-12, quantile(magnitudes, 0.5));
  // When the output spans several orders of magnitude, a symmetric-log view
  // keeps all samples represented while preventing a few tails dominating.
  if (maximum / threshold > 50) {
    const transformed = finite.map((value) => symlog(value, threshold));
    return { range: padded(Math.min(0, ...transformed), Math.max(0, ...transformed)), scale: 'symlog', threshold };
  }
  const low = quantile(finite, 0.02); const high = quantile(finite, 0.98);
  return { range: padded(Math.min(0, low), Math.max(0, high)), scale: 'linear', threshold };
}

export const symlog = (value: number, threshold: number) => Math.sign(value) * Math.asinh(Math.abs(value) / threshold);
export const inverseSymlog = (value: number, threshold: number) => Math.sign(value) * threshold * Math.sinh(Math.abs(value));

export function fittedBounds(
  points: Float32Array,
  valid: (index: number) => boolean,
  mode: Exclude<FitMode, 'Manual'>,
  vertices: number,
  preserveAxes: [boolean, boolean, boolean] = [false, false, false],
  maxRobustSpan?: number,
): { min: [number, number, number]; max: [number, number, number] } {
  const values: [number[], number[], number[]] = [[], [], []];
  const actualMin: [number, number, number] = [Infinity, Infinity, Infinity];
  const actualMax: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const stride = Math.max(1, Math.ceil(vertices / 8192));
  for (let k = 0; k < vertices; k++) {
    if (!valid(k)) continue;
    for (let axis = 0; axis < 3; axis++) {
      const value = points[k * 3 + axis];
      if (!Number.isFinite(value)) continue;
      actualMin[axis] = Math.min(actualMin[axis], value); actualMax[axis] = Math.max(actualMax[axis], value);
      // Bound robust-fit sorting cost for custom million-vertex grids.
      if (mode === 'Robust' && k % stride === 0) values[axis].push(value);
    }
  }
  const min: [number, number, number] = [0, 0, 0]; const max: [number, number, number] = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    if (!Number.isFinite(actualMin[axis])) { min[axis] = -1; max[axis] = 1; continue; }
    if (mode === 'All' || preserveAxes[axis]) {
      min[axis] = actualMin[axis]; max[axis] = actualMax[axis];
    } else {
      const sampled = values[axis].length ? values[axis] : [actualMin[axis], actualMax[axis]];
      const center = quantile(sampled, 0.5);
      const deviations = sampled.map((value) => Math.abs(value - center));
      const mad = quantile(deviations, 0.5);
      if (mad > Number.EPSILON * Math.max(1, Math.abs(center))) {
        // Median absolute deviation limits camera influence from sparse tails
        // while preserving the original sample values for All/export modes.
        const radius = 4 * mad;
        min[axis] = Math.max(actualMin[axis], center - radius);
        max[axis] = Math.min(actualMax[axis], center + radius);
      } else {
        min[axis] = quantile(sampled, 0.02); max[axis] = quantile(sampled, 0.98);
      }
      if (maxRobustSpan !== undefined && maxRobustSpan > 0 && max[axis] - min[axis] > maxRobustSpan) {
        if (min[axis] >= 0) max[axis] = Math.min(actualMax[axis], min[axis] + maxRobustSpan);
        else if (max[axis] <= 0) min[axis] = Math.max(actualMin[axis], max[axis] - maxRobustSpan);
        else {
          const middle = (min[axis] + max[axis]) / 2;
          min[axis] = Math.max(actualMin[axis], middle - maxRobustSpan / 2);
          max[axis] = Math.min(actualMax[axis], middle + maxRobustSpan / 2);
        }
      }
    }
    if (min[axis] === max[axis]) { min[axis] -= 0.5; max[axis] += 0.5; }
  }
  return { min, max };
}
