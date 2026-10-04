import { useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as math from 'mathjs';
import { evaluateZeta, KNOWN_NONTRIVIAL_ZEROS, phaseToRgb } from './zeta';

export interface CinematicSceneRef {
  getCameraState: () => { position: { x: number, y: number, z: number }, target: { x: number, y: number, z: number }, zoom: number };
  setCameraState: (state: any) => void;
  fitScene: () => void;
  resetView: () => void;
  applyPreset: (preset: string) => void;
  exportPNG: (w?: number, h?: number) => string | null;
}

export interface SceneConfig {
  expression: string;
  heightMode: 'mag' | 'real' | 'imag';
  heightScale: number;
  resolutionX: number;
  resolutionZ: number;
  heightLimitMode?: 'Auto' | 'Off' | 'Custom';
  customHeightLimit?: number | null;
  lightBrightness?: number;
  surfaceColor?: string;
  atmosphere?: number;
  colorMode?: 'solid' | 'palette';
  domain: { xMin: number, xMax: number, zMin: number, zMax: number };
  // Wrapped grid controls
  showWrappedGrid?: boolean;
  wrappedGridDensity?: 'Low' | 'Medium' | 'High';
  // Zeta reference overlays
  showCriticalLine?: boolean;
  showCriticalStrip?: boolean;
  showKnownZeros?: boolean;
}

export interface CinematicSceneProps {
  config: SceneConfig;
  cameraMode: 'perspective' | 'orthographic';
  wireframe: boolean;
  showGrid: boolean;
  showAxes: boolean;
  showNumericLabels: boolean;
  showAxisLabels: boolean;
  labelsAlwaysVisible: boolean;
  numericLabelSize: number;
  axisTitleSize: number;
  tickSpacingMode: 'auto' | 'manual';
  manualTickStep: number;
  axisRatio: [number, number, number];
  groundMagnitudeAtZero: boolean;
  initialCamera?: {
    position?: { x: number; y: number; z: number };
    target?: { x: number; y: number; z: number };
    zoom?: number;
  };
}

function createTextSprite(
  message: string, 
  color: string = '#8b9eb0', 
  fontSize: number = 32, 
  scaleMult: number = 0.015,
  alwaysVisible: boolean = false
) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  context.font = `bold ${fontSize}px sans-serif`;
  const metrics = context.measureText(message);
  
  canvas.width = Math.ceil(metrics.width) + 16;
  canvas.height = fontSize + 16;

  context.font = `bold ${fontSize}px sans-serif`;
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(message, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  
  const spriteMaterial = new THREE.SpriteMaterial({ 
    map: texture, 
    depthTest: !alwaysVisible,
    depthWrite: !alwaysVisible,
    fog: false
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(canvas.width * scaleMult, canvas.height * scaleMult, 1);
  
  if (alwaysVisible) {
    sprite.renderOrder = 999;
  }
  
  return sprite;
}

function getTicks(min: number, max: number, count: number = 5, mode: 'auto' | 'manual' = 'auto', manualStep: number = 1, minAutoStep: number = 0) {
  const range = max - min;
  if (range <= 0) return [min];
  
  let step = manualStep;
  if (mode === 'auto') {
    const roughStep = range / (count - 1);
    const stepPower = Math.floor(Math.log10(roughStep));
    const stepMag = Math.pow(10, stepPower);
    const normStep = roughStep / stepMag;
    if (normStep >= 5) step = 5 * stepMag;
    else if (normStep >= 2) step = 2 * stepMag;
        else step = 1 * stepMag;

    if (minAutoStep > 0 && step < minAutoStep) {
      if (range / minAutoStep >= 1.0) {
        step = minAutoStep;
      }
    }
  } else {
    if (isNaN(step) || step <= 0) step = 1;
  }

  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let t = start; t <= max + 1e-9; t += step) {
    ticks.push(parseFloat(t.toFixed(5)));
  }
  return ticks;
}

const CinematicScene = forwardRef<CinematicSceneRef, CinematicSceneProps>(function CinematicScene({ config, cameraMode, wireframe, showGrid, showAxes, showNumericLabels, showAxisLabels, labelsAlwaysVisible, numericLabelSize, axisTitleSize, tickSpacingMode, manualTickStep, axisRatio, groundMagnitudeAtZero, initialCamera }, ref) {
  const mountRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getCameraState: () => {
      if (!sceneRef.current) return { position: {x:5,y:4,z:5}, target: {x:0,y:0,z:0}, zoom: 1 };
      const { camera, controls } = sceneRef.current;
      return {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
        zoom: camera instanceof THREE.OrthographicCamera ? camera.zoom : 1
      };
    },
    setCameraState: (state) => {
      if (!sceneRef.current || !state) return;
      const { camera, controls } = sceneRef.current;
      if (state.position) camera.position.set(state.position.x, state.position.y, state.position.z);
      if (state.target) controls.target.set(state.target.x, state.target.y, state.target.z);
      if (state.zoom && camera instanceof THREE.OrthographicCamera) camera.zoom = state.zoom;
      camera.updateProjectionMatrix();
      controls.update();
    },
    fitScene: () => {
      if (!sceneRef.current) return;
      const { camera, controls, mesh } = sceneRef.current;
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox;
      if (!box) return;
      
      const center = new THREE.Vector3();
      box.getCenter(center);
      center.multiply(mesh.scale);
      
      const size = new THREE.Vector3();
      box.getSize(size);
      size.multiply(mesh.scale);
      
      const maxDim = Math.max(size.x, size.y, size.z, 0.1);
      const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov * (Math.PI / 180) : Math.PI / 4;
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.4;
      
      controls.target.copy(center);
      camera.position.set(center.x + cameraZ * 0.6, center.y + cameraZ * 0.4, center.z + cameraZ * 0.7);
      
      if (camera instanceof THREE.OrthographicCamera) {
         camera.zoom = 8 / (maxDim * 1.5);
      }
      
      camera.updateProjectionMatrix();
      controls.update();
    },
    resetView: () => {
      if (!sceneRef.current) return;
      const { camera, controls } = sceneRef.current;
      camera.position.set(5, 4, 5);
      controls.target.set(0, 0, 0);
      if (camera instanceof THREE.OrthographicCamera) camera.zoom = 1;
      camera.updateProjectionMatrix();
      controls.update();
    },
    applyPreset: (preset) => {
      if (!sceneRef.current) return;
      const { camera, controls } = sceneRef.current;
      controls.target.set(0, 0, 0);
      let dist = 6.4;
      if (preset === 'Low angle') camera.position.set(0, 0.5, dist);
      else if (preset === 'High angle') camera.position.set(0, dist, 0.5);
      else if (preset === 'Wide') camera.position.set(dist * 1.5, dist * 1.2, dist * 1.5);
      else if (preset === 'Close') camera.position.set(dist * 0.5, dist * 0.4, dist * 0.5);
      else if (preset === 'Zeta default') {
        // Exact Riemann Zeta showcase camera coordinates
        camera.position.set(38.71247034362551, 3.6612697441959243, 23.744254450895912);
        controls.target.set(-4.13096552313472, 1.210383630053239, 1.7711678695156614);
      }
      else camera.position.set(5, 4, 5);
      
      if (camera instanceof THREE.OrthographicCamera) {
         camera.zoom = preset === 'Wide' ? 0.5 : preset === 'Close' ? 2 : 1;
      }
      camera.updateProjectionMatrix();
      controls.update();
    },
    exportPNG: (w, h) => {
      if (!sceneRef.current || !mountRef.current) return null;
      const { renderer, scene, camera } = sceneRef.current;
      
      if (w && h) {
        if (w * h > 16000000) throw new Error("Resolution too high");
        const origSize = new THREE.Vector2();
        renderer.getSize(origSize);
        const mount = mountRef.current;
        const origAspect = mount.clientWidth / Math.max(1, mount.clientHeight);
        
        renderer.setSize(w, h);
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.aspect = w / h;
        } else {
          const frustumSize = 8;
          const aspect = w / h;
          camera.left = frustumSize * aspect / -2;
          camera.right = frustumSize * aspect / 2;
        }
        camera.updateProjectionMatrix();
        const activeCam = sceneRef.current?.camera || camera;
      renderer.render(scene, activeCam);
        
        const dataURL = renderer.domElement.toDataURL('image/png');
        
        renderer.setSize(origSize.x, origSize.y);
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.aspect = origAspect;
        } else {
          const frustumSize = 8;
          const aspect = origAspect;
          camera.left = frustumSize * aspect / -2;
          camera.right = frustumSize * aspect / 2;
        }
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        
        return dataURL;
      }
      
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    }
  }));

  const sceneRef = useRef<any>(null);

  // Math Evaluation
  const geometryData = useMemo(() => {
    const isZeta = config.expression.trim() === 'zeta(z)' || config.expression.trim() === 'zeta(s)';
    let compiled: math.EvalFunction | null = null;
    if (!isZeta) {
      try { compiled = math.parse(config.expression).compile(); } catch(e) {}
    }

    const resX = config.resolutionX;
    const resZ = config.resolutionZ;
    const { xMin, xMax, zMin, zMax } = config.domain;
    
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    let minY = Infinity;
    let maxY = -Infinity;

    for (let j = 0; j <= resZ; j++) {
      const t = zMin + (j / resZ) * (zMax - zMin);
      for (let i = 0; i <= resX; i++) {
        const sigma = xMin + (i / resX) * (xMax - xMin);
        let y = 0;
        let vertexPhase = 0;
        
        if (isZeta) {
          const zRes = evaluateZeta(sigma, t);
          vertexPhase = zRes.arg;
          
          if (config.heightMode === 'mag') {
            // Riemann Zeta logarithmic magnitude: h(s) = ln(|ζ(s)|)
            // |ζ| > 1 -> y > 0, |ζ| = 1 -> y = 0, 0 < |ζ| < 1 -> y < 0, zeros -> deep negative valleys
            const eps = 1e-12;
            const mag = Math.max(zRes.abs, eps);
            y = Math.log(mag);
          } else if (config.heightMode === 'real') {
            const raw = zRes.re;
            y = Math.sign(raw) * Math.log(1 + Math.abs(raw));
          } else if (config.heightMode === 'imag') {
            const raw = zRes.im;
            y = Math.sign(raw) * Math.log(1 + Math.abs(raw));
          }
        } else if (compiled) {
          try {
            const c = math.complex(sigma, t);
            const val = compiled.evaluate({ z: c, s: c });
            
            if (val && typeof val === 'object' && val.arg !== undefined) {
              vertexPhase = typeof val.arg === 'function' ? val.arg() : val.arg;
            } else if (val && typeof val === 'object' && val.re !== undefined && val.im !== undefined) {
              vertexPhase = Math.atan2(val.im, val.re);
            } else if (typeof val === 'number') {
              vertexPhase = val < 0 ? Math.PI : 0;
            }

            let rawHeight = 0;
            if (config.heightMode === 'mag') {
              rawHeight = math.abs(val) as number;
            } else if (config.heightMode === 'real') {
              rawHeight = val.re !== undefined ? val.re : (val as number);
            } else if (config.heightMode === 'imag') {
              rawHeight = val.im !== undefined ? val.im : 0;
            }

            if (isNaN(rawHeight)) {
              y = 0;
            } else if (config.heightMode === 'mag') {
              y = Math.log(1 + rawHeight) * config.heightScale;
            } else {
              y = Math.sign(rawHeight) * Math.log(1 + Math.abs(rawHeight)) * config.heightScale;
            }
          } catch(e) {}
        }
        
        if (isNaN(y)) y = 0;

        let limit = undefined;
        if (config.heightLimitMode === 'Auto') {
          const maxExt = Math.max(xMax - xMin, zMax - zMin);
          limit = Math.max(maxExt * 1.5, 5);
        } else if (config.heightLimitMode === 'Custom') {
          limit = config.customHeightLimit;
        }

        if (limit !== undefined && limit !== null && limit > 0) {
          if (y === Infinity) y = limit;
          else if (y === -Infinity) y = -limit;
          else {
            if (isZeta) {
              // Symmetric clamping [-limit, +limit] for Riemann Zeta
              y = Math.max(-limit, Math.min(limit, y));
            } else if (config.heightMode === 'mag') {
              y = Math.min(y, limit);
            } else {
              y = Math.sign(y) * Math.min(Math.abs(y), limit);
            }
          }
        } else {
          if (!isFinite(y)) y = 0;
        }
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        positions.push(sigma, y, t);

        const [cr, cg, cb] = phaseToRgb(vertexPhase);
        colors.push(cr, cg, cb);
      }
    }

    if (minY > maxY) { minY = 0; maxY = 0; }
    if (minY === maxY) { maxY += 1; minY -= 1; }

    for (let j = 0; j < resZ; j++) {
      for (let i = 0; i < resX; i++) {
        const p0 = j * (resX + 1) + i;
        const p1 = p0 + 1;
        const p2 = (j + 1) * (resX + 1) + i;
        const p3 = p2 + 1;
        indices.push(p0, p2, p1, p1, p2, p3);
      }
    }
    
    return {
      positions: new Float32Array(positions),
      indices: new Uint32Array(indices),
      colors: new Float32Array(colors),
      minY,
      maxY
    };
  }, [config]);

  // Setup Three.js
  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05070a');

    const width = mount.clientWidth;
    const height = mount.clientHeight;
    
    let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    if (cameraMode === 'perspective') {
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
      camera.position.set(5, 4, 5);
    } else {
      const frustumSize = 8;
      const aspect = width / height;
      camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2, frustumSize * aspect / 2,
        frustumSize / 2, frustumSize / -2,
        -5000, 5000
      );
      camera.position.set(5, 4, 5);
    }
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    scene.fog = new THREE.FogExp2('#05070a', 0.035 * (config.atmosphere !== undefined ? config.atmosphere : 0.2));
    
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 0, 0);

    if (initialCamera) {
      if (initialCamera.position) {
        camera.position.set(initialCamera.position.x, initialCamera.position.y, initialCamera.position.z);
      }
      if (initialCamera.target) {
        controls.target.set(initialCamera.target.x, initialCamera.target.y, initialCamera.target.z);
      }
      if (initialCamera.zoom && camera instanceof THREE.OrthographicCamera) {
        camera.zoom = initialCamera.zoom;
      }
      camera.updateProjectionMatrix();
      controls.update();
    }

    const ambient = new THREE.AmbientLight(0x1e2430, 0.6);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(-6, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.05;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x8dafe3, 1.2);
    rimLight.position.set(5, 3, -6);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x5669bf, 0.8);
    fillLight.position.set(6, 4, 4);
    scene.add(fillLight);

    // Optional local accent light near origin
    const accentLight = new THREE.PointLight(0x42f5c2, 1.0, 4);
    accentLight.position.set(0, 0.5, 0);
    scene.add(accentLight);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(geometryData.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(geometryData.colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(geometryData.indices, 1));
    geometry.computeVertexNormals();
    
    const usePalette = config.colorMode === 'palette';
    const material = new THREE.MeshStandardMaterial({
      color: usePalette ? 0xffffff : new THREE.Color(config.surfaceColor || '#0f7a7a'),
      roughness: 0.35,
      metalness: 0.15,
      vertexColors: usePalette,
      emissive: usePalette ? 0x111111 : new THREE.Color(config.surfaceColor || '#0f7a7a'),
      emissiveIntensity: 0.03,
      side: THREE.DoubleSide,
      wireframe: wireframe
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const axesContainer = new THREE.Group();
    scene.add(axesContainer);

    sceneRef.current = { scene, camera, renderer, controls, mesh, axesContainer, lights: { ambient, keyLight, rimLight, fillLight, accentLight } };

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      const activeCamera = sceneRef.current?.camera || camera;
      renderer.render(scene, activeCamera);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      const currCam = sceneRef.current?.camera || camera;
      if (currCam instanceof THREE.PerspectiveCamera) {
        currCam.aspect = w / h;
        currCam.updateProjectionMatrix();
      } else {
        const frustumSize = 8;
        const aspect = w / h;
        currCam.left = frustumSize * aspect / -2;
        currCam.right = frustumSize * aspect / 2;
        currCam.top = frustumSize / 2;
        currCam.bottom = frustumSize / -2;
        currCam.updateProjectionMatrix();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  // Update Geometry & Material
  useEffect(() => {
    if (!sceneRef.current) return;
    const { mesh } = sceneRef.current;
    
    const oldGeometry = mesh.geometry;
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.BufferAttribute(geometryData.positions, 3));
    newGeometry.setAttribute('color', new THREE.BufferAttribute(geometryData.colors, 3));
    newGeometry.setIndex(new THREE.BufferAttribute(geometryData.indices, 1));
    newGeometry.computeVertexNormals();
    newGeometry.computeBoundingBox();
    newGeometry.computeBoundingSphere();
    mesh.geometry = newGeometry;
    oldGeometry.dispose();

    const usePalette = config.colorMode === 'palette';
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.wireframe = wireframe;
    mat.vertexColors = usePalette;
    if (usePalette) {
      mat.color.set(0xffffff);
      mat.emissive.set(0x111111);
    } else {
      mat.color.set(config.surfaceColor || '#0f7a7a');
      mat.emissive.set(config.surfaceColor || '#0f7a7a');
    }
    mat.needsUpdate = true;
    
    const b = config.lightBrightness !== undefined ? config.lightBrightness : 1.0;
    sceneRef.current.lights.ambient.intensity = 0.6 * b;
    sceneRef.current.lights.keyLight.intensity = 1.8 * b;
    sceneRef.current.lights.rimLight.intensity = 1.2 * b;
    sceneRef.current.lights.fillLight.intensity = 0.8 * b;
    sceneRef.current.lights.accentLight.intensity = 1.0 * b;
    
    if (sceneRef.current.scene.fog instanceof THREE.FogExp2) {
      sceneRef.current.scene.fog.density = 0.035 * (config.atmosphere !== undefined ? config.atmosphere : 0.2);
    }
    mesh.scale.set(axisRatio[0], axisRatio[1], axisRatio[2]);
  }, [geometryData, wireframe, axisRatio, config.surfaceColor, config.colorMode, config.lightBrightness, config.atmosphere]);

  // Update Camera Mode
  useEffect(() => {
    if (!sceneRef.current) return;
    const { camera } = sceneRef.current;
    if (cameraMode === 'perspective' && camera instanceof THREE.OrthographicCamera) {
      const mount = mountRef.current;
      if (mount) {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        const newCam = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
        newCam.position.copy(camera.position);
        newCam.lookAt(0,0,0);
        sceneRef.current.camera = newCam;
        sceneRef.current.controls.object = newCam;
      }
    } else if (cameraMode === 'orthographic' && camera instanceof THREE.PerspectiveCamera) {
      const mount = mountRef.current;
      if (mount) {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        const frustumSize = 8;
        const aspect = w / h;
        const newCam = new THREE.OrthographicCamera(
          frustumSize * aspect / -2, frustumSize * aspect / 2,
          frustumSize / 2, frustumSize / -2,
          -5000, 5000
        );
        newCam.position.copy(camera.position);
        newCam.lookAt(0,0,0);
        newCam.zoom = 1;
        newCam.updateProjectionMatrix();
        sceneRef.current.camera = newCam;
        sceneRef.current.controls.object = newCam;
      }
    }
  }, [cameraMode]);

  // Rebuild Axes / Grid
  useEffect(() => {
    if (!sceneRef.current) return;
    const { axesContainer } = sceneRef.current;
    
    // Clear old axes
    while(axesContainer.children.length > 0) {
      const child = axesContainer.children[0] as any;
      axesContainer.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      if (child.material?.map) child.material.map.dispose();
    }

    const { xMin, xMax, zMin, zMax } = config.domain;
    const isZeta = config.expression.trim() === 'zeta(z)' || config.expression.trim() === 'zeta(s)';
    // Visual scene range (used for placing the scene floor, planes, padding)
    const visualMinY = (config.heightMode === 'mag' && groundMagnitudeAtZero && !isZeta) ? 0 : Math.floor(geometryData.minY) - 0.5;
    const visualMaxY = Math.ceil(geometryData.maxY) + 0.5;
    const yFloor = visualMinY;
    let yCeil = visualMaxY;
    
    const xMid = (xMax + xMin) / 2;
    const zMid = (zMax + zMin) / 2;
    const yMid = (yCeil + yFloor) / 2;

    const [sx, sy, sz] = axisRatio;
    const scalePt = (x: number, y: number, z: number) => new THREE.Vector3(x * sx, y * sy, z * sz);
    
    const xRange = (xMax - xMin) || 1;
    const zRange = (zMax - zMin) || 1;
    
    const xOffset = xRange * 0.05;
    const zOffset = zRange * 0.05;
    const xTitleOffset = xRange * 0.12;
    const zTitleOffset = zRange * 0.12;

    // Single source of truth for ticks
    const xTicks = getTicks(xMin, xMax, 5, tickSpacingMode, manualTickStep);
    const zTicks = getTicks(zMin, zMax, 5, tickSpacingMode, manualTickStep);
    
    let tickMinY = geometryData.minY;
    let tickMaxY = geometryData.maxY;
    if (config.heightMode === 'mag' && !isZeta) {
      tickMinY = 0; // start at zero for generic magnitude
      // Ensure tickMaxY and grid top boundary reflect actual geometry maxY
      tickMaxY = Math.max(geometryData.maxY, 1);
    }
    const minAutoY = (config.heightMode === 'mag' && !isZeta) ? 1 : 0;
    const yTicks = getTicks(tickMinY, tickMaxY, 4, tickSpacingMode, manualTickStep, minAutoY);
    const gridYTicks = yTicks; // ensure grid uses same ticks
    // Use yTicks directly for grid lines to ensure alignment with height labels
    // Adjust visual top boundary for magnitude mode to match actual height extent
    if (config.heightMode === 'mag' && !isZeta) {
      yCeil = Math.max(tickMaxY, yTicks[yTicks.length - 1] ?? tickMaxY);
    }


    if (showGrid) {
      const gridPts: THREE.Vector3[] = [];
      
      // 1. Bottom Grid (XZ plane) at Y = yFloor
      xTicks.forEach(x => {
        gridPts.push(scalePt(x, yFloor, zMin), scalePt(x, yFloor, zMax));
      });
      zTicks.forEach(z => {
        gridPts.push(scalePt(xMin, yFloor, z), scalePt(xMax, yFloor, z));
      });

      // 2. Back Grid (YZ plane) at X = xMin
      zTicks.forEach(z => {
        gridPts.push(scalePt(xMin, yFloor, z), scalePt(xMin, yCeil, z));
      });
      gridYTicks.forEach(y => {
        gridPts.push(scalePt(xMin, y, zMin), scalePt(xMin, y, zMax));
      });
      
      // 3. Side Grid (XY plane) at Z = zMin
      xTicks.forEach(x => {
        gridPts.push(scalePt(x, yFloor, zMin), scalePt(x, yCeil, zMin));
      });
      gridYTicks.forEach(y => {
        gridPts.push(scalePt(xMin, y, zMin), scalePt(xMax, y, zMin));
      });


      // Close outer boundaries explicitly
      
      // XZ Plane Boundaries
      gridPts.push(scalePt(xMin, yFloor, zMin), scalePt(xMax, yFloor, zMin));
      gridPts.push(scalePt(xMin, yFloor, zMax), scalePt(xMax, yFloor, zMax));
      gridPts.push(scalePt(xMin, yFloor, zMin), scalePt(xMin, yFloor, zMax));
      gridPts.push(scalePt(xMax, yFloor, zMin), scalePt(xMax, yFloor, zMax));

      // YZ Plane Boundaries
      gridPts.push(scalePt(xMin, yFloor, zMin), scalePt(xMin, yCeil, zMin));
      gridPts.push(scalePt(xMin, yFloor, zMax), scalePt(xMin, yCeil, zMax));
      gridPts.push(scalePt(xMin, yFloor, zMin), scalePt(xMin, yFloor, zMax));
      gridPts.push(scalePt(xMin, yCeil, zMin), scalePt(xMin, yCeil, zMax));

      // XY Plane Boundaries
      gridPts.push(scalePt(xMin, yFloor, zMin), scalePt(xMax, yFloor, zMin));
      gridPts.push(scalePt(xMin, yCeil, zMin), scalePt(xMax, yCeil, zMin));
      gridPts.push(scalePt(xMin, yFloor, zMin), scalePt(xMin, yCeil, zMin));
      gridPts.push(scalePt(xMax, yFloor, zMin), scalePt(xMax, yCeil, zMin));

      const gridGeom = new THREE.BufferGeometry().setFromPoints(gridPts);

      const gridMat = new THREE.LineBasicMaterial({ color: 0x1f2937, linewidth: 1 });
      axesContainer.add(new THREE.LineSegments(gridGeom, gridMat));
    }
        // Wrapped Reference Coordinate Grid (V5.7.1: Rectangular complex-plane grid wrapped onto surface)
        if (config.showWrappedGrid) {
          const wrappedPts: THREE.Vector3[] = [];
          const { wrappedGridDensity = 'Low' } = config;
          const densityLineCount: Record<string, number> = {
            Low: 7,
            Medium: 13,
            High: 21,
          };
          const numLines = densityLineCount[wrappedGridDensity] || 7;
          const { xMin, xMax, zMin, zMax } = config.domain;
          const resX = config.resolutionX;
          const resZ = config.resolutionZ;

          const getY = (x: number, z: number): number => {
            const fx = (x - xMin) / (xMax - xMin || 1);
            const fz = (z - zMin) / (zMax - zMin || 1);
            const clampedFx = Math.max(0, Math.min(1, fx));
            const clampedFz = Math.max(0, Math.min(1, fz));
            const i = Math.max(0, Math.min(resX - 1, Math.floor(clampedFx * resX)));
            const j = Math.max(0, Math.min(resZ - 1, Math.floor(clampedFz * resZ)));
            const i1 = Math.min(resX, i + 1);
            const j1 = Math.min(resZ, j + 1);
            const s = clampedFx * resX - i;
            const t = clampedFz * resZ - j;
            const idx = (row: number, col: number) => (row * (resX + 1) + col) * 3;
            const y00 = geometryData.positions[idx(j, i) + 1] ?? 0;
            const y10 = geometryData.positions[idx(j, i1) + 1] ?? 0;
            const y01 = geometryData.positions[idx(j1, i) + 1] ?? 0;
            const y11 = geometryData.positions[idx(j1, i1) + 1] ?? 0;
            const y0 = y00 * (1 - s) + y10 * s;
            const y1 = y01 * (1 - s) + y11 * s;
            return y0 * (1 - t) + y1 * t;
          };

          const samplesPerLine = Math.max(64, Math.min(180, Math.max(resX, resZ)));
          const yEpsilon = 0.0015 * (axisRatio[1] || 1);

          // 1. Lines of constant Re(z) (varying Im(z) / z)
          for (let l = 0; l < numLines; l++) {
            const x = xMin + (l / (numLines - 1)) * (xMax - xMin);
            let prevPt: THREE.Vector3 | null = null;
            for (let s = 0; s <= samplesPerLine; s++) {
              const z = zMin + (s / samplesPerLine) * (zMax - zMin);
              const y = getY(x, z) + yEpsilon;
              const pt = scalePt(x, y, z);
              if (prevPt) {
                wrappedPts.push(prevPt, pt);
              }
              prevPt = pt;
            }
          }

          // 2. Lines of constant Im(z) (varying Re(z) / x)
          for (let l = 0; l < numLines; l++) {
            const z = zMin + (l / (numLines - 1)) * (zMax - zMin);
            let prevPt: THREE.Vector3 | null = null;
            for (let s = 0; s <= samplesPerLine; s++) {
              const x = xMin + (s / samplesPerLine) * (xMax - xMin);
              const y = getY(x, z) + yEpsilon;
              const pt = scalePt(x, y, z);
              if (prevPt) {
                wrappedPts.push(prevPt, pt);
              }
              prevPt = pt;
            }
          }

          if (wrappedPts.length > 0) {
            const wrappedGeom = new THREE.BufferGeometry().setFromPoints(wrappedPts);
            const wrappedMat = new THREE.LineBasicMaterial({
              color: 0x67e8f9,
              transparent: true,
              opacity: 0.35,
              depthWrite: false
            });
            axesContainer.add(new THREE.LineSegments(wrappedGeom, wrappedMat));
          }
        }

        // Helper for surface height sampling along lines
        const getSurfaceY = (x: number, z: number): number => {
          const { xMin, xMax, zMin, zMax } = config.domain;
          const resX = config.resolutionX;
          const resZ = config.resolutionZ;
          const fx = (x - xMin) / (xMax - xMin || 1);
          const fz = (z - zMin) / (zMax - zMin || 1);
          const clampedFx = Math.max(0, Math.min(1, fx));
          const clampedFz = Math.max(0, Math.min(1, fz));
          const i = Math.max(0, Math.min(resX - 1, Math.floor(clampedFx * resX)));
          const j = Math.max(0, Math.min(resZ - 1, Math.floor(clampedFz * resZ)));
          const i1 = Math.min(resX, i + 1);
          const j1 = Math.min(resZ, j + 1);
          const s = clampedFx * resX - i;
          const t = clampedFz * resZ - j;
          const idx = (row: number, col: number) => (row * (resX + 1) + col) * 3;
          const y00 = geometryData.positions[idx(j, i) + 1] ?? 0;
          const y10 = geometryData.positions[idx(j, i1) + 1] ?? 0;
          const y01 = geometryData.positions[idx(j1, i) + 1] ?? 0;
          const y11 = geometryData.positions[idx(j1, i1) + 1] ?? 0;
          const y0 = y00 * (1 - s) + y10 * s;
          const y1 = y01 * (1 - s) + y11 * s;
          return y0 * (1 - t) + y1 * t;
        };

        // Mathematical Reference Overlay: Critical Line Re(s) = 0.5
        if (config.showCriticalLine && xMin <= 0.5 && 0.5 <= xMax) {
          const critPts: THREE.Vector3[] = [];
          const samples = Math.max(120, config.resolutionZ * 2);
          const yEps = 0.003 * (axisRatio[1] || 1);
          let prevPt: THREE.Vector3 | null = null;
          for (let s = 0; s <= samples; s++) {
            const z = zMin + (s / samples) * (zMax - zMin);
            const y = getSurfaceY(0.5, z) + yEps;
            const pt = scalePt(0.5, y, z);
            if (prevPt) {
              critPts.push(prevPt, pt);
            }
            prevPt = pt;
          }
          if (critPts.length > 0) {
            const critGeom = new THREE.BufferGeometry().setFromPoints(critPts);
            const critMat = new THREE.LineBasicMaterial({
              color: 0xfacc15, // Golden / amber luminescent line
              linewidth: 2,
              transparent: true,
              opacity: 0.95
            });
            axesContainer.add(new THREE.LineSegments(critGeom, critMat));
          }
        }

        // Mathematical Reference Overlay: Critical Strip 0 <= Re(s) <= 1
        if (config.showCriticalStrip) {
          const stripPts: THREE.Vector3[] = [];
          const linesToDraw = [0, 1].filter(x => x >= xMin && x <= xMax);
          for (const sxLine of linesToDraw) {
            stripPts.push(scalePt(sxLine, yFloor, zMin), scalePt(sxLine, yFloor, zMax));
          }
          if (stripPts.length > 0) {
            const stripGeom = new THREE.BufferGeometry().setFromPoints(stripPts);
            const stripMat = new THREE.LineBasicMaterial({
              color: 0x38bdf8, // Cyan / sky blue floor boundaries
              linewidth: 1.5,
              transparent: true,
              opacity: 0.75
            });
            axesContainer.add(new THREE.LineSegments(stripGeom, stripMat));
          }
        }

        // Mathematical Reference Overlay: Known Nontrivial & Trivial Zeros
        if (config.showKnownZeros) {
          const zeroMarkerPts: THREE.Vector3[] = [];
          // 1. Nontrivial zeros along Re(s) = 0.5
          if (xMin <= 0.5 && 0.5 <= xMax) {
            const tValues: number[] = [];
            for (const t0 of KNOWN_NONTRIVIAL_ZEROS) {
              if (t0 >= zMin && t0 <= zMax) tValues.push(t0);
              if (-t0 >= zMin && -t0 <= zMax) tValues.push(-t0);
            }
            for (const t of tValues) {
              const y = getSurfaceY(0.5, t);
              // Draw a vertical glowing marker pin from floor to zero on surface
              zeroMarkerPts.push(scalePt(0.5, yFloor, t), scalePt(0.5, y + 0.35, t));
              
              // Small luminous bead at the zero height
              const sphereGeom = new THREE.SphereGeometry(0.08 * (numericLabelSize / 0.008), 12, 12);
              const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 }); // Vivid red / coral bead
              const bead = new THREE.Mesh(sphereGeom, sphereMat);
              bead.position.copy(scalePt(0.5, y + 0.02, t));
              axesContainer.add(bead);
            }
          }

          // 2. Trivial zeros at s = -2, -4 on real axis (t = 0)
          if (zMin <= 0 && 0 <= zMax) {
            const trivialRe = [-2, -4].filter(r => r >= xMin && r <= xMax);
            for (const r of trivialRe) {
              const y = getSurfaceY(r, 0);
              zeroMarkerPts.push(scalePt(r, yFloor, 0), scalePt(r, y + 0.25, 0));
              const sphereGeom = new THREE.SphereGeometry(0.06 * (numericLabelSize / 0.008), 10, 10);
              const sphereMat = new THREE.MeshBasicMaterial({ color: 0x34d399 }); // Emerald green bead
              const bead = new THREE.Mesh(sphereGeom, sphereMat);
              bead.position.copy(scalePt(r, y + 0.02, 0));
              axesContainer.add(bead);
            }
          }

          if (zeroMarkerPts.length > 0) {
            const zmGeom = new THREE.BufferGeometry().setFromPoints(zeroMarkerPts);
            const zmMat = new THREE.LineBasicMaterial({
              color: 0xffedd5,
              transparent: true,
              opacity: 0.8
            });
            axesContainer.add(new THREE.LineSegments(zmGeom, zmMat));
          }
        }
        

    if (showAxes) {
      const axisMaterial = new THREE.LineBasicMaterial({ color: 0x586069, linewidth: 2 });
      const axisGeom = new THREE.BufferGeometry().setFromPoints([
        scalePt(xMin, yFloor, zMax), scalePt(xMax, yFloor, zMax), // X axis
        scalePt(xMin, yFloor, zMax), scalePt(xMin, yCeil, zMax), // Y axis
        scalePt(xMax, yFloor, zMax), scalePt(xMax, yFloor, zMin)  // Z axis (Im(z))
      ]);
      axesContainer.add(new THREE.LineSegments(axisGeom, axisMaterial));
    }

    if (showNumericLabels) {
      const tickPts: THREE.Vector3[] = [];
      
      xTicks.forEach(t => {
        tickPts.push(scalePt(t, yFloor, zMax), scalePt(t, yFloor, zMax + zOffset / 2));
        if (true) {
          const sprite = createTextSprite(t.toString(), '#8b9eb0', 32, numericLabelSize, labelsAlwaysVisible);
          sprite.position.copy(scalePt(t, yFloor, zMax + zOffset));
          axesContainer.add(sprite);
        }
      });
      
      zTicks.forEach(t => {
        // Physical tick mark: short outward notch at xMax edge of the floor plane
        tickPts.push(scalePt(xMax, yFloor, t), scalePt(xMax + xOffset / 2, yFloor, t));
        // Im(z) numeric labels: right edge of the floor (Re(z)×Im(z)) plane, just outside xMax
        const sprite = createTextSprite(t.toString(), '#8b9eb0', 32, numericLabelSize, labelsAlwaysVisible);
        sprite.position.copy(scalePt(xMax + xOffset, yFloor, t));
        axesContainer.add(sprite);
      });
      
      yTicks.forEach(t => {
        tickPts.push(scalePt(xMin, t, zMax), scalePt(xMin + xOffset / 2, t, zMax));
        const sprite = createTextSprite(t.toString(), '#8b9eb0', 32, numericLabelSize, labelsAlwaysVisible);
        sprite.position.copy(scalePt(xMin + xOffset, t, zMax));
        axesContainer.add(sprite);
      });
      
      if (tickPts.length > 0) {
        const tickMaterial = new THREE.LineBasicMaterial({ color: 0x586069, linewidth: 2 });
        axesContainer.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tickPts), tickMaterial));
      }
    }

    if (showAxisLabels) {
      const titleColor = '#e2e8f0';
      const xTitle = createTextSprite('Re(z)', titleColor, 36, axisTitleSize, labelsAlwaysVisible);
      xTitle.position.copy(scalePt(xMid, yFloor, zMax + zTitleOffset));
      axesContainer.add(xTitle);
      
      const zTitle = createTextSprite('Im(z)', titleColor, 36, axisTitleSize, labelsAlwaysVisible);
      zTitle.position.copy(scalePt(xMax + xTitleOffset, yFloor, zMid));
      axesContainer.add(zTitle);
      
    let yLabel = '|f(z)|';
      if (isZeta && config.heightMode === 'mag') yLabel = 'ln|ζ(s)|';
      else if (config.heightMode === 'real') yLabel = isZeta ? 'Re(ζ(s))' : 'Re(f(z))';
      else if (config.heightMode === 'imag') yLabel = isZeta ? 'Im(ζ(s))' : 'Im(f(z))';
      const yTitle = createTextSprite(yLabel, titleColor, 36, axisTitleSize, labelsAlwaysVisible);
      yTitle.position.copy(scalePt(xMin + xTitleOffset, yMid, zMax));
      axesContainer.add(yTitle);
    }

  }, [
    config.expression, config.domain, showGrid, showAxes, showNumericLabels, showAxisLabels, labelsAlwaysVisible,
    geometryData.minY, geometryData.maxY, config.heightMode, config.showWrappedGrid, config.wrappedGridDensity,
    config.showCriticalLine, config.showCriticalStrip, config.showKnownZeros,
    numericLabelSize, axisTitleSize, tickSpacingMode, manualTickStep, axisRatio
  ]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />;
});
export default CinematicScene;


