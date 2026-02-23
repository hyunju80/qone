
import React, { useState, useRef, useMemo } from 'react';
import {
  Wand2, FileUp, X, Loader2, ClipboardList, CheckCircle2,
  ChevronRight, Trash2, Edit3, ArrowUp, ArrowDown, Save,
  Bot, Target, Search, FileText, Layout, Plus, Check,
  Image as ImageIcon, FileJson, FileType, AlignLeft,
  Database, Globe, Compass, ListChecks, Sparkles, Activity,
  RefreshCw, ClipboardCopy, DatabaseZap, Square
} from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { Project, Persona, Scenario, TestCase } from '../types';
import { scenariosApi } from '../api/scenarios';

interface FeatureSummary {
  name: string;
  description: string;
  flows: string[];
}

interface ScenarioGeneratorProps {
  activeProject: Project;
  personas: Persona[];
  onApproveScenario: (scenario: Scenario) => void;
  focusedTaskId: string | null;
  onClearFocus: () => void;
  // Persistence Props
  persistedFeatures: FeatureSummary[];
  onUpdatePersistedFeatures: (features: FeatureSummary[]) => void;
  persistedScenarios: Scenario[];
  onUpdatePersistedScenarios: (scenarios: Scenario[]) => void;
  persistedEditingId: string | null;
  onUpdatePersistedEditingId: (id: string | null) => void;
}

type GeneratorTab = 'upload' | 'rag' | 'browsing';

