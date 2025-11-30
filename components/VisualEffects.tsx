import * as React from 'react';
import * as THREE from 'three';
import { Range, FieldlineConfig, ColorMapName, GraphIR } from '../../types';
import { EffectsState } from './ViewportPanel';
import { EPGlows } from './visual-effects/EPGlows';
import { Streamlines } from './visual-effects/Streamlines';
import { FluxHeatmap } from './visual-effects/FluxHeatmap';
import { TopologicalRibbon } from './visual-effects/TopologicalRibbon';
import { CriticalTransitionContour } from './visual-effects/CriticalTransitionContour';
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
    // New props for contour integration
    functions?: any;
    time?: number;
}

const VisualEffects: React.FC<VisualEffectsProps> = ({
    effectsState,
    potentialFn,
    xRange,
    yRange,
    particlesStateRef,
    particleCount,
    controls,
    functions,
    time = 0
}) => {
    
    const fieldlineConfig: FieldlineConfig = React.useMemo(() => ({
        mode: 'gradient',
        source: 'potential',
        density: 30,
        length: 500,
        seedPoints: 'random',
        colorMap: 'plasma',
        opacity: controls.fieldLineOpacity,
        animate: false,
        showArrows: true,
    }), [controls.fieldLineOpacity]);

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
                config={fieldlineConfig}
            />}
            {effectsState.fluxHeatmap && particleCount > 0 && <FluxHeatmap particlePositions={particlesStateRef.current.positions} xRange={xRange} yRange={yRange} particleCount={particleCount}/>}
            {effectsState.topologicalRibbon && <TopologicalRibbon potentialFn={potentialFn} damping={controls.damping} />}
            
            {/* The Critical Transition Contour (AP' = -1/3) */}
            {functions && <CriticalTransitionContour 
                functions={functions} 
                xRange={xRange} 
                yRange={yRange} 
                time={time} 
                potentialFn={potentialFn} 
            />}
        </group>
    );
};

export default VisualEffects;