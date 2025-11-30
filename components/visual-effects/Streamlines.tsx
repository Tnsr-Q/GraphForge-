import * as React from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { Range, FieldlineConfig, ColorMapName } from '../../types';
import { getColorFromMap } from '../../services/color-maps';

interface StreamlinesProps {
  potentialFn: (x: number, y: number) => number;
  vectorField?: (x: number, y: number) => [number, number, number];
  differentialEq?: (x: number, y: number) => [number, number]; // dx/dt, dy/dt
  xRange: Range;
  yRange: Range;
  config: FieldlineConfig;
  time?: number;
}

// Enhanced field line generator with multiple modes
const generateFieldline = (
  startX: number, 
  startY: number, 
  config: FieldlineConfig,
  potentialFn: (x: number, y: number) => number,
  vectorField: ((x: number, y: number) => [number, number, number]) | undefined,
  differentialEq: ((x: number, y: number) => [number, number]) | undefined,
  xRange: Range,
  yRange: Range,
  time: number = 0
) => {
  const points: THREE.Vector3[] = [];
  const magnitudes: number[] = [];
  const properties: number[] = []; // Could be curvature, divergence, etc.
  
  let x = startX, y = startY;
  const dt = 0.03;

  const getFieldVector = (x: number, y: number): [number, number] => {
    switch (config.mode) {
      case 'gradient':
        const h = 0.01;
        const dx = (potentialFn(x + h, y) - potentialFn(x - h, y)) / (2 * h);
        const dy = (potentialFn(x, y + h) - potentialFn(x, y - h)) / (2 * h);
        return [-dx, -dy]; // Follow negative gradient
      
      case 'vector_field':
        if (vectorField) {
          const [vx, vy] = vectorField(x, y);
          return [vx, vy];
        }
        return [0, 0];
      
      case 'null_lines':
        if (vectorField) {
          const [vx, vy] = vectorField(x, y);
          return [vy, -vx]; // Perpendicular to find zero crossings
        }
        return [0, 0];
      
      case 'phase_portrait':
        if (differentialEq) {
          return differentialEq(x, y);
        }
        return [0, 0];
      
      case 'integral_curves':
        if (vectorField) {
          const [vx, vy] = vectorField(x, y);
          return [vx, vy];
        }
        return [0, 0];
      
      default:
        return [0, 0];
    }
  };

  for (let i = 0; i < 1000; i++) {
    const z = potentialFn(x, y);
    points.push(new THREE.Vector3(x, z + 0.05, -y));

    const [dx, dy] = getFieldVector(x, y);
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    magnitudes.push(magnitude);
    
    const curvature = calculateCurvature(points);
    properties.push(curvature);

    // RK4 integration for smooth curves
    const k1 = getFieldVector(x, y);
    const k2 = getFieldVector(x + 0.5 * dt * k1[0], y + 0.5 * dt * k1[1]);
    const k3 = getFieldVector(x + 0.5 * dt * k2[0], y + 0.5 * dt * k2[1]);
    const k4 = getFieldVector(x + dt * k3[0], y + dt * k3[1]);
    
    const netDx = (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6;
    const netDy = (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6;
    
    x += dt * netDx;
    y += dt * netDy;
    
    const outOfBounds = x < xRange.min || x > xRange.max || y < yRange.min || y > yRange.max;
    const tooSlow = magnitude < 1e-6;
    const tooLong = i > config.length;
    
    if (outOfBounds || tooSlow || tooLong) break;
  }

  return { points, magnitudes, properties };
};

// Smart seeding strategies
const generateSeedPoints = (
  config: FieldlineConfig,
  potentialFn: (x: number, y: number) => number,
  xRange: Range,
  yRange: Range,
  count: number
): [number, number][] => {
  const seeds: [number, number][] = [];

  switch (config.seedPoints) {
    case 'random':
      for (let i = 0; i < count; i++) {
        seeds.push([
          xRange.min + Math.random() * (xRange.max - xRange.min),
          yRange.min + Math.random() * (yRange.max - yRange.min)
        ]);
      }
      break;

    case 'grid':
      const gridSize = Math.ceil(Math.sqrt(count));
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          seeds.push([
            xRange.min + (i / (gridSize-1)) * (xRange.max - xRange.min),
            yRange.min + (j / (gridSize-1)) * (yRange.max - yRange.min)
          ]);
        }
      }
      break;

    case 'critical_points':
      const criticalPoints = findCriticalPoints(potentialFn, xRange, yRange);
      seeds.push(...criticalPoints);
      
      criticalPoints.forEach(([cx, cy]) => {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
          seeds.push([ cx + 0.1 * Math.cos(angle), cy + 0.1 * Math.sin(angle) ]);
        }
      });
      break;

    case 'boundary':
      const boundaryCount = Math.floor(count / 4);
      for (let i = 0; i < boundaryCount; i++) {
        seeds.push([xRange.min + (i / boundaryCount) * (xRange.max - xRange.min), yRange.max]);
        seeds.push([xRange.min + (i / boundaryCount) * (xRange.max - xRange.min), yRange.min]);
        seeds.push([xRange.min, yRange.min + (i / boundaryCount) * (yRange.max - yRange.min)]);
        seeds.push([xRange.max, yRange.min + (i / boundaryCount) * (yRange.max - yRange.min)]);
      }
      break;
  }

  return seeds;
};

