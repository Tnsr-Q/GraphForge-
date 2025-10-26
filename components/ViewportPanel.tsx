// FIX: Change React import to default import to fix JSX namespace issues with react-three-fiber.
import React from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { Grid, Text, CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import { GraphIR, Animation, ColorMapName, Label as LabelType, G3DFunction, ExperimentalPoint, ValidationResults, SurfacePlot, VectorPlot, TensorPlot } from '../types';
import { createConfiguredMathParser } from '../services/math-parser';
import { VideoIcon, CodeIcon, ExclamationIcon, GraphIcon, ImageIcon, PlayIcon, PauseIcon, WireframeIcon, RecordingIcon, RulerIcon, ButterflyIcon } from './Icons';
import saveAs from 'file-saver';
import { toPng } from 'html-to-image';
import { getColorFromMap, getColormapGradient, COLOR_MAP_NAMES } from '../services/color-maps';
import { Muxer } from 'mp4-muxer';
import { ParticleSystem } from './ParticleSystem';
import VisualEffects from './VisualEffects';
import { ControlsState } from './ControlsPanel';
import { calculateGeodesicPath } from '../services/geodesic';
import { DistanceMeasurement, MeasurementData } from './DistanceMeasurement';
import { generateLyapunovGrid } from '../services/lyapunov';
import { ExperimentalDataOverlay } from './ExperimentalDataOverlay';
import { VectorField } from './visual-effects/VectorField';
import { TensorGlyphs } from './visual-effects/TensorGlyphs';

export interface SurfaceData {
    geometry: THREE.BufferGeometry;
    originalXY: { x: number, y: number }[];
    plotExpr: string;
    animParam: string | null;
    functions: { [key: string]: G3DFunction };
    zRange: { min: number, max: number };
    colorMap: ColorMapName;
}

export interface EffectsState {
  streamlines: boolean;
  particleTrails: boolean;
  epGlows: boolean;
  fluxHeatmap: boolean;
  topologicalRibbon: boolean;
  lyapunovViz: boolean;
}

const cameraPresets = {
  'Overview': { pos: [0, 20, 30], target: [0, 4, 0] },
  'EP2 Close': { pos: [-2, 10, 15], target: [-2, 8, 4] },
  'Topological': { pos: [20, 20, 20], target: [0, 5, 0] },
  'Side Profile': { pos: [25, 5, 0], target: [0, 4, 0] }
};

const CameraManager: React.FC<{ preset: string | null; onTransitionEnd: () => void; }> = ({ preset, onTransitionEnd }) => {
    const controlsRef = React.useRef<any>(null!);

    React.useEffect(() => {
        if (preset && controlsRef.current) {
            const { pos, target } = cameraPresets[preset as keyof typeof cameraPresets];
            controlsRef.current.setLookAt(...pos, ...target, true); // true for enableTransition
        }
    }, [preset]);

    React.useEffect(() => {
        const controls = controlsRef.current;
        if (controls) {
            const onEnd = () => onTransitionEnd();
            controls.addEventListener('transitionend', onEnd);
            return () => {
                controls.removeEventListener('transitionend', onEnd);
            }
        }
    }, [onTransitionEnd]);

    return <CameraControls ref={controlsRef} />;
};

const generateSurfaceData = (graphData: GraphIR): SurfaceData | null => {
    const surfacePlot = graphData.plots.find(p => p.type === 'surface') as SurfacePlot;
    if (!graphData || !surfacePlot) return null;

    const mathParser = createConfiguredMathParser(graphData.functions || {});
    const { x: xRange, y: yRange, z: zRange } = graphData.ranges;
    const colorMap = graphData.colorMap || 'default';
    const plotExpr = surfacePlot.expr;
    const xSteps = 60; const ySteps = 60;
    const vertices = []; const colors = []; const indices = []; const originalXY = []; const gradMags = []; const uvs = [];
    if (graphData.animation) { mathParser.set(graphData.animation.parameter, graphData.animation.from || 0); }
    const evaluateAt = (x: number, y: number) => {
        try { mathParser.set('x', x); mathParser.set('y', y); const z = mathParser.evaluate(plotExpr); return isNaN(z) || !isFinite(z) ? 0 : z; } catch (e) { return 0; }
    };
    for (let i = 0; i <= ySteps; i++) {
        const v = i / ySteps; const y = yRange.min + v * (yRange.max - yRange.min);
        for (let j = 0; j <= xSteps; j++) {
            const u = j / xSteps; const x = xRange.min + u * (xRange.max - xRange.min);
            originalXY.push({ x, y });
            uvs.push(u, v);
            const z = evaluateAt(x, y);
            vertices.push(x, z, -y);
            const zPercent = (Math.min(zRange.max, Math.max(zRange.min, z)) - zRange.min) / (zRange.max - zRange.min);
            const [r, g, b] = getColorFromMap(zPercent, colorMap); colors.push(r, g, b);
            const h = 0.01; const gradX = (evaluateAt(x + h, y) - evaluateAt(x - h, y)) / (2 * h); const gradY = (evaluateAt(x, y + h) - evaluateAt(x, y - h)) / (2 * h);
            gradMags.push(Math.sqrt(gradX * gradX + gradY * gradY));
        }
    }
    for (let i = 0; i < ySteps; i++) { for (let j = 0; j < xSteps; j++) { const a = i * (xSteps + 1) + j; const b = a + 1; const c = (i + 1) * (xSteps + 1) + j; const d = c + 1; indices.push(a, c, b); indices.push(b, c, d); } }
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('gradMag', new THREE.Float32BufferAttribute(gradMags, 1));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    return { geometry, originalXY, plotExpr, animParam: graphData.animation?.parameter || null, functions: graphData.functions, zRange, colorMap };
};

const GraphSurface: React.FC<{ surfaceData: SurfaceData | null; time: number; isWireframeVisible: boolean; onSurfaceClick?: (point: THREE.Vector3) => void; lyapunovTexture: THREE.DataTexture | null; showLyapunov: boolean; }> = ({ surfaceData, time, isWireframeVisible, onSurfaceClick, lyapunovTexture, showLyapunov }) => {
    const meshRef = React.useRef<THREE.Mesh>(null!);
    const materialRef = React.useRef<THREE.MeshStandardMaterial>(null!);
    const mathParser = React.useMemo(() => surfaceData ? createConfiguredMathParser(surfaceData.functions) : null, [surfaceData]);

    React.useLayoutEffect(() => {
        if (!materialRef.current || !surfaceData) return;
        const colorMapIndex = COLOR_MAP_NAMES.indexOf(surfaceData.colorMap);
        
        materialRef.current.onBeforeCompile = (shader) => {
            shader.uniforms.zRange = { value: new THREE.Vector2(surfaceData.zRange.min, surfaceData.zRange.max) };
            shader.uniforms.colorMapIndex = { value: colorMapIndex };
            shader.uniforms.uLyapunovMap = { value: lyapunovTexture };
            shader.uniforms.uShowLyapunov = { value: showLyapunov ? 1.0 : 0.0 };
            
            shader.vertexShader = 'attribute float gradMag;\nvarying float vGradMag;\nvarying float vRelativeZ;\nvarying vec2 vUv;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGradMag = gradMag;\nvRelativeZ = position.y;\nvUv = uv;\n');
            
            shader.fragmentShader = 'varying float vGradMag;\nvarying float vRelativeZ;\nuniform vec2 zRange;\nuniform int colorMapIndex;\nvarying vec2 vUv;\nuniform sampler2D uLyapunovMap;\nuniform float uShowLyapunov;\n' +
                `vec3 viridis( float t ) { const vec3 c0 = vec3( 0.277, 0.005, 0.344 ); const vec3 c1 = vec3( 0.244, 0.323, 0.613 ); const vec3 c2 = vec3( 0.021, 0.655, 0.518 ); const vec3 c3 = vec3( 0.542, 0.890, 0.141 ); const vec3 c4 = vec3( 0.983, 0.944, 0.367 ); return c0 + t * (c1 + t * (c2 + t * (c3 + t * c4))); }\n` +
                `vec3 plasma( float t ) { const vec3 c0 = vec3(0.05, 0.03, 0.53); const vec3 c1 = vec3(0.44, 0.09, 0.75); const vec3 c2 = vec3(0.74, 0.24, 0.67); const vec3 c3 = vec3(0.95, 0.46, 0.43); const vec3 c4 = vec3(0.98, 0.74, 0.16); const vec3 c5 = vec3(0.97, 0.98, 0.56); t=t*t; return c0 + t*(c1-c0) + t*t*(c2-c1) + t*t*t*(c3-c2) + t*t*t*t*(c4-c3) + t*t*t*t*t*(c5-c4); }\n` +
                `vec3 inferno( float t ) { const vec3 c0 = vec3(0.0, 0.0, 0.0); const vec3 c1 = vec3(0.35, 0.0, 0.46); const vec3 c2 = vec3(0.75, 0.2, 0.37); const vec3 c3 = vec3(0.98, 0.55, 0.0); const vec3 c4 = vec3(0.98, 0.98, 0.6); t=t*t; return c0 + t*(c1-c0) + t*t*(c2-c1) + t*t*t*(c3-c2) + t*t*t*t*(c4-c3); }\n` +
                `vec3 magma( float t ) { const vec3 c0 = vec3(0.0, 0.0, 0.0); const vec3 c1 = vec3(0.28, 0.1, 0.48); const vec3 c2 = vec3(0.68, 0.25, 0.52); const vec3 c3 = vec3(0.96, 0.58, 0.33); const vec3 c4 = vec3(0.99, 0.98, 0.8); t=t*t; return c0 + t*(c1-c0) + t*t*(c2-c1) + t*t*t*(c3-c2) + t*t*t*t*(c4-c3); }\n` +
                `vec3 hot( float t ) { return vec3( smoothstep(0.0, 0.4, t), smoothstep(0.4, 0.8, t), smoothstep(0.8, 1.0, t) ); }\n` +
                `vec3 cool( float t ) { return vec3(t, 1.0 - t, 1.0); }\n` +
                `vec3 defaultMap( float t ) { return mix(vec3(0.2, 0.2, 0.8), vec3(0.8, 0.2, 0.2), t); }\n` +
                `vec3 chaosColor( float t ) { vec3 blue = vec3(0.2, 0.2, 1.0); vec3 yellow = vec3(1.0, 1.0, 0.2); vec3 red = vec3(1.0, 0.2, 0.2); return mix(mix(blue, yellow, t * 2.0), mix(yellow, red, (t - 0.5) * 2.0), step(0.5, t)); }\n` +
                shader.fragmentShader.replace(
                    'vec4 diffuseColor = vec4( diffuse, opacity );',
                    `float zPercent = clamp((vRelativeZ - zRange.x) / (zRange.y - zRange.x), 0.0, 1.0);
                     vec3 baseColor;
                     if (colorMapIndex == 0) baseColor = viridis(zPercent);
                     else if (colorMapIndex == 1) baseColor = plasma(zPercent);
                     else if (colorMapIndex == 2) baseColor = inferno(zPercent);
                     else if (colorMapIndex == 3) baseColor = magma(zPercent);
                     else if (colorMapIndex == 4) baseColor = hot(zPercent);
                     else if (colorMapIndex == 5) baseColor = cool(zPercent);
                     else baseColor = defaultMap(zPercent);

                     float edgeIntensity = min(vGradMag / 5.0, 1.0);
                     vec3 edgeColor = mix(baseColor, vec3(1.0, 1.0, 1.0), edgeIntensity * 0.3);
                     float ambientFactor = 0.3 + 0.7 * zPercent;
                     vec3 finalColor = edgeColor * ambientFactor;

                     vec3 lyapunovColor = chaosColor(texture2D(uLyapunovMap, vUv).r);
                     vec3 finalMixedColor = mix(finalColor, lyapunovColor, uShowLyapunov * 0.85);

                     vec4 diffuseColor = vec4( finalMixedColor, opacity );`
                );
        };
        materialRef.current.needsUpdate = true;
    }, [surfaceData, lyapunovTexture, showLyapunov]);

    React.useLayoutEffect(() => {
        if (!surfaceData || !mathParser || !surfaceData.animParam) return;
        const { geometry, originalXY, plotExpr, animParam, zRange, colorMap } = surfaceData;
        const positions = geometry.attributes.position as THREE.BufferAttribute; const colors = geometry.attributes.color as THREE.BufferAttribute;
        mathParser.set(animParam, time);
        for (let i = 0; i < originalXY.length; i++) {
            const { x, y } = originalXY[i]; mathParser.set('x', x); mathParser.set('y', y);
            let z = 0; try { z = mathParser.evaluate(plotExpr); } catch (e) { /* z remains 0 */ }
            if (!isNaN(z) && isFinite(z)) { positions.setY(i, z); const zPercent = (Math.min(zRange.max, Math.max(zRange.min, z)) - zRange.min) / (zRange.max - zRange.min); const [r, g, b] = getColorFromMap(zPercent, colorMap); colors.setXYZ(i, r, g, b); } else { positions.setY(i, 0); colors.setXYZ(i, 0.1, 0.1, 0.15); }
        }
        positions.needsUpdate = true; colors.needsUpdate = true; geometry.computeVertexNormals();
    }, [time, surfaceData, mathParser]);

    if (!surfaceData) return null;
    return (
        <group>
            <mesh 
              ref={meshRef} 
              geometry={surfaceData.geometry} 
              onClick={(e) => {
                  if (onSurfaceClick) {
                      e.stopPropagation();
                      onSurfaceClick(e.point);
                  }
              }}
            >
                <meshStandardMaterial ref={materialRef} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
            </mesh>
            {isWireframeVisible && <mesh geometry={surfaceData.geometry}><meshStandardMaterial wireframe color="#00ffff" transparent opacity={0.6} /></mesh>}
        </group>
    );
};


