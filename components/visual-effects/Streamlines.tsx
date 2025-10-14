


// FIX: Change React import to default import to fix JSX namespace issues with react-three-fiber.
import React from 'react';
import * as THREE from 'three';
import { Tube } from '@react-three/drei';
import { Range } from '../../types';

interface StreamlinesProps {
    potentialFn: (x: number, y: number) => number;
    xRange: Range;
    yRange: Range;
}

const computeGradient = (x: number, y: number, Phi: (x: number, y: number) => number) => {
    const h = 0.01;
    const dFdx = (Phi(x + h, y) - Phi(x - h, y)) / (2 * h);
    const dFdy = (Phi(x, y + h) - Phi(x, y - h)) / (2 * h);
    return { dx: dFdx, dy: dFdy };
};

const generateStreamline = (startX: number, startY: number, Phi: (x: number, y: number) => number, xRange: Range, yRange: Range) => {
    const points = [];
    let x = startX, y = startY;
    const dt = 0.05;

    for (let i = 0; i < 500; i++) {
        const z = Phi(x, y);
        points.push(new THREE.Vector3(x, z, -y));

        const k1 = computeGradient(x, y, Phi);
        const k2 = computeGradient(x + 0.5 * dt * k1.dx, y + 0.5 * dt * k1.dy, Phi);
        const k3 = computeGradient(x + 0.5 * dt * k2.dx, y + 0.5 * dt * k2.dy, Phi);
        const k4 = computeGradient(x + dt * k3.dx, y + dt * k3.dy, Phi);
        
        const dx = (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx) / 6;
        const dy = (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy) / 6;
        
        x -= dt * dx;
        y -= dt * dy;
        
        if (x < xRange.min || x > xRange.max || y < yRange.min || y > yRange.max || (dx * dx + dy * dy) < 1e-6) break;
    }
    return points;
};

const Streamline: React.FC<{ points: THREE.Vector3[] }> = ({ points }) => {
    if (points.length < 2) return null;

    const curve = React.useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
    const avgGradMag = React.useMemo(() => {
        let sum = 0;
        for (let i = 0; i < points.length - 1; i++) {
            sum += points[i].distanceTo(points[i + 1]);
        }
        return sum / points.length;
    }, [points]);
    
    return (
        <Tube args={[curve, 128, 0.02 + avgGradMag * 0.05, 8, false]}>
            <meshStandardMaterial color="#88ffff" transparent opacity={0.6} side={THREE.DoubleSide} />
        </Tube>
    );
};

export const Streamlines: React.FC<StreamlinesProps> = ({ potentialFn, xRange, yRange }) => {
    const streamlines = React.useMemo(() => {
        const lines = [];
        const count = 30;
        for (let i = 0; i < count; i++) {
            const startX = xRange.min + Math.random() * (xRange.max - xRange.min);
            const startY = yRange.min + Math.random() * (yRange.max - yRange.min);
            const points = generateStreamline(startX, startY, potentialFn, xRange, yRange);
            if (points.length > 10) { // Only draw non-trivial lines
                lines.push(points);
            }
        }
        return lines;
    }, [potentialFn, xRange, yRange]);

    return (
        <group>
            {streamlines.map((points, i) => (
                <Streamline key={i} points={points} />
            ))}
        </group>
    );
};