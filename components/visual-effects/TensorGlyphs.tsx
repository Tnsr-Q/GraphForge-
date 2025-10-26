import React from 'react';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GraphIR, TensorPlot } from '../../types';
import { createConfiguredMathParser } from '../../services/math-parser';
import { eigs, isMatrix, column } from 'mathjs';

interface TensorGlyphsProps {
  plot: TensorPlot;
  graphData: GraphIR;
  potentialFn: (x: number, y: number) => number;
  time: number;
}

const GRID_SIZE = 20;
const GLYPH_SCALE_FACTOR = 0.25;

export const TensorGlyphs: React.FC<TensorGlyphsProps> = ({ plot, graphData, potentialFn, time }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    
    const glyphData = useMemo(() => {
        const mathParser = createConfiguredMathParser(graphData.functions);
        const tensorFn = graphData.functions[plot.fnName];
        if (!tensorFn) return null;
        if (graphData.animation) {
            mathParser.set(graphData.animation.parameter, time);
        }

        const matrices: THREE.Matrix4[] = [];
        const colors: THREE.Color[] = [];
        let maxEigenvalue = -Infinity;
        const eigenvalueMagnitudes: number[] = [];

        const { x: xRange, y: yRange } = graphData.ranges;

        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                const x = xRange.min + (i / (GRID_SIZE - 1)) * (xRange.max - xRange.min);
                const y = yRange.min + (j / (GRID_SIZE - 1)) * (yRange.max - yRange.min);
                
                mathParser.set('x', x);
                mathParser.set('y', y);
                
                try {
                    const tensorResult = mathParser.evaluate(tensorFn.body);
                    if (!isMatrix(tensorResult) || tensorResult.size().length !== 2 || tensorResult.size()[0] !== 2 || tensorResult.size()[1] !== 2) {
                        continue;
                    }

                    const { values, vectors } = eigs(tensorResult);
                    const eigenvalues = values as number[];
                    
                    const v1 = new THREE.Vector3(...(column(vectors, 0) as any).toArray().flat(), 0).normalize();
                    const v2 = new THREE.Vector3(...(column(vectors, 1) as any).toArray().flat(), 0).normalize();
                    const v3 = new THREE.Vector3().crossVectors(v1, v2);

                    const rotationMatrix = new THREE.Matrix4().makeBasis(v1, v2, v3);
                    const scaleMatrix = new THREE.Matrix4().makeScale(
                        Math.abs(eigenvalues[0]) * GLYPH_SCALE_FACTOR,
                        Math.abs(eigenvalues[1]) * GLYPH_SCALE_FACTOR,
                        0.1 * GLYPH_SCALE_FACTOR
                    );

                    const transformMatrix = new THREE.Matrix4().multiplyMatrices(rotationMatrix, scaleMatrix);
                    const z = potentialFn(x, y);
                    transformMatrix.setPosition(x, z + 0.1, -y);

                    matrices.push(transformMatrix);
                    const currentMaxEigen = Math.max(Math.abs(eigenvalues[0]), Math.abs(eigenvalues[1]));
                    eigenvalueMagnitudes.push(currentMaxEigen);
                    if(currentMaxEigen > maxEigenvalue) maxEigenvalue = currentMaxEigen;

                } catch (e) {
                    // Ignore errors for individual points
                }
            }
        }
        
        // Normalize colors
        eigenvalueMagnitudes.forEach(mag => {
            const normalized = maxEigenvalue > 0 ? mag / maxEigenvalue : 0;
            colors.push(new THREE.Color().setHSL(0.6 - normalized * 0.6, 1.0, 0.5));
        });


        return { matrices, colors };
    }, [plot, graphData, potentialFn, time]);

    useLayoutEffect(() => {
        if (!meshRef.current || !glyphData) return;

        const { matrices, colors } = glyphData;
        const colorAttrib = meshRef.current.geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute;

        for (let i = 0; i < matrices.length; i++) {
            meshRef.current.setMatrixAt(i, matrices[i]);
            if (colors[i]) {
                colorAttrib.setXYZ(i, colors[i].r, colors[i].g, colors[i].b);
            }
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        colorAttrib.needsUpdate = true;
        meshRef.current.count = matrices.length;

    }, [glyphData]);

    const sphereGeometry = useMemo(() => {
        const geo = new THREE.SphereGeometry(1, 10, 6); // Base size is 1, will be scaled
        geo.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(new Float32Array(GRID_SIZE * GRID_SIZE * 3), 3));
        return geo;
    }, []);

    const glyphMaterial = useMemo(() => {
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.6 });
        mat.onBeforeCompile = (shader) => {
            shader.vertexShader = 'attribute vec3 instanceColor;\nvarying vec3 vInstanceColor;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceColor = instanceColor;\n');
            shader.fragmentShader = 'varying vec3 vInstanceColor;\n' + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( vInstanceColor, opacity );');
        };
        return mat;
    }, []);
    
    return (
        <instancedMesh ref={meshRef} args={[sphereGeometry, glyphMaterial, GRID_SIZE * GRID_SIZE]} frustumCulled={false} />
    );
};