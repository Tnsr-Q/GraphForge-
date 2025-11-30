import * as React from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

// Helper to convert arrays/vectors to Vector3
const vec3 = (v: any) => (v instanceof THREE.Vector3 ? v : new THREE.Vector3(...v));

interface ArrowProps {
  origin: THREE.Vector3 | [number, number, number];
  direction?: THREE.Vector3 | [number, number, number];
  vector?: THREE.Vector3 | [number, number, number]; // Direct vector (alternative to direction+length)
  length?: number;
  color?: THREE.Color | string | number;
  headWidth?: number;
  headLength?: number;
  opacity?: number;
  lineWidth?: number;
  
  // Enhanced features
  scaleWithMagnitude?: boolean;
  maxLength?: number;
  minLength?: number;
  colorByMagnitude?: boolean;
  magnitudeRange?: [number, number];
  colorMap?: (normalizedMagnitude: number) => THREE.Color;
  
  // Tensor physics features
  tensorType?: 'electric' | 'magnetic' | 'velocity' | 'stress' | 'gradient' | 'general';
  showFieldLines?: boolean;
  fieldLineCount?: number;
  fieldLineLength?: number;
  
  // Animation
  pulse?: boolean;
  pulseSpeed?: number;
  animate?: boolean;
  animationPhase?: number;
}

export const Arrow: React.FC<ArrowProps> = React.forwardRef<THREE.Group, ArrowProps>(
  ({ 
    origin, 
    direction = [0, 0, 1], 
    vector,
    length = 1, 
    color = '#00ffff',
    headWidth, 
    headLength,
    opacity = 1,
    lineWidth = 1,
    
    // Enhanced features
    scaleWithMagnitude = false,
    maxLength = 2,
    minLength = 0.1,
    colorByMagnitude = false,
    magnitudeRange,
    colorMap,
    
    // Tensor features
    tensorType = 'general',
    showFieldLines = false,
    fieldLineCount = 3,
    fieldLineLength = 0.5,
    
    // Animation
    pulse = false,
    pulseSpeed = 1,
    animate = false,
    animationPhase = 0,
    
    ...props 
  }, ref) => {
    
    const groupRef = React.useRef<THREE.Group>(null);
    const arrowRef = React.useRef<THREE.ArrowHelper>(null!);
    
    React.useImperativeHandle(ref, () => groupRef.current!);
    
    // Calculate actual vector and magnitude
    const { actualVector, magnitude } = React.useMemo(() => {
      if (vector) {
        const v = vec3(vector);
        return { actualVector: v, magnitude: v.length() };
      } else {
        const dir = vec3(direction).normalize();
        return { actualVector: dir.clone().multiplyScalar(length), magnitude: length };
      }
    }, [vector, direction, length]);
    
    // Enhanced color calculation
    const arrowColor = React.useMemo(() => {
      if (colorByMagnitude && colorMap) {
        const normalizedMag = magnitudeRange 
          ? THREE.MathUtils.inverseLerp(magnitudeRange[0], magnitudeRange[1], magnitude)
          : Math.min(magnitude / (maxLength || 2), 1);
        return colorMap(normalizedMag);
      }
      
      if (colorByMagnitude) {
        // Default color mapping by magnitude
        const normalizedMag = Math.min(magnitude / (maxLength || 2), 1);
        return new THREE.Color().lerpColors(
          new THREE.Color('#0000ff'), 
          new THREE.Color('#ff0000'), 
          normalizedMag
        );
      }
      
      return new THREE.Color(color as any);
    }, [color, colorByMagnitude, magnitude, colorMap, magnitudeRange, maxLength]);
    
    // Scale calculation with constraints
    const effectiveLength = React.useMemo(() => {
      if (!scaleWithMagnitude) return length;
      
      let scaled = magnitude;
      if (maxLength) scaled = Math.min(scaled, maxLength);
      if (minLength) scaled = Math.max(scaled, minLength);
      return scaled;
    }, [magnitude, scaleWithMagnitude, maxLength, minLength, length]);
    
    // Pulse animation
    const pulseScale = React.useMemo(() => {
      if (!pulse) return 1;
      return 1 + 0.2 * Math.sin((animationPhase || 0) * pulseSpeed * Math.PI * 2);
    }, [pulse, animationPhase, pulseSpeed]);
    
    // Create arrow helper
    const arrow = React.useMemo(() => {
      const helper = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1), 
        new THREE.Vector3(0, 0, 0), 
        1, 
        0x00ffff, 
        0.2, 
        0.1
      );
      return helper;
    }, []);
    
    // Update arrow properties
    React.useLayoutEffect(() => {
      if (!arrowRef.current) return;
      
      const effectiveHeadWidth = headWidth === undefined ? effectiveLength * 0.15 : headWidth;
      const effectiveHeadLength = headLength === undefined ? effectiveHeadWidth * 0.6 : headLength;
      
      arrow.position.copy(vec3(origin));
      arrow.setDirection(actualVector.clone().normalize());
      arrow.setLength(effectiveLength * pulseScale, effectiveHeadLength, effectiveHeadWidth);
      arrow.setColor(arrowColor);
      
      // Apply opacity to materials
      (arrow.line.material as THREE.LineBasicMaterial).transparent = opacity < 1;
      (arrow.line.material as THREE.LineBasicMaterial).opacity = opacity;
      (arrow.cone.material as THREE.MeshBasicMaterial).transparent = opacity < 1;
      (arrow.cone.material as THREE.MeshBasicMaterial).opacity = opacity;
      
      // Apply line width if supported
      if ('linewidth' in arrow.line.material) {
        (arrow.line.material as any).linewidth = lineWidth;
      }
      
    }, [origin, actualVector, effectiveLength, arrowColor, headWidth, headLength, opacity, lineWidth, pulseScale]);
    
    // Generate field lines for tensor visualization
    const generateFieldLines = React.useMemo(() => {
      if (!showFieldLines || fieldLineCount === 0) return [];
      
      const lines: THREE.Vector3[][] = [];
      const baseDirection = actualVector.clone().normalize();
      
      for (let i = 0; i < fieldLineCount; i++) {
        const angle = (i / fieldLineCount) * Math.PI * 2;
        const radius = effectiveLength * 0.1;
        
        // Create a perpendicular vector
        const perpendicular = new THREE.Vector3();
        if (Math.abs(baseDirection.x) > 0.1 || Math.abs(baseDirection.y) > 0.1) {
          perpendicular.set(-baseDirection.y, baseDirection.x, 0).normalize();
        } else {
          perpendicular.set(0, -baseDirection.z, baseDirection.y).normalize();
        }
        
        // Rotate around the arrow direction
        const tangent = perpendicular.clone().applyAxisAngle(baseDirection, angle);
        
        const points: THREE.Vector3[] = [];
        const steps = 10;
        
        for (let j = 0; j <= steps; j++) {
          const t = (j / steps) * fieldLineLength;
          const curvePoint = tangent.clone()
            .multiplyScalar(Math.sin(t * Math.PI) * radius)
            .add(baseDirection.clone().multiplyScalar(t * effectiveLength * 0.5));
          
          points.push(curvePoint);
        }
        
        lines.push(points);
      }
      
      return lines;
    }, [showFieldLines, fieldLineCount, actualVector, effectiveLength, fieldLineLength]);
    
    return (
      <group ref={groupRef} position={vec3(origin)} {...props}>
        <primitive object={arrow} ref={arrowRef} />
        
        {/* Field lines for tensor visualization */}
        {showFieldLines && generateFieldLines.map((points, index) => (
          <FieldLine 
            key={index}
            points={points}
            color={arrowColor}
            opacity={opacity * 0.6}
          />
        ))}
        
        {/* Optional coordinate system indicator */}
        {tensorType === 'stress' && (
          <TensorIndicator 
            direction={actualVector.clone().normalize()}
            magnitude={magnitude}
            color={arrowColor}
          />
        )}
      </group>
    );
  }
);

