import React, { useState } from 'react';
import { generateG3DCode } from '../services/geminiService';
import { FileIcon, SparklesIcon, UploadIcon } from './Icons';

interface EditorPanelProps {
  code: string;
  setCode: (code: string) => void;
}

const EditorPanel: React.FC<EditorPanelProps> = ({ code, setCode }) => {
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          setCode(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleGenerateCode = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setAiError(null);
    try {
      const generatedCode = await generateG3DCode(prompt);
      setCode(generatedCode);
    } catch (error) {
      setAiError('Failed to generate code. Please check your API key and try again.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col h-full shadow-2xl">
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
            <FileIcon className="h-5 w-5 text-gray-400"/>
            <h2 className="font-semibold text-white">G3D Source</h2>
        </div>
        <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-md text-sm transition-colors">
            <UploadIcon className="h-4 w-4"/>
            Load .g3d
        </label>
        <input id="file-upload" type="file" className="hidden" accept=".g3d" onChange={handleFileChange} />
      </div>
      <div className="p-3 flex-grow flex flex-col min-h-[200px]">
        <div className="w-full flex-grow border border-gray-700 rounded-md overflow-hidden bg-gray-800">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-full bg-gray-800 text-gray-200 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
            style={{ minHeight: '400px', lineHeight: '1.5' }}
            spellCheck={false}
          />
        </div>
      </div>
      <div className="p-3 border-t border-gray-800">
        <div className="flex flex-col gap-2">
           <div className="flex items-center gap-2 text-sm text-fuchsia-400 font-semibold">
             <SparklesIcon className="h-5 w-5" />
             <span>Generate with AI</span>
           </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe a 3D shape, e.g., 'a wavy surface'"
              className="w-full bg-gray-800 p-2 rounded-md text-sm text-gray-200 border border-gray-700 focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateCode()}
              disabled={isLoading}
            />
            <button
              onClick={handleGenerateCode}
              disabled={isLoading}
              className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-md text-sm font-semibold transition-colors disabled:bg-fuchsia-800 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : 'Generate'}
            </button>
          </div>
          {aiError && <p className="text-red-400 text-xs mt-1">{aiError}</p>}
        </div>
      </div>
    </div>
  );
};

export default EditorPanel;
