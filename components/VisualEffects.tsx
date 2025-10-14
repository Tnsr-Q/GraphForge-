



// FIX: Change React import to default import to fix JSX namespace issues with react-three-fiber.
import React from 'react';
// FIX: Import THREE to resolve namespace errors.
import * as THREE from 'three';
import { Range } from '../types';
import { EffectsState } from './EffectsPanel';
import { EPGlows } from './visual-effects/EPGlows';
import { Streamlines } from './visual-effects/Streamlines';
import { FluxHeatmap } from './visual-effects/FluxHeatmap';

interface ParticlesState {
    positions: THREE.Vector3[];
    trails: THREE.Vector3[][];
}
interface VisualEffectsProps {
    effectsState: EffectsState;
    potentialFn: (x: number, y: number) => number;
    xRange: Range;
    yRange: Range;
    particlesStateRef: React.RefObject<ParticlesState>;
    particleCount: number;
}

const VisualEffects: React.FC<VisualEffectsProps> = ({
    effectsState,
    potentialFn,
    xRange,
    yRange,
    particlesStateRef,
    particleCount,
}) => {
    return (
        <group>
            {effectsState.epGlows && <EPGlows potentialFn={potentialFn} />}
            {effectsState.streamlines && <Streamlines potentialFn={potentialFn} xRange={xRange} yRange={yRange} />}
            {effectsState.fluxHeatmap && particleCount > 0 && <FluxHeatmap particlePositions={particlesStateRef.current.positions} xRange={xRange} yRange={yRange} particleCount={particleCount}/>}
        </group>
    );
};

export default VisualEffects;