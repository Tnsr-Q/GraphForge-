// FIX: Change React import to default import to fix JSX namespace issues with react-three-fiber.
import React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Range } from '../../types';

interface FluxHeatmapProps {
  particlePositions: THREE.Vector3[];
  xRange: Range;
  yRange: Range;
  particleCount: number;
}

const GRID_SIZE = 32;
// Smoothing factor for temporal stability (how quickly the map reacts).
const SMOOTHING_FACTOR = 0.05; 
// Density floor: particle counts below this won't be rendered.
const DENSITY_FLOOR = 2.0; 


/**
 * A high-fidelity, perceptually uniform 'Plasma' colormap.
 * @param t - A value from 0.0 to 1.0
 * @returns [r, g, b] array, with values from 0.0 to 1.0
 */
const plasmaColor = (t: number): [number, number, number] => {
  const v = Math.max(0, Math.min(1, t));
  const c0 = [0.051, 0.031, 0.529];
  const c1 = [0.494, 0.059, 0.686];
  const c2 = [0.804, 0.275, 0.561];
  const c3 = [0.976, 0.573, 0.251];
  const c4 = [0.949, 0.882, 0.373];

  let r = c0[0] + v * (c1[0] - c0[0] + v * (c2[0] - c1[0] + v * (c3[0] - c2[0] + v * (c4[0] - c3[0]))));
  let g = c0[1] + v * (c1[1] - c0[1] + v * (c2[1] - c1[1] + v * (c3[1] - c2[1] + v * (c4[1] - c3[1]))));
  let b = c0[2] + v * (c1[2] - c0[2] + v * (c2[2] - c1[2] + v * (c3[2] - c2[2] + v * (c4[2] - c3[2]))));

  return [r, g, b];
};


export const FluxHeatmap: React.FC<FluxHeatmapProps> = ({ particlePositions, xRange, yRange, particleCount }) => {
  const textureRef = React.useRef<THREE.CanvasTexture>(null!);
  const canvasRef = React.useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const smoothedDensityRef = React.useRef<number[]>(new Array(GRID_SIZE * GRID_SIZE).fill(0));

  // Density ceiling: particle counts at or above this will get the "hottest" color.
  // This is now dynamic, with a retuned factor to prevent saturation in high-cluster simulations.
  const DENSITY_CEILING = Math.max(40.0, particleCount * 0.5);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = GRID_SIZE;
    canvas.height = GRID_SIZE;
    textureRef.current = new THREE.CanvasTexture(canvas);
  }, []);

  useFrame(() => {
    if (!particlePositions) return;

    // 1. Calculate raw density for the current frame
    const rawDensity = new Array(GRID_SIZE * GRID_SIZE).fill(0);
    const xSize = xRange.max - xRange.min;
    const ySize = yRange.max - yRange.min;

    particlePositions.forEach(p => {
      const i = Math.floor(((p.x - xRange.min) / xSize) * GRID_SIZE);
      const j = Math.floor(((-p.z - yRange.min) / ySize) * GRID_SIZE);
      if (i >= 0 && i < GRID_SIZE && j >= 0 && j < GRID_SIZE) {
        rawDensity[j * GRID_SIZE + i] += 1;
      }
    });

    // 2. Apply temporal smoothing to the density values
    const smoothedDensity = smoothedDensityRef.current;
    for (let i = 0; i < smoothedDensity.length; i++) {
        smoothedDensity[i] += (rawDensity[i] - smoothedDensity[i]) * SMOOTHING_FACTOR;
    }
    
    // 3. Render to canvas using color brightness for masking
    const context = canvasRef.current.getContext('2d')!;
    const imageData = context.createImageData(GRID_SIZE, GRID_SIZE);
    const densityRange = DENSITY_CEILING - DENSITY_FLOOR;

    for (let i = 0; i < smoothedDensity.length; i++) {
        const density = smoothedDensity[i];
        const idx = i * 4;
        
        if (density > DENSITY_FLOOR) {
            // Normalize density within our stable floor/ceiling range
            const normalizedDensity = (density - DENSITY_FLOOR) / densityRange;
            // Apply a perceptual curve to enhance detail
            const displayValue = Math.pow(Math.min(1.0, normalizedDensity), 0.75);
            const [r, g, b] = plasmaColor(displayValue);

            imageData.data[idx] = r * 255;
            imageData.data[idx + 1] = g * 255;
            imageData.data[idx + 2] = b * 255;
        } else {
            // Render pure black for low-density areas. Additive blending will make these invisible.
            imageData.data[idx] = 0;
            imageData.data[idx + 1] = 0;
            imageData.data[idx + 2] = 0;
        }
        // Alpha is always 255. The "masking" is done by the color brightness itself.
        imageData.data[idx + 3] = 255;
    }
    context.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
    context.putImageData(imageData, 0, 0);
    if(textureRef.current) textureRef.current.needsUpdate = true;
  });

  return (
    <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[xRange.max - xRange.min, yRange.max - yRange.min]} />
      {/* By removing `transparent`, we use a different rendering path that avoids the occlusion issue.
          AdditiveBlending on non-transparent material means black texels have no effect, and colored texels add light. */}
      <meshBasicMaterial map={textureRef.current} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
};