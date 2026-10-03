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

export type Example = { label: string, expression: string, group: 'Complex' | 'Real', highlight?: boolean, title?: string, description?: string };
export const EXAMPLES: Example[] = [
  { label: 'A strange power', title: 'A power that powers itself', description: 'Watch an unusual power create intricate structure.', expression: 'z^z', group: 'Complex', highlight: true },
  { label: 'A branching surface', title: 'A branching function', description: 'See how a square root behaves across the complex plane.', expression: 'sqrt(z)', group: 'Complex', highlight: true },
  { label: 'Infinite spikes', title: 'Where the surface blows up', description: 'Explore the dramatic behavior around its singularities.', expression: '1/(z^2+1)', group: 'Complex', highlight: true },
  { label: 'A wave in complex space', title: 'A wave in complex space', description: 'A familiar sine function behaves very differently here.', expression: 'sin(z)', group: 'Complex', highlight: true },
  { label: 'Identity', expression: 'z', group: 'Complex' },
  { label: 'Reciprocal', expression: '1/z', group: 'Complex' },
  { label: 'z to the 2', expression: 'z^2', group: 'Complex' },
  { label: 'z to the 3', expression: 'z^3', group: 'Complex' },
  { label: 'Exponential', expression: 'exp(z)', group: 'Complex' },
  { label: 'Exp squared', expression: 'exp(z^2)', group: 'Complex' },
  { label: 'Logarithm', expression: 'log(z)', group: 'Complex' },
  { label: 'Cosine', expression: 'cos(z)', group: 'Complex' },
  { label: 'Tangent', expression: 'tan(z)', group: 'Complex' },
  { label: 'Sinh', expression: 'sinh(z)', group: 'Complex' },
  { label: 'Cosh', expression: 'cosh(z)', group: 'Complex' },
  { label: 'Gamma function', expression: 'gamma(z)', group: 'Complex' },
  { label: 'Absolute', expression: 'abs(z)', group: 'Complex' },
  { label: 'Argument', expression: 'arg(z)', group: 'Complex' },
  { label: 'Linear', expression: 'x', group: 'Real' },
  { label: 'Parabola', expression: 'x^2', group: 'Real' },
  { label: 'Cubic', expression: 'x^3', group: 'Real' },
  { label: 'Sine wave', expression: 'sin(x)', group: 'Real' },
  { label: 'Gaussian', expression: 'exp(-x^2)', group: 'Real' },
  { label: 'Sinc function', expression: 'sin(x)/x', group: 'Real' },
];
