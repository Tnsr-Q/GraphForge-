import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { ExperimentalPoint, ValidationResults } from '../types';
import { EXCEPTIONAL_POINTS } from '../constants';
import { DatabaseIcon, UploadIcon } from './Icons';

interface DataPanelProps {
  setExperimentalData: (data: ExperimentalPoint[] | null) => void;
  setValidationResults: (results: ValidationResults | null) => void;
  validationResults: ValidationResults | null;
  showOverlay: boolean;
  setShowOverlay: (show: boolean) => void;
  onClose: () => void;
}

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


const DataPanel: React.FC<DataPanelProps> = ({ setExperimentalData, setValidationResults, validationResults, showOverlay, setShowOverlay, onClose }) => {
    const [error, setError] = useState<string | null>(null);

    const validateTheoryVsExperiment = useCallback((measured: ExperimentalPoint[]): ValidationResults => {
        const theory = EXCEPTIONAL_POINTS;
        const residuals: { ep: string; deviation: number }[] = [];
        const squaredErrors: number[] = [];

        measured.forEach(mep => {
            const tep = theory.find(t => t.id === mep.id);
            if (tep) {
                const dx = tep.x - mep.x;
                const dy = tep.y - mep.y;
                const deviation = Math.sqrt(dx * dx + dy * dy);
                residuals.push({ ep: mep.id, deviation });
                squaredErrors.push(deviation * deviation);
            }
        });

        if (squaredErrors.length === 0) {
            return { rms: 0, maxDeviation: 0, passFailStatus: 'FALSIFIED', deviations: [] };
        }

        const rms = Math.sqrt(squaredErrors.reduce((sum, r) => sum + r, 0) / squaredErrors.length);
        const maxDev = Math.max(...residuals.map(r => r.deviation));
        const passThreshold = maxDev < 0.3;

        return {
            rms,
            maxDeviation: maxDev,
            passFailStatus: passThreshold ? 'THEOREM B.5 CONFIRMED' : 'FALSIFIED',
            deviations: residuals
        };
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setError(null);
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        if (results.errors.length > 0) {
                            throw new Error(`CSV parsing error on row ${results.errors[0].row}: ${results.errors[0].message}`);
                        }
                        const expPoints = (results.data as any[]).map(row => {
                            if (row.ep_id == null || row.re_lambda == null || row.im_lambda == null || row.measured_residue == null || row.uncertainty == null) {
                                throw new Error('CSV is missing required columns: ep_id, re_lambda, im_lambda, measured_residue, uncertainty');
                            }
                            return {
                                id: String(row.ep_id),
                                x: row.re_lambda,
                                y: row.im_lambda,
                                residue: row.measured_residue,
                                uncertainty: row.uncertainty
                            };
                        });
                        
                        setExperimentalData(expPoints);
                        const validation = validateTheoryVsExperiment(expPoints);
                        setValidationResults(validation);

                    } catch(e: any) {
                        setError(`Failed to process CSV: ${e.message}`);
                        setExperimentalData(null);
                        setValidationResults(null);
                    }
                },
                error: (err: any) => {
                    setError(`File reading error: ${err.message}`);
                    setExperimentalData(null);
                    setValidationResults(null);
                }
            });
        }
    };
    
    const { passFailStatus, rms, maxDeviation, deviations } = validationResults || {};
    const isConfirmed = passFailStatus === 'THEOREM B.5 CONFIRMED';

    return (
    <div className="bg-gray-900 border-l border-gray-800 w-80 flex flex-col h-full text-white text-sm shadow-2xl">
      <div className="flex items-center justify-between p-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
            <DatabaseIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-white">Willow Data Interface</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 text-2xl leading-none hover:text-white">&times;</button>
      </div>
      <div className="p-4 flex-grow overflow-y-auto space-y-6">
        <section>
          <h3 className="font-bold mb-3 text-base text-cyan-400">Data Upload</h3>
          <p className="text-xs text-gray-400 mb-2">Load experimental data from a CSV file. Required columns: `ep_id`, `re_lambda`, `im_lambda`, `measured_residue`, `uncertainty`.</p>
           <label htmlFor="csv-upload" className="w-full cursor-pointer flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-md text-sm transition-colors">
                <UploadIcon className="h-4 w-4"/>
                Load .csv File
            </label>
            <input id="csv-upload" type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </section>

        {validationResults && (
            <section>
                <h3 className="font-bold mb-3 text-base text-cyan-400">Validation Results</h3>
                <div className="space-y-4">
                    <div className={`p-4 rounded-lg text-center ${isConfirmed ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        <p className="font-bold text-lg tracking-wider">{passFailStatus}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="bg-gray-800 p-2 rounded-md">
                            <p className="text-xs text-gray-400">RMS Error</p>
                            <p className="text-lg font-mono">{rms?.toFixed(4)}</p>
                        </div>
                        <div className="bg-gray-800 p-2 rounded-md">
                            <p className="text-xs text-gray-400">Max Deviation</p>
                            <p className="text-lg font-mono">{maxDeviation?.toFixed(4)}</p>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2 text-gray-300">Deviations per EP</h4>
                        <div className="bg-gray-800 rounded-md p-2 font-mono text-xs space-y-1">
                            {deviations?.map(d => (
                                <div key={d.ep} className="flex justify-between">
                                    <span>{d.ep}:</span>
                                    <span>{d.deviation.toFixed(4)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="pt-2 border-t border-gray-800">
                        <Toggle label="Show Data Overlay" checked={showOverlay} onChange={setShowOverlay} />
                    </div>
                </div>
            </section>
        )}

      </div>
    </div>
    )
}

export default DataPanel;
