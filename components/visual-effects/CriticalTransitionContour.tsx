import React, { useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { Range } from '../../types';
import { createConfiguredMathParser } from '../../services/math-parser';

interface CriticalTransitionContourProps {
    functions: any;
    xRange: Range;
    yRange: Range;
    time: number;
    potentialFn: (x: number, y: number) => number;
}

const CRITICAL_VALUE = -1.0 / 3.0;
const GRID_RES = 120; // High resolution for smooth contour

export const CriticalTransitionContour: React.FC<CriticalTransitionContourProps> = ({ 
    functions, xRange, yRange, time, potentialFn 
}) => {
    const lineRef = useRef<THREE.LineSegments>(null!);
    
    // Check if the specific AP' function exists in the G3D code
    const hasApPrime = useMemo(() => {
        return functions && !!functions['FN_AP_PRIME'];
    }, [functions]);

    const geometry = useMemo(() => {
        if (!hasApPrime) return null;

        const mathParser = createConfiguredMathParser(functions);
        if (functions['t']) mathParser.set('t', time); // Handle time dependency if applicable

        const positions: number[] = [];
        
        // Marching Squares Algorithm to find isoline AP'(x,y) = CRITICAL_VALUE
        const grid = new Float32Array((GRID_RES + 1) * (GRID_RES + 1));
        const dx = (xRange.max - xRange.min) / GRID_RES;
        const dy = (yRange.max - yRange.min) / GRID_RES;

        // 1. Evaluate Scalar Field Grid
        for (let j = 0; j <= GRID_RES; j++) {
            const y = yRange.min + j * dy;
            for (let i = 0; i <= GRID_RES; i++) {
                const x = xRange.min + i * dx;
                
                let val = 0;
                try {
                    mathParser.set('x', x);
                    mathParser.set('y', y);
                    val = mathParser.evaluate('FN_AP_PRIME(x,y)');
                } catch (e) { val = 0; }
                
                grid[j * (GRID_RES + 1) + i] = val;
            }
        }

        // 2. Linear Interpolation Helper
        const lerp = (v0: number, v1: number, t0: number, t1: number) => {
            return t0 + (t1 - t0) * ((CRITICAL_VALUE - v0) / (v1 - v0));
        };

        // 3. Marching Squares
        for (let j = 0; j < GRID_RES; j++) {
            for (let i = 0; i < GRID_RES; i++) {
                const idx = j * (GRID_RES + 1) + i;
                const v0 = grid[idx];                     // Bottom-left
                const v1 = grid[idx + 1];                 // Bottom-right
                const v2 = grid[idx + (GRID_RES + 1) + 1]; // Top-right
                const v3 = grid[idx + (GRID_RES + 1)];     // Top-left

                const x0 = xRange.min + i * dx;
                const y0 = yRange.min + j * dy;
                
                // Determine square case index (0-15) based on threshold
                let squareIndex = 0;
                if (v0 < CRITICAL_VALUE) squareIndex |= 1;
                if (v1 < CRITICAL_VALUE) squareIndex |= 2;
                if (v2 < CRITICAL_VALUE) squareIndex |= 4;
                if (v3 < CRITICAL_VALUE) squareIndex |= 8;

                // Edges: 0:bottom, 1:right, 2:top, 3:left
                const getPoint = (edge: number) => {
                    let px = x0, py = y0;
                    if (edge === 0) { px = lerp(v0, v1, x0, x0+dx); py = y0; }
                    if (edge === 1) { px = x0+dx; py = lerp(v1, v2, y0, y0+dy); }
                    if (edge === 2) { px = lerp(v3, v2, x0, x0+dx); py = y0+dy; }
                    if (edge === 3) { px = x0; py = lerp(v0, v3, y0, y0+dy); }
                    
                    const z = potentialFn(px, py) + 0.15; // Lift slightly above surface
                    return [px, z, -py];
                };

                const addLine = (e1: number, e2: number) => {
                    positions.push(...getPoint(e1));
                    positions.push(...getPoint(e2));
                };

                // Lookup table for Marching Squares lines
                switch (squareIndex) {
                    case 1: addLine(3, 0); break;
                    case 2: addLine(0, 1); break;
                    case 3: addLine(3, 1); break;
                    case 4: addLine(1, 2); break;
                    case 5: addLine(0, 1); addLine(2, 3); break; // Ambiguous saddle
                    case 6: addLine(0, 2); break;
                    case 7: addLine(3, 2); break;
                    case 8: addLine(2, 3); break;
                    case 9: addLine(0, 2); break;
                    case 10: addLine(0, 3); addLine(1, 2); break; // Ambiguous saddle
                    case 11: addLine(1, 2); break;
                    case 12: addLine(3, 1); break;
                    case 13: addLine(0, 1); break;
                    case 14: addLine(3, 0); break;
                    // 0 and 15 have no lines
                }
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        return geo;

    }, [hasApPrime, functions, xRange, yRange, time, potentialFn]);

    if (!hasApPrime || !geometry) return null;

    return (
        <lineSegments ref={lineRef} geometry={geometry}>
            <lineBasicMaterial color="#ff0044" linewidth={3} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthTest={false} />
        </lineSegments>
    );
};