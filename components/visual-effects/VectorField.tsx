import * as React from 'react';
import { Arrow } from '../helpers/Arrow';
import * as THREE from 'three';
import { GraphIR, VectorPlot } from '../../types';
import { createConfiguredMathParser } from '../../services/math-parser';

interface VectorFieldProps {
    plot: VectorPlot;
    graphData: GraphIR;
    potentialFn: (x: number, y: number) => number;
    time: number;
}

// Helper function to properly parse vector components
function parseVectorComponents(vectorBody: string): string[] {
    const trimmed = vectorBody.trim();
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
        return [];
    }
    
    const content = trimmed.slice(1, -1).trim();
    const components: string[] = [];
    let currentComponent = '';
    let bracketDepth = 0;
    let parenDepth = 0;
    
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        
        if (char === '[') bracketDepth++;
        if (char === ']') bracketDepth--;
        if (char === '(') parenDepth++;
        if (char === ')') parenDepth--;
        
        if (char === ',' && bracketDepth === 0 && parenDepth === 0) {
            // This comma separates components
            components.push(currentComponent.trim());
            currentComponent = '';
        } else {
            currentComponent += char;
        }
    }
    
    // Add the last component
    if (currentComponent.trim()) {
        components.push(currentComponent.trim());
    }
    
    return components;
}

// Helper to get color based on tensor type and magnitude
function getTensorColor(tensorType: string, magnitude: number, maxMagnitude: number): string {
    const normalizedMagnitude = maxMagnitude > 0 ? magnitude / maxMagnitude : 0;
    
    switch (tensorType) {
        case 'electric_field':
            // Blue to red for electric fields
            return new THREE.Color().setHSL(0.6 - (normalizedMagnitude * 0.6), 1.0, 0.5).getStyle();
        
        case 'magnetic_field':
            // Cyan to green for magnetic fields
             return new THREE.Color().setHSL(0.5, 1.0, 0.5 - (normalizedMagnitude * 0.2)).getStyle();
        
        case 'velocity_field':
            // Green to yellow for velocity fields
            return new THREE.Color().setHSL(0.3 - (normalizedMagnitude * 0.15), 1.0, 0.5).getStyle();
        
        case 'stress_tensor':
            // Orange to red for stress
            return new THREE.Color().setHSL(0.1 - (normalizedMagnitude * 0.1), 1.0, 0.5).getStyle();
        
        default:
            // Default cyan for general vector fields
            return "#00ffff";
    }
}

// A component to render a single vector field with tensor physics support
export const VectorField: React.FC<VectorFieldProps> = ({ plot, graphData, potentialFn, time }) => {
    const arrows = React.useMemo(() => {
        const mathParser = createConfiguredMathParser(graphData.functions);
        const fn = graphData.functions[plot.fnName];
        if (!fn) return [];

        // Determine tensor type from plot metadata or function name
        const tensorType = plot.tensorType || 'general_vector';
        
        // Use the improved parser to handle commas inside function parameters
        const componentExprs = parseVectorComponents(fn.body);
        if (componentExprs.length !== 3) {
            console.error(`Vector function ${plot.fnName} does not have 3 components. Got:`, componentExprs);
            return [];
        }

        const [exprX, exprY, exprZ] = componentExprs;
        const { x: xRange, y: yRange } = graphData.ranges;
        const arrowData = [];
        const gridSize = plot.gridSize || 15;
        
        // For tensor physics, we might need additional parameters
        const physicsParams = plot.physicsParams || {};
        const mass = physicsParams.mass || 1.0;
        const charge = physicsParams.charge || 1.0;
        const current = physicsParams.current || 1.0;

        if (graphData.animation) {
            mathParser.set(graphData.animation.parameter, time);
        }

        // First pass to compute magnitudes for normalization
        const magnitudes: number[] = [];
        const rawVectors: {x: number, y: number, vx: number, vy: number, vz: number}[] = [];
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const x = xRange.min + (i / (gridSize - 1)) * (xRange.max - xRange.min);
                const y = yRange.min + (j / (gridSize - 1)) * (yRange.max - yRange.min);

                try {
                    mathParser.set('x', x);
                    mathParser.set('y', y);
                    mathParser.set('z', 0);
                    
                    // Map function parameters to coordinates if custom names are used (e.g. dt_ps -> x)
                    if (fn.params) {
                        if (fn.params[0]) mathParser.set(fn.params[0], x);
                        if (fn.params[1]) mathParser.set(fn.params[1], y);
                        if (fn.params[2]) mathParser.set(fn.params[2], 0);
                    }

                    mathParser.set('M', mass);
                    mathParser.set('q', charge);
                    mathParser.set('I', current);
                    mathParser.set('t', time);

                    const vx = mathParser.evaluate(exprX);
                    const vy = mathParser.evaluate(exprY);
                    const vz = mathParser.evaluate(exprZ);

                    if ([vx, vy, vz].some(v => isNaN(v) || !isFinite(v))) continue;
                    
                    const magnitude = Math.sqrt(vx*vx + vy*vy + vz*vz);
                    magnitudes.push(magnitude);
                    rawVectors.push({x, y, vx, vy, vz});

                } catch (e) {
                    // Ignore evaluation errors for this point
                }
            }
        }

        // Compute max magnitude for normalization
        const maxMagnitude = magnitudes.length > 0 ? Math.max(...magnitudes) : 1;

        // Second pass to create arrows with proper coloring
        rawVectors.forEach((vecData, index) => {
            const { x, y, vx, vy, vz } = vecData;
            const magnitude = magnitudes[index];
            const i = Math.floor(index / gridSize);
            const j = index % gridSize;

            if (magnitude < 1e-6) return;

            const origin = new THREE.Vector3(x, potentialFn(x, y) + 0.1, -y);
            const vec = new THREE.Vector3(vx, vz, -vy);
            const direction = vec.normalize();
            const color = getTensorColor(tensorType, magnitude, maxMagnitude);
            
            arrowData.push({
                id: `${i}-${j}`,
                origin,
                direction,
                magnitude,
                color,
                tensorType
            });
        });

        return arrowData;
    }, [plot, graphData, potentialFn, time]);

    return (
        <group>
            {arrows.map(arrow => (
                <Arrow
                    key={arrow.id}
                    origin={arrow.origin}
                    direction={arrow.direction}
                    length={Math.min(1.5, arrow.magnitude * 0.8)}
                    color={arrow.color || "#00ffff"}
                />
            ))}
        </group>
    );
};

// Additional helper component for tensor field visualization
export const TensorField: React.FC<VectorFieldProps & { tensorType: string }> = ({ 
    plot, graphData, potentialFn, time, tensorType 
}) => {
    return (
        <VectorField 
            plot={{ ...plot, tensorType }}
            graphData={graphData}
            potentialFn={potentialFn}
            time={time}
        />
    );
};