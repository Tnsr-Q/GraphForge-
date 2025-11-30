import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TopologicalRibbonProps {
    potentialFn: (x: number, y: number) => number;
    damping?: number;
}

const RIBBON_RADIUS = 0.1; 
const PATH_SEGMENTS = 256;
const TUBE_SEGMENTS = 64; // Increased for better color resolution

export const TopologicalRibbon: React.FC<TopologicalRibbonProps> = ({ potentialFn, damping = 0.5 }) => {
    const meshRef = useRef<THREE.Mesh>(null!);

    // Generate Path
    const path = useMemo(() => {
        const points = [];
        for (let i = 0; i <= PATH_SEGMENTS; i++) {
            const t = (i / PATH_SEGMENTS) * Math.PI * 2;
            const x = 4 * Math.cos(t) + 0.5 * Math.cos(5 * t);
            const y = 4 * Math.sin(t) + 0.5 * Math.sin(5 * t);
            const z = potentialFn(x, y);
            points.push(new THREE.Vector3(x, z + 0.15, -y)); 
        }
        return new THREE.CatmullRomCurve3(points, true);
    }, [potentialFn]);

    // Calculate Geometry and Stability Colors
    const geometry = useMemo(() => {
        const tubeGeo = new THREE.TubeGeometry(path, TUBE_SEGMENTS, RIBBON_RADIUS, 8, true);
        const count = tubeGeo.attributes.position.count;
        const colors = new Float32Array(count * 3);
        
        // Helper to calculate numerical Laplacian (Trace of Hessian) as a proxy for stability
        // Positive Laplacian (Minima) -> Converging -> Blue/Green
        // Negative Laplacian (Maxima) -> Diverging -> Red/Yellow
        const getStability = (x: number, y: number) => {
            const h = 0.05;
            const c = potentialFn(x, y);
            const dx1 = potentialFn(x + h, y);
            const dx2 = potentialFn(x - h, y);
            const dy1 = potentialFn(x, y + h);
            const dy2 = potentialFn(x, y - h);
            
            // Second derivatives
            const d2x = (dx1 - 2*c + dx2) / (h*h);
            const d2y = (dy1 - 2*c + dy2) / (h*h);
            
            return d2x + d2y; 
        };

        const posAttr = tubeGeo.attributes.position;
        const stableColor = new THREE.Color(0x0088ff); // Blue
        const neutralColor = new THREE.Color(0xffff00); // Yellow
        const unstableColor = new THREE.Color(0xff0044); // Red

        for (let i = 0; i < count; i++) {
            const x = posAttr.getX(i);
            const y = -posAttr.getZ(i); // Map back from 3D Z to 2D Y
            
            const stability = getStability(x, y);
            // Normalize stability for visualization: range approx -2 to 2
            // stability > 0 is locally convex (stable-ish)
            
            const color = new THREE.Color();
            if (stability > 0.5) {
                color.copy(stableColor);
            } else if (stability < -0.5) {
                color.copy(unstableColor);
            } else {
                // Interpolate through yellow
                const t = (stability + 0.5); // 0 to 1
                color.lerpColors(unstableColor, stableColor, t);
            }
            
            // Mix with a bit of "damping" effect (just for visual variation based on props)
            if (damping > 1.0) color.offsetHSL(0, -0.2, 0);

            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        tubeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        return tubeGeo;

    }, [path, potentialFn, damping]);

    // Use a basic material with vertex coloring enabled to show the stability gradient
    const material = useMemo(() => {
        return new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.3,
            metalness: 0.1,
            emissive: 0x222222,
        });
    }, []);

    useFrame(({ clock }) => {
        if (meshRef.current) {
            // Subtle pulse to indicate active topology
            const scale = 1.0 + 0.02 * Math.sin(clock.getElapsedTime() * 2);
            meshRef.current.scale.set(scale, scale, scale);
        }
    });

    return (
        <mesh ref={meshRef} geometry={geometry} material={material} />
    );
};