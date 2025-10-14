
import React from 'react';

export interface EffectsState {
  streamlines: boolean;
  particleTrails: boolean;
  epGlows: boolean;
  fluxHeatmap: boolean;
}

interface EffectsPanelProps {
  state: EffectsState;
  setState: React.Dispatch<React.SetStateAction<EffectsState>>;
}

const EffectsPanel: React.FC<EffectsPanelProps> = ({ state, setState }) => {
  const handleChange = (effect: keyof EffectsState) => {
    setState(prevState => ({ ...prevState, [effect]: !prevState[effect] }));
  };

  const effectLabels: { [key in keyof EffectsState]: string } = {
    streamlines: "Field Lines",
    particleTrails: "Particle Trails",
    epGlows: "EP Glows",
    fluxHeatmap: "Flux Heatmap",
  };

  return (
    <div className="absolute top-4 left-4 bg-gray-900/70 backdrop-blur-sm p-3 rounded-lg border border-gray-700 shadow-lg text-white text-sm w-48">
      <h3 className="font-bold mb-2 text-base">Visual Effects</h3>
      <div className="flex flex-col gap-2">
        {Object.keys(state).map(key => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state[key as keyof EffectsState]}
              onChange={() => handleChange(key as keyof EffectsState)}
              className="form-checkbox h-4 w-4 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-600"
            />
            <span>{effectLabels[key as keyof EffectsState]}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default EffectsPanel;
