// FIX: Change React import to default import to fix JSX namespace issues with react-three-fiber.
import React from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { Range } from '../../types';
import { getColorFromMap } from '../../services/color-maps';

interface StreamlinesProps {
    potentialFn: (x: number, y: number) => number;
    xRange: Range;
    yRange: Range;
}

const computeGradient = (x: number, y: number, Phi: (x: number, y: number) => number) => {
    const h = 0.01;
    const dFdx = (Phi(x + h, y) - Phi(x - h, y)) / (2 * h);
    const dFdy = (Phi(x, y + h) - Phi(x, y - h)) / (2 * h);
    const mag = Math.sqrt(dFdx * dFdx + dFdy * dFdy);
    return { dx: dFdx, dy: dFdy, mag };
};

const generateStreamline = (startX: number, startY: number, Phi: (x: number, y: number) => number, xRange: Range, yRange: Range) => {
    const points: THREE.Vector3[] = [];
    const magnitudes: number[] = [];
    let x = startX, y = startY;
    const dt = 0.05;

    for (let i = 0; i < 500; i++) {
        const z = Phi(x, y);
        points.push(new THREE.Vector3(x, z + 0.05, -y));

        const k1 = computeGradient(x, y, Phi);
        magnitudes.push(k1.mag);
        const k2 = computeGradient(x + 0.5 * dt * k1.dx, y + 0.5 * dt * k1.dy, Phi);
        const k3 = computeGradient(x + 0.5 * dt * k2.dx, y + 0.5 * dt * k2.dy, Phi);
        const k4 = computeGradient(x + dt * k3.dx, y + dt * k3.dy, Phi);
        
        const dx = (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx) / 6;
        const dy = (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy) / 6;
        
        x -= dt * dx;
        y -= dt * dy;
        
        if (x < xRange.min || x > xRange.max || y < yRange.min || y > yRange.max || (dx * dx + dy * dy) < 1e-6) break;
    }
    return { points, magnitudes };
};

const Streamline: React.FC<{ points: THREE.Vector3[]; magnitudes: number[] }> = ({ points, magnitudes }) => {
    if (points.length < 2) return null;

    const colors = React.useMemo(() => {
        const maxMag = Math.max(...magnitudes, 5); // Avoid division by zero and cap
        return magnitudes.map(mag => {
            const normalized = Math.min(mag / maxMag, 1.0);
            const [r, g, b] = getColorFromMap(normalized, 'plasma');
            return new THREE.Color(r, g, b);
        });
    }, [magnitudes]);
    
    const avgMag = React.useMemo(() => {
        if (magnitudes.length === 0) return 0;
        return magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    }, [magnitudes]);

    return (
        <Line 
            points={points} 
            vertexColors={colors} 
            lineWidth={1 + avgMag * 0.5} 
            transparent 
            opacity={0.6}
        />
    );
};

export const Streamlines: React.FC<StreamlinesProps> = ({ potentialFn, xRange, yRange }) => {
    const streamlines = React.useMemo(() => {
        const lines = [];
        const count = 30;
        for (let i = 0; i < count; i++) {
            const startX = xRange.min + Math.random() * (xRange.max - xRange.min);
            const startY = yRange.min + Math.random() * (yRange.max - yRange.min);
            const { points, magnitudes } = generateStreamline(startX, startY, potentialFn, xRange, yRange);
            if (points.length > 20) { 
                lines.push({ id: i, points, magnitudes });
            }
        }
        return lines;
    }, [potentialFn, xRange, yRange]);

    return (
        <group>
            {streamlines.map(line => (
                <Streamline key={line.id} points={line.points} magnitudes={line.magnitudes} />
            ))}
        </group>
    );
};