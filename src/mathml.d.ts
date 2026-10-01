import type { HTMLAttributes } from 'react';

type MathMLAttributes = HTMLAttributes<HTMLElement> & {
  display?: string;
  mathvariant?: string;
  key?: string | number;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      math: MathMLAttributes;
      mrow: MathMLAttributes;
      mn: MathMLAttributes;
      mi: MathMLAttributes;
      mo: MathMLAttributes;
      mfrac: MathMLAttributes;
      msup: MathMLAttributes;
      msqrt: MathMLAttributes;
      mtext: MathMLAttributes;
    }
  }
}

export {};
