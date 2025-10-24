import React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Range } from '../types';
import { EXCEPTIONAL_POINTS } from '../constants';

interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    trail: THREE.Vector3[];
}

interface ParticlesState {
    positions: THREE.Vector3[];
    trails: THREE.Vector3[][];
}

interface ParticleSystemProps {
  count: number;
  potentialFn: (x: number, y: number) => number;
  xRange: Range;
  yRange: Range;
  particlesStateRef: React.RefObject<ParticlesState>;
  showTrails: boolean;
  damping: number;
  forceCoupling: number;
  particleSize: number;
  trailLength: number;
}

const ParticleTrails: React.FC<{ trails: THREE.Vector3[][]; count: number; trailLength: number }> = ({ trails, count, trailLength }) => {
    const lineRef = React.useRef<THREE.LineSegments>(null!);
    
    const [positions, colors] = React.useMemo(() => {
        const maxSegments = count * (trailLength - 1);
        return [
            new Float32Array(maxSegments * 2 * 3), // Each segment has 2 vertices, each vertex has 3 coordinates
            new Float32Array(maxSegments * 2 * 3)  // Each vertex has an RGB color
        ];
    }, [count, trailLength]);

    React.useLayoutEffect(() => {
        if (!lineRef.current) return;
        const geometry = lineRef.current.geometry;
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        let vertexIndex = 0;
        let colorIndex = 0;
        
        for (const trail of trails) {
            for (let i = 0; i < trail.length - 1; i++) {
                const p1 = trail[i];
                const p2 = trail[i+1];

                positions[vertexIndex++] = p1.x;
                positions[vertexIndex++] = p1.y;
                positions[vertexIndex++] = p1.z;
                positions[vertexIndex++] = p2.x;
                positions[vertexIndex++] = p2.y;
                positions[vertexIndex++] = p2.z;

                // Fade out effect: newer segments are brighter
                const alpha = (i / trailLength);
                colors[colorIndex++] = 1.0 * alpha;
                colors[colorIndex++] = 1.0 * alpha;
                colors[colorIndex++] = 1.0 * alpha;
                colors[colorIndex++] = 1.0 * alpha;
                colors[colorIndex++] = 1.0 * alpha;
                colors[colorIndex++] = 1.0 * alpha;
            }
        }
        
        // Hide unused buffer capacity
        geometry.setDrawRange(0, vertexIndex / 3);
        
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
        geometry.computeBoundingSphere();

    }, [trails, positions, colors, trailLength]);

    return (
        <lineSegments ref={lineRef}>
            <bufferGeometry />
            <lineBasicMaterial vertexColors transparent opacity={0.7} />
        </lineSegments>
    );
};

