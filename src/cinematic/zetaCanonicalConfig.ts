// Canonical Riemann Zeta configuration derived from RiemmanZetaConfig.json
// and shared between CinematicPage's handleZetaPreset and RiemannZetaPage.

export interface CameraStateConfig {
  mode: 'perspective' | 'orthographic';
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  zoom: number;
}

export interface CanonicalZetaConfig {
  mathematical: {
    expression: string;
    domain: {
      xMin: number;
      xMax: number;
      zMin: number;
      zMax: number;
    };
    heightMode: 'mag' | 'real' | 'imag';
    heightScale: number;
    resolution: number;
    useCustomRes: boolean;
    customResX: number;
    customResZ: number;
    heightLimitMode: 'Auto' | 'Off' | 'Custom';
    customHeightLimit: number;
  };
  presentation: {
    showGrid: boolean;
    showAxes: boolean;
    showNumericLabels: boolean;
    showAxisLabels: boolean;
    labelsAlwaysVisible: boolean;
    showWrappedGrid: boolean;
    wrappedGridDensity: 'Low' | 'Medium' | 'High';
    showCriticalLine: boolean;
    showCriticalStrip: boolean;
    showKnownZeros: boolean;
    numericLabelSize: number;
    axisTitleSize: number;
    tickSpacingMode: 'auto' | 'manual';
    manualTickStep: number;
    axisRatioMode: 'default' | 'cube' | 'custom';
    customRatio: {
      re: number;
      height: number;
      im: number;
    };
    groundMagnitudeAtZero: boolean;
  };
  appearance: {
    wireframe: boolean;
    surfaceColor: string;
    colorMode: 'solid' | 'palette';
    lightBrightness: number;
    atmosphere: number;
  };
  camera: CameraStateConfig;
}

export const CANONICAL_RIEMANN_ZETA_CONFIG: CanonicalZetaConfig = {
  mathematical: {
    expression: 'zeta(z)',
    domain: {
      xMin: -7,
      xMax: 0.501,
      zMin: -65,
      zMax: 65,
    },
    heightMode: 'mag',
    heightScale: 1,
    resolution: 100,
    useCustomRes: true,
    customResX: 463,
    customResZ: 8000,
    heightLimitMode: 'Custom',
    customHeightLimit: 20,
  },
  presentation: {
    showGrid: true,
    showAxes: true,
    showNumericLabels: true,
    showAxisLabels: false,
    labelsAlwaysVisible: false,
    showWrappedGrid: true,
    wrappedGridDensity: 'High',
    showCriticalLine: true,
    showCriticalStrip: true,
    showKnownZeros: false,
    numericLabelSize: 0.014,
    axisTitleSize: 0.012,
    tickSpacingMode: 'auto',
    manualTickStep: 1,
    axisRatioMode: 'custom',
    customRatio: {
      re: 2,
      height: 0.5,
      im: 0.25,
    },
    groundMagnitudeAtZero: true,
  },
  appearance: {
    wireframe: false,
    surfaceColor: '#0f7a7a',
    colorMode: 'palette',
    lightBrightness: 0.7,
    atmosphere: 0.35,
  },
  camera: {
    mode: 'perspective',
    position: {
      x: 38.71247034362551,
      y: 3.6612697441959243,
      z: 23.744254450895912,
    },
    target: {
      x: -4.13096552313472,
      y: 1.210383630053239,
      z: 1.7711678695156614,
    },
    zoom: 1,
  },
};