const ContourLines: React.FC<{ surfaceData: SurfaceData, graphData: GraphIR, time: number }> = ({ surfaceData, graphData, time }) => {
    const mathParser = React.useMemo(() => surfaceData ? createConfiguredMathParser(surfaceData.functions) : null, [surfaceData]);
    const contourGeometry = React.useMemo(() => {
        if (!graphData.contours || !surfaceData || !mathParser) return null;
        const { originalXY, plotExpr, animParam } = surfaceData; const levels = graphData.contours.levels; const xSteps = 60; const ySteps = 60; const contourPoints: number[] = []; const yOffset = 0.01;
        if (animParam) { mathParser.set(animParam, time); }
        const animatedPositions: number[] = [];
        for (let i = 0; i < originalXY.length; i++) { const { x, y } = originalXY[i]; mathParser.set('x', x); mathParser.set('y', y); let z = 0; try { z = mathParser.evaluate(plotExpr); } catch(e) { /* z remains 0 */ } animatedPositions.push(x, isNaN(z) || !isFinite(z) ? 0 : z, -y); }
        const positions = animatedPositions;
        for (let i = 0; i < ySteps; i++) { for (let j = 0; j < xSteps; j++) { const aIdx = i * (xSteps + 1) + j; const bIdx = aIdx + 1; const cIdx = (i + 1) * (xSteps + 1) + j; const dIdx = cIdx + 1; const vA = new THREE.Vector3().fromArray(positions, aIdx * 3); const vB = new THREE.Vector3().fromArray(positions, bIdx * 3); const vC = new THREE.Vector3().fromArray(positions, cIdx * 3); const vD = new THREE.Vector3().fromArray(positions, dIdx * 3);
                levels.forEach(level => { const points: THREE.Vector3[] = []; const edgeCheck = (p1: THREE.Vector3, p2: THREE.Vector3) => { if ((p1.y > level && p2.y <= level) || (p1.y <= level && p2.y > level)) { const t = (level - p1.y) / (p2.y - p1.y); points.push(new THREE.Vector3().lerpVectors(p1, p2, t)); }}; edgeCheck(vA, vB); edgeCheck(vB, vD); edgeCheck(vD, vC); edgeCheck(vC, vA); if (points.length >= 2) { contourPoints.push(points[0].x, points[0].y + yOffset, points[0].z, points[1].x, points[1].y + yOffset, points[1].z); if (points.length === 4) { contourPoints.push(points[2].x, points[2].y + yOffset, points[2].z, points[3].x, points[3].y + yOffset, points[3].z); } } }); } }
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(contourPoints, 3)); return geometry;
    }, [graphData, surfaceData, time, mathParser]);
    if (!contourGeometry) return null; return <lineSegments geometry={contourGeometry}><lineBasicMaterial color="white" /></lineSegments>;
};

