import type { PlotMode } from './Renderers';

export type Quality = 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High' | 'Custom';
export type Dimension = '2D' | '3D';
export type Projection = 'perspective' | 'orthographic';
export type Mapping = 'inputRe' | 'inputIm' | 'outputRe' | 'outputIm' | 'magnitude' | 'phase';
export type FitMode = 'Robust' | 'All' | 'Manual';
export type Vec3 = { x: number; y: number; z: number };
export type CameraSnapshot = { position: Vec3; target: Vec3; orthographicZoom: number; orthographicHeight: number };
export type LegacyCameraOffset = { offset: Vec3 };
export type SavedCamera = CameraSnapshot | LegacyCameraOffset | null;

export type DisplayOptions = {
  show2DGrid: boolean;
  show2DLabels: boolean;
  show2DLegend: boolean;
  show3DAxes: boolean;
  show3DGrid: boolean;
  show3DAxisLabels: boolean;
  show3DSurface: boolean;
  show3DWireframe: boolean;
  show3DLegend: boolean;
  asymptoteEnhancement: boolean;
};

export type Complex3DFunction = {
  id: string;
  expression: string;
  visible: boolean;
  colorMode: 'solid' | 'domain';
  solidColor: string;
};

export type AppConfig = {
  complex3DFunctions: Complex3DFunction[];
  activeComplex3DFunctionId: string;
  expression: string;
  dimension: Dimension;
  plotMode: PlotMode;
  quality: Quality;
  cartesian2DDomain: { xmin: number; xmax: number; ymin: number; ymax: number };
  complex2DDomain: { xmin: number; xmax: number; ymin: number; ymax: number };
  cartesian3DDomain: { xmin: number; xmax: number; ymin: number; ymax: number };
  complex3DDomain: { xmin: number; xmax: number; ymin: number; ymax: number };
  resolution: { x: number; y: number };
  projection: Projection;
  axes: { x: Mapping; y: Mapping; z: Mapping };
  color: { contrast: number; saturation: number; logMagnitude: boolean; contours: boolean };
  display: DisplayOptions;
  fitMode: FitMode;
  manualY: { min: number; max: number };
  manualCameraDistance: number;
  camera: SavedCamera;
};

const DEFAULT_DOMAIN = { xmin: -3, xmax: 3, ymin: -3, ymax: 3 };

export const DEFAULT_CONFIG: AppConfig = {
  complex3DFunctions: [{ id: 'f1', expression: 'sin(z)', visible: true, colorMode: 'domain', solidColor: '#3b82f6' }],
  activeComplex3DFunctionId: 'f1',
  expression: 'sin(z)', dimension: '3D', plotMode: 'cartesian', quality: 'Medium',
  cartesian2DDomain: { ...DEFAULT_DOMAIN },
  complex2DDomain: { ...DEFAULT_DOMAIN },
  cartesian3DDomain: { ...DEFAULT_DOMAIN },
  complex3DDomain: { ...DEFAULT_DOMAIN },
  resolution: { x: 128, y: 128 }, projection: 'perspective',
  axes: { x: 'inputRe', y: 'inputIm', z: 'outputRe' },
  color: { contrast: 1.1, saturation: 0.9, logMagnitude: true, contours: false },
  display: {
    show2DGrid: true, show2DLabels: true, show2DLegend: true,
    show3DAxes: true, show3DGrid: true, show3DAxisLabels: true,
    show3DSurface: true, show3DWireframe: false, show3DLegend: true,
    asymptoteEnhancement: true,
  },
  fitMode: 'Robust', manualY: { min: -5, max: 5 }, manualCameraDistance: 9,
  camera: null,
};

export type ProjectDocument = {
  formatVersion: 1;
  application: 'Complex Studio';
  visualization: Omit<AppConfig, 'camera'>;
  camera: SavedCamera;
};

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const pick = <T extends string>(value: unknown, choices: readonly T[], fallback: T): T =>
  typeof value === 'string' && (choices as readonly string[]).includes(value) ? value as T : fallback;
