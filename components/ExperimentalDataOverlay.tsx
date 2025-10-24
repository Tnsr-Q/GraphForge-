import React from 'react';
import * as THREE from 'three';
import { Sphere, Line, Html, Ring } from '@react-three/drei';
import { ExperimentalPoint, ValidationResults } from '../types';
import { EXCEPTIONAL_POINTS } from '../constants';

interface ExperimentalDataOverlayProps {
    experimentalData: ExperimentalPoint[];
    validationResults: ValidationResults;
    potentialFn: (x: number, y: number) => number;
}

const sphereMaterial = <meshStandardMaterial color="#ff4444" emissive="#ff4444" emissiveIntensity={0.6} toneMapped={false} />;
const ringMaterial = <meshBasicMaterial color="#ff8888" side={THREE.DoubleSide} />;
const lineMaterial = {
    color: "#ffffff",
    lineWidth: 2,
    transparent: true,
    opacity: 0.5,
};

export const ExperimentalDataOverlay: React.FC<ExperimentalDataOverlayProps> = ({ experimentalData, validationResults, potentialFn }) => {

    const theoreticalEPs = React.useMemo(() => {
        return EXCEPTIONAL_POINTS.map(tep => {
            const z = potentialFn(tep.x, tep.y);
            return { ...tep, position: new THREE.Vector3(tep.x, z + 0.02, -tep.y) };
        });
    }, [potentialFn]);

    const measuredEPs = React.useMemo(() => {
        return experimentalData.map(mep => {
            const z = potentialFn(mep.x, mep.y);
            return { ...mep, position: new THREE.Vector3(mep.x, z + 0.02, -mep.y) };
        });
    }, [experimentalData, potentialFn]);

    return (
        <group>
            {measuredEPs.map(mep => {
                const tep = theoreticalEPs.find(t => t.id === mep.id);
                if (!tep) return null;

                const deviation = validationResults.deviations.find(d => d.ep === mep.id)?.deviation;
                const midpoint = new THREE.Vector3().lerpVectors(tep.position, mep.position, 0.5);

                return (
                    <group key={mep.id}>
                        {/* Measured EP Sphere */}
                        <Sphere position={mep.position} args={[0.1]}>
                           {sphereMaterial}
                        </Sphere>
                        
                        {/* Uncertainty Ring */}
                        <Ring args={[mep.uncertainty - 0.01, mep.uncertainty, 32]} position={mep.position} rotation-x={-Math.PI / 2}>
                            {ringMaterial}
                        </Ring>

                        {/* Connection Line */}
                        <Line points={[tep.position, mep.position]} {...lineMaterial} />

                        {/* Deviation Label */}
                        {deviation !== undefined && (
                             <Html position={midpoint} center>
                                <div style={{
                                    background: 'rgba(50, 50, 50, 0.7)',
                                    color: '#e0e0e0',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontFamily: 'monospace',
                                    whiteSpace: 'nowrap',
                                    transform: 'translateY(-10px)',
                                }}>
                                    Δ = {deviation.toFixed(3)}
                                </div>
                            </Html>
                        )}
                    </group>
                )
            })}
        </group>
    );
};
