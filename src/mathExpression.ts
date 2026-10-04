/** Normalize common TeX and handwritten notation into the parser's expression syntax. */
export function normalizeExpression(source: string): string {
  let text = source.trim()
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\pi\b/g, 'pi')
    .replace(/\\infty\b/g, 'inf')
    .replace(/\\(sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln|exp|abs|arg|Gamma|Re|Im)\b/g, '$1')
    .replace(/\bGamma(?=\s*\()/g, 'gamma')
    .replace(/\bRe(?=\s*\()/g, 're')
    .replace(/\bIm(?=\s*\()/g, 'im')
    .replace(/\\sqrt\s*\{/g, 'sqrt(');

  // Convert \frac{numerator}{denominator}, including nested brace groups.
  for (let pass = 0; pass < 8; pass++) {
    const index = text.indexOf('\\frac');
    if (index < 0) break;
    let cursor = index + 5;
    const readGroup = (): string | null => {
      while (/\s/.test(text[cursor] ?? '')) cursor++;
      if (text[cursor] !== '{') return null;
      const start = ++cursor;
      let depth = 1;
      while (cursor < text.length && depth > 0) {
        if (text[cursor] === '{') depth++;
        if (text[cursor] === '}') depth--;
        cursor++;
      }
      return depth === 0 ? text.slice(start, cursor - 1) : null;
    };
    const numerator = readGroup();
    const denominator = numerator == null ? null : readGroup();
    if (numerator == null || denominator == null) {
      text = text.replace('\\frac', 'frac');
      continue;
    }
    text = `${text.slice(0, index)}((${numerator})/(${denominator}))${text.slice(cursor)}`;
  }
  text = text.replace(/\\sqrt\(([^{}]+)\)\}/g, 'sqrt($1)')
    .replace(/[{}]/g, (brace) => brace === '{' ? '(' : ')')
    .replace(/\\/g, '')
    // In common complex notation, "iy" means i*y (math parsers tokenize "iy" as a name).
    .replace(/i(?=[xyzt])/g, 'i*');
  // Simple absolute-value bars: |z|, |f(z)|, etc.
  text = text.replace(/\|([^|]+)\|/g, 'abs($1)');
  return text;
}

export type Example = {
  label: string;
  expression: string;
  group: 'Complex' | 'Real';
  highlight?: boolean;
  title?: string;
  description?: string;
};

export const EXAMPLES: Example[] = [
  // Curated highlights
  {
    label: 'A strange power',
    title: 'A power that powers itself',
    description: 'See how raising a complex number to its own power twists the plane into intricate spirals.',
    expression: 'z^z',
    group: 'Complex',
    highlight: true
  },
  {
    label: 'A branching surface',
    title: 'A branching function',
    description: 'Explore how a square root folds the complex plane around a branch point at the origin.',
    expression: 'sqrt(z)',
    group: 'Complex',
    highlight: true
  },
  {
    label: 'Infinite spikes',
    title: 'Where the surface blows up',
    description: 'Examine two dramatic poles at ±i where the surface shoots up toward infinity.',
    expression: '1/(z^2+1)',
    group: 'Complex',
    highlight: true
  },
  {
    label: 'A wave in complex space',
    title: 'A wave in complex space',
    description: 'Watch a familiar sine wave turn into a periodic complex landscape growing exponentially off the real line.',
    expression: 'sin(z)',
    group: 'Complex',
    highlight: true
  },

  // Complex examples
  {
    label: 'Identity',
    title: 'Identity plane',
    description: 'Inspect the flat, undistorted coordinate plane where output matches input.',
    expression: 'z',
    group: 'Complex'
  },
  {
    label: 'Reciprocal',
    title: 'Singular funnel',
    description: 'See how 1/z turns the origin into an infinite funnel while pulling infinity to zero.',
    expression: '1/z',
    group: 'Complex'
  },
  {
    label: 'z to the 2',
    title: 'Quadratic twist',
    description: 'Watch how z² squares distances and doubles every angle across the plane.',
    expression: 'z^2',
    group: 'Complex'
  },
  {
    label: 'z to the 3',
    title: 'Cubic rosette',
    description: 'See three symmetric valleys and rapid radial growth across complex directions.',
    expression: 'z^3',
    group: 'Complex'
  },
  {
    label: 'Exponential',
    title: 'Exponential roll',
    description: 'Observe horizontal growth turning into periodic vertical waves with period 2πi.',
    expression: 'exp(z)',
    group: 'Complex'
  },
  {
    label: 'Exp squared',
    title: 'Exponential quadratic',
    description: 'Track extremely sharp ridges and valleys caused by squaring before exponentiating.',
    expression: 'exp(z^2)',
    group: 'Complex'
  },
  {
    label: 'Logarithm',
    title: 'Complex logarithm',
    description: 'See where log(z) wraps around the origin and branches along the negative real axis.',
    expression: 'log(z)',
    group: 'Complex'
  },
  {
    label: 'Cosine',
    title: 'Complex cosine',
    description: 'Explore bounded real oscillations turning into rapid hyperbolic growth in the imaginary direction.',
    expression: 'cos(z)',
    group: 'Complex'
  },
  {
    label: 'Tangent',
    title: 'Periodic poles',
    description: 'Inspect an endless row of singularities along the real axis spaced by π.',
    expression: 'tan(z)',
    group: 'Complex'
  },
  {
    label: 'Sinh',
    title: 'Hyperbolic sine',
    description: 'Compare smooth real exponential growth with periodic imaginary oscillations.',
    expression: 'sinh(z)',
    group: 'Complex'
  },
  {
    label: 'Cosh',
    title: 'Hyperbolic cosine',
    description: 'See hyperbolic curvature with a smooth minimum at the origin and periodic imaginary phase.',
    expression: 'cosh(z)',
    group: 'Complex'
  },
  {
    label: 'Gamma function',
    title: 'Factorial landscape',
    description: 'Explore the continuous factorial function with isolated poles at zero and negative integers.',
    expression: 'gamma(z)',
    group: 'Complex'
  },
  {
    label: 'Absolute',
    title: 'Radial cone',
    description: 'View the distance from the origin forming an inverted cone with a sharp tip at zero.',
    expression: 'abs(z)',
    group: 'Complex'
  },
  {
    label: 'Argument',
    title: 'Phase staircase',
    description: 'See the angle from -π to +π forming a spiral ramp that jumps across the branch cut.',
    expression: 'arg(z)',
    group: 'Complex'
  },

  // Real examples
  {
    label: 'Linear',
    title: 'Linear slope',
    description: 'A straight line passing through zero with constant unit slope.',
    expression: 'x',
    group: 'Real'
  },
  {
    label: 'Parabola',
    title: 'Standard parabola',
    description: 'A symmetric U-shaped curve with a single minimum at the origin.',
    expression: 'x^2',
    group: 'Real'
  },
  {
    label: 'Cubic',
    title: 'Cubic curve',
    description: 'An odd polynomial with an inflection point at the origin and opposite tails.',
    expression: 'x^3',
    group: 'Real'
  },
  {
    label: 'Sine wave',
    title: 'Pure oscillation',
    description: 'The standard periodic wave bounded smoothly between -1 and +1.',
    expression: 'sin(x)',
    group: 'Real'
  },
  {
    label: 'Gaussian',
    title: 'Bell curve',
    description: 'A smooth bell-shaped curve with unit peak decaying rapidly toward both tails.',
    expression: 'exp(-x^2)',
    group: 'Real'
  },
  {
    label: 'Sinc function',
    title: 'Wavelet envelope',
    description: 'See central unit height with decaying ripple lobes on either side.',
    expression: 'sin(x)/x',
    group: 'Real'
  },
];