const ScenarioGenerator: React.FC<ScenarioGeneratorProps> = ({
  activeProject, personas, onApproveScenario, focusedTaskId, onClearFocus,
  persistedFeatures, onUpdatePersistedFeatures,
  persistedScenarios, onUpdatePersistedScenarios, persistedEditingId, onUpdatePersistedEditingId
}) => {
  const [activeTab, setActiveTab] = useState<GeneratorTab>('upload');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Inputs
  const [userPrompt, setUserPrompt] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [ragQuery, setRagQuery] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string, type: string, data: string, preview?: string }[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona>(personas[0] || {} as Persona);
  const [domContext, setDomContext] = useState<string>(''); // Store simplified DOM
  const abortControllerRef = useRef<AbortController | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeScenario = useMemo(() =>
    persistedScenarios.find(s => s.id === persistedEditingId) || null,
    [persistedScenarios, persistedEditingId]
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = await Promise.all(Array.from(files).map(async (file: File) => {
      return new Promise<{ name: string, type: string, data: string, preview?: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = (e.target?.result as string).split(',')[1];
          resolve({
            name: file.name,
            type: file.type,
            data: base64,
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
          });
        };
        reader.readAsDataURL(file);
      });
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const target = prev[index];
      if (target.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleAnalyzeBase = async () => {
    setIsAnalyzing(true);
    abortControllerRef.current = new AbortController();
    // onUpdatePersistedFeatures([]); // Removed
    onUpdatePersistedScenarios([]); // Clear previous results

    try {
      let result;
      if (activeTab === 'browsing') {
        result = await scenariosApi.analyzeUrl(targetUrl, userPrompt, abortControllerRef.current.signal);
      } else if (activeTab === 'upload') {
        if (uploadedFiles.length === 0) {
          alert("업로드된 파일이 없습니다.");
          setIsAnalyzing(false);
          return;
        }
        const filesPayload = uploadedFiles.map(f => ({
          name: f.name,
          type: f.type,
          data: f.data
        }));
        result = await scenariosApi.analyzeUpload(filesPayload, userPrompt, abortControllerRef.current.signal);
      } else {
        // RAG / Other tabs currently disabled or handled similarly
        // Legacy warning can be here or removed
        setIsAnalyzing(false);
        return;
      }

      // DIRECTLY PROCESS SCENARIOS
      setDomContext(result.dom_context || '');

      const scenarios: Scenario[] = (result.scenarios || []).map((s: any, idx: number) => ({
        id: `scen_${Date.now()}_${idx}`,
        projectId: activeProject.id,
        title: s.title,
        description: s.description,
        testCases: (s.testCases || []).map((tc: any, tcIdx: number) => ({
          id: `tc_${Date.now()}_${idx}_${tcIdx}`,
          ...tc,
          status: 'draft'
        })),
        personaId: selectedPersona.id,
        createdAt: new Date().toISOString(),
        isApproved: false
      }));

      onUpdatePersistedScenarios(scenarios);
      if (scenarios.length > 0) onUpdatePersistedEditingId(scenarios[0].id);

    } catch (e: any) {
      if (e.name === 'AbortError' || e.message === 'canceled') {
        console.log('Analysis Aborted');
        return;
      }
      console.error(e);
      alert("Scenario Generation Failed: " + e.message);
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Helper functions restored
  const updateScenarioMetadata = (field: 'title' | 'description', value: string) => {
    if (!persistedEditingId) return;
    onUpdatePersistedScenarios(persistedScenarios.map(s => s.id === persistedEditingId ? { ...s, [field]: value } : s));
  };

  const updateTestCase = (tcId: string, field: keyof TestCase, value: any) => {
    if (!persistedEditingId) return;
    onUpdatePersistedScenarios(persistedScenarios.map(s => {
      if (s.id !== persistedEditingId) return s;
      return { ...s, testCases: s.testCases.map(tc => tc.id === tcId ? { ...tc, [field]: value } : tc) };
    }));
  };

  const moveTestCase = (index: number, direction: 'up' | 'down') => {
    if (!persistedEditingId) return;
    onUpdatePersistedScenarios(persistedScenarios.map(s => {
      if (s.id !== persistedEditingId) return s;
      const newTCs = [...s.testCases];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= newTCs.length) return s;
      [newTCs[index], newTCs[target]] = [newTCs[target], newTCs[index]];
      return { ...s, testCases: newTCs };
    }));
  };

  const deleteTestCase = (tcId: string) => {
    if (!persistedEditingId) return;
    onUpdatePersistedScenarios(persistedScenarios.map(s => s.id === persistedEditingId ? { ...s, testCases: s.testCases.filter(tc => tc.id !== tcId) } : s));
  };

  const addTestCase = () => {
    if (!persistedEditingId) return;
    const newTC: TestCase = {
      id: `tc_new_${Date.now()}`,
      title: 'New Test Node',
      description: '',
      preCondition: '로그인 완료 상태',
      inputData: 'N/A',
      steps: ['Action...'],
      expectedResult: 'Success...',
      status: 'draft'
    };
    onUpdatePersistedScenarios(persistedScenarios.map(s => s.id === persistedEditingId ? { ...s, testCases: [...s.testCases, newTC] } : s));
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-50 dark:bg-[#0c0e12] transition-colors">
      {/* Left Panel */}
      <div className="w-[440px] border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-[#111318] transition-colors">
        <div className="flex bg-gray-50 dark:bg-[#0c0e12] p-1 border-b border-gray-200 dark:border-gray-800 transition-colors">
          {/* ... tabs ... */}
          {[
            { id: 'upload', icon: FileUp, label: 'Upload Base' },
            { id: 'rag', icon: Database, label: 'RAG Base' },
            { id: 'browsing', icon: Globe, label: 'Browsing' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as GeneratorTab)}
              className={`flex-1 flex flex-col items-center py-3 gap-1 transition-all rounded-lg ${activeTab === tab.id ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-600 dark:hover:text-gray-400'}`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6 border-b border-gray-200 dark:border-gray-800 space-y-4 transition-colors">
          {activeTab === 'upload' && (
            /* ... upload UI ... */
            <div className="space-y-4 animate-in fade-in duration-300">
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-2xl p-6 text-center hover:border-indigo-500/50 hover:bg-indigo-600/5 transition-all cursor-pointer group">
                <FileUp className="w-6 h-6 text-gray-400 dark:text-gray-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mx-auto mb-2 transition-colors" />
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Specifications / Mockups</p>
                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
              </div>
              {uploadedFiles.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="relative w-14 h-14 shrink-0 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-lg group/file transition-colors">
                      {file.preview ? <img src={file.preview} className="w-full h-full object-cover" /> : <FileText className="w-full h-full p-3 text-indigo-400/40" />}
                      <button onClick={() => removeFile(idx)} className="absolute top-0 right-0 bg-black/60 p-0.5 opacity-0 group-hover/file:opacity-100 transition-opacity"><X className="w-3 h-3 text-white" /></button>
                    </div>
                  ))}
                </div>
              )}
              <textarea value={userPrompt} onChange={e => setUserPrompt(e.target.value)} placeholder="테스트 대상의 추가 정보나 상세 요구사항을 입력하세요..." className="w-full h-20 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-xs text-gray-900 dark:text-gray-300 outline-none focus:border-indigo-500 transition-all resize-none shadow-inner" />
            </div>
          )}

          {activeTab === 'rag' && (
            /* ... ragg UI ... */
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 p-3 bg-indigo-600/5 border border-indigo-500/10 rounded-xl">
                <Database className="w-4 h-4 text-indigo-400" />
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">Knowledge Base Integration</span>
              </div>
              <textarea value={ragQuery} onChange={e => setRagQuery(e.target.value)} placeholder="지식 베이스에서 검색할 기능이나 문서 키워드를 입력하세요..." className="w-full h-28 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-xs text-gray-900 dark:text-gray-300 outline-none focus:border-indigo-500 transition-all resize-none shadow-inner" />
            </div>
          )}

          {activeTab === 'browsing' && (
            /* ... browsing UI ... */
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Platform Entry URL</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-600 transition-colors" />
                  <input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="https://example.com" className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-3 pl-12 pr-4 text-sm text-indigo-600 dark:text-indigo-400 outline-none focus:border-indigo-500 transition-all" />
                </div>
              </div>
              <div className="p-4 bg-amber-600/5 border border-amber-500/10 rounded-xl flex gap-3">
                <Compass className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-[10px] text-gray-500 italic">"AI가 지정된 URL을 실제 탐색하여 테스트 가능한 UI 요소와 플로우를 동적으로 수집합니다."</p>
              </div>
              <textarea value={userPrompt} onChange={e => setUserPrompt(e.target.value)} placeholder="테스트 대상의 추가 정보나 상세 요구사항을 입력하세요..." className="w-full h-20 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-xs text-gray-900 dark:text-gray-300 outline-none focus:border-indigo-500 transition-all resize-none shadow-inner" />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">QA Insight Persona</label>
            {/* ... persona ... */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
              {personas.map(p => (
                <button key={p.id} onClick={() => setSelectedPersona(p)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase whitespace-nowrap transition-all border ${selectedPersona.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-500'}`}>{p.name}</button>
              ))}
            </div>
          </div>

          {isAnalyzing ? (
            <button
              onClick={handleStopAnalysis}
              className="w-full bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl font-black text-[11px] uppercase flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all active:scale-95"
            >
              <Square className="w-4 h-4 fill-current" /> STOP GENERATION
            </button>
          ) : (
            <button
              onClick={handleAnalyzeBase}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white py-3.5 rounded-xl font-black text-[11px] uppercase flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4" /> GENERATE SCENARIOS
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/10">

          {persistedScenarios.length > 0 && (
            <div className="space-y-3 animate-in fade-in duration-500">
              <div className="px-2 flex items-center justify-between border-l-2 border-purple-500 ml-1 pl-3 mb-4">
                <div>
                  <div className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Target className="w-3.5 h-3.5" /> Generated Scenarios
                  </div>
                  <p className="text-[8px] text-gray-600 uppercase font-black tracking-tighter mt-0.5">Automated Test Architecture</p>
                </div>
                <button onClick={handleAnalyzeBase} className="p-1.5 hover:bg-purple-500/10 rounded-lg text-gray-600 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
              </div>
              {persistedScenarios.map(s => (
                <button
                  key={s.id}
                  onClick={() => onUpdatePersistedEditingId(s.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all relative overflow-hidden group ${persistedEditingId === s.id ? 'bg-indigo-600/10 border-indigo-500 shadow-lg' : 'bg-white dark:bg-[#16191f] border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}
                >
                  <div className="text-xs font-black text-gray-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{s.title}</div>
                  <div className="text-[10px] text-gray-500 line-clamp-1 italic">"{s.description}"</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[8px] font-black bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-600 uppercase transition-colors">{s.testCases.length} TestCases</span>
                    <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-700 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isAnalyzing && persistedScenarios.length === 0 && (
            <div className="py-24 text-center opacity-20 flex flex-col items-center">
              <ClipboardList className="w-14 h-14 mb-4" />
              <p className="text-xs font-black uppercase tracking-[0.2em]">Ready to Generate</p>
              <p className="text-[9px] mt-2 max-w-[200px] leading-relaxed">자료를 업로드하거나 URL을 입력한 후 시나리오를 생성하세요.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Workbench */}
      <div className="flex-1 bg-gray-50 dark:bg-[#0c0e12] flex flex-col overflow-hidden transition-colors">
        {activeScenario ? (
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
            <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950/20 transition-colors">
              <div className="flex items-center justify-between gap-6">
                <div className="flex-1 flex items-center gap-6">
                  <div className="p-4 bg-indigo-600/10 rounded-3xl text-indigo-400 border border-indigo-500/20 flex-shrink-0">
                    <Bot className="w-8 h-8" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <input value={activeScenario.title} onChange={e => updateScenarioMetadata('title', e.target.value)} className="text-2xl font-black text-gray-900 dark:text-white bg-transparent border-b border-transparent focus:border-indigo-500 outline-none w-full italic uppercase tracking-tight transition-colors" placeholder="Scenario Title" />
                      <Edit3 className="w-4 h-4 text-gray-400 dark:text-gray-700 transition-colors" />
                    </div>
                    <div className="flex items-center gap-3">
                      <AlignLeft className="w-3.5 h-3.5 text-gray-400 dark:text-gray-600 transition-colors" />
                      <input value={activeScenario.description} onChange={e => updateScenarioMetadata('description', e.target.value)} className="text-xs text-gray-500 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none w-full" placeholder="Scenario Description" />
                    </div>
                  </div>
                </div>
                <button onClick={async () => {
                  try {
                    // Explicitly construct the payload to match backend CreateScenarioRequest
                    // and avoid sending extra fields (like createdAt, isApproved camelCase, etc.)
                    const payload = {
                      id: activeScenario.id,
                      project_id: activeProject.id,
                      title: activeScenario.title || "Untitled Scenario",
                      description: activeScenario.description || "",
                      testCases: activeScenario.testCases.map((tc, idx) => ({
                        id: tc.id || `tc_gen_${Date.now()}_${idx}`,
                        title: tc.title,
                        preCondition: tc.preCondition || "",
                        inputData: tc.inputData || "",
                        steps: tc.steps || [],
                        expectedResult: tc.expectedResult || "",
                        status: tc.status
                      })),
                      persona_id: selectedPersona.id,
                      is_approved: true,
                      tags: activeScenario.tags || []
                    };

                    const saved = await scenariosApi.create(payload);
                    onApproveScenario(saved);
                    // Remove from draft
                    onUpdatePersistedScenarios(persistedScenarios.filter(s => s.id !== activeScenario.id));
                    onUpdatePersistedEditingId(null);
                  } catch (e) {
                    console.error("Failed to approve scenario", e);
                    // You might want to show an alert here, but for now console error
                  }
                }} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-indigo-600/20 flex items-center gap-2 flex-shrink-0 transition-all active:scale-95">
                  <CheckCircle2 className="w-4 h-4" /> Approve & Move to Generator
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-gray-50/50 dark:bg-black/20 transition-colors">
              <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-400" /> Scenario Logic Workbench (Sequential TestNodes)
              </div>

              <div className="space-y-8">
                {activeScenario.testCases.map((tc, idx) => (
                  <div key={tc.id} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 group relative hover:border-gray-400 dark:hover:border-gray-700 transition-all shadow-sm">
                    <div className="flex items-start gap-6">
                      <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center text-xs font-black text-indigo-600 dark:text-indigo-500 shrink-0 transition-colors">{idx + 1}</div>
                      <div className="flex-1 space-y-6 min-w-0">
                        <div className="flex items-center justify-between">
                          <input className="bg-transparent border-b border-transparent focus:border-indigo-500 text-xl font-black text-gray-900 dark:text-white outline-none w-full mr-10 transition-colors" value={tc.title} onChange={e => updateTestCase(tc.id, 'title', e.target.value)} />
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => moveTestCase(idx, 'up')} disabled={idx === 0} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 dark:text-gray-500 disabled:opacity-10 transition-colors"><ArrowUp className="w-4 h-4" /></button>
                            <button onClick={() => moveTestCase(idx, 'down')} disabled={idx === activeScenario.testCases.length - 1} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 dark:text-gray-500 disabled:opacity-10 transition-colors"><ArrowDown className="w-4 h-4" /></button>
                            <button onClick={() => deleteTestCase(tc.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 ml-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>

                        {/* Test Case Content Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Left Column: Context & Data */}
                          <div className="space-y-6">
                            <div className="space-y-3">
                              <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                <ClipboardCopy className="w-3.5 h-3.5 text-amber-500" /> 1. Pre-condition
                              </div>
                              <textarea
                                className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-xs text-gray-700 dark:text-gray-400 focus:text-gray-900 dark:focus:text-white outline-none transition-all h-20 resize-none shadow-inner"
                                value={tc.preCondition}
                                onChange={e => updateTestCase(tc.id, 'preCondition', e.target.value)}
                              />
                            </div>
                            <div className="space-y-3">
                              <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                <DatabaseZap className="w-3.5 h-3.5 text-blue-500" /> 2. Input Data
                              </div>
                              <textarea
                                className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-xs text-gray-700 dark:text-gray-400 focus:text-gray-900 dark:focus:text-white outline-none transition-all h-20 resize-none shadow-inner"
                                value={tc.inputData}
                                onChange={e => updateTestCase(tc.id, 'inputData', e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Right Column: Execution & Expectation */}
                          <div className="space-y-6">
                            <div className="space-y-3">
                              <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                <Layout className="w-3.5 h-3.5 text-indigo-400" /> 3. Execution Steps
                              </div>
                              <div className="bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 space-y-2 shadow-inner transition-colors">
                                {tc.steps.map((step, sIdx) => (
                                  <div key={sIdx} className="flex gap-3 group/step">
                                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-700 mt-0.5 transition-colors">{sIdx + 1}.</span>
                                    <input className="bg-transparent border-none text-[12px] text-gray-600 dark:text-gray-400 focus:text-gray-900 dark:focus:text-white outline-none w-full transition-colors" value={step} onChange={e => { const newSteps = [...tc.steps]; newSteps[sIdx] = e.target.value; updateTestCase(tc.id, 'steps', newSteps); }} />
                                    <button onClick={() => updateTestCase(tc.id, 'steps', tc.steps.filter((_, i) => i !== sIdx))} className="opacity-0 group-hover/step:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                                  </div>
                                ))}
                                <button onClick={() => updateTestCase(tc.id, 'steps', [...tc.steps, 'New Action...'])} className="text-[9px] font-bold text-indigo-500 uppercase hover:underline flex items-center gap-1 mt-2"><Plus className="w-2.5 h-2.5" /> Add Action</button>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> 4. Expected Result
                              </div>
                              <textarea className="w-full bg-green-50 dark:bg-green-600/5 border border-green-200 dark:border-green-500/10 rounded-2xl p-4 text-[12px] text-green-700 dark:text-green-400/80 outline-none focus:border-green-500 transition-all h-24 resize-none shadow-sm font-medium" value={tc.expectedResult} onChange={e => updateTestCase(tc.id, 'expectedResult', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addTestCase} className="w-full py-5 border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-[2rem] text-gray-500 dark:text-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-600/5 transition-all flex items-center justify-center gap-3 font-black uppercase text-xs tracking-[0.2em] shadow-inner"><Plus className="w-5 h-5" /> Insert New Logic Block</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-[2.5rem] flex items-center justify-center text-indigo-500/20 mb-8 shadow-2xl transition-colors">
              <Sparkles className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-gray-400 dark:text-gray-600 uppercase tracking-tighter italic transition-colors">Scenario Orchestration</h2>
            <p className="max-w-md text-gray-500 dark:text-gray-700 text-sm mt-4 font-medium leading-relaxed uppercase tracking-widest transition-colors">
              왼쪽에서 데이터 소스를 분석하고 1단계 기능 추출을 완료하세요.<br />
              추출된 핵심 항목을 바탕으로 4단계 구조의 최적 테스트 시나리오가 설계됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioGenerator;