const GraphLabels: React.FC<{ labels: LabelType[], graphData: GraphIR, time: number }> = ({ labels, graphData, time }) => {
    const mathParser = React.useMemo(() => createConfiguredMathParser(graphData.functions || {}), [graphData.functions]);
    const evaluatedLabels = React.useMemo(() => {
        if (graphData.animation) { mathParser.set(graphData.animation.parameter, time); }
        return labels.map(label => {
            try { const { textExpr, positionExpr } = label; const [xExpr, yExpr, zExpr] = positionExpr; const x = mathParser.evaluate(xExpr); const y = mathParser.evaluate(yExpr); const z = mathParser.evaluate(zExpr); const position: [number, number, number] = [x, z, -y]; const text = String(mathParser.evaluate(textExpr)); return { key: textExpr, text, position, visible: true }; } catch (e: any) { console.warn(`Label eval error:`, e.message); return { key: label.textExpr, text: '', position: [0,0,0] as [number,number,number], visible: false }; }
        });
    }, [labels, mathParser, time, graphData.animation]);
    return <group>{evaluatedLabels.map((label) => <Text key={label.key} visible={label.visible} position={label.position} fontSize={0.5} color="white" anchorX="center" anchorY="middle" outlineWidth={0.04} outlineColor="#182030">{label.text}</Text>)}</group>;
};

