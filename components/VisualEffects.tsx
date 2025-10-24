// FIX: Change React import to default import to fix JSX namespace issues with react-three-fiber.
import React from 'react';
// FIX: Import THREE to resolve namespace errors.
import * as THREE from 'three';
import { Range } from '../types';
import { EffectsState } from './ViewportPanel';
import { EPGlows } from './visual-effects/EPGlows';
import { Streamlines } from './visual-effects/Streamlines';
import { FluxHeatmap } from './visual-effects/FluxHeatmap';
import { TopologicalRibbon } from './visual-effects/TopologicalRibbon';
import { ControlsState } from './ControlsPanel';

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
    controls: ControlsState;
}

const VisualEffects: React.FC<VisualEffectsProps> = ({
    effectsState,
    potentialFn,
    xRange,
    yRange,
    particlesStateRef,
    particleCount,
    controls
}) => {
    return (
        <group>
            {effectsState.epGlows && <EPGlows 
                potentialFn={potentialFn}
                residues={{
                    ep1Residue: controls.ep1Residue,
                    ep2Residue: controls.ep2Residue,
                    ep3Residue: controls.ep3Residue,
                    ep4Residue: controls.ep4Residue,
                }}
                intensityFactor={controls.epGlowIntensity}
            />}
            {effectsState.streamlines && <Streamlines 
                potentialFn={potentialFn} 
                xRange={xRange} 
                yRange={yRange} 
                opacity={controls.fieldLineOpacity}
            />}
            {effectsState.fluxHeatmap && particleCount > 0 && <FluxHeatmap particlePositions={particlesStateRef.current.positions} xRange={xRange} yRange={yRange} particleCount={particleCount}/>}
            {effectsState.topologicalRibbon && <TopologicalRibbon potentialFn={potentialFn} />}
        </group>
    );
};

export default VisualEffects;