const numberOr = (value: unknown, fallback: number) => finite(value) ? value : fallback;
const booleanOr = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const vec3 = (value: unknown): Vec3 | null => {
  if (!isRecord(value) || !finite(value.x) || !finite(value.y) || !finite(value.z)) return null;
  return { x: clamp(value.x, -1e9, 1e9), y: clamp(value.y, -1e9, 1e9), z: clamp(value.z, -1e9, 1e9) };
};

function readCamera(value: unknown): SavedCamera {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return null;
  const position = vec3(value.position);
  const target = vec3(value.target);
  if (position && target && finite(value.orthographicZoom) && value.orthographicZoom > 0) {
    return {
      position, target,
      orthographicZoom: clamp(value.orthographicZoom, 0.01, 1000),
      orthographicHeight: clamp(numberOr(value.orthographicHeight, 8.64), 0.01, 1e6),
    };
  }
  // Prior JSON files stored only a camera offset from OrbitControls.target.
  const offset = vec3(value.offset) ?? vec3(value);
  return offset ? { offset } : null;
}

function readDomain(input: unknown, fallback: { xmin: number, xmax: number, ymin: number, ymax: number }) {
  const source = isRecord(input) ? input : {};
  const candidate = {
    xmin: clamp(numberOr(source.xmin, fallback.xmin), -1e9, 1e9),
    xmax: clamp(numberOr(source.xmax, fallback.xmax), -1e9, 1e9),
    ymin: clamp(numberOr(source.ymin, fallback.ymin), -1e9, 1e9),
    ymax: clamp(numberOr(source.ymax, fallback.ymax), -1e9, 1e9),
  };
  return candidate.xmin < candidate.xmax && candidate.ymin < candidate.ymax ? candidate : { ...fallback };
}