const AnimationControls: React.FC<{ animation: Animation; time: number; setTime: (t: number) => void; isPlaying: boolean; setIsPlaying: (p: boolean) => void; isRecording: boolean; }> = ({ animation, time, setTime, isPlaying, setIsPlaying, isRecording }) => (
    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-900/50 backdrop-blur-sm rounded-b-lg"><div className="flex items-center gap-4 text-white">
        <button onClick={() => setIsPlaying(!isPlaying)} disabled={isRecording} className="p-2 rounded-full hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isPlaying ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}</button>
        <span className="text-sm font-mono w-20 text-center">{animation.parameter} = {time.toFixed(2)}</span>
        <input type="range" min={animation.from} max={animation.to} step={animation.step} value={time} onChange={(e) => setTime(parseFloat(e.target.value))} disabled={isRecording} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50" />
    </div></div>
);

const Colorbar: React.FC<{ mapName: ColorMapName, zRange: { min: number, max: number } }> = ({ mapName, zRange }) => (
    <div className="absolute top-4 right-4 flex flex-col items-center text-white text-xs font-mono">
        <span>{zRange.max.toFixed(2)}</span>
        <div className="w-5 h-48 my-1 border-2 border-gray-600 rounded" style={{ background: getColormapGradient(mapName) }}></div>
        <span>{zRange.min.toFixed(2)}</span>
    </div>
);