// Field line component for tensor visualization
const FieldLine: React.FC<{
  points: THREE.Vector3[];
  color: THREE.Color;
  opacity: number;
}> = ({ points, color, opacity }) => {
  return (
    <Line
      points={points}
      color={color}
      transparent
      opacity={opacity}
      lineWidth={1}
    />
  );
};

// Stress tensor indicator (shows principal directions)
const TensorIndicator: React.FC<{
  direction: THREE.Vector3;
  magnitude: number;
  color: THREE.Color;
}> = ({ direction, magnitude, color }) => {
  
  const perpendiculars = React.useMemo(() => {
    const perp1 = new THREE.Vector3();
    const up = Math.abs(direction.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    perp1.crossVectors(direction, up).normalize().multiplyScalar(magnitude * 0.3);
    const perp2 = new THREE.Vector3().crossVectors(direction, perp1).normalize().multiplyScalar(magnitude * 0.3);
    return [perp1, perp2];
  }, [direction, magnitude]);
  
  return (
    <group>
      {perpendiculars.map((perp, index) => (
        <Line
          key={index}
          points={[perp.clone().negate(), perp]}
          color={color}
          transparent
          opacity={0.4}
          lineWidth={1}
        />
      ))}
    </group>
  );
};

// Helper hook for animated arrows
export const useAnimatedArrow = (initialProps: Partial<ArrowProps>) => {
  const [animationPhase, setAnimationPhase] = React.useState(0);
  
  React.useEffect(() => {
    if (!initialProps.animate) return;
    
    let animId: number;
    const animate = () => {
      setAnimationPhase(prev => (prev + 0.016) % 1); // ~60fps
      animId = requestAnimationFrame(animate);
    };
    
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [initialProps.animate]);
  
  return { animationPhase };
};

// Pre-configured arrow presets
export const ArrowPresets = {
  electric: (props: Partial<ArrowProps>) => ({
    color: '#ff4444',
    tensorType: 'electric' as const,
    pulse: true,
    pulseSpeed: 2,
    ...props
  }),
  
  magnetic: (props: Partial<ArrowProps>) => ({
    color: '#4444ff', 
    tensorType: 'magnetic' as const,
    showFieldLines: true,
    fieldLineCount: 4,
    ...props
  }),
  
  velocity: (props: Partial<ArrowProps>) => ({
    color: '#44ff44',
    tensorType: 'velocity' as const,
    scaleWithMagnitude: true,
    colorByMagnitude: true,
    ...props
  }),
  
  stress: (props: Partial<ArrowProps>) => ({
    color: '#ff8844',
    tensorType: 'stress' as const,
    headWidth: 0.1,
    headLength: 0.2,
    ...props
  }),
  
  gradient: (props: Partial<ArrowProps>) => ({
    color: '#ffff44',
    tensorType: 'gradient' as const,
    pulse: true,
    pulseSpeed: 1,
    ...props
  })
};