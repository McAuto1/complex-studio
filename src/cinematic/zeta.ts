/**
 * High-performance, numerically robust Riemann Zeta function evaluation
 * over the entire complex plane s = sigma + i*t.
 * 
 * Based on Borwein's algorithm (1995) / Xavier Gourdon & Pascal Sebah (2003)
 * with Riemann's functional reflection equation for sigma < -(n - 1) / 2.
 */

// Complex number structure
export interface ComplexVal {
  re: number;
  im: number;
}

export interface ZetaResult {
  re: number;
  im: number;
  abs: number;
  arg: number;
}

// Precomputed Borwein d(k, n) tables for n = 15 .. 60
const dTable: Record<number, Float64Array> = {};

function fact(x: number): number {
  let r = 1;
  for (let i = 2; i <= x; i++) r *= i;
  return r;
}

function computeD(k: number, n: number): number {
  let S = k;
  for (let j = k; j <= n; j++) {
    const factor = (fact(n + j - 1) * Math.pow(4, j)) / (fact(n - j) * fact(2 * j));
    S += factor;
  }
  return n * S;
}

for (let n = 15; n <= 60; n++) {
  const arr = new Float64Array(n + 1);
  for (let k = 0; k <= n; k++) {
    arr[k] = computeD(k, n);
  }
  dTable[n] = arr;
}

// Complex arithmetic helpers
function cMult(aRe: number, aIm: number, bRe: number, bIm: number): [number, number] {
  return [aRe * bRe - aIm * bIm, aRe * bIm + aIm * bRe];
}

function cDiv(aRe: number, aIm: number, bRe: number, bIm: number): [number, number] {
  const d = bRe * bRe + bIm * bIm;
  if (d === 0) return [0, 0];
  return [(aRe * bRe + aIm * bIm) / d, (aIm * bRe - aRe * bIm) / d];
}

function cSin(re: number, im: number): [number, number] {
  return [Math.sin(re) * Math.cosh(im), Math.cos(re) * Math.sinh(im)];
}

function cPow(base: number, re: number, im: number): [number, number] {
  const l = Math.log(base);
  const mag = Math.pow(base, re);
  const ang = im * l;
  return [mag * Math.cos(ang), mag * Math.sin(ang)];
}

// Lanczos approximation for Gamma(s) with g = 7
const LANCZOS_G = 7;
const LANCZOS_P = [
  0.99999999999980993,
  676.5203681287051,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.138571095836526,
  9.9843695780195716e-6,
  1.5056327351493116e-7
];

function cGamma(re: number, im: number): [number, number] {
  if (re < 0.5) {
    // Reflection formula: Gamma(1 - z) * Gamma(z) = pi / sin(pi * z)
    const [sinRe, sinIm] = cSin(Math.PI * re, Math.PI * im);
    const [gRe, gIm] = cGamma(1 - re, -im);
    const [denRe, denIm] = cMult(sinRe, sinIm, gRe, gIm);
    return cDiv(Math.PI, 0, denRe, denIm);
  }
  const zRe = re - 1;
  const zIm = im;
  let xRe = LANCZOS_P[0];
  let xIm = 0;
  for (let i = 1; i < LANCZOS_G + 2; i++) {
    const denomRe = zRe + i;
    const denomIm = zIm;
    const [tRe, tIm] = cDiv(LANCZOS_P[i], 0, denomRe, denomIm);
    xRe += tRe;
    xIm += tIm;
  }
  const tRe = zRe + LANCZOS_G + 0.5;
  const tIm = zIm;
  const rT = Math.hypot(tRe, tIm);
  const thetaT = Math.atan2(tIm, tRe);
  const lnTRe = Math.log(rT);
  const lnTIm = thetaT;
  const expPRe = (zRe + 0.5) * lnTRe - zIm * lnTIm;
  const expPIm = (zRe + 0.5) * lnTIm + zIm * lnTRe;
  const magP = Math.exp(expPRe - tRe);
  const angP = expPIm - tIm;
  const [powRe, powIm] = [magP * Math.cos(angP), magP * Math.sin(angP)];
  const sqrt2pi = Math.sqrt(2 * Math.PI);
  const [res1Re, res1Im] = cMult(powRe, powIm, xRe, xIm);
  return [res1Re * sqrt2pi, res1Im * sqrt2pi];
}

/**
 * Evaluate the Riemann Zeta function at s = sigma + i*t
 */
