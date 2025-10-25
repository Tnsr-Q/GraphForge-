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
// Density floor: particle counts below this won't be rendered.
const DENSITY_FLOOR = 0.1; 

const createGaussianKernel = (sigma: number, size: number) => {
  const kernel: number[] = [];
  const half = Math.floor(size / 2);
  let sum = 0;
  for (let y = -half; y <= half; y++) {
    for (let x = -half; x <= half; x++) {
      const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      kernel.push(value);
      sum += value;
    }
  }
  return kernel.map(v => v / sum);
};

// Pre-calculated for performance
const GAUSSIAN_KERNEL_5X5_SIGMA2 = createGaussianKernel(2, 5);

const applyGaussianBlur = (density: number[], gridSize: number) => {
    const blurredDensity = new Array(density.length).fill(0);
    const kernel = GAUSSIAN_KERNEL_5X5_SIGMA2;
    const kernelSize = 5;
    const kernelHalf = Math.floor(kernelSize / 2);

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            let weightedSum = 0;
            for (let ky = -kernelHalf; ky <= kernelHalf; ky++) {
                for (let kx = -kernelHalf; kx <= kernelHalf; kx++) {
                    const ny = Math.max(0, Math.min(gridSize - 1, y + ky)); // Clamp to edge
                    const nx = Math.max(0, Math.min(gridSize - 1, x + kx));
                    
                    const kernelIndex = (ky + kernelHalf) * kernelSize + (kx + kernelHalf);
                    const densityIndex = ny * gridSize + nx;
                    
                    weightedSum += density[densityIndex] * kernel[kernelIndex];
                }
            }
            blurredDensity[y * gridSize + x] = weightedSum;
        }
    }
    return blurredDensity;
};

/**
 * A blue-to-red colormap.
 * @param t - A value from 0.0 to 1.0
 * @returns [r, g, b] array, with values from 0.0 to 1.0
 */
const blueToRedColor = (t: number): [number, number, number] => {
  const v = Math.max(0, Math.min(1, t));
  return [v, 0, 1 - v];
};


export const FluxHeatmap: React.FC<FluxHeatmapProps> = ({ particlePositions, xRange, yRange, particleCount }) => {
  const textureRef = React.useRef<THREE.CanvasTexture>(null!);
  const canvasRef = React.useRef<HTMLCanvasElement>(document.createElement('canvas'));
  
  // Density ceiling: particle counts at or above this will get the "hottest" color.
  const DENSITY_CEILING = Math.max(10.0, particleCount * 0.1);

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

    // 2. Apply Gaussian blur for spatial smoothing
    const blurredDensity = applyGaussianBlur(rawDensity, GRID_SIZE);
    
    // 3. Render to canvas
    const context = canvasRef.current.getContext('2d')!;
    const imageData = context.createImageData(GRID_SIZE, GRID_SIZE);
    const densityRange = DENSITY_CEILING - DENSITY_FLOOR;

    for (let i = 0; i < blurredDensity.length; i++) {
        const density = blurredDensity[i];
        const idx = i * 4;
        
        if (density > DENSITY_FLOOR) {
            const normalizedDensity = Math.min(1.0, (density - DENSITY_FLOOR) / densityRange);
            const [r, g, b] = blueToRedColor(normalizedDensity);

            imageData.data[idx] = r * 255;
            imageData.data[idx + 1] = g * 255;
            imageData.data[idx + 2] = b * 255;
            imageData.data[idx + 3] = normalizedDensity * 255; // Alpha is based on density
        } else {
            // Make low-density areas fully transparent
            imageData.data[idx + 3] = 0;
        }
    }
    context.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
    context.putImageData(imageData, 0, 0);
    if(textureRef.current) textureRef.current.needsUpdate = true;
  });

  return (
    <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[xRange.max - xRange.min, yRange.max - yRange.min]} />
      <meshBasicMaterial 
        map={textureRef.current} 
        transparent={true} 
        opacity={0.5} 
        depthWrite={false} 
      />
    </mesh>
  );
};