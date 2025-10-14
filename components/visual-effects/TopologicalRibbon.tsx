import React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Tube } from '@react-three/drei';

interface TopologicalRibbonProps {
    potentialFn: (x: number, y: number) => number;
}

const RIBBON_RADIUS = 0.1; // Half of the 0.2 width from the prompt
const PATH_SEGMENTS = 256;
const TUBE_SEGMENTS = 32;

// We define the material once outside the component so it's not recreated on every render.
const ribbonMaterial = new THREE.MeshStandardMaterial({
    metalness: 0.2,
    roughness: 0.4,
});

// Use onBeforeCompile to inject custom GLSL shader code into the standard material.
ribbonMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.time = { value: 0 };

    // Pass necessary varyings from vertex to fragment shader
    shader.vertexShader =
        'varying vec3 v_worldPosition;\n' +
        'varying vec3 v_worldNormal;\n' +
        shader.vertexShader;
    
    shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `v_worldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
         v_worldNormal = normalize(mat3(modelMatrix) * normal);
         #include <project_vertex>`
    );

    // Main fragment shader logic for iridescence and flow
    shader.fragmentShader =
        'uniform float time;\n' +
        'varying vec3 v_worldPosition;\n' +
        'varying vec3 v_worldNormal;\n' +
        shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `
        // Iridescence (Fresnel effect)
        vec3 viewDirection = normalize(cameraPosition - v_worldPosition);
        float fresnel = 1.0 - abs(dot(viewDirection, v_worldNormal));
        fresnel = pow(fresnel, 2.5);

        vec3 color1 = vec3(1.0, 0.1, 0.5); // Magenta
        vec3 color2 = vec3(0.1, 0.5, 1.0); // Cyan
        vec3 iridescentColor = mix(color1, color2, fresnel);
        
        // Flowing animation
        float flowSpeed = -0.5;
        float bandDensity = 20.0;
        // Use world position for the texture to avoid UV mapping issues on the tube geometry
        float flowPattern = sin((v_worldPosition.x + v_worldPosition.y + v_worldPosition.z) * bandDensity - time * flowSpeed * 10.0);
        flowPattern = 0.5 + 0.5 * flowPattern; // Remap to 0-1
        
        vec3 finalColor = iridescentColor * mix(0.6, 1.2, flowPattern);

        vec4 diffuseColor = vec4(finalColor, opacity);
        `
    );

    // Store the shader on the material's userData so we can update uniforms from the component
    (ribbonMaterial as any).userData.shader = shader;
};

export const TopologicalRibbon: React.FC<TopologicalRibbonProps> = ({ potentialFn }) => {
    const materialRef = React.useRef(ribbonMaterial);

    const path = React.useMemo(() => {
        const points = [];
        for (let i = 0; i <= PATH_SEGMENTS; i++) {
            const t = (i / PATH_SEGMENTS) * Math.PI * 2;
            const x = 4 * Math.cos(t) + 0.5 * Math.cos(5 * t);
            const y = 4 * Math.sin(t) + 0.5 * Math.sin(5 * t);
            const z = potentialFn(x, y);
            points.push(new THREE.Vector3(x, z + 0.15, -y)); // Raise slightly above surface
        }
        return new THREE.CatmullRomCurve3(points, true); // `true` for closed loop
    }, [potentialFn]);

    useFrame(({ clock }) => {
        const shader = (materialRef.current as any).userData.shader;
        if (shader) {
            shader.uniforms.time.value = clock.getElapsedTime();
        }
    });

    return (
        <Tube args={[path, TUBE_SEGMENTS, RIBBON_RADIUS, 8, true]} material={materialRef.current} />
    );
};