export function evaluateZeta(sigma: number, t: number): ZetaResult {
  // Simple pole at s = 1 + 0i
  const distToPole = Math.hypot(sigma - 1, t);
  if (distToPole < 1e-6) {
    // Principal part near pole: zeta(s) ~ 1 / (s - 1) + gamma_euler
    const denomSq = (sigma - 1) * (sigma - 1) + t * t;
    if (denomSq === 0) {
      return { re: 1e6, im: 0, abs: 1e6, arg: 0 };
    }
    const invRe = (sigma - 1) / denomSq + 0.5772156649;
    const invIm = -t / denomSq;
    const abs = Math.min(1e6, Math.hypot(invRe, invIm));
    return { re: invRe, im: invIm, abs, arg: Math.atan2(invIm, invRe) };
  }

  // To avoid numeric cancellation when sigma is near 1
  let sRe = sigma;
  if (Math.abs(sigma - 1) < 1e-8) {
    sRe = 1 + (sigma >= 1 ? 1e-8 : -1e-8);
  }

  const n = Math.min(55, Math.max(16, Math.round(1.3 * 15 + 0.9 * Math.abs(t))));
  if (sRe > -(n - 1) / 2) {
    const d = dTable[n] || dTable[55];
    const p2 = Math.pow(2, 1 - sRe);
    const ang2 = -t * Math.LN2;
    const denA = 1 - p2 * Math.cos(ang2);
    const denB = -p2 * Math.sin(ang2);
    const d0 = d[0];
    const denomRe = d0 * denA;
    const denomIm = d0 * denB;
    let sSumRe = 0;
    let sSumIm = 0;
    for (let k = 1; k <= n; k++) {
      const dk = d[k];
      const sign = (k % 2 === 1) ? 1 : -1;
      const coeff = sign * dk;
      const pk = Math.pow(k, -sRe);
      const angk = -t * Math.log(k);
      sSumRe += coeff * pk * Math.cos(angk);
      sSumIm += coeff * pk * Math.sin(angk);
    }
    const dsq = denomRe * denomRe + denomIm * denomIm;
    if (dsq === 0) return { re: 0, im: 0, abs: 0, arg: 0 };
    const re = (sSumRe * denomRe + sSumIm * denomIm) / dsq;
    const im = (sSumIm * denomRe - sSumRe * denomIm) / dsq;
    return { re, im, abs: Math.hypot(re, im), arg: Math.atan2(im, re) };
  } else {
    // Functional equation reflection for Re(s) < -(n-1)/2
    // zeta(s) = 2^s * pi^{s-1} * sin(pi*s/2) * Gamma(1-s) * zeta(1-s)
    const [p2Re, p2Im] = cPow(2, sRe, t);
    const [piRe, piIm] = cPow(Math.PI, sRe - 1, t);
    const [sinRe, sinIm] = cSin(Math.PI * sRe / 2, Math.PI * t / 2);
    const [gRe, gIm] = cGamma(1 - sRe, -t);
    const z1 = evaluateZeta(1 - sRe, -t);
    let [cRe, cIm] = cMult(p2Re, p2Im, piRe, piIm);
    [cRe, cIm] = cMult(cRe, cIm, sinRe, sinIm);
    [cRe, cIm] = cMult(cRe, cIm, gRe, gIm);
    const [resRe, resIm] = cMult(cRe, cIm, z1.re, z1.im);
    return { re: resRe, im: resIm, abs: Math.hypot(resRe, resIm), arg: Math.atan2(resIm, resRe) };
  }
}

/**
 * Standard known nontrivial zero heights on the critical line Re(s) = 0.5
 */
export const KNOWN_NONTRIVIAL_ZEROS = [
  14.134725,
  21.022040,
  25.010858,
  30.424876,
  32.935062
];

/**
 * Convert complex phase angle (arg in [-pi, pi]) to RGB [0..1, 0..1, 0..1]
 * using a refined scientific domain-coloring palette.
 */
export function phaseToRgb(arg: number, saturation: number = 0.85, lightness: number = 0.5): [number, number, number] {
  // Hue normalized to [0, 1)
  let h = (arg + Math.PI) / (2 * Math.PI);
  h = ((h % 1) + 1) % 1;
  
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  
  const hue2rgb = (t: number) => {
    let tc = t;
    if (tc < 0) tc += 1;
    if (tc > 1) tc -= 1;
    if (tc < 1 / 6) return p + (q - p) * 6 * tc;
    if (tc < 1 / 2) return q;
    if (tc < 2 / 3) return p + (q - p) * (2 / 3 - tc) * 6;
    return p;
  };
  
  return [hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3)];
}
