import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  FileUp, Database, Globe, Search, RefreshCw, Sparkles, Square,
  CheckSquare, Trash2, Edit3, ArrowUp, ArrowDown, Plus, X, AlignLeft,
  ClipboardCopy, DatabaseZap, Layout, CheckCircle2, ChevronRight,
  Smartphone, Monitor, Filter, CheckCircle, ArrowRight, Target,
  Save, Loader2, Info, MousePointerClick
} from 'lucide-react';
import { Project, Persona, Scenario, TestCase } from '../types';
import { scenariosApi } from '../api/scenarios';
import MapVisualizer from './MapVisualizer';

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
  persistedFeatures: FeatureSummary[];
  onUpdatePersistedFeatures: (features: FeatureSummary[]) => void;
  persistedScenarios: Scenario[];
  onUpdatePersistedScenarios: (scenarios: Scenario[]) => void;
  persistedEditingId: string | null;
  onUpdatePersistedEditingId: (id: string | null) => void;
  onAlert?: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

type GenerationMode = 'upload' | 'rag' | 'browsing' | 'map';
type PlatformType = 'WEB' | 'APP';

const ScenarioGenerator: React.FC<ScenarioGeneratorProps> = ({
  activeProject, personas, onApproveScenario,
  persistedScenarios, onUpdatePersistedScenarios,
  persistedEditingId, onUpdatePersistedEditingId,
  onAlert
}) => {
  // --- Global Top Bar State ---
  const [platform, setPlatform] = useState<PlatformType>('WEB');
  const [targetInput, setTargetInput] = useState('');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(personas[0]?.id || '');
  const [enableAiTestAll, setEnableAiTestAll] = useState(false);

  // Sync persona selection when personas are loaded/change
  React.useEffect(() => {
    if (!selectedPersonaId && personas.length > 0) {
      setSelectedPersonaId(personas[0].id);
    }
  }, [personas, selectedPersonaId]);

  // --- Left Panel State ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string, type: string, data: string, preview?: string }[]>([]);
  const [selectedRagCategories, setSelectedRagCategories] = useState<string[]>([]);
  const [selectedMapIds, setSelectedMapIds] = useState<string[]>([]);
  
  const [savedMaps, setSavedMaps] = useState<any[]>([]); // For Map Selection
  const [ragCategories, setRagCategories] = useState<string[]>(['공통기능', '전시', '주문', '회원']); // Mock categories for now
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);


  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Center Panel (Master List) State ---
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [listSearch, setListSearch] = useState('');

  // Derived states
  const activeScenario = useMemo(() => persistedScenarios.find(s => s.id === persistedEditingId) || null, [persistedScenarios, persistedEditingId]);
  const filteredScenarios = useMemo(() => persistedScenarios.filter(s => s.title.toLowerCase().includes(listSearch.toLowerCase())), [persistedScenarios, listSearch]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = await Promise.all(Array.from(files).map(async (file: File) => {
      return new Promise<{ name: string, type: string, data: string, preview?: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = (e.target?.result as string).split(',')[1];
          resolve({
            name: file.name, type: file.type, data: base64,
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
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  React.useEffect(() => {
    if (activeProject?.id) {
      loadSavedMaps();
    }
  }, [activeProject?.id]);

  const loadSavedMaps = async () => {
    setIsLoadingMaps(true);
    try {
      const maps = await scenariosApi.listActionMaps(activeProject.id);
      setSavedMaps(maps);
    } catch (e) {
      console.error("Failed to load maps", e);
    } finally {
      setIsLoadingMaps(false);
    }
  };

  const handleGenerate = async () => {
    // Validation: Require at least one source
    if (
      selectedRagCategories.length === 0 &&
      selectedMapIds.length === 0 &&
      uploadedFiles.length === 0 &&
      !userPrompt.trim()
    ) {
      if (onAlert) onAlert("Input Required", "RAG 카테고리, Map, 업로드 파일, 프롬프트 중 최소 하나는 입력해야 합니다.", 'info');
      return;
    }

    setIsAnalyzing(true);
    abortControllerRef.current = new AbortController();
    try {
      let result = { scenarios: [] };
      // Placeholder for new multi-source API call
      // result = await scenariosApi.generateMultiSource(...)
      
      const filesPayload = uploadedFiles.map(f => ({ name: f.name, type: f.type, data: f.data }));
      if (uploadedFiles.length > 0) {
        result = await scenariosApi.analyzeUpload(filesPayload, userPrompt, activeProject.id, abortControllerRef.current.signal);
      } else {
        // Mock generation for other sources until API is ready
        await new Promise(r => setTimeout(r, 1500));
        if (onAlert) onAlert("AI Generation", "복합 소스 기반 시나리오 생성을 요청합니다.", "info");
      }

      const newScenarios: Scenario[] = (result.scenarios || []).map((s: any, idx: number) => ({
        id: `scen_${Date.now()}_${idx}`,
        projectId: activeProject.id,
        title: s.title,
        description: s.description,
        category: s.category,
        testCases: (s.testCases || []).map((tc: any, tcIdx: number) => ({
          ...tc,
          id: `tc_${Date.now()}_${idx}_${tcIdx}`,
          status: 'draft'
        })),
        personaId: selectedPersonaId,
        createdAt: new Date().toISOString(),
        isApproved: false,
        tags: ["AI"],
        enable_ai_test: enableAiTestAll
      }));

      onUpdatePersistedScenarios([...persistedScenarios, ...newScenarios]);
      if (newScenarios.length > 0 && !persistedEditingId) {
        onUpdatePersistedEditingId(newScenarios[0].id);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError' && e.message !== 'canceled') {
        if (onAlert) onAlert("Generation Error", e.message, 'error');
      }
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  // --- Bulk Actions ---
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    const toApprove = persistedScenarios.filter(s => selectedIds.includes(s.id));

    for (const sc of toApprove) {
      const payload = {
        id: sc.id, project_id: activeProject.id, title: sc.title || "Untitled", description: sc.description || "",
        testCases: sc.testCases.map((tc, idx) => ({
          id: tc.id || `tc_gen_${Date.now()}_${idx}`, title: tc.title, preCondition: tc.preCondition || "",
          inputData: tc.inputData || "", steps: tc.steps || [], expectedResult: tc.expectedResult || "", status: tc.status,
          selectors: tc.selectors
        })),
        persona_id: sc.personaId || selectedPersonaId || (personas.length > 0 ? personas[0].id : ""),
        category: sc.category,
        platform: platform,
        target: targetInput,
        is_approved: true, tags: [...(sc.tags || []), "AI"].filter((v, i, a) => a.indexOf(v) === i),
        enable_ai_test: sc.enable_ai_test ?? enableAiTestAll
      };
      try {
        const saved = await scenariosApi.create(payload);
        onApproveScenario(saved);
      } catch (e) { console.error("Failed to approve", sc.id); }
    }
    onUpdatePersistedScenarios(persistedScenarios.filter(s => !selectedIds.includes(s.id)));
    setSelectedIds([]);
    if (persistedEditingId && selectedIds.includes(persistedEditingId)) onUpdatePersistedEditingId(null);
  };

  const handleBulkDelete = () => {
    onUpdatePersistedScenarios(persistedScenarios.filter(s => !selectedIds.includes(s.id)));
    setSelectedIds([]);
    if (persistedEditingId && selectedIds.includes(persistedEditingId)) onUpdatePersistedEditingId(null);
  };

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredScenarios.length && filteredScenarios.length > 0) setSelectedIds([]);
    else setSelectedIds(filteredScenarios.map(s => s.id));
  };

  // --- Editors Helper ---
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
    const newTC: TestCase = { id: `tc_new_${Date.now()}`, title: 'New Test Node', description: '', preCondition: '', inputData: '', steps: [''], expectedResult: '', status: 'draft' };
    onUpdatePersistedScenarios(persistedScenarios.map(s => s.id === persistedEditingId ? { ...s, testCases: [...s.testCases, newTC] } : s));
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-50 dark:bg-[#0c0e12]">
      {/* 1. Global Top Bar */}
      <div className="flex items-center gap-4 px-6 py-4 bg-white dark:bg-[#16191f] border-b border-gray-200 dark:border-gray-800 shrink-0">
        <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
          <button onClick={() => setPlatform('WEB')} className={`px-4 py-1.5 text-xs font-black uppercase rounded-md flex items-center gap-2 transition-all ${platform === 'WEB' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500'}`}><Monitor className="w-3.5 h-3.5" /> Web</button>
          <button onClick={() => setPlatform('APP')} className={`px-4 py-1.5 text-xs font-black uppercase rounded-md flex items-center gap-2 transition-all ${platform === 'APP' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500'}`}><Smartphone className="w-3.5 h-3.5" /> App</button>
        </div>
        <div className="flex-1 max-w-xl relative">
          <input
            value={targetInput}
            onChange={e => setTargetInput(e.target.value)}
            placeholder={platform === 'WEB' ? "Enter Target URL (e.g., https://example.com)" : "Enter App Package/Bundle ID"}
            className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2 pl-4 pr-10 text-xs text-gray-900 dark:text-gray-300 outline-none focus:border-indigo-500"
          />
          <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[10px] font-black text-gray-500 uppercase">Persona:</span>
          <select
            value={selectedPersonaId}
            onChange={e => setSelectedPersonaId(e.target.value)}
            className="bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-lg py-2 px-3 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none"
          >
            {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 2. Left Panel: Unified Source Input */}
        <div className="w-[340px] bg-white dark:bg-[#111318] border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-black/20">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" /> AI Source Selection
            </h3>
            <p className="text-[9px] text-gray-500 font-bold mt-1">Select at least one input source for generation.</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 p-4 shadow-inner custom-scrollbar bg-gray-50/20 dark:bg-transparent">
            
            {/* 1. RAG Selection */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-indigo-500" /> 1. Knowledge Repository (RAG)
              </label>
              <div className="p-3 bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl space-y-2">
                {ragCategories.map(cat => (
                  <label key={cat} className="flex items-center gap-2 text-[10px] font-bold text-gray-600 dark:text-gray-400 cursor-pointer hover:text-indigo-600">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedRagCategories.includes(cat)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedRagCategories([...selectedRagCategories, cat]);
                        else setSelectedRagCategories(selectedRagCategories.filter(c => c !== cat));
                      }}
                    />
                    {cat}
                  </label>
                ))}
              </div>
            </div>

            {/* 2. Map Selection */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-emerald-500" /> 2. Action Flow Maps
              </label>
              <div className="max-h-[160px] overflow-y-auto custom-scrollbar border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-[#0c0e12]">
                {isLoadingMaps ? (
                  <div className="p-4 text-[10px] text-gray-400 animate-pulse text-center">Loading maps...</div>
                ) : savedMaps.length === 0 ? (
                  <div className="p-4 text-[10px] text-gray-400 italic text-center">No maps found.</div>
                ) : (
                  <div className="p-1.5 space-y-1">
                    {savedMaps.map(m => (
                      <label key={m.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          className="mt-0.5 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                          checked={selectedMapIds.includes(m.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedMapIds([...selectedMapIds, m.id]);
                            else setSelectedMapIds(selectedMapIds.filter(id => id !== m.id));
                          }}
                        />
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase text-gray-700 dark:text-gray-200 truncate">{m.title}</div>
                          <div className="text-[8px] text-gray-400 truncate">{m.url}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Upload Selection */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2">
                <FileUp className="w-3.5 h-3.5 text-amber-500" /> 3. Direct Uploads
              </label>
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center hover:bg-amber-50 dark:hover:bg-amber-900/10 cursor-pointer transition-colors bg-white dark:bg-[#0c0e12]">
                <FileUp className="w-4 h-4 text-amber-400 mx-auto mb-1.5" />
                <p className="text-[9px] font-bold text-gray-500 uppercase">Upload Specs / Mockups</p>
                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
              </div>
              {uploadedFiles.length > 0 && (
                <div className="flex gap-2 flex-wrap pb-1">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="relative w-10 h-10 bg-gray-100 dark:bg-gray-900 border rounded-lg overflow-hidden group">
                      {file.preview ? <img src={file.preview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center p-1 text-[7px] break-all leading-tight">{file.name}</div>}
                      <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="absolute top-0 right-0 bg-red-500 p-0.5"><X className="w-3 h-3 text-white" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Custom Prompt */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest flex items-center justify-between">
                <span className="flex items-center gap-2"><Edit3 className="w-3.5 h-3.5 text-blue-500" /> 4. Custom Instructions</span>
              </label>
              <textarea 
                value={userPrompt} 
                onChange={e => setUserPrompt(e.target.value)} 
                placeholder="e.g. Focus on edge cases and error handling for the payment flow..." 
                className="w-full h-24 bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-[10px] resize-none outline-none focus:border-blue-500 transition-colors shadow-inner" 
              />
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#16191f]">
            {isAnalyzing ? (
              <button onClick={() => abortControllerRef.current?.abort()} className="w-full bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-red-600/10 transition-all"><Square className="w-4 h-4 fill-current" /> Stop Generator</button>
            ) : (
              <button 
                onClick={handleGenerate} 
                disabled={selectedRagCategories.length === 0 && selectedMapIds.length === 0 && uploadedFiles.length === 0 && !userPrompt.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:text-gray-500 text-white py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4" /> Generate Scenarios
              </button>
            )}
          </div>
        </div>

        {/* 3. Center Panel: Master List */}
        <div className="w-[360px] bg-white dark:bg-[#16191f] border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
          <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest">Draft Lab ({filteredScenarios.length})</h3>
              <div className="px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded-lg">AI READY</div>
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="Filter drafts..." className="w-full bg-gray-100 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2 pl-10 pr-4 text-[11px] outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div className="flex items-center justify-between mt-1">
              <button onClick={toggleAll} className="text-[10px] font-black uppercase tracking-tighter text-gray-500 flex items-center gap-2 hover:text-indigo-600 transition-colors">
                {selectedIds.length === filteredScenarios.length && filteredScenarios.length > 0 ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                Select Scope
              </button>
              {selectedIds.length > 0 && (
                <div className="flex gap-2 animate-in slide-in-from-right-4 duration-200">
                  <button onClick={handleBulkDelete} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  <button onClick={handleBulkApprove} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/10 transition-all"><ArrowRight className="w-3.5 h-3.5" /> Proceed</button>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar bg-gray-50/30 dark:bg-black/10">
            {filteredScenarios.map(s => (
              <div key={s.id} onClick={() => onUpdatePersistedEditingId(s.id)} className={`p-4 rounded-2xl border transition-all cursor-pointer group ${persistedEditingId === s.id ? 'border-indigo-500 bg-white dark:bg-indigo-900/10 shadow-md ring-1 ring-indigo-500/20' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-[#111318] hover:border-gray-300 dark:hover:border-gray-700 shadow-sm'}`}>
                <div className="flex items-start gap-3">
                  <div onClick={(e) => toggleSelection(e, s.id)} className="mt-0.5 text-gray-300 hover:text-indigo-600 cursor-pointer shrink-0 transition-colors">
                    {selectedIds.includes(s.id) ? <CheckSquare className="w-4.5 h-4.5 text-indigo-600" /> : <Square className="w-4.5 h-4.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {s.category && <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[8px] font-black rounded uppercase tracking-widest">{s.category}</span>}
                      <span className="text-[8px] font-black text-gray-400 uppercase ml-auto">{s.testCases.length} Nodes</span>
                    </div>
                    <div className="text-xs font-black text-gray-900 dark:text-gray-200 truncate group-hover:text-indigo-600 transition-colors">{s.title || 'Untitled Prototype'}</div>
                    <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">{s.description || 'No description provided'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Right Panel: Detail Editor */}
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-[#0c0e12] overflow-hidden relative">
          {activeScenario ? (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
              <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111318] shadow-sm relative z-10 transition-colors">
                <div className="flex items-start gap-6">
                  <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/20"><Target className="w-7 h-7" /></div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      {activeScenario.category && <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-lg uppercase tracking-widest transition-colors mb-1">PROTOTYPE: {activeScenario.category}</span>}
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">ID: {activeScenario.id}</div>
                    </div>
                    <input value={activeScenario.title} onChange={e => updateScenarioMetadata('title', e.target.value)} className="w-full text-2xl font-black text-gray-900 dark:text-gray-100 bg-transparent outline-none border-b - 2 border-transparent focus:border-indigo-500 transition-all pb-1" placeholder="Define scenario signature..." />
                    <input value={activeScenario.description} onChange={e => updateScenarioMetadata('description', e.target.value)} className="w-full text-sm text-gray-500 font-medium bg-transparent outline-none border-b border-transparent focus:border-indigo-500 transition-all" placeholder="Project architectural description..." />
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar bg-gray-50/50 dark:bg-black/20">
                {activeScenario.testCases.map((tc, idx) => (
                  <div key={tc.id || idx} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-sm space-y-8 group/card transition-all hover:shadow-xl hover:border-indigo-500/20 relative">
                    <div className="absolute top-8 left-0 w-1 h-8 bg-indigo-600 rounded-r-full" />
                    <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-5 w-full mr-10">
                        <span className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 font-black flex items-center justify-center text-sm shadow-inner">{idx + 1}</span>
                        <input className="flex-1 bg-transparent font-black text-lg text-gray-900 dark:text-gray-100 outline-none w-full border-b border-transparent focus:border-indigo-500 pb-1" value={tc.title} onChange={e => updateTestCase(tc.id, 'title', e.target.value)} placeholder="Action Node Label" />
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                          <button onClick={() => moveTestCase(idx, 'up')} disabled={idx === 0} className="p-2 text-gray-500 hover:text-indigo-600 disabled:opacity-20 transition-colors"><ArrowUp className="w-4 h-4" /></button>
                          <button onClick={() => moveTestCase(idx, 'down')} disabled={idx === activeScenario.testCases.length - 1} className="p-2 text-gray-500 hover:text-indigo-600 disabled:opacity-20 transition-colors"><ArrowDown className="w-4 h-4" /></button>
                        </div>
                        <button onClick={() => deleteTestCase(tc.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl ml-2 transition-all"><Trash2 className="w-4.5 h-4.5" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-10">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2 tracking-widest mb-3"><ClipboardCopy className="w-4 h-4 text-indigo-400" /> Pre-requisites</label>
                        <textarea className="w-full h-24 bg-gray-50 dark:bg-[#0c0e12] border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none shadow-inner" value={tc.preCondition} onChange={e => updateTestCase(tc.id, 'preCondition', e.target.value)} placeholder="System state requirements..." />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2 tracking-widest mb-3"><DatabaseZap className="w-4 h-4 text-indigo-400" /> Test Vectors</label>
                        <textarea className="w-full h-24 bg-gray-50 dark:bg-[#0c0e12] border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none shadow-inner" value={tc.inputData} onChange={e => updateTestCase(tc.id, 'inputData', e.target.value)} placeholder="Specific payload or input values..." />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2 tracking-widest mb-3"><Layout className="w-4 h-4 text-indigo-400" /> Procedural Steps</label>
                        <div className="p-6 rounded-3xl bg-gray-50 dark:bg-[#0c0e12] border border-gray-100 dark:border-gray-800 shadow-inner space-y-3">
                          {tc.steps.map((step, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-4 group/step">
                              <span className="text-[11px] font-black text-gray-400 w-6 tabular-nums">{sIdx + 1}</span>
                              <input className="flex-1 bg-transparent border-b border-transparent focus:border-indigo-500/30 outline-none text-[12px] font-medium text-gray-800 dark:text-gray-200 py-1 transition-all" value={step} onChange={e => { const ns = [...tc.steps]; ns[sIdx] = e.target.value; updateTestCase(tc.id, 'steps', ns); }} placeholder="Execute action..." />
                              <button onClick={() => updateTestCase(tc.id, 'steps', tc.steps.filter((_, i) => i !== sIdx))} className="opacity-0 group-hover/step:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                          <button onClick={() => updateTestCase(tc.id, 'steps', [...tc.steps, ''])} className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-500 flex items-center gap-2 mt-4 transition-colors"><Plus className="w-4 h-4" /> Expand Flow</button>
                        </div>
                      </div>
                      <div className="col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-2 tracking-widest mb-3"><CheckCircle2 className="w-4 h-4" /> Oracle / Validation Policy</label>
                        <textarea className="w-full h-24 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl p-4 text-xs font-bold text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all resize-none shadow-inner" value={tc.expectedResult} onChange={e => updateTestCase(tc.id, 'expectedResult', e.target.value)} placeholder="Define exact validation criteria..." />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addTestCase} className="w-full py-10 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl text-gray-400 hover:text-indigo-600 hover:border-indigo-500/40 hover:bg-white dark:hover:bg-[#16191f] transition-all flex flex-col items-center justify-center gap-3"><Plus className="w-8 h-8 opacity-20" /><span className="text-[11px] font-black uppercase tracking-widest">Append Architectural Node</span></button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 space-y-6 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-800 p-6 opacity-40"><Sparkles className="w-full h-full text-gray-400" /></div>
              <div className="text-center space-y-2">
                <h4 className="text-sm font-black text-gray-500 uppercase tracking-widest">Awaiting Analysis Selection</h4>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-tighter">Choose a generated draft or upload new specs to begin architectural refinement.</p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default ScenarioGenerator;
