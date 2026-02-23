
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileText, Code, Loader2, Wand2, Zap, PlayCircle, Sparkles,
  RefreshCw, ClipboardList, Target, UserCheck, CheckCircle2,
  Database, Link as LinkIcon, Trash2, ArrowRight, Library,
  Code2, Terminal, Activity, Plus, X, ArrowUp, ArrowDown,
  Info, ShieldCheck, CheckSquare, Square, Search, Check, ChevronDown, ChevronUp,
  Eye, FileSearch, ListChecks, CheckCircle, ClipboardCopy, DatabaseZap, Layout,
  ExternalLink
} from 'lucide-react';
import LiveView from './LiveView';
import ActionLibrary from './ActionLibrary';
import LiveExecutionModal from './LiveExecutionModal';
import { ScriptStatus, TestCase, TestScript, ScriptOrigin, Persona, DataType, TestDataRow, Project, Scenario } from '../types';
import { testApi } from '../api/test';

interface GeneratorDashboardProps {
  activeProject: Project;
  approvedScenarios: Scenario[];
  onCertify?: (script: Partial<TestScript>, sourceScenarioIds: string[]) => void;
  personas: Persona[];
}

const GeneratorDashboard: React.FC<GeneratorDashboardProps> = ({
  activeProject, approvedScenarios, onCertify, personas
}) => {
  const [dryRunStatus, setDryRunStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<{ msg: string, type: 'info' | 'success' | 'error' | 'cmd' }[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  const [isActionLibraryOpen, setIsActionLibraryOpen] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [code, setCode] = useState(`// Select approved scenarios from the left to start code generation...`);
  const [generatedTags, setGeneratedTags] = useState<string[]>([]);

  // 상세 보기 시나리오 상태 (슬라이드 패널용)
  const [viewingDetailScenarioId, setViewingDetailScenarioId] = useState<string | null>(null);

  // Data Synthesis State
  const [selectedDataTypes, setSelectedDataTypes] = useState<DataType[]>([DataType.VALID]);
  const [syntheticData, setSyntheticData] = useState<TestDataRow[]>([]);
  const [appliedDataset, setAppliedDataset] = useState<TestDataRow[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [bindNotification, setBindNotification] = useState<string | null>(null);

  const selectedScenarios = useMemo(() =>
    approvedScenarios.filter(s => selectedScenarioIds.includes(s.id)),
    [approvedScenarios, selectedScenarioIds]
  );

  const detailScenario = useMemo(() =>
    approvedScenarios.find(s => s.id === viewingDetailScenarioId) || null,
    [approvedScenarios, viewingDetailScenarioId]
  );

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'cmd' = 'info') => {
    setLogs(prev => [...prev, { msg, type }]);
  };

  const toggleScenario = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedScenarioIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  /* New State for Dry Run Modal */
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const generateSuiteScript = async () => {
    if (selectedScenarios.length === 0) return;
    setIsGeneratingScript(true);
    setLogs([]);
    addLog(`Generating Playwright suite for ${selectedScenarios.length} scenarios...`, 'info');

    try {
      const persona = personas.find(p => p.id === selectedScenarios[0].personaId) || personas[0];

      // Use Backend API
      const result = await testApi.generateScript({
        scenarios: selectedScenarios,
        persona: { name: persona.name, goal: persona.goal },
        projectContext: activeProject.name
      });

      setCode(result.code);
      setGeneratedTags(result.tags);
      addLog(`Suite logic consolidated successfully via Backend.`, 'success');
    } catch (error) {
      console.error(error);
      addLog('Generation failed. Check backend logs.', 'error');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const synthesizeData = async () => {
    if (selectedScenarios.length === 0) return;
    setIsSynthesizing(true);
    addLog('Initiating AI Data Synthesis...', 'info');

    try {
      const result = await testApi.generateData(selectedScenarios, selectedDataTypes);
      setSyntheticData(result.data);
      addLog(`Examples generated: ${result.data.length} vectors.`, 'success');
      setShowDataModal(true);
    } catch (e) {
      console.error("Data synthesis failed", e);
      addLog('Data synthesis failed. Check console.', 'error');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleDryRun = async () => {
    if (dryRunStatus === 'running' || !code) return;
    setDryRunStatus('running');
    addLog('Initiating Dry Run via Backend...', 'cmd');

    try {
      const { run_id } = await testApi.dryRun(code);
      setActiveRunId(run_id);
      setDryRunStatus('success');
      addLog(`Dry Run initiated. ID: ${run_id}`, 'success');
    } catch (e: any) {
      setDryRunStatus('error');
      addLog('Failed to start Dry Run.', 'error');
      console.error(e);
      alert(`Dry Run Failed to Start:\n${e.response?.data?.detail || e.message || JSON.stringify(e)}`);
    }
  };

  const handleCertify = () => {
    if (selectedScenarios.length === 0 || !onCertify) return;
    const persona = personas.find(p => p.id === selectedScenarios[0].personaId) || personas[0];
    onCertify({
      name: `Suite: ${selectedScenarios.map(s => s.title).join(' & ')}`,
      code,
      origin: ScriptOrigin.AI,
      persona,
      dataset: appliedDataset,
      tags: generatedTags
    }, selectedScenarioIds);
  };

  // Helper for badge colors
  const getDataTypeStyle = (type: string) => {
    switch (type) {
      case DataType.VALID:
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case DataType.INVALID:
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case DataType.SECURITY:
        return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case DataType.EDGE_CASE:
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden relative bg-gray-50 dark:bg-[#0c0e12] transition-colors">
      {/* Left: Approved Scenarios List */}
      <div className="w-[360px] border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-[#111318] z-10 transition-colors">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#16191f]/40 transition-colors">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center justify-between mb-4">
            Approved Scenarios
            <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[8px]">{approvedScenarios.length} Nodes</span>
          </h3>
          <div className="relative group">
            <input type="text" placeholder="Filter scenarios..." className="w-full bg-gray-100 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 pl-10 text-[11px] text-gray-900 dark:text-gray-300 outline-none focus:border-indigo-500 transition-all" />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-600 transition-colors" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {approvedScenarios.map(s => (
            <div
              key={s.id}
              onClick={() => setViewingDetailScenarioId(s.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer group relative ${selectedScenarioIds.includes(s.id) ? 'bg-indigo-600/10 border-indigo-500 shadow-lg' : 'bg-gray-50 dark:bg-[#16191f] border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <div className={`text-xs font-bold truncate transition-colors ${selectedScenarioIds.includes(s.id) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-200'}`}>{s.title}</div>
                  <p className="text-[10px] mt-1.5 line-clamp-1 text-gray-500 font-medium italic">"{s.description}"</p>
                </div>
                <div
                  onClick={(e) => toggleScenario(e, s.id)}
                  className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all shrink-0 ${selectedScenarioIds.includes(s.id) ? 'bg-indigo-600 border-indigo-500' : 'border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 group-hover:border-indigo-500'}`}
                >
                  {selectedScenarioIds.includes(s.id) && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-colors ${selectedScenarioIds.includes(s.id) ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-gray-200 dark:bg-gray-800 text-gray-600'}`}>{s.testCases.length} TestCases</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setViewingDetailScenarioId(s.id); }}
                  className="text-[9px] font-black text-gray-500 hover:text-indigo-400 uppercase flex items-center gap-1 transition-colors"
                >
                  <FileSearch className="w-3 h-3" /> Inspect Detail
                </button>
              </div>
            </div>
          ))}
          {approvedScenarios.length === 0 && (
            <div className="py-20 text-center opacity-30 px-6">
              <ClipboardList className="w-12 h-12 mb-4 mx-auto" />
              <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">No approved scenarios found. Go to "Scenario Generator" first.</p>
            </div>
          )}
        </div>

        {selectedScenarios.length > 0 && (
          <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#16191f] animate-in slide-in-from-bottom-2 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest transition-colors">Orchestration Target</span>
              <span className="text-[10px] font-black text-gray-900 dark:text-white transition-colors">{selectedScenarios.length} selected</span>
            </div>
            <button
              onClick={generateSuiteScript}
              disabled={isGeneratingScript}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2"
            >
              {isGeneratingScript ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Consolidate Suite Code
            </button>
          </div>
        )}
      </div>

      {/* Center: Orchestrator & Code */}
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-[#0c0e12] overflow-hidden transition-colors">
        {/* Removed inline LiveView to maximize code space as requested */}

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#16191f]/20 transition-colors">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 transition-colors">
              <Code2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 transition-colors" />
              <span className="text-[10px] font-black uppercase tracking-widest">Playwright Logic Orchestrator</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsActionLibraryOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-indigo-500/50 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl text-[10px] font-black uppercase transition-all"><Library className="w-3.5 h-3.5" /> Library</button>
              <button onClick={handleDryRun} disabled={!code || code.trim().length === 0} className="px-5 py-2 bg-green-600/10 text-green-600 dark:text-green-500 border border-green-500/30 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-green-600/20 transition-all disabled:opacity-30"><PlayCircle className="w-3.5 h-3.5" /> Dry Run</button>
              <button onClick={generateSuiteScript} disabled={selectedScenarioIds.length === 0 || isGeneratingScript} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-30">
                {isGeneratingScript ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Re-Build Logic
              </button>
            </div>
          </div>
          <div className="flex-1 p-8 overflow-y-auto bg-gray-50 dark:bg-black/20 custom-scrollbar relative transition-colors">
            <div className="absolute top-8 right-8 flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 dark:text-gray-700 uppercase tracking-widest transition-colors">Playwright / TypeScript</span>
            </div>
            {generatedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {generatedTags.map((t, i) => (
                  <span key={i} className="px-2.5 py-1 bg-indigo-600/10 border border-indigo-500/20 text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase rounded-lg transition-colors">#{t}</span>
                ))}
              </div>
            )}
            <textarea value={code} onChange={(e) => setCode(e.target.value)} className="w-full h-full bg-transparent mono text-[13px] text-gray-800 dark:text-blue-300 leading-relaxed outline-none resize-none transition-colors" spellCheck={false} />
          </div>
          <div className="p-5 border-t border-gray-200 dark:border-gray-800 flex justify-end bg-white dark:bg-gray-950/40 transition-colors">
            <button onClick={handleCertify} disabled={dryRunStatus !== 'success'} className="px-14 py-4 bg-indigo-600 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-indigo-600/30 transition-all disabled:opacity-30 disabled:grayscale hover:bg-indigo-500 active:scale-95">Certify Golden Asset</button>
          </div>
        </div>
      </div>

      {/* Right: Synthesis Data Panel */}
      <div className="w-[320px] border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-[#16191f] p-6 space-y-10 overflow-y-auto custom-scrollbar z-10 transition-colors">
        <div className="space-y-4">
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Synthesis Matrix</div>
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800/50 transition-colors">
            <div className="grid grid-cols-1 gap-2 p-1 bg-gray-50 dark:bg-[#0c0e12] rounded-2xl border border-gray-200 dark:border-gray-800 transition-colors">
              {(Object.values(DataType) as DataType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedDataTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                  className={`py-3 px-4 text-[10px] font-black uppercase rounded-xl border transition-all flex items-center justify-between ${selectedDataTypes.includes(t) ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' : 'text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'}`}
                >
                  <span>{t} Pattern</span>
                  {selectedDataTypes.includes(t) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-20" />}
                </button>
              ))}
            </div>
            <button
              onClick={synthesizeData}
              disabled={selectedScenarioIds.length === 0 || isSynthesizing || !code || code.startsWith('//') || selectedDataTypes.length === 0}
              className="w-full bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 text-indigo-600 dark:text-indigo-400 text-[10px] font-black py-4 rounded-2xl border border-indigo-500/30 flex items-center justify-center gap-3 uppercase transition-all shadow-xl shadow-indigo-600/5 disabled:opacity-30"
            >
              {isSynthesizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />} Synthesize Data Vectors
            </button>

            {bindNotification && (
              <button
                onClick={() => {
                  setSyntheticData([...appliedDataset]); // Re-load applied dataset for viewing
                  setShowDataModal(true);
                }}
                className="w-full p-4 bg-green-600/10 border border-green-500/30 rounded-2xl animate-in zoom-in-95 flex items-center justify-between group hover:bg-green-600/20 transition-all"
              >
                <div className="flex flex-col items-start">
                  <p className="text-[10px] text-green-500 font-black uppercase tracking-widest">{bindNotification}</p>
                  <p className="text-[8px] text-green-600/60 font-bold uppercase mt-1">Click to view mapped vectors</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-green-500 group-hover:scale-110 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- SCENARIO DETAIL SLIDE PANEL --- */}
      {detailScenario && (
        <div className="fixed inset-0 z-[150] flex justify-end">
          <div className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm animate-in fade-in transition-colors" onClick={() => setViewingDetailScenarioId(null)} />
          <div className="relative w-[500px] bg-white dark:bg-[#16191f] border-l border-gray-200 dark:border-gray-800 h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col transition-colors">
            <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex items-center justify-between transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600/10 rounded-2xl text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-colors">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase tracking-widest italic transition-colors">{detailScenario.title}</h3>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest mt-1 transition-colors">Scenario Logic Inspection</p>
                </div>
              </div>
              <button onClick={() => setViewingDetailScenarioId(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 hover:text-gray-600 dark:text-gray-500 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-gray-50 dark:bg-[#0c0e12]/40 transition-colors">
              <div className="space-y-4">
                <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase tracking-widest flex items-center gap-2 transition-colors">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 transition-colors" /> Operational Context
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed italic bg-indigo-500/5 border border-indigo-500/10 p-5 rounded-[1.5rem] transition-colors">
                  "{detailScenario.description}"
                </p>
              </div>

              <div className="space-y-6">
                <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase tracking-widest flex items-center gap-2 transition-colors">
                  <ListChecks className="w-4 h-4 text-indigo-600 dark:text-indigo-400 transition-colors" /> Full TestCase Sequence
                </div>

                <div className="space-y-6">
                  {detailScenario.testCases.map((tc, idx) => (
                    <div key={tc.id} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-2 transition-colors" style={{ animationDelay: `${idx * 50}ms` }}>
                      <div className="p-5 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 bg-white dark:bg-gray-950 border border-indigo-500/30 rounded-full flex items-center justify-center text-[11px] font-black text-indigo-600 dark:text-indigo-400 transition-colors">
                            {idx + 1}
                          </div>
                          <span className="text-[13px] font-black text-gray-900 dark:text-gray-200 transition-colors">{tc.title}</span>
                        </div>
                        <CheckCircle className="w-4 h-4 text-green-500 opacity-20" />
                      </div>
                      <div className="p-6 space-y-5">
                        {/* 4-Part Structure Display */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <span className="text-[8px] font-black text-amber-500 uppercase flex items-center gap-1.5">
                              <ClipboardCopy className="w-2.5 h-2.5" /> Pre-condition
                            </span>
                            <p className="text-[10px] text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-800 min-h-[40px] italic transition-colors">
                              {tc.preCondition}
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-[8px] font-black text-blue-500 uppercase flex items-center gap-1.5">
                              <DatabaseZap className="w-2.5 h-2.5" /> Input Data
                            </span>
                            <p className="text-[10px] text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-800 min-h-[40px] italic transition-colors">
                              {tc.inputData}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase flex items-center gap-1.5 transition-colors">
                            <Layout className="w-2.5 h-2.5" /> Execution Steps
                          </span>
                          <div className="space-y-1.5">
                            {tc.steps.map((step, sIdx) => (
                              <div key={sIdx} className="flex gap-3 p-2.5 bg-gray-50/50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800 rounded-xl group hover:border-indigo-500/30 transition-all">
                                <span className="text-[9px] font-black text-gray-500 dark:text-gray-700 mt-0.5 transition-colors">{sIdx + 1}</span>
                                <p className="text-[11px] text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-300 leading-snug transition-colors">{step}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 transition-colors">
                          <span className="text-[9px] font-black text-green-600/80 uppercase flex items-center gap-1.5 mb-2">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Expected Result
                          </span>
                          <div className="p-4 bg-green-600/5 border border-green-500/10 rounded-2xl text-[12px] text-green-600 dark:text-green-400/80 italic leading-relaxed font-medium transition-colors">
                            "{tc.expectedResult}"
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 flex items-center justify-between gap-4 transition-colors">
              <div className="text-[9px] font-black text-gray-500 dark:text-gray-600 uppercase tracking-tighter transition-colors">Total Nodes: {detailScenario.testCases.length}</div>
              <div className="flex gap-3">
                <button
                  onClick={() => setViewingDetailScenarioId(null)}
                  className="px-6 py-3 text-[10px] font-black text-gray-400 hover:text-gray-600 dark:text-gray-500 uppercase dark:hover:text-gray-300 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => { toggleScenario({ stopPropagation: () => { } } as any, detailScenario.id); setViewingDetailScenarioId(null); }}
                  className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg transition-all flex items-center gap-2 ${selectedScenarioIds.includes(detailScenario.id) ? 'bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-white' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20'}`}
                >
                  {selectedScenarioIds.includes(detailScenario.id) ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {selectedScenarioIds.includes(detailScenario.id) ? 'Deselect from Suite' : 'Include in Suite'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ActionLibrary isOpen={isActionLibraryOpen} onClose={() => setIsActionLibraryOpen(false)} onInsert={(c) => setCode(prev => prev + '\n' + c)} activeProject={activeProject} />

      {/* Data Modal [기존 코드 로직 유지] */}
      {showDataModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-8 bg-black/50 dark:bg-black/90 backdrop-blur-md transition-colors">
          <div className="relative w-full max-w-4xl bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[85vh] transition-colors">
            <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between transition-colors">
              <div className="flex items-center gap-4"><Database className="w-8 h-8 text-indigo-600 dark:text-indigo-400 transition-colors" /><h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight transition-colors">Data Vector Mapping</h3></div>
              <button onClick={() => setShowDataModal(false)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl text-gray-400 hover:text-gray-600 dark:text-gray-500 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-auto p-6 custom-scrollbar">
              <table className="w-full text-left text-[11px]">
                <thead className="text-[9px] font-black uppercase text-gray-500 dark:text-gray-600 border-b border-gray-200 dark:border-gray-800 transition-colors">
                  <tr>
                    <th className="px-5 py-4">Status & Type</th>
                    <th className="px-5 py-4">Field ID</th>
                    <th className="px-5 py-4">Value</th>
                    <th className="px-5 py-4">Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800 transition-colors">
                  {syntheticData.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-5 py-5">
                        <span className={`px-2 py-1 rounded text-[8px] font-black uppercase border ${getDataTypeStyle(row.type)}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-5 py-5 font-bold text-gray-900 dark:text-white mono transition-colors">{row.field}</td>
                      <td className="px-5 py-5 text-indigo-600 dark:text-indigo-300 mono max-w-[200px] truncate transition-colors" title={row.value}>{row.value}</td>
                      <td className="px-5 py-5 text-gray-500 italic">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-8 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 flex justify-end transition-colors">
              <button onClick={() => { setAppliedDataset([...syntheticData]); setShowDataModal(false); setBindNotification('Data vectors bound.'); }} className="bg-indigo-600 text-white px-14 py-4 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-500 flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Bind Vectors</button>
            </div>
          </div>
        </div>
      )}
      {/* Dry Run Modal */}
      {activeRunId && (
        <LiveExecutionModal
          runId={activeRunId}
          onClose={() => { setActiveRunId(null); /* activeRunId null closes modal, but we keep dryRunStatus if success */ }}
          onComplete={(status) => {
            setDryRunStatus(status);
            if (status === 'success') {
              addLog('Dry Run PASSED. Ready to Certify.', 'success');
            } else {
              addLog('Dry Run FAILED.', 'error');
            }
          }}
        />
      )}
    </div>
  );
};

export default GeneratorDashboard;
