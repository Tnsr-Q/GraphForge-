// FIX: Change React import to default import to fix JSX namespace issues with react-three-fiber.
import React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Billboard, Plane } from '@react-three/drei';
import { EXCEPTIONAL_POINTS } from '../../constants';

const Glow: React.FC<{ position: [number, number, number]; residue: number; intensityFactor: number; frequency: number }> = ({ position, residue, intensityFactor, frequency }) => {
    const lightRef = React.useRef<THREE.PointLight>(null!);
    const spriteRef = React.useRef<THREE.Mesh>(null!);
    
    const glowTexture = React.useMemo(() => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = 128;
        canvas.height = 128;
        const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 220, 150, 1.0)');
        gradient.addColorStop(0.3, 'rgba(255, 180, 80, 0.6)');
        gradient.addColorStop(1, 'rgba(200, 100, 0, 0.0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(canvas);
    }, []);

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        const pulse = (Math.sin(t * frequency * Math.PI * 2) + 1) / 2; // 0 to 1
        const finalResidue = residue * intensityFactor;
        const intensity = finalResidue * (0.5 + pulse * 1.5);
        lightRef.current.intensity = intensity;
        const scale = finalResidue * (0.8 + pulse * 0.4);
        spriteRef.current.scale.set(scale, scale, scale);
    });

    return (
        <group position={position}>
            <pointLight ref={lightRef} color="#ffaa44" distance={10} />
            <Billboard>
                <Plane ref={spriteRef} args={[1, 1]}>
                    <meshBasicMaterial map={glowTexture} blending={THREE.AdditiveBlending} transparent depthWrite={false} />
                </Plane>
            </Billboard>
        </group>
    );
};

export const EPGlows: React.FC<{ 
    potentialFn: (x: number, y: number) => number;
    residues: { [key: string]: number };
    intensityFactor: number;
}> = ({ potentialFn, residues, intensityFactor }) => {
    const frequencies = React.useMemo(() => EXCEPTIONAL_POINTS.map(() => 0.5 + Math.random() * 1.5), []);
    
    return (
        <group>
            {EXCEPTIONAL_POINTS.map((ep, i) => {
                const z = potentialFn(ep.x, ep.y);
                const residue = residues[ep.key as keyof typeof residues] ?? ep.defaultResidue;
                return <Glow key={i} position={[ep.x, z, -ep.y]} residue={residue} intensityFactor={intensityFactor} frequency={frequencies[i]} />;
            })}
        </group>
    );
};