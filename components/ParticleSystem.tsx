import React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { G3DFunction, Range } from '../types';
import { Line } from '@react-three/drei';

const GAMMA = 0.5;
const ALPHA = 2.0;
const PARTICLE_SIZE = 0.08;
const TRAIL_LENGTH = 50;

const EXCEPTIONAL_POINTS = [
    { x: 3, y: 2, r: 2.5 },
    { x: -2, y: 4, r: 3.0 },
    { x: -4, y: -3, r: 2.0 },
    { x: 2, y: -4, r: 2.8 }
];

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
  surfaceData: {
    plotExpr: string;
    functions: { [key: string]: G3DFunction };
    animParam: string | null;
  };
  xRange: Range;
  yRange: Range;
  time: number;
  particlesStateRef: React.RefObject<ParticlesState>;
  showTrails: boolean;
}

const ParticleTrails: React.FC<{ trails: THREE.Vector3[][] }> = ({ trails }) => {
    return (
        <group>
            {trails.map((points, i) => (
                points.length > 1 && (
                    <Line
                        key={i}
                        points={points}
                        color="white"
                        lineWidth={2}
                        transparent
                        opacity={0.6}
                    />
                )
            ))}
        </group>
    );
};

export const ParticleSystem: React.FC<ParticleSystemProps> = ({ 
  count, surfaceData, xRange, yRange, time, particlesStateRef, showTrails 
}) => {
  const meshRef = React.useRef<THREE.InstancedMesh>(null);
  const particlesRef = React.useRef<Particle[]>([]);
  const phiRef = React.useRef<((x: number, y: number, t: number) => number) | null>(null);
  const [trails, setTrails] = React.useState<THREE.Vector3[][]>([]);
  const initializeRef = React.useRef(false); // Track if first update done

  // Initialize Phi (same as before)
  React.useEffect(() => {
    const { plotExpr, functions, animParam } = surfaceData;
    
    const mathScope: any = {
      sin: Math.sin, cos: Math.cos, tan: Math.tan,
      asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
      sqrt: Math.sqrt, log: Math.log, exp: Math.exp, pow: Math.pow, abs: Math.abs,
      pi: Math.PI, PI: Math.PI
    };

    const remainingFunctions = { ...functions };
    let changedInLastPass = true;
    const maxPasses = Object.keys(functions).length + 2;
    let passes = 0;

    while (Object.keys(remainingFunctions).length > 0 && changedInLastPass && passes < maxPasses) {
        changedInLastPass = false;
        passes++;
        for (const name in remainingFunctions) {
            const fn = remainingFunctions[name];
            try {
                const func = new Function(...fn.params, `with(this) { return ${fn.body}; }`);
                mathScope[name] = func.bind(mathScope);
                delete remainingFunctions[name];
                changedInLastPass = true;
            } catch (e) { }
        }
    }

    const plotFunction = new Function('scope', `with(scope) { return ${plotExpr}; }`);
    phiRef.current = (x: number, y: number, t: number) => {
        const localScope = Object.create(mathScope);
        localScope.x = x;
        localScope.y = y;
        if (animParam) localScope[animParam] = t;
        try {
            const z = plotFunction(localScope);
            return isNaN(z) || !isFinite(z) ? 0 : z;
        } catch (e) {
            return 0;
        }
    };
    
    initializeRef.current = false; // Reset on surface change
  }, [surfaceData]);

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
    if (!meshRef.current || !phiRef.current) return;
    
    const dt = Math.min(0.016, delta);
    const Phi = phiRef.current;
    const particles = particlesRef.current;
    
    // Initialize positions on first frame
    if (!initializeRef.current) {
      console.log('[ParticleSystem] Initializing particle positions...');
      
      const tempMatrix = new THREE.Matrix4();
      particles.forEach((p, i) => {
        const z = Phi(p.x, p.y, time);
        tempMatrix.makeScale(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
        tempMatrix.setPosition(p.x, z + 0.1, -p.y);
        meshRef.current!.setMatrixAt(i, tempMatrix);
      });
      
      meshRef.current.instanceMatrix.needsUpdate = true;
      initializeRef.current = true;
      console.log('[ParticleSystem] Positions initialized');
      return; // Skip physics on first frame
    }
    
    const timedPhi = (x: number, y: number) => Phi(x, y, time);
    
    const computeGradient = (x: number, y: number) => {
        const h = 0.01;
        const dFdx = (timedPhi(x + h, y) - timedPhi(x - h, y)) / (2 * h);
        const dFdy = (timedPhi(x, y + h) - timedPhi(x, y - h)) / (2 * h);
        return { dx: dFdx, dy: dFdy };
    };

    const colorAttrib = meshRef.current.geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute;
    const newTrails: THREE.Vector3[][] = [];
    const tempMatrix = new THREE.Matrix4();

    particles.forEach((p, i) => {
        // Verlet integration
        const grad1 = computeGradient(p.x, p.y);
        const ax1 = -GAMMA * p.vx - ALPHA * grad1.dx;
        const ay1 = -GAMMA * p.vy - ALPHA * grad1.dy;
        
        p.x += p.vx * dt + 0.5 * ax1 * dt * dt;
        p.y += p.vy * dt + 0.5 * ay1 * dt * dt;
        
        const grad2 = computeGradient(p.x, p.y);
        const ax2 = -GAMMA * p.vx - ALPHA * grad2.dx;
        const ay2 = -GAMMA * p.vy - ALPHA * grad2.dy;
        
        p.vx += 0.5 * (ax1 + ax2) * dt;
        p.vy += 0.5 * (ay1 + ay2) * dt;
        
        // Boundary conditions
        if (Math.abs(p.x) > xRange.max) { 
          p.x = Math.sign(p.x) * xRange.max; 
          p.vx *= -0.8; 
        }
        if (Math.abs(p.y) > yRange.max) { 
          p.y = Math.sign(p.y) * yRange.max; 
          p.vy *= -0.8; 
        }
        
        // Safety respawn
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
        
        // Position particle on surface
        const z = timedPhi(p.x, p.y);
        tempMatrix.makeScale(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
        tempMatrix.setPosition(p.x, z + 0.1, -p.y);
        meshRef.current!.setMatrixAt(i, tempMatrix);
        
        // Trail management
        if (showTrails) {
            const trailPoint = new THREE.Vector3(p.x, z + 0.1, -p.y);
            p.trail.push(trailPoint);
            if (p.trail.length > TRAIL_LENGTH) p.trail.shift();
            newTrails.push([...p.trail]);
        } else {
            p.trail = [];
        }
        
        // Color
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
            const z = timedPhi(p.x, p.y);
            return new THREE.Vector3(p.x, z + 0.1, -p.y);
        });
        particlesStateRef.current.trails = newTrails;
    }
  });

  // Geometry/Material same as before
  const sphereGeometry = React.useMemo(() => {
    const geo = new THREE.SphereGeometry(PARTICLE_SIZE, 12, 8);
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
      {showTrails && trails.length > 0 && <ParticleTrails trails={trails} />}
    </>
  );
};