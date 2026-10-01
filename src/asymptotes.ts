export type BreakSample = {
  x: ArrayLike<number>;
  re: ArrayLike<number>;
  im: ArrayLike<number>;
  valid: ArrayLike<number>;
};

type ComplexStep = { re: number; im: number };

function step(sample: BreakSample, a: number, b: number): ComplexStep {
  const dx = sample.x[b] - sample.x[a];
  if (!Number.isFinite(dx) || dx === 0) return { re: NaN, im: NaN };
  return {
    re: (sample.re[b] - sample.re[a]) / dx,
    im: (sample.im[b] - sample.im[a]) / dx,
  };
}

function magnitude(value: ComplexStep): number {
  return Math.hypot(value.re, value.im);
}

function dot(a: ComplexStep, b: ComplexStep): number {
  return a.re * b.re + a.im * b.im;
}

function localSteps(sample: BreakSample, i: number) {
  const before = step(sample, i - 1, i);
  const jump = step(sample, i, i + 1);
  const after = step(sample, i + 1, i + 2);
  const beforeSize = magnitude(before);
  const jumpSize = magnitude(jump);
  const afterSize = magnitude(after);
  const scale = Math.max(beforeSize, afterSize, Number.EPSILON);
  return {
    reversal: dot(before, jump) < 0 && dot(jump, after) < 0,
    slopeRatio: jumpSize / scale,
    beforeSize,
    jumpSize,
    afterSize,
  };
}

function hasFourFiniteSamples(sample: BreakSample, i: number): boolean {
  return sample.valid[i - 1] === 1 && sample.valid[i] === 1 &&
    sample.valid[i + 1] === 1 && sample.valid[i + 2] === 1 &&
    [i - 1, i, i + 1, i + 2].every((k) =>
      Number.isFinite(sample.x[k]) && Number.isFinite(sample.re[k]) && Number.isFinite(sample.im[k]),
    );
}

/**
 * Finds intervals worth checking more closely. These are only refinement
 * candidates: a large secant by itself never becomes a visual break.
 *
 * Secants are divided by their real domain spacing, so this continues to work
 * after the worker has inserted non-uniform samples around a difficult region.
 */
export function detectCartesianCandidates(sample: BreakSample): Uint8Array {
  const count = sample.re.length;
  const candidates = new Uint8Array(Math.max(0, count - 1));
  for (let i = 1; i < count - 2; i++) {
    if (!hasFourFiniteSamples(sample, i)) continue;
    const local = localSteps(sample, i);

    // Pole-like reversals are worth refinement even when their sampled jump
    // only slightly exceeds adjacent secants (as often happens for tan(x)).
    // A very steep monotone interval is also refined, then rejected unless the
    // actual samples provide singularity evidence.
    if ((local.reversal && local.slopeRatio >= 1.02) || local.slopeRatio >= 5) candidates[i] = 1;
  }
  return candidates;
}

/**
 * Marks only intervals with a pole-like local reversal. Smooth large slopes,
 * including steep monotone transitions, remain connected. Invalid samples are
 * handled by the renderer as actual holes rather than inferred breaks.
 */
export function detectCartesianBreaks(sample: BreakSample): Uint8Array {
  const count = sample.re.length;
  const breaks = new Uint8Array(Math.max(0, count - 1));
  for (let i = 1; i < count - 2; i++) {
    if (!hasFourFiniteSamples(sample, i)) continue;
    const local = localSteps(sample, i);

    // A pole reverses the complex secant direction on both sides and creates
    // a larger spacing-normalized change across the suspected interval. The
    // permissive refinement threshold is paired with this two-sided evidence;
    // it is intentionally not a global output-magnitude cutoff.
    if (local.reversal && local.slopeRatio >= 1.04) breaks[i] = 1;
  }
  return breaks;
}