const LyapunovLegend: React.FC = () => (
    <div className="absolute top-4 left-4 flex flex-col items-center text-white text-xs font-mono">
        <span>Chaotic</span>
        <div className="w-5 h-48 my-1 border-2 border-gray-600 rounded" style={{ background: 'linear-gradient(to top, #22f, #ff2, #f22)' }}></div>
        <span>Stable</span>
    </div>
);


const AnimationController: React.FC<{ isPlaying: boolean; animation: Animation | undefined; setTime: React.Dispatch<React.SetStateAction<number>>; }> = ({ isPlaying, animation, setTime }) => {
  useFrame(() => { if (isPlaying && animation) { setTime(t => (t + animation.step > animation.to) ? animation.from : t + animation.step); } }); return null;
};

interface ViewportPanelProps {
  graphData: GraphIR | null;
  error: string | null;
  controls: ControlsState;
  effects: EffectsState;
  setEffects: React.Dispatch<React.SetStateAction<EffectsState>>;
  experimentalData: ExperimentalPoint[] | null;
  validationResults: ValidationResults | null;
  showExpOverlay: boolean;
}

const ViewportPanel: React.FC<ViewportPanelProps> = ({ 
    graphData, error, controls, effects, setEffects,
    experimentalData, validationResults, showExpOverlay
}) => {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const particlesStateRef = React.useRef({ positions: [], trails: [] });
  
  const animation = graphData?.animation;
  const [time, setTime] = React.useState(animation?.from ?? 0);
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [isWireframeVisible, setIsWireframeVisible] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordProgress, setRecordProgress] = React.useState(0);
  const [activePreset, setActivePreset] = React.useState<string | null>(null);
  
  const [isMeasurementMode, setIsMeasurementMode] = React.useState(false);
  const [measurementData, setMeasurementData] = React.useState<MeasurementData>({ points: [], path: null, distance: null });

  const surfaceData = React.useMemo(() => graphData ? generateSurfaceData(graphData) : null, [graphData]);
  const vectorPlots = React.useMemo(() => graphData?.plots.filter(p => p.type === 'vector') as VectorPlot[] || [], [graphData]);
  const tensorPlots = React.useMemo(() => graphData?.plots.filter(p => p.type === 'tensor') as TensorPlot[] || [], [graphData]);
  
  const potentialFn = React.useMemo(() => {
    if (!surfaceData) return () => 0; // Return a flat plane if no surface is plotted
    const mathParser = createConfiguredMathParser(surfaceData.functions);
    return (x: number, y: number): number => {
        try { 
            if (surfaceData.animParam) mathParser.set(surfaceData.animParam, time); 
            mathParser.set('x', x); 
            mathParser.set('y', y); 
            const z = mathParser.evaluate(surfaceData.plotExpr); 
            return isNaN(z) || !isFinite(z) ? 0 : z; 
        } catch (e) { 
            return 0; 
        }
    };
  }, [surfaceData, time]);

  const lyapunovGridData = React.useMemo(() => {
    if (!effects.lyapunovViz || !surfaceData || !graphData) return null;
    return generateLyapunovGrid(
        64, 64, // grid resolution
        graphData.ranges.x,
        graphData.ranges.y,
        potentialFn,
        controls.damping,
        controls.forceCoupling
    );
  }, [effects.lyapunovViz, surfaceData, graphData, potentialFn, controls.damping, controls.forceCoupling]);

  const lyapunovTexture = React.useMemo(() => {
      if (!lyapunovGridData) return null;
      const texture = new THREE.DataTexture(lyapunovGridData, 64, 64, THREE.RedFormat, THREE.FloatType);
      texture.needsUpdate = true;
      return texture;
  }, [lyapunovGridData]);

  React.useEffect(() => {
      if (viewportRef.current) {
          viewportRef.current.style.cursor = isMeasurementMode ? 'crosshair' : 'auto';
      }
  }, [isMeasurementMode]);

  const handleToggleMeasurement = () => {
    setIsMeasurementMode(v => !v);
    if (isMeasurementMode) {
      setMeasurementData({ points: [], path: null, distance: null });
    }
  };

  const handleSurfaceClick = (point: THREE.Vector3) => {
    if (!isMeasurementMode) return;
    setMeasurementData(prev => {
        const newPoints = [...prev.points, point];
        if (newPoints.length === 1) return { points: newPoints, path: null, distance: null };
        if (newPoints.length === 2 && surfaceData?.geometry) {
            const { path, distance } = calculateGeodesicPath(newPoints[0], newPoints[1], surfaceData.geometry);
            return { points: newPoints, path, distance };
        }
        return { points: [point], path: null, distance: null };
    });
  };

  React.useEffect(() => { setTime(animation?.from ?? 0); setIsPlaying(true); }, [animation]);

  const handleExportPNG = React.useCallback(() => {
    if (viewportRef.current) { const wasPlaying = isPlaying; setIsPlaying(false); setTimeout(() => { toPng(viewportRef.current, { cacheBust: true, backgroundColor: '#182030' }).then((dataUrl) => saveAs(dataUrl, 'graphforge-plot.png')).catch((err) => { console.error('Failed to export PNG:', err); alert("Could not export image."); }).finally(() => setIsPlaying(wasPlaying)); }, 100); }
  }, [isPlaying]);

  const handleExportVideo = React.useCallback(async () => { /* ... (unchanged) ... */ }, [isRecording, animation, isPlaying, setTime]);
  const handleExportGRTL = () => { /* ... (unchanged) ... */ };

  const renderContent = () => {
    if (error) return <div className="flex flex-col items-center justify-center h-full text-center text-red-400"><ExclamationIcon className="h-12 w-12 mb-4" /><h3 className="text-lg font-semibold">Parsing Error</h3><p className="font-mono bg-red-900/50 p-4 rounded-md mt-2 text-sm">{error}</p></div>;
    if (!graphData || graphData.plots.length === 0) return <div className="flex flex-col items-center justify-center h-full text-center text-gray-500"><GraphIcon className="h-12 w-12 mb-4" /><h3 className="text-lg font-semibold">No Data to Display</h3><p className="mt-2 text-sm">Valid G3D code will render a plot here.</p></div>;
    
    const { x, y, z } = graphData.ranges;
    const center = [ (x.min + x.max) / 2, (z.min + z.max) / 2, -(y.min + y.max) / 2 ];
    const size = Math.max(x.max - x.min, y.max - y.min, z.max - z.min);

    return (
        <div ref={viewportRef} className="w-full h-full bg-gray-850 rounded-md overflow-hidden relative">
            <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ position: [center[0], center[1] + size * 1.5, center[2] + size * 1.5], fov: 50 }} onCreated={({ gl }) => { canvasRef.current = gl.domElement; }}>
                <color attach="background" args={['#182030']} />
                <ambientLight intensity={Math.PI / 2} />
                <spotLight position={[size, size * 2, size]} angle={0.3} penumbra={1} distance={0} intensity={Math.PI * 2} />
                <pointLight position={[-size, -size, -size]} distance={0} intensity={Math.PI} />
                
                <AnimationController isPlaying={isPlaying} animation={animation} setTime={setTime} />
                
                {surfaceData && <GraphSurface surfaceData={surfaceData} time={time} isWireframeVisible={isWireframeVisible} onSurfaceClick={handleSurfaceClick} lyapunovTexture={lyapunovTexture} showLyapunov={effects.lyapunovViz} />}
                
                {vectorPlots.map(plot => (
                    <VectorField
                        key={plot.fnName}
                        plot={plot}
                        graphData={graphData}
                        potentialFn={potentialFn}
                        time={time}
                    />
                ))}

                {tensorPlots.map(plot => (
                    <TensorGlyphs
                        key={plot.fnName}
                        plot={plot}
                        graphData={graphData}
                        potentialFn={potentialFn}
                        time={time}
                    />
                ))}

                {surfaceData && graphData.contours && <ContourLines surfaceData={surfaceData} graphData={graphData} time={time} />}
                {graphData.labels && <GraphLabels labels={graphData.labels} graphData={graphData} time={time} />}
                {graphData.particles && (
                    <ParticleSystem 
                        key={surfaceData?.plotExpr}
                        count={graphData.particles.count} 
                        potentialFn={potentialFn}
                        xRange={graphData.ranges.x} 
                        yRange={graphData.ranges.y} 
                        particlesStateRef={particlesStateRef} 
                        showTrails={effects.particleTrails}
                        damping={controls.damping}
                        forceCoupling={controls.forceCoupling}
                        particleSize={controls.particleSize}
                        trailLength={controls.trailLength}
                    />
                )}
                
                <VisualEffects
                    effectsState={effects}
                    potentialFn={potentialFn}
                    xRange={x}
                    yRange={y}
                    particlesStateRef={particlesStateRef}
                    particleCount={graphData.particles?.count ?? 0}
                    controls={controls}
                />
                {isMeasurementMode && <DistanceMeasurement data={measurementData} />}

                {showExpOverlay && experimentalData && validationResults && (
                    <ExperimentalDataOverlay
                        experimentalData={experimentalData}
                        validationResults={validationResults}
                        potentialFn={potentialFn}
                    />
                )}

                <CameraManager preset={activePreset} onTransitionEnd={() => setActivePreset(null)} />
                <Grid position={[center[0], 0, center[2]]} fadeDistance={size*3} infiniteGrid />
            </Canvas>
            {surfaceData && <Colorbar mapName={graphData.colorMap || 'default'} zRange={z} />}
            {effects.lyapunovViz && <LyapunovLegend />}
        </div>
    );
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col h-full shadow-2xl">
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <h2 className="font-semibold text-white">3D Viewport</h2>
        <div className="flex items-center gap-2">
            <select
                value={activePreset || ""}
                onChange={(e) => {
                    if (e.target.value) setActivePreset(e.target.value);
                }}
                className="bg-gray-800 text-gray-300 text-sm rounded-md px-2 py-1.5 focus:ring-cyan-500 focus:outline-none hover:bg-gray-700 transition-colors"
            >
                <option value="" disabled>Presets</option>
                {Object.keys(cameraPresets).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <button onClick={() => setEffects(p => ({...p, lyapunovViz: !p.lyapunovViz}))} disabled={isRecording} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50 ${effects.lyapunovViz ? 'bg-cyan-500/20 text-cyan-300' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
              <ButterflyIcon className="h-4 w-4" /> Stability
            </button>
            <button onClick={handleToggleMeasurement} disabled={isRecording} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50 ${isMeasurementMode ? 'bg-cyan-500/20 text-cyan-300' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
              <RulerIcon className="h-4 w-4" /> Measure
            </button>
            <button onClick={() => setIsWireframeVisible(v => !v)} disabled={isRecording} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50 ${isWireframeVisible ? 'bg-cyan-500/20 text-cyan-300' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
              <WireframeIcon className="h-4 w-4" /> Wireframe
            </button>
            <button onClick={handleExportPNG} disabled={isRecording} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50"><ImageIcon className="h-4 w-4" /> PNG</button>
            <button onClick={handleExportVideo} disabled={isRecording} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50 min-w-[110px] justify-center">{isRecording ? <><RecordingIcon className="h-4 w-4 text-red-500 animate-pulse"/>{`Rec ${recordProgress}%`}</> : <><VideoIcon className="h-4 w-4" /> Video</>}</button>
            <button onClick={handleExportGRTL} disabled={isRecording} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50"><CodeIcon className="h-4 w-4" /> GRTL</button>
        </div>
      </div>
      <div className="p-4 flex-grow relative min-h-[300px] md:min-h-0">
        {renderContent()}
        {animation && <AnimationControls animation={animation} time={time} setTime={setTime} isPlaying={isPlaying} setIsPlaying={setIsPlaying} isRecording={isRecording} />}
      </div>
    </div>
  );
};

export default ViewportPanel;