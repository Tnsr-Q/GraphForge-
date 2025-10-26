import React from 'react';
import * as THREE from 'three';

// Helper to convert arrays/vectors to Vector3
const vec3 = (v: any) => (v instanceof THREE.Vector3 ? v : new THREE.Vector3(...v));

interface ArrowProps {
  origin: THREE.Vector3 | [number, number, number];
  direction?: THREE.Vector3 | [number, number, number];
  length?: number;
  color?: THREE.Color | string | number;
  headWidth?: number;
  headLength?: number;
}

export const Arrow: React.FC<ArrowProps> = React.forwardRef<THREE.ArrowHelper, ArrowProps>(
  ({ origin, direction = [0, 0, 1], length = 1, color = 'black', headWidth, headLength, ...props }, ref) => {
    
    // Create an arrow helper instance once and memoize it
    const arrow = React.useMemo(() => new THREE.ArrowHelper(new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,0), 0, 0, 0, 0), []);
    
    // Update the arrow's properties imperatively when props change
    React.useLayoutEffect(() => {
        // Set defaults for head size if not provided, based on length
        const effectiveHeadWidth = headWidth === undefined ? length * 0.15 : headWidth;
        const effectiveHeadLength = headLength === undefined ? effectiveHeadWidth * 0.6 : headLength;

        if (origin) arrow.position.copy(vec3(origin));
        arrow.setDirection(vec3(direction).normalize());
        arrow.setLength(length, effectiveHeadLength, effectiveHeadWidth);
        arrow.setColor(new THREE.Color(color as any));
    }, [origin, direction, length, color, headWidth, headLength]);
    
    // Render the arrow helper using <primitive>
    return <primitive {...props} object={arrow} ref={ref as any} />;
});