function normalizeConfig(source: RecordValue, cameraOverride?: unknown): AppConfig {
  const legacyExpression = typeof source.expression === 'string' ? source.expression : DEFAULT_CONFIG.expression;
  const complex3DFunctions = Array.isArray(source.complex3DFunctions) ? source.complex3DFunctions : [{
    id: 'f1',
    expression: legacyExpression,
    visible: true,
    colorMode: 'domain',
    solidColor: '#3b82f6'
  }];
  const activeComplex3DFunctionId = typeof source.activeComplex3DFunctionId === 'string' ? source.activeComplex3DFunctionId : complex3DFunctions[0].id;
  const legacyDomain = readDomain(source.domain, DEFAULT_DOMAIN);

  const cartesian2DDomain = readDomain(source.cartesian2DDomain ?? source.domain, legacyDomain);
  const complex2DDomain = readDomain(source.complex2DDomain ?? source.domain, legacyDomain);
  const cartesian3DDomain = readDomain(source.cartesian3DDomain ?? source.domain, legacyDomain);
  const complex3DDomain = readDomain(source.complex3DDomain ?? source.domain, legacyDomain);

  const resolutionInput = isRecord(source.resolution) ? source.resolution : {};
  const resolution = {
    x: Math.round(clamp(numberOr(resolutionInput.x, DEFAULT_CONFIG.resolution.x), 16, 1024)),
    y: Math.round(clamp(numberOr(resolutionInput.y, DEFAULT_CONFIG.resolution.y), 16, 1024)),
  };
  const axesInput = isRecord(source.axes) ? source.axes : {};
  const colorInput = isRecord(source.color) ? source.color : {};
  const displayInput = isRecord(source.display) ? source.display : {};
  const legacyGrid = booleanOr(colorInput.showGrid, true);
  const display: DisplayOptions = {
    show2DGrid: booleanOr(displayInput.show2DGrid, legacyGrid),
    show2DLabels: booleanOr(displayInput.show2DLabels, legacyGrid),
    show2DLegend: booleanOr(displayInput.show2DLegend, true),
    show3DAxes: booleanOr(displayInput.show3DAxes, legacyGrid),
    show3DGrid: booleanOr(displayInput.show3DGrid, legacyGrid),
    show3DAxisLabels: booleanOr(displayInput.show3DAxisLabels, true),
    show3DSurface: booleanOr(displayInput.show3DSurface, true),
    show3DWireframe: booleanOr(displayInput.show3DWireframe, booleanOr(colorInput.wireframe, false)),
    show3DLegend: booleanOr(displayInput.show3DLegend, true),
    asymptoteEnhancement: booleanOr(displayInput.asymptoteEnhancement, true),
  };
  const manualInput = isRecord(source.manualY) ? source.manualY : {};
  const manualCandidate = {
    min: clamp(numberOr(manualInput.min, DEFAULT_CONFIG.manualY.min), -1e12, 1e12),
    max: clamp(numberOr(manualInput.max, DEFAULT_CONFIG.manualY.max), -1e12, 1e12),
  };
  const manualY = manualCandidate.min < manualCandidate.max ? manualCandidate : DEFAULT_CONFIG.manualY;
  const expression = typeof source.expression === 'string' && source.expression.length <= 4096
    ? source.expression : DEFAULT_CONFIG.expression;
  const camera = readCamera(cameraOverride === undefined ? source.camera : cameraOverride);
  return {
    expression,
    complex3DFunctions,
    activeComplex3DFunctionId,
    dimension: pick(source.dimension, ['2D', '3D'] as const, DEFAULT_CONFIG.dimension),
    plotMode: pick(source.plotMode, ['cartesian', 'domain', 'magnitude', 'phase', 'contours', 'vector'] as const, DEFAULT_CONFIG.plotMode),
    quality: pick(source.quality, ['Very Low', 'Low', 'Medium', 'High', 'Very High', 'Custom'] as const, DEFAULT_CONFIG.quality),
    cartesian2DDomain, complex2DDomain, cartesian3DDomain, complex3DDomain, resolution,
    projection: pick(source.projection, ['perspective', 'orthographic'] as const, DEFAULT_CONFIG.projection),
    axes: {
      x: pick(axesInput.x, ['inputRe', 'inputIm', 'outputRe', 'outputIm', 'magnitude', 'phase'] as const, DEFAULT_CONFIG.axes.x),
      y: pick(axesInput.y, ['inputRe', 'inputIm', 'outputRe', 'outputIm', 'magnitude', 'phase'] as const, DEFAULT_CONFIG.axes.y),
      z: pick(axesInput.z, ['inputRe', 'inputIm', 'outputRe', 'outputIm', 'magnitude', 'phase'] as const, DEFAULT_CONFIG.axes.z),
    },
    color: {
      contrast: clamp(numberOr(colorInput.contrast, DEFAULT_CONFIG.color.contrast), 0.4, 2.8),
      saturation: clamp(numberOr(colorInput.saturation, DEFAULT_CONFIG.color.saturation), 0, 1),
      logMagnitude: booleanOr(colorInput.logMagnitude, DEFAULT_CONFIG.color.logMagnitude),
      contours: booleanOr(colorInput.contours, DEFAULT_CONFIG.color.contours),
    },
    display,
    fitMode: pick(source.fitMode, ['Robust', 'All', 'Manual'] as const, DEFAULT_CONFIG.fitMode),
    manualY,
    manualCameraDistance: clamp(numberOr(source.manualCameraDistance, DEFAULT_CONFIG.manualCameraDistance), 1, 100000),
    camera,
  };
}

export function serializeProject(config: AppConfig): ProjectDocument {
  const { camera, ...visualization } = config;
  return { formatVersion: 1, application: 'Complex Studio', visualization, camera };
}

export function deserializeProject(input: unknown): AppConfig {
  if (!isRecord(input)) throw new Error('Project file must contain a JSON object.');
  if ('formatVersion' in input) {
    if (input.formatVersion !== 1) throw new Error('This project uses an unsupported format version.');
    if (input.application !== 'Complex Studio' || !isRecord(input.visualization)) throw new Error('This is not a valid Complex Studio project.');
    return normalizeConfig(input.visualization, input.camera);
  }
  // Legacy unversioned JSON configuration.
  return normalizeConfig(input);
}
