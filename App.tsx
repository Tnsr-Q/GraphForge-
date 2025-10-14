import React, { useState, useEffect, useCallback } from 'react';
import EditorPanel from './components/EditorPanel';
import ViewportPanel from './components/ViewportPanel';
import { GraphIR } from './types';
import { parseG3D } from './services/parser';
import { DEFAULT_G3D_CODE } from './constants';
import { LogoIcon } from './components/Icons';
import ErrorBoundary from './components/ErrorBoundary';

const App: React.FC = () => {
  const [g3dCode, setG3dCode] = useState<string>(DEFAULT_G3D_CODE);
  const [graphData, setGraphData] = useState<GraphIR | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col font-sans">
      <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 p-3 flex items-center justify-between shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <LogoIcon className="h-8 w-8 text-cyan-400" />
          <h1 className="text-xl font-bold tracking-tight text-white">GraphForge Studio</h1>
        </div>
        <a href="https://github.com/google/generative-ai-docs" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-cyan-400 transition-colors">
          Powered by Gemini
        </a>
      </header>
      <ErrorBoundary>
        <main className="flex-grow flex flex-col md:flex-row gap-4 p-4">
          <div className="md:w-1/2 lg:w-2/5 flex flex-col">
            <EditorPanel code={g3dCode} setCode={setG3dCode} />
          </div>
          <div className="md:w-1/2 lg:w-3/5 flex flex-col">
            <ViewportPanel graphData={graphData} error={error} />
          </div>
        </main>
      </ErrorBoundary>
    </div>
  );
};

export default App;