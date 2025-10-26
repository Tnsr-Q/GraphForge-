import React from 'react';
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

// A component to render a single vector field
export const VectorField: React.FC<VectorFieldProps> = ({ plot, graphData, potentialFn, time }) => {
    const arrows = React.useMemo(() => {
        const mathParser = createConfiguredMathParser(graphData.functions);
        const fn = graphData.functions[plot.fnName];
        if (!fn) return [];

        // Simple parse of the vector body: "[exprX, exprY, exprZ]"
        const componentExprs = fn.body.slice(1, -1).split(',');
        if (componentExprs.length !== 3) {
            console.error(`Vector function ${plot.fnName} does not have 3 components.`);
            return [];
        }

        const [exprX, exprY, exprZ] = componentExprs.map(e => e.trim());
        const { x: xRange, y: yRange } = graphData.ranges;
        const arrowData = [];
        const gridSize = 15;

        if (graphData.animation) {
            mathParser.set(graphData.animation.parameter, time);
        }

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const x = xRange.min + (i / (gridSize - 1)) * (xRange.max - xRange.min);
                const y = yRange.min + (j / (gridSize - 1)) * (yRange.max - yRange.min);

                try {
                    mathParser.set('x', x);
                    mathParser.set('y', y);

                    const vx = mathParser.evaluate(exprX);
                    const vy = mathParser.evaluate(exprY);
                    const vz = mathParser.evaluate(exprZ);

                    if ([vx, vy, vz].some(v => isNaN(v) || !isFinite(v))) continue;
                    
                    const origin = new THREE.Vector3(x, potentialFn(x, y) + 0.1, -y);
                    const vec = new THREE.Vector3(vx, vz, -vy); // Remap components to 3D space
                    const magnitude = vec.length();
                    
                    if (magnitude < 1e-6) continue;

                    const direction = vec.normalize();
                    
                    arrowData.push({
                        id: `${i}-${j}`,
                        origin,
                        direction,
                        magnitude,
                    });

                } catch (e) {
                    // Ignore evaluation errors for individual points, allowing for partial fields
                }
            }
        }
        return arrowData;
    }, [plot.fnName, graphData, potentialFn, time]);

    return (
        <group>
            {arrows.map(arrow => (
                <Arrow
                    key={arrow.id}
                    origin={arrow.origin}
                    direction={arrow.direction}
                    length={Math.min(1.5, arrow.magnitude * 0.8)}
                    color="#00ffff"
                />
            ))}
        </group>
    );
};