const findCriticalPoints = (potentialFn: (x: number, y: number) => number, xRange: Range, yRange: Range): [number, number][] => {
  const criticalPoints: [number, number][] = [];
  const gridSize = 20;
  
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const x = xRange.min + (i / gridSize) * (xRange.max - xRange.min);
      const y = yRange.min + (j / gridSize) * (yRange.max - yRange.min);
      
      const h = 0.01;
      const dx = (potentialFn(x + h, y) - potentialFn(x - h, y)) / (2 * h);
      const dy = (potentialFn(x, y + h) - potentialFn(x, y - h)) / (2 * h);
      
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
        criticalPoints.push([x, y]);
      }
    }
  }
  
  return criticalPoints;
};

const calculateCurvature = (points: THREE.Vector3[]): number => {
  if (points.length < 3) return 0;
  
  const p1 = points[points.length - 3];
  const p2 = points[points.length - 2]; 
  const p3 = points[points.length - 1];
  
  const v1 = new THREE.Vector3().subVectors(p2, p1);
  const v2 = new THREE.Vector3().subVectors(p3, p2);
  const cross = new THREE.Vector3().crossVectors(v1, v2);
  
  return cross.length() / (v1.length() * v2.length() + 1e-6);
};

export const Streamlines: React.FC<StreamlinesProps> = ({
  potentialFn,
  vectorField,
  differentialEq,
  xRange,
  yRange,
  config,
  time = 0
}) => {
  const fieldlines = React.useMemo(() => {
    const lines = [];
    const seedPoints = generateSeedPoints(config, potentialFn, xRange, yRange, config.density);
    
    for (const [startX, startY] of seedPoints) {
      const { points, magnitudes, properties } = generateFieldline(
        startX, startY, config, potentialFn, vectorField, differentialEq, xRange, yRange, time
      );
      
      if (points.length > 5) {
        lines.push({ id: `${startX}-${startY}`, points, magnitudes, properties });
      }
    }
    
    return lines;
  }, [potentialFn, vectorField, differentialEq, xRange, yRange, config, time]);

  return (
    <group>
      {fieldlines.map(line => (
        <Streamline 
          key={line.id} 
          points={line.points} 
          magnitudes={line.magnitudes}
          properties={line.properties}
          config={config}
        />
      ))}
    </group>
  );
};

const ArrowHead: React.FC<{ position: THREE.Vector3; direction: THREE.Vector3; color: THREE.Color; }> = ({ position, direction, color }) => {
    const meshRef = React.useRef<THREE.Mesh>(null!);
    React.useLayoutEffect(() => {
        if (meshRef.current) {
            const targetDirection = direction.clone().normalize();
            if (targetDirection.lengthSq() === 0) return;
            const up = new THREE.Vector3(0, 1, 0);
            const quaternion = new THREE.Quaternion().setFromUnitVectors(up, targetDirection);
            meshRef.current.quaternion.copy(quaternion);
        }
    }, [direction]);
    return (
        <mesh ref={meshRef} position={position} >
            <coneGeometry args={[0.05, 0.2, 8]} />
            <meshBasicMaterial color={color} />
        </mesh>
    );
};

const Streamline: React.FC<{
  points: THREE.Vector3[];
  magnitudes: number[];
  properties: number[];
  config: FieldlineConfig;
}> = ({ points, magnitudes, properties, config }) => {
  if (points.length < 2) return null;

  const colors = React.useMemo(() => {
    const maxMag = Math.max(...magnitudes, 1e-6);
    return magnitudes.map((mag, index) => {
      let value = Math.min(mag / maxMag, 1.0);
      if (config.mode === 'null_lines') {
        value = properties[index] || 0; // Color by curvature
      }
      const [r, g, b] = getColorFromMap(value, config.colorMap);
      return new THREE.Color(r, g, b);
    });
  }, [magnitudes, properties, config]);

  const arrowIndex = Math.floor(points.length * 0.7);

  return (
    <group>
      <Line 
        points={points} 
        vertexColors={colors} 
        lineWidth={2} 
        transparent 
        opacity={config.opacity}
      />
      {config.showArrows && points.length > 10 && (
        <ArrowHead 
          position={points[arrowIndex]} 
          direction={points[arrowIndex].clone().sub(points[arrowIndex - 1])}
          color={colors[arrowIndex]}
        />
      )}
    </group>
  );
};