export const ParticleSystem: React.FC<ParticleSystemProps> = ({ 
  count, potentialFn, xRange, yRange, particlesStateRef, showTrails, 
  damping, forceCoupling, particleSize, trailLength
}) => {
  const meshRef = React.useRef<THREE.InstancedMesh>(null);
  const particlesRef = React.useRef<Particle[]>([]);
  const [trails, setTrails] = React.useState<THREE.Vector3[][]>([]);
  const initializeRef = React.useRef(false); // Track if first update done

  // Initialize particles
  React.useEffect(() => {
    const spawnParticle = (id: number): Particle => {
        const ep = EXCEPTIONAL_POINTS[id % EXCEPTIONAL_POINTS.length];
        const radius = 1.0 + Math.random() * 1.5;
        const angle = Math.random() * 2 * Math.PI;
        const tangentialSpeed = 0.5;
        return {
            id,
            x: ep.x + radius * Math.cos(angle),
            y: ep.y + radius * Math.sin(angle),
            vx: -tangentialSpeed * Math.sin(angle),
            vy: tangentialSpeed * Math.cos(angle),
            trail: []
        };
    };

    particlesRef.current = Array.from({ length: count }, (_, i) => spawnParticle(i));
    initializeRef.current = false; // Force initialization on next frame
  }, [count]);

  // Physics + rendering
  useFrame((_, delta) => {
    if (!meshRef.current || !potentialFn) return;
    
    const dt = Math.min(0.016, delta);
    const particles = particlesRef.current;
    
    // Initialize positions on first frame
    if (!initializeRef.current) {
      const tempMatrix = new THREE.Matrix4();
      particles.forEach((p, i) => {
        const z = potentialFn(p.x, p.y);
        tempMatrix.makeScale(particleSize, particleSize, particleSize);
        tempMatrix.setPosition(p.x, z + 0.1, -p.y);
        meshRef.current!.setMatrixAt(i, tempMatrix);
      });
      
      meshRef.current.instanceMatrix.needsUpdate = true;
      initializeRef.current = true;
      return; // Skip physics on first frame
    }
    
    const computeGradient = (x: number, y: number) => {
        const h = 0.01;
        const dFdx = (potentialFn(x + h, y) - potentialFn(x - h, y)) / (2 * h);
        const dFdy = (potentialFn(x, y + h) - potentialFn(x, y - h)) / (2 * h);
        return { dx: dFdx, dy: dFdy };
    };

    const colorAttrib = meshRef.current.geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute;
    const newTrails: THREE.Vector3[][] = [];
    const tempMatrix = new THREE.Matrix4();

    particles.forEach((p, i) => {
        // Improved Velocity Verlet for velocity-dependent forces (like damping)
        const grad1 = computeGradient(p.x, p.y);
        const ax1 = -damping * p.vx - forceCoupling * grad1.dx;
        const ay1 = -damping * p.vy - forceCoupling * grad1.dy;
        const new_x = p.x + p.vx * dt + 0.5 * ax1 * dt * dt;
        const new_y = p.y + p.vy * dt + 0.5 * ay1 * dt * dt;
        const pred_vx = p.vx + ax1 * dt;
        const pred_vy = p.vy + ay1 * dt;
        const grad2 = computeGradient(new_x, new_y);
        const ax2 = -damping * pred_vx - forceCoupling * grad2.dx;
        const ay2 = -damping * pred_vy - forceCoupling * grad2.dy;
        p.vx += 0.5 * (ax1 + ax2) * dt;
        p.vy += 0.5 * (ay1 + ay2) * dt;
        p.x = new_x;
        p.y = new_y;
        
        // Boundary conditions (inelastic bounce)
        if (Math.abs(p.x) > xRange.max) { 
          p.x = Math.sign(p.x) * xRange.max; 
          p.vx *= -0.8; 
        }
        if (Math.abs(p.y) > yRange.max) { 
          p.y = Math.sign(p.y) * yRange.max; 
          p.vy *= -0.8; 
        }
        
        // Safety respawn for numerical instability
        if (!isFinite(p.x) || !isFinite(p.y)) {
            const ep = EXCEPTIONAL_POINTS[p.id % EXCEPTIONAL_POINTS.length];
            const radius = 1.0 + Math.random() * 1.5;
            const angle = Math.random() * 2 * Math.PI;
            p.x = ep.x + radius * Math.cos(angle);
            p.y = ep.y + radius * Math.sin(angle);
            p.vx = -0.5 * Math.sin(angle);
            p.vy = 0.5 * Math.cos(angle);
            p.trail = [];
        }
        
        const z = potentialFn(p.x, p.y);
        tempMatrix.makeScale(particleSize, particleSize, particleSize);
        tempMatrix.setPosition(p.x, z + 0.1, -p.y);
        meshRef.current!.setMatrixAt(i, tempMatrix);
        
        // Trail management
        if (showTrails) {
            const trailPoint = new THREE.Vector3(p.x, z + 0.1, -p.y);
            p.trail.push(trailPoint);
            if (p.trail.length > trailLength) p.trail.shift();
            newTrails.push([...p.trail]);
        } else {
            p.trail = [];
        }
        
        // Color based on speed and proximity to exceptional points
        const speed = Math.sqrt(p.vx ** 2 + p.vy ** 2);
        const colorFactor = Math.min(1, speed / 4.0);
        
        let inAccretionDisk = false;
        for (const ep of EXCEPTIONAL_POINTS) {
            const dist = Math.sqrt((p.x - ep.x)**2 + (p.y - ep.y)**2);
            if (dist < 1.0) {
                inAccretionDisk = true;
                const accretionFactor = 1.0 - dist / 1.0;
                const color = new THREE.Color().setHSL(0.1, 1.0, 0.5 + accretionFactor * 0.4);
                colorAttrib.setXYZ(i, color.r, color.g, color.b);
                break;
            }
        }
        
        if (!inAccretionDisk) {
            const color = new THREE.Color().setHSL(0.6 - colorFactor * 0.6, 1.0, 0.5 + colorFactor * 0.2);
            colorAttrib.setXYZ(i, color.r, color.g, color.b);
        }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    colorAttrib.needsUpdate = true;
    
    if (showTrails) setTrails(newTrails);
    else if (trails.length > 0) setTrails([]);
    
    if (particlesStateRef.current) {
        particlesStateRef.current.positions = particles.map(p => {
            const z = potentialFn(p.x, p.y);
            return new THREE.Vector3(p.x, z + 0.1, -p.y);
        });
        particlesStateRef.current.trails = newTrails;
    }
  });

  const sphereGeometry = React.useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 12, 8); // Base size is 1, will be scaled by matrix
    geo.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
    return geo;
  }, [count]);

  const particleMaterial = React.useMemo(() => {
      const mat = new THREE.MeshStandardMaterial({ 
        vertexColors: true, 
        emissive: new THREE.Color(0xffffff), 
        emissiveIntensity: 0.5, 
        toneMapped: false 
      });
      
      mat.onBeforeCompile = (shader) => {
          shader.vertexShader = 'attribute vec3 instanceColor;\nvarying vec3 vInstanceColor;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>', 
            '#include <begin_vertex>\nvInstanceColor = instanceColor;\n'
          );
          shader.fragmentShader = 'varying vec3 vInstanceColor;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            'vec4 diffuseColor = vec4( diffuse, opacity );', 
            'vec4 diffuseColor = vec4( vInstanceColor, opacity );'
          );
      };
      
      return mat;
  }, []);

  return (
    <>
      <instancedMesh 
        ref={meshRef} 
        args={[sphereGeometry, particleMaterial, count]}
        frustumCulled={false}
      />
      {showTrails && trails.length > 0 && <ParticleTrails trails={trails} count={count} trailLength={trailLength} />}
    </>
  );
};