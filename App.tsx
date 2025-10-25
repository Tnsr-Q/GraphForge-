import React, { useState, useEffect, useCallback } from 'react';
import EditorPanel from './components/EditorPanel';
import ViewportPanel from './components/ViewportPanel';
import ControlsPanel, { ControlsState } from './components/ControlsPanel';
import { GraphIR, ExperimentalPoint, ValidationResults } from './types';
import { parseG3D } from './services/parser';
import { DEFAULT_G3D_CODE } from './constants';
import { LogoIcon, SlidersHorizontalIcon, DatabaseIcon } from './components/Icons';
import ErrorBoundary from './components/ErrorBoundary';
import { EffectsState } from './components/ViewportPanel';
import DataPanel from './components/DataPanel';

const App: React.FC = () => {
  const [g3dCode, setG3dCode] = useState<string>(DEFAULT_G3D_CODE);
  const [graphData, setGraphData] = useState<GraphIR | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isControlsPanelVisible, setIsControlsPanelVisible] = useState<boolean>(true);
  const [isDataPanelVisible, setIsDataPanelVisible] = useState<boolean>(false);

  const [experimentalData, setExperimentalData] = useState<ExperimentalPoint[] | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResults | null>(null);
  const [showExpOverlay, setShowExpOverlay] = useState<boolean>(true);

  const [controls, setControls] = useState<ControlsState>({
    damping: 0.5,
    forceCoupling: 2.0,
    trailLength: 50,
    epGlowIntensity: 1.0,
    particleSize: 0.35,
    fieldLineOpacity: 0.6,
    ep1Residue: 2.5,
    ep2Residue: 3.0,
    ep3Residue: 2.0,
    ep4Residue: 2.8,
  });

  const [effects, setEffects] = useState<EffectsState>({
    streamlines: true,
    particleTrails: true,
    epGlows: true,
    fluxHeatmap: false,
    topologicalRibbon: true,
    lyapunovViz: false,
  });

  const handleControlChange = useCallback((key: keyof ControlsState, value: number) => {
    setControls(prev => ({ ...prev, [key]: value }));

    // Update G3D code for residues
    if (key.includes('Residue')) {
        const residueMap: { [key: string]: string } = {
            ep1Residue: 'FNEP1_RESIDUE',
            ep2Residue: 'FNEP2_RESIDUE',
            ep3Residue: 'FNEP3_RESIDUE',
            ep4Residue: 'FNEP4_RESIDUE',
        };
        const residueName = residueMap[key as keyof typeof residueMap];
        if (residueName) {
            setG3dCode(currentCode => {
                const regex = new RegExp(`(DEF\\s+${residueName}\\s*=\\s*)[-0-9.]+`, 'i');
                return currentCode.replace(regex, `$1${value.toFixed(2)}`);
            });
        }
    }
  }, []);

  const handleParse = useCallback(() => {
    try {
      const ir = parseG3D(g3dCode);
      setGraphData(ir);
      setError(null);
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('An unknown parsing error occurred.');
      }
      setGraphData(null);
    }
  }, [g3dCode]);

  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      handleParse();
    }, 500); // Debounce parsing to avoid running on every keystroke

    return () => clearTimeout(debounceTimeout);
  }, [g3dCode, handleParse]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col font-sans h-screen">
      <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 p-3 flex items-center justify-between shadow-lg sticky top-0 z-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <LogoIcon className="h-8 w-8 text-cyan-400" />
          <h1 className="text-xl font-bold tracking-tight text-white">GraphForge Studio</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
              onClick={() => setIsDataPanelVisible(v => !v)} 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${isDataPanelVisible ? 'bg-cyan-500/20 text-cyan-300' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
              <DatabaseIcon className="h-4 w-4" /> Willow Data
          </button>
          <button 
              onClick={() => setIsControlsPanelVisible(v => !v)} 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${isControlsPanelVisible ? 'bg-cyan-500/20 text-cyan-300' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
              <SlidersHorizontalIcon className="h-4 w-4" /> Controls
          </button>
          <a href="https://github.com/google/generative-ai-docs" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-cyan-400 transition-colors">
            Powered by Gemini
          </a>
        </div>
      </header>
      <ErrorBoundary>
        <main className="flex-grow flex flex-row overflow-hidden">
          <div className="w-1/3 flex flex-col p-4">
            <EditorPanel code={g3dCode} setCode={setG3dCode} />
          </div>
          <div className="flex-grow flex flex-col p-4 pl-0">
            <ViewportPanel 
                graphData={graphData} 
                error={error} 
                controls={controls} 
                effects={effects} 
                setEffects={setEffects}
                experimentalData={experimentalData}
                validationResults={validationResults}
                showExpOverlay={showExpOverlay}
            />
          </div>
          {isControlsPanelVisible && (
              <div className="flex-shrink-0 h-full">
                  <ControlsPanel 
                      controls={controls} 
                      setControl={handleControlChange}
                      effects={effects}
                      setEffect={(key, value) => setEffects(prev => ({...prev, [key]: value}))}
                      onClose={() => setIsControlsPanelVisible(false)}
                  />
              </div>
          )}
           {isDataPanelVisible && (
              <div className="flex-shrink-0 h-full">
                  <DataPanel
                      setExperimentalData={setExperimentalData}
                      setValidationResults={setValidationResults}
                      validationResults={validationResults}
                      showOverlay={showExpOverlay}
                      setShowOverlay={setShowExpOverlay}
                      onClose={() => setIsDataPanelVisible(false)}
                  />
              </div>
          )}
        </main>
      </ErrorBoundary>
    </div>
  );
};

export default App;