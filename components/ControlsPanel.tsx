import React from 'react';
import { EffectsState } from './ViewportPanel';
import { SlidersHorizontalIcon } from './Icons';

export interface ControlsState {
  damping: number;
  forceCoupling: number;
  trailLength: number;
  epGlowIntensity: number;
  particleSize: number;
  fieldLineOpacity: number;
  ep1Residue: number;
  ep2Residue: number;
  ep3Residue: number;
  ep4Residue: number;
}

interface ControlsPanelProps {
  controls: ControlsState;
  setControl: (key: keyof ControlsState, value: number) => void;
  effects: EffectsState;
  setEffect: (key: keyof EffectsState, value: boolean) => void;
  onClose: () => void;
}

const Slider: React.FC<{ label: string; min: number; max: number; step: number; value: number; onChange: (val: number) => void; }> = 
({ label, min, max, step, value, onChange }) => (
    <div>
        <label className="block text-xs text-gray-400 mb-1">{label}</label>
        <div className="flex items-center gap-2">
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <span className="text-xs font-mono bg-gray-800 px-2 py-0.5 rounded w-14 text-center">{value.toFixed(2)}</span>
        </div>
    </div>
);

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void; }> =
({ label, checked, onChange }) => (
    <label className="flex items-center justify-between gap-2 cursor-pointer">
      <span>{label}</span>
      <div className="relative">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
      </div>
    </label>
);

const ControlsPanel: React.FC<ControlsPanelProps> = ({ controls, setControl, effects, setEffect, onClose }) => {
  return (
    <div className="bg-gray-900 border-l border-gray-800 w-80 flex flex-col h-full text-white text-sm shadow-2xl">
      <div className="flex items-center justify-between p-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
            <SlidersHorizontalIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-white">Controls</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 text-2xl leading-none hover:text-white">&times;</button>
      </div>
      <div className="p-4 flex-grow overflow-y-auto space-y-6">
        
        <section>
          <h3 className="font-bold mb-3 text-base text-cyan-400">Physics</h3>
          <div className="space-y-4">
              <Slider label="Damping γ" min={0} max={2} step={0.1} value={controls.damping} onChange={(v) => setControl('damping', v)} />
              <Slider label="Force Coupling α" min={0} max={5} step={0.1} value={controls.forceCoupling} onChange={(v) => setControl('forceCoupling', v)} />
          </div>
        </section>

        <section>
          <h3 className="font-bold mb-3 text-base text-cyan-400">Topology</h3>
           <div className="space-y-4">
              <Slider label="EP1 Residue" min={0} max={5} step={0.01} value={controls.ep1Residue} onChange={(v) => setControl('ep1Residue', v)} />
              <Slider label="EP2 Residue" min={0} max={5} step={0.01} value={controls.ep2Residue} onChange={(v) => setControl('ep2Residue', v)} />
              <Slider label="EP3 Residue" min={0} max={5} step={0.01} value={controls.ep3Residue} onChange={(v) => setControl('ep3Residue', v)} />
              <Slider label="EP4 Residue" min={0} max={5} step={0.01} value={controls.ep4Residue} onChange={(v) => setControl('ep4Residue', v)} />
          </div>
        </section>

        <section>
          <h3 className="font-bold mb-3 text-base text-cyan-400">Visual Effects</h3>
          <div className="space-y-3">
            <Toggle label="Field Lines" checked={effects.streamlines} onChange={(v) => setEffect('streamlines', v)} />
            <Toggle label="Particle Trails" checked={effects.particleTrails} onChange={(v) => setEffect('particleTrails', v)} />
            <Toggle label="EP Glows" checked={effects.epGlows} onChange={(v) => setEffect('epGlows', v)} />
            <Toggle label="Flux Heatmap" checked={effects.fluxHeatmap} onChange={(v) => setEffect('fluxHeatmap', v)} />
            <Toggle label="Topological Ribbon" checked={effects.topologicalRibbon} onChange={(v) => setEffect('topologicalRibbon', v)} />
            <Toggle label="Lyapunov Stability" checked={effects.lyapunovViz} onChange={(v) => setEffect('lyapunovViz', v)} />
          </div>
        </section>

        <section>
          <h3 className="font-bold mb-3 text-base text-cyan-400">Visual Parameters</h3>
           <div className="space-y-4">
              <Slider label="Trail Length" min={10} max={200} step={10} value={controls.trailLength} onChange={(v) => setControl('trailLength', v)} />
              <Slider label="EP Glow Intensity" min={0} max={2} step={0.1} value={controls.epGlowIntensity} onChange={(v) => setControl('epGlowIntensity', v)} />
              <Slider label="Particle Size" min={0.1} max={1.0} step={0.05} value={controls.particleSize} onChange={(v) => setControl('particleSize', v)} />
              <Slider label="Field Line Opacity" min={0} max={1} step={0.1} value={controls.fieldLineOpacity} onChange={(v) => setControl('fieldLineOpacity', v)} />
           </div>
        </section>
      </div>
    </div>
  );
};

export default ControlsPanel;