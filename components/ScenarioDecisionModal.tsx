import React, { useState } from 'react';
import { X, FileCode, CheckCircle2, Zap, Loader2, List, Bot, Activity, ChevronRight } from 'lucide-react';
import { Scenario } from '../types';

interface ScenarioDecisionModalProps {
  scenario: Scenario;
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  isDark: boolean;
}

const ScenarioDecisionModal: React.FC<ScenarioDecisionModalProps> = ({ scenario, onClose, onApprove, isDark }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(scenario.id);
      onClose();
    } catch (e) {
      console.error("Scenario approval failed", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const bgClass = isDark ? 'bg-[#0f1115]' : 'bg-white';
  const borderClass = isDark ? 'border-white/10' : 'border-gray-100';
  const textClass = isDark ? 'text-white' : 'text-gray-900';
  const subTextClass = isDark ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 sm:p-12 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
      <div className={`relative w-full max-w-5xl max-h-[90vh] ${bgClass} border ${borderClass} rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300`}>
        
        {/* Header Section: Asset Intelligence Center Style */}
        <div className={`p-8 border-b ${borderClass} flex items-center justify-between transition-colors`}>
          <div className="flex items-center gap-5">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-500/30">
              <FileCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className={`text-lg font-black ${textClass} tracking-tight uppercase`}>Asset Intelligence Center</h3>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">AI_GENERATOR: 시나리오 초안 분석 및 승인 검토</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <div className="space-y-10">
            {/* Scenario Identity */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Scenario Title</label>
              <h2 className={`text-2xl font-black ${textClass} tracking-tight leading-tight`}>{scenario.title}</h2>
              <p className={`text-sm ${subTextClass} font-medium leading-relaxed`}>
                {scenario.description || "No description provided for this generated scenario."}
              </p>
            </div>

            {/* Steps / Test Cases List: Asset Intelligence Style */}
            <div className="space-y-6">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-3 h-3" /> Test Cases / Verified Flow
              </label>
              <div className="space-y-6">
                {(scenario.testCases || scenario.test_cases || []).map((tc: any, tcIdx: number) => (
                  <div key={tc.id || tcIdx} className={`bg-gray-50/50 dark:bg-white/5 border ${borderClass} rounded-3xl p-8 relative shadow-sm transition-all hover:border-indigo-500/30`}>
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center text-[11px]">{tcIdx + 1}</span>
                        <h4 className={`text-base font-black ${textClass} tracking-tight`}>{tc.title}</h4>
                      </div>
                      <span className="text-[9px] font-black bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 px-3 py-1.5 rounded-full uppercase tracking-widest">COMPLETED</span>
                    </div>

                    <div className="space-y-4 mb-8">
                      {(tc.steps || []).map((step: string, sIdx: number) => (
                        <div key={sIdx} className="flex gap-4 items-start group">
                          <span className="text-[12px] font-mono font-bold text-indigo-500/50 mt-0.5">{sIdx + 1}.</span>
                          <span className={`text-[13px] ${isDark ? 'text-gray-300' : 'text-gray-700'} font-semibold leading-relaxed group-hover:text-indigo-500 transition-colors`}>{step}</span>
                        </div>
                      ))}
                    </div>

                    {/* Expected Result: Highlighted Box */}
                    <div className="pt-6 border-t border-gray-100 dark:border-white/5">
                      <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block mb-2">Expected Result</label>
                      <p className={`text-[13px] ${isDark ? 'text-gray-200' : 'text-gray-800'} font-bold italic leading-relaxed`}>
                        "{tc.expectedResult || "Goal achieved successfully."}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`p-8 border-t ${borderClass} bg-gray-50/50 dark:bg-white/5 flex justify-end gap-5 transition-colors`}>
          <button
            onClick={onClose}
            className="px-8 py-4 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={isProcessing}
            className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] shadow-2xl shadow-indigo-600/30 transition-all flex items-center gap-3 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            Verify Now
          </button>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default ScenarioDecisionModal;
