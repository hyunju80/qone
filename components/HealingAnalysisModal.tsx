import React, { useState } from 'react';
import { X, Bot, AlertTriangle, CheckCircle2, Zap, Loader2 } from 'lucide-react';
import { TestHistory } from '../types';
import { testApi } from '../api/test';

interface HealingAnalysisModalProps {
  targetItem: TestHistory;
  onClose: () => void;
  onSuccess: (logId: string) => void;
}

const HealingAnalysisModal: React.FC<HealingAnalysisModalProps> = ({ targetItem, onClose, onSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStartHealing = async () => {
    setIsProcessing(true);
    try {
      const { log_id } = await testApi.selfHealTest(targetItem.id);
      onSuccess(log_id);
      onClose();
    } catch (e) {
      console.error("Self-healing failed", e);
      alert("Failed to start self-healing.");
    } finally {
      setIsProcessing(false);
    }
  };

  const analysis = targetItem.failureAnalysis;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-white dark:bg-[#0f1115] border border-gray-200 dark:border-white/10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 transition-all">

        {/* Header Section */}
        <div className="p-6 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 dark:bg-indigo-500 rounded-2xl text-white shadow-xl shadow-indigo-500/30">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight uppercase">AI Healing Diagnosis</h3>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Repair Strategy & Autonomous Recovery</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Target Asset Information (Moved to Top) */}
        <div className="px-10 py-6">
          <div className="p-6 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-[2rem] flex items-center justify-between shadow-sm">
            <div className="min-w-0">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Target Script Asset</span>
              <h4 className="text-[13px] font-black text-gray-900 dark:text-white truncate">{targetItem.scriptName}</h4>
            </div>
            <div className="text-right flex-shrink-0 ml-6">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Last Failure Result</span>
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">{new Date(targetItem.runDate).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-10 pb-8 pt-2 custom-scrollbar">
          <div className="space-y-8">
            {/* Oracle Intelligent Analysis Section */}
            <div className="p-8 rounded-[2rem] border bg-indigo-50/50 dark:bg-indigo-500/5 border-indigo-100 dark:border-indigo-500/20 transition-all hover:bg-indigo-50 dark:hover:bg-indigo-500/10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <h4 className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.3em]">Oracle Analysis Summary</h4>
                </div>
                {analysis?.confidence && (
                  <div className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 uppercase tracking-[0.1em]">
                    AI Confidence: {analysis.confidence}%
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-[1.7] font-medium transition-colors whitespace-pre-wrap">
                  {analysis?.thought || targetItem.aiSummary || "No detailed analysis available."}
                </p>

                <div className="grid grid-cols-1 gap-4">
                  <div className="group flex items-start gap-4 p-6 bg-white dark:bg-black/20 border border-red-100 dark:border-red-500/10 rounded-[1.5rem] transition-all hover:border-red-200">
                    <div className="p-2.5 bg-red-50 dark:bg-red-500/10 rounded-xl text-red-500">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1.5">Root Cause (AI Diagnostic)</div>
                      <p className="text-[13px] text-red-800 dark:text-red-400 font-bold leading-relaxed">
                        {analysis?.reason || targetItem.failureReason || 'Logic Discrepancy'}
                      </p>
                    </div>
                  </div>

                  {analysis?.suggestion && (
                    <div className="group flex items-start gap-4 p-6 bg-white dark:bg-black/20 border border-emerald-100 dark:border-emerald-500/10 rounded-[1.5rem] transition-all hover:border-emerald-200">
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-500">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-1.5">Suggested Fix Strategy</div>
                        <p className="text-[13px] text-emerald-800 dark:text-emerald-400 leading-relaxed font-medium">
                          {analysis.suggestion}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer with improved spacing */}
        <div className="px-10 py-6 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex justify-end gap-4 transition-colors">
          <button
            onClick={onClose}
            className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            CNACEL
          </button>
          <button
            onClick={handleStartHealing}
            disabled={isProcessing}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.1em] shadow-2xl shadow-indigo-600/30 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
          >
            {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 fill-white" />}
            Start Healing
          </button>
        </div>
      </div>
    </div>
  );
};

export default HealingAnalysisModal;
