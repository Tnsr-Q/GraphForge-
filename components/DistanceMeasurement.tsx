import React from 'react';
import * as THREE from 'three';
import { Sphere, Line, Html } from '@react-three/drei';

export interface MeasurementData {
    points: THREE.Vector3[];
    path: THREE.Vector3[] | null;
    distance: number | null;
}

interface DistanceMeasurementProps {
    data: MeasurementData;
}

const pointMaterial = <meshStandardMaterial emissive="#00ffff" emissiveIntensity={2} toneMapped={false} />;
const lineMaterial = {
    color: "#00ffff",
    lineWidth: 3,
    transparent: true,
    opacity: 0.8,
    dashed: false,
};

export const DistanceMeasurement: React.FC<DistanceMeasurementProps> = ({ data }) => {
    const { points, path, distance } = data;

    // Calculate the position for the distance label (midpoint of the path)
    const labelPosition = React.useMemo(() => {
        if (!path || path.length === 0) return new THREE.Vector3();
        const midIndex = Math.floor(path.length / 2);
        return path[midIndex];
    }, [path]);

    return (
        <group>
            {/* Render markers for the selected points */}
            {points.map((point, index) => (
                <Sphere key={index} position={point} args={[0.15]}>
                    {pointMaterial}
                </Sphere>
            ))}

            {/* Render the geodesic path line */}
            {path && path.length > 1 && (
                <Line
                    points={path}
                    {...lineMaterial}
                />
            )}

            {/* Render the distance label */}
            {distance !== null && (
                 <Html position={labelPosition} center>
                    <div
                        style={{
                            background: 'rgba(0, 255, 255, 0.2)',
                            color: '#e0f7fa',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(0, 255, 255, 0.5)',
                            fontSize: '14px',
                            fontFamily: 'monospace',
                            whiteSpace: 'nowrap',
                            transform: 'translateY(-20px)', // Offset above the line
                        }}
                    >
                        {distance.toFixed(2)} units
                    </div>
                </Html>
            )}
        </group>
    );
};