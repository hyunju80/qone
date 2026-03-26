import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  FileUp, Database, Search, Sparkles, Square,
  CheckSquare, Trash2, Edit3, ArrowUp, ArrowDown, Plus, X, AlignLeft,
  Layout, CheckCircle, ArrowRight, Target,
  Loader2, ChevronDown, ChevronRight, Bot, AlertTriangle, CheckCircle2, Filter
} from 'lucide-react';
import { Project, Persona, Scenario, TestCase } from '../types';
import { scenariosApi } from '../api/scenarios';

interface FeatureSummary {
  name: string;
  description: string;
  flows: string[];
}

interface HierarchyItem {
  name: string;
  level: string;
  item_ids: string[];
  children: HierarchyItem[];
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

const ScenarioGenerator: React.FC<ScenarioGeneratorProps> = ({
  activeProject, personas, onApproveScenario,
  persistedScenarios, onUpdatePersistedScenarios,
  persistedEditingId, onUpdatePersistedEditingId,
  onAlert,
  // Legacy props kept for compatibility
  focusedTaskId, onClearFocus, persistedFeatures, onUpdatePersistedFeatures
}) => {
  // --- States ---
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(personas[0]?.id || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string, type: string, data: string, preview?: string }[]>([]);
  const [selectedKnowledgeItemIds, setSelectedKnowledgeItemIds] = useState<string[]>([]);
  const [selectedMapIds, setSelectedMapIds] = useState<string[]>([]);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(['main']);
  const [knowledgeHierarchy, setKnowledgeHierarchy] = useState<HierarchyItem[]>([]);
  const [isLoadingHierarchy, setIsLoadingHierarchy] = useState(false);
  const [savedMaps, setSavedMaps] = useState<any[]>([]);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    if (activeProject?.id) {
      loadKnowledgeHierarchy();
      loadSavedMaps();
    }
  }, [activeProject?.id]);

  useEffect(() => {
    if (!selectedPersonaId && personas.length > 0) {
      setSelectedPersonaId(personas[0].id);
    }
  }, [personas]);

  // --- Data Loading ---
  const loadKnowledgeHierarchy = async () => {
    setIsLoadingHierarchy(true);
    try {
      const resp = await scenariosApi.getHierarchy(activeProject.id);
      setKnowledgeHierarchy(resp);
    } catch (e) {
      console.error("Failed to load hierarchy", e);
    } finally {
      setIsLoadingHierarchy(false);
    }
  };

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

  // --- Handlers ---
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    const newFiles = await Promise.all(files.map(async (file: File) => {
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
  };

  const handleGenerate = async () => {
    if (selectedKnowledgeItemIds.length === 0 && selectedMapIds.length === 0 && uploadedFiles.length === 0 && !userPrompt.trim()) {
      if (onAlert) onAlert("Input Required", "At least one knowledge source or specific instruction is required.", 'info');
      return;
    }

    setIsAnalyzing(true);
    abortControllerRef.current = new AbortController();
    try {
      let combinedPrompt = userPrompt;
      if (selectedStrategies.length > 0) {
        combinedPrompt += `\n\nGeneration Strategy: Focus on ${selectedStrategies.join(', ')}.`;
      }

      let result;
      if (selectedKnowledgeItemIds.length > 0) {
        result = await scenariosApi.analyzeKnowledge(selectedKnowledgeItemIds, combinedPrompt, activeProject.id, abortControllerRef.current.signal);
      } else if (uploadedFiles.length > 0) {
        const filesPayload = uploadedFiles.map(f => ({ name: f.name, type: f.type, data: f.data }));
        result = await scenariosApi.analyzeUpload(filesPayload, combinedPrompt, activeProject.id, abortControllerRef.current.signal);
      } else {
        await new Promise(r => setTimeout(r, 2000));
        result = { scenarios: [] };
      }

      const newScenarios: Scenario[] = (result.scenarios || []).map((s: any, idx: number) => ({
        id: `scen_${Date.now()}_${idx}`,
        projectId: activeProject.id,
        title: s.title,
        description: s.description,
        category: s.category || 'common',
        testCases: (s.testCases || []).map((tc: any, tcIdx: number) => ({
          ...tc,
          id: `tc_${Date.now()}_${idx}_${tcIdx}`,
          status: 'draft'
        })),
        personaId: selectedPersonaId,
        createdAt: new Date().toISOString(),
        isApproved: false,
        tags: ["AI"],
        enable_ai_test: false
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

  // --- Registration / Deletion logic ---
  const handleApprove = async (scenId?: string) => {
    const idsToRegister = scenId ? [scenId] : selectedIds;
    if (idsToRegister.length === 0) return;

    const toProcess = persistedScenarios.filter(s => idsToRegister.includes(s.id));
    for (const sc of toProcess) {
      const payload = {
        ...sc,
        is_approved: true,
        project_id: activeProject.id,
        persona_id: sc.personaId || selectedPersonaId
      };
      try {
        const saved = await scenariosApi.create(payload);
        onApproveScenario(saved);
      } catch (e) {
        console.error("Failed to register scenario", sc.id, e);
      }
    }

    onUpdatePersistedScenarios(persistedScenarios.filter(s => !idsToRegister.includes(s.id)));
    setSelectedIds(prev => prev.filter(id => !idsToRegister.includes(id)));
    if (scenId === persistedEditingId || (scenId === undefined && selectedIds.includes(persistedEditingId || ''))) {
      onUpdatePersistedEditingId(null);
    }
  };

  const handleDelete = (scenId?: string) => {
    const idsToRemove = scenId ? [scenId] : selectedIds;
    onUpdatePersistedScenarios(persistedScenarios.filter(s => !idsToRemove.includes(s.id)));
    setSelectedIds(prev => prev.filter(id => !idsToRemove.includes(id)));
    if (scenId === persistedEditingId || (scenId === undefined && selectedIds.includes(persistedEditingId || ''))) {
      onUpdatePersistedEditingId(null);
    }
  };

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === persistedScenarios.length && persistedScenarios.length > 0) setSelectedIds([]);
    else setSelectedIds(persistedScenarios.map(s => s.id));
  };

  // --- Editor Helpers ---
  const updateScenarioMetadata = (scenId: string, field: 'title' | 'description', value: string) => {
    onUpdatePersistedScenarios(persistedScenarios.map(s => s.id === scenId ? { ...s, [field]: value } : s));
  };

  const updateTestCase = (scenId: string, tcId: string, field: keyof TestCase, value: any) => {
    onUpdatePersistedScenarios(persistedScenarios.map(s => {
      if (s.id !== scenId) return s;
      return { ...s, testCases: s.testCases.map(tc => tc.id === tcId ? { ...tc, [field]: value } : tc) };
    }));
  };

  const moveTestCase = (scenId: string, index: number, direction: 'up' | 'down') => {
    onUpdatePersistedScenarios(persistedScenarios.map(s => {
      if (s.id !== scenId) return s;
      const newTCs = [...s.testCases];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= newTCs.length) return s;
      [newTCs[index], newTCs[target]] = [newTCs[target], newTCs[index]];
      return { ...s, testCases: newTCs };
    }));
  };

  const deleteTestCase = (scenId: string, tcId: string) => {
    onUpdatePersistedScenarios(persistedScenarios.map(s => s.id === scenId ? { ...s, testCases: s.testCases.filter(tc => tc.id !== tcId) } : s));
  };

  const addTestCase = (scenId: string) => {
    const newTC: TestCase = { id: `tc_new_${Date.now()}`, title: 'New Test Node', description: '', preCondition: '', inputData: '', steps: [''], expectedResult: '', status: 'draft' };
    onUpdatePersistedScenarios(persistedScenarios.map(s => s.id === scenId ? { ...s, testCases: [...s.testCases, newTC] } : s));
  };

  // --- Rendering Helpers ---
  const onToggleKnowledgeItem = (checked: boolean, item_ids: string[]) => {
    if (checked) {
      const toAdd = item_ids.filter(id => !selectedKnowledgeItemIds.includes(id));
      setSelectedKnowledgeItemIds([...selectedKnowledgeItemIds, ...toAdd]);
    } else {
      setSelectedKnowledgeItemIds(selectedKnowledgeItemIds.filter(id => !item_ids.includes(id)));
    }
  };



  return (
    <div className="h-full w-full bg-gray-50/50 dark:bg-[#0c0e12] p-8 overflow-hidden flex flex-col transition-all duration-700">
      <div className="flex-1 flex gap-8 min-h-0 overflow-hidden">
        {/* 1. Left Panel: AI Source Selection */}
        <div className="w-[420px] flex flex-col shrink-0 overflow-y-auto custom-scrollbar pr-2 pb-2">
          <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col shadow-sm transition-all overflow-hidden mb-8 shrink-0">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white/50 dark:bg-white/5 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl transition-all">
                  <Bot className="w-6 h-6 text-indigo-500" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-[13px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-[0.15em] leading-tight">
                    Source Selection
                  </h2>
                  <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight">
                    Select sources to generate AI scenarios
                  </p>
                </div>
              </div>
              {isAnalyzing && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
            </div>

            <div className="p-8 space-y-10">
              {/* 1. Knowledge Repository */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-emerald-500" /> 1. Knowledge Repository
                </label>
                <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-black/20">
                  <div className="max-h-[220px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {isLoadingHierarchy ? (
                      <div className="p-4 text-[10px] text-gray-400 animate-pulse text-center">Loading Knowledge...</div>
                    ) : knowledgeHierarchy.length === 0 ? (
                      <div className="p-4 text-[10px] text-gray-400 text-center py-4 italic">No knowledge items available.</div>
                    ) : (
                      <div className="space-y-0.5">
                        {knowledgeHierarchy.map(item => (
                          <HierarchyNode key={item.name + item.level} item={item} depth={0} selectedIds={selectedKnowledgeItemIds} onToggleSelected={onToggleKnowledgeItem} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Action Flow Maps */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2">
                  <AlignLeft className="w-3.5 h-3.5 text-orange-500" /> 2. Action Flow Maps
                </label>
                <div className="grid grid-cols-1 gap-1.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
                  {isLoadingMaps ? (
                    <div className="p-4 text-[10px] text-gray-400 animate-pulse text-center">Loading maps...</div>
                  ) : savedMaps.length === 0 ? (
                    <div className="text-[10px] text-gray-400 text-center py-4 italic">No maps available.</div>
                  ) : savedMaps.map(map => (
                    <div
                      key={map.id}
                      onClick={() => {
                        if (selectedMapIds.includes(map.id)) setSelectedMapIds(selectedMapIds.filter(id => id !== map.id));
                        else setSelectedMapIds([...selectedMapIds, map.id]);
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${selectedMapIds.includes(map.id) ? 'bg-orange-50 dark:bg-orange-600/10 border-orange-200 dark:border-orange-500/30' : 'bg-gray-50/50 dark:bg-black/20 border-gray-100 dark:border-gray-800 hover:border-orange-200'}`}
                    >
                      <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${selectedMapIds.includes(map.id) ? 'bg-orange-500 border-orange-500' : 'border-gray-300 dark:border-gray-700'}`}>
                        {selectedMapIds.includes(map.id) && <CheckSquare className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate uppercase tracking-tight">{map.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Direct Uploads */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2">
                  <FileUp className="w-3.5 h-3.5 text-indigo-500" /> 3. Direct Uploads
                </label>
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-black/20 rounded-2xl p-6 text-center hover:border-indigo-500/40 hover:bg-indigo-50/50 transition-all cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept="image/*,application/pdf" />
                  <FileUp className="w-6 h-6 text-gray-300 group-hover:text-indigo-500 mx-auto mb-2 transition-colors" />
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Drop screenshots or PDFs</p>
                  <p className="text-[8px] text-gray-400 mt-1 italic">Extracted UI text will follow the generation strategy.</p>
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="relative w-10 h-10 bg-gray-100 dark:bg-gray-900 border rounded-lg overflow-hidden group">
                        {file.preview ? <img src={file.preview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center p-1 text-[7px] break-all leading-tight">{file.name}</div>}
                        <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="absolute top-0 right-0 bg-red-500 p-0.5"><X className="w-3 h-3 text-white" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Persona Selection */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-purple-500" /> 4. Testing Persona
                </label>
                <select
                  value={selectedPersonaId}
                  onChange={e => setSelectedPersonaId(e.target.value)}
                  className="w-full bg-gray-50/50 dark:bg-black/20 border border-gray-100 dark:border-gray-800 rounded-xl p-3 text-[10px] font-bold text-gray-700 dark:text-gray-300 outline-none focus:border-purple-500 transition-colors shadow-inner"
                >
                  {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* 5. Custom Prompt */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2">
                  <Edit3 className="w-3.5 h-3.5 text-blue-500" /> 5. Custom Instructions
                </label>
                <textarea
                  value={userPrompt}
                  onChange={e => setUserPrompt(e.target.value)}
                  placeholder="e.g. Focus on edge cases and error handling..."
                  className="w-full h-24 bg-gray-50/50 dark:bg-black/20 border border-gray-100 dark:border-gray-800 rounded-xl p-3 text-[10px] resize-none outline-none focus:border-blue-500 transition-colors shadow-inner"
                />
              </div>

              {/* 6. Generation Strategy */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> 6. Strategy
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    { id: 'main', label: 'Main Features', icon: <CheckCircle className="w-3 h-3 text-indigo-500" /> },
                    { id: 'negative', label: 'Negative / Edge Cases', icon: <AlertTriangle className="w-3 h-3 text-red-500" /> },
                    { id: 'data', label: 'Data Variations', icon: <Database className="w-3 h-3 text-emerald-500" /> },
                    { id: 'ux', label: 'Visual & UX Consistency', icon: <Layout className="w-3 h-3 text-amber-500" /> }
                  ].map(opt => (
                    <label key={opt.id} className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${selectedStrategies.includes(opt.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-500/30 shadow-sm' : 'bg-white dark:bg-[#16191f] border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'}`}>
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        checked={selectedStrategies.includes(opt.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedStrategies([...selectedStrategies, opt.id]);
                          else setSelectedStrategies(selectedStrategies.filter(id => id !== opt.id));
                        }}
                      />
                      <div className="flex items-center gap-2 min-w-0">
                        {opt.icon}
                        <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-tight truncate">{opt.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-[#16191f] rounded-b-2xl shrink-0">
              {isAnalyzing ? (
                <button
                  onClick={() => abortControllerRef.current?.abort()}
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-3.5 px-6 rounded-xl font-black text-xs tracking-widest uppercase transition-all duration-200 flex items-center justify-center gap-3 shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  <Square className="w-4 h-4 fill-current" /> Stop Generator
                </button>
              ) : (
                <button
                  onClick={handleGenerate}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-6 rounded-xl font-black text-xs tracking-widest uppercase transition-all duration-200 flex items-center justify-center gap-3 shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4" /> Generate Scenarios
                </button>
              )}
            </div>
          </div>
        </div>
        {/* 2. Right Panel: AI Prototype Inventory */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden transition-all h-full bg-white dark:bg-[#111318] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
            {/* Unified Header with Border-B */}
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white/50 dark:bg-white/5 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl shadow-sm">
                  <Target className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-[13px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-[0.15em] leading-tight flex items-center gap-2">
                    Prototype Inventory
                    <span className="text-indigo-500 dark:text-indigo-400 font-black tracking-tight ml-1 text-[11px]">({persistedScenarios.length})</span>
                  </h2>
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest leading-tight">
                    Review & Register Scenarios
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                    <button onClick={() => handleDelete()} className="p-2.5 text-gray-400 hover:text-red-500 transition-all bg-gray-50 dark:bg-gray-800 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                    <button onClick={() => handleApprove()} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"><ArrowRight className="w-3.5 h-3.5" /> Register Selected</button>
                  </div>
                )}
                <button onClick={toggleAll} className="p-2.5 text-gray-400 hover:text-indigo-600 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all transition-all transition-all duration-300">
                  {selectedIds.length === persistedScenarios.length && persistedScenarios.length > 0 ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-6 custom-scrollbar pr-2 pb-2">
              {persistedScenarios.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 opacity-30 animate-in fade-in zoom-in-95 duration-700">
                  <Sparkles className="w-16 h-16 mb-2" />
                  <h4 className="text-xs font-black uppercase tracking-widest">Awaiting Generation</h4>
                </div>
              ) : (
                persistedScenarios.map((s) => {
                  const isExpanded = persistedEditingId === s.id;
                  return (
                    <div key={s.id} className={`bg-gray-50 dark:bg-[#0c0e12] border transition-all duration-500 rounded-2xl overflow-hidden ${isExpanded ? 'border-indigo-400 shadow-xl ring-1 ring-indigo-500/20' : 'border-gray-200 dark:border-gray-800 shadow-sm hover:border-indigo-300'}`}>
                      <div onClick={() => onUpdatePersistedEditingId(isExpanded ? null : s.id)} className={`p-5 px-6 border-b border-transparent cursor-pointer flex items-center justify-between transition-all ${isExpanded ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/50' : 'hover:bg-white dark:hover:bg-[#16191f]'}`}>
                        <div className="flex items-center gap-5 flex-1 min-w-0">
                          <div onClick={(e) => toggleSelection(e, s.id)} className={`shrink-0 transition-all ${selectedIds.includes(s.id) ? 'scale-110 text-indigo-600' : 'text-gray-300 hover:text-gray-400'}`}>
                            {selectedIds.includes(s.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              {s.category && <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[8px] font-black rounded uppercase tracking-wider">{s.category}</span>}
                              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{s.testCases.length} Nodes</span>
                            </div>
                            {isExpanded ? (
                              <div className="space-y-1 pr-4" onClick={e => e.stopPropagation()}>
                                <input
                                  value={s.title}
                                  onChange={e => updateScenarioMetadata(s.id, 'title', e.target.value)}
                                  className="w-full text-sm font-black text-gray-900 dark:text-gray-100 bg-transparent border-b border-indigo-500/30 focus:border-indigo-500 outline-none pb-0.5 uppercase tracking-tight transition-colors"
                                  placeholder="Scenario Title"
                                />
                                <input
                                  value={s.description}
                                  onChange={e => updateScenarioMetadata(s.id, 'description', e.target.value)}
                                  className="w-full text-[10px] text-gray-500 font-bold bg-transparent border-b border-transparent focus:border-indigo-500/30 outline-none pb-0.5 tracking-tight transition-colors"
                                  placeholder="Scenario Description"
                                />
                              </div>
                            ) : (
                              <h3 className="text-xs font-black text-gray-800 dark:text-gray-200 truncate uppercase tracking-tight">{s.title || 'Untitled Prototype'}</h3>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 border-r border-gray-200 dark:border-gray-800 pr-3 mr-1" onClick={e => e.stopPropagation()}>
                            <button onClick={(e) => { e.stopPropagation(); handleApprove(s.id); }} className={`px-4 py-1.5 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-sm hover:bg-indigo-500 border border-indigo-600 active:scale-95 transition-all flex items-center gap-2 ${isExpanded ? '' : 'hidden sm:flex'}`}><ArrowRight className="w-3 h-3" /> {isExpanded ? 'Register' : 'Save'}</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors bg-gray-100 dark:bg-gray-800 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-indigo-500 transition-all duration-500 ${isExpanded ? 'rotate-180 scale-125' : ''}`} />
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="p-6 space-y-8 bg-white dark:bg-[#16191f] animate-in slide-in-from-top-2 duration-300">
                          <div className="space-y-6">
                            {s.testCases.map((tc, tcIdx) => (
                              <div key={tc.id || tcIdx} className="bg-gray-50/30 dark:bg-white/5 border border-gray-100 dark:border-gray-800/50 rounded-2xl p-6 relative group/node hover:border-indigo-300 transition-all">
                                <div className="absolute top-8 left-0 w-1 h-3/4 bg-indigo-500/20 group-hover:bg-indigo-500 rounded-r-full transition-colors" />
                                <div className="flex items-center justify-between pb-4">
                                  <div className="flex items-center gap-4 w-full pl-2">
                                    <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-black flex items-center justify-center text-[10px] shadow-sm">{tcIdx + 1}</span>
                                    <input className="flex-1 bg-transparent font-black text-xs text-gray-800 dark:text-gray-200 outline-none focus:border-indigo-500 border-b border-transparent pb-0.5 uppercase tracking-wide" value={tc.title} onChange={e => updateTestCase(s.id, tc.id, 'title', e.target.value)} />
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-opacity">
                                    <button onClick={() => moveTestCase(s.id, tcIdx, 'up')} disabled={tcIdx === 0} className="p-1.5 text-gray-400 hover:text-indigo-600 disabled:opacity-20 rounded bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700"><ArrowUp className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => moveTestCase(s.id, tcIdx, 'down')} disabled={tcIdx === s.testCases.length - 1} className="p-1.5 text-gray-400 hover:text-indigo-600 disabled:opacity-20 rounded bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700"><ArrowDown className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => deleteTestCase(s.id, tc.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded bg-white dark:bg-gray-800 shadow-sm ml-1 border border-gray-100 dark:border-gray-700 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6 pl-2">
                                  <div className="space-y-2">
                                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-1.5 ml-1">
                                      <Filter className="w-3 h-3" /> Pre-condition
                                    </label>
                                    <textarea className="w-full h-20 bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-[10px] font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none shadow-sm" value={tc.preCondition} onChange={e => updateTestCase(s.id, tc.id, 'preCondition', e.target.value)} placeholder="Entry requirements..." />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-1.5 ml-1">
                                      <Database className="w-3 h-3" /> Input Data
                                    </label>
                                    <textarea className="w-full h-20 bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-[10px] font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none shadow-sm" value={tc.inputData} onChange={e => updateTestCase(s.id, tc.id, 'inputData', e.target.value)} placeholder="Test vectors..." />
                                  </div>
                                  <div className="col-span-2 space-y-3">
                                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                                      <AlignLeft className="w-3 h-3" /> Execution Steps
                                    </label>
                                    <div className="space-y-2.5 pl-1">
                                      {tc.steps.map((step, sIdx) => (
                                        <div key={sIdx} className="flex items-center gap-3 group/step">
                                          <span className="text-[9px] font-black text-indigo-400 w-5 tabular-nums text-right">{sIdx + 1}.</span>
                                          <input className="flex-1 bg-transparent border-b border-gray-100 dark:border-gray-800 focus:border-indigo-400 outline-none text-[10px] font-semibold text-gray-700 dark:text-gray-300 py-1 transition-colors" value={step} onChange={e => { const ns = [...tc.steps]; ns[sIdx] = e.target.value; updateTestCase(s.id, tc.id, 'steps', ns); }} />
                                          <button onClick={() => updateTestCase(s.id, tc.id, 'steps', tc.steps.filter((_, i) => i !== sIdx))} className="opacity-0 group-hover/step:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"><X className="w-3 h-3" /></button>
                                        </div>
                                      ))}
                                      <button onClick={() => updateTestCase(s.id, tc.id, 'steps', [...tc.steps, ''])} className="text-[9px] font-black uppercase text-indigo-500 hover:text-indigo-600 flex items-center gap-1.5 mt-2 ml-7"><Plus className="w-3 h-3 text-indigo-400" /> Add Action</button>
                                    </div>
                                  </div>
                                  <div className="col-span-2 space-y-2">
                                    <label className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                                      <CheckCircle2 className="w-3 h-3" /> Expected Result
                                    </label>
                                    <textarea className="w-full h-20 bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 text-[10px] font-semibold text-emerald-800 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none shadow-sm" value={tc.expectedResult} onChange={e => updateTestCase(s.id, tc.id, 'expectedResult', e.target.value)} placeholder="Validation policy..." />
                                  </div>
                                </div>
                              </div>
                            ))}
                            <button onClick={() => addTestCase(s.id)} className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-400 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all flex items-center justify-center gap-2"><Plus className="w-4 h-4" /><span className="text-[10px] font-black uppercase">Append Node</span></button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const HierarchyNode = ({ item, depth, selectedIds, onToggleSelected }: { item: HierarchyItem; depth: number; selectedIds: string[]; onToggleSelected: (checked: boolean, item_ids: string[]) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isSelected = item.item_ids.every(id => selectedIds.includes(id));
  const hasSomeSelected = !isSelected && item.item_ids.some(id => selectedIds.includes(id));
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className="space-y-1">
      <div className={`flex items-center gap-1 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${depth === 0 ? 'mt-1' : ''}`}>
        <button
          onClick={(e) => { e.preventDefault(); setIsExpanded(!isExpanded); }}
          className={`w-4 h-4 flex items-center justify-center shrink-0 transition-colors ${hasChildren ? 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer' : 'opacity-0 cursor-default'}`}
          disabled={!hasChildren}
        >
          {hasChildren && (isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
        </button>

        <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0" onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') { if (hasChildren) setIsExpanded(!isExpanded); } }}>
          <div className="relative flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              className={`rounded border-gray-300 text-indigo-500 focus:ring-indigo-500 ${hasSomeSelected ? 'opacity-50' : ''} w-3.5 h-3.5`}
              checked={isSelected}
              onChange={(e) => onToggleSelected(e.target.checked, item.item_ids)}
            />
          </div>
          <div className="min-w-0 flex items-center">
            <span className={`text-[10px] text-gray-700 dark:text-gray-300 truncate tracking-tight ${depth === 0 ? 'font-black text-indigo-600 dark:text-indigo-400 uppercase leading-none' : 'font-bold leading-none'}`}>{item.name}</span>
            {item.level === 'category' && <span className="ml-1.5 py-0.5 px-1 bg-gray-200 dark:bg-gray-800 text-[8px] font-black text-gray-500 rounded uppercase leading-none">Cat</span>}
          </div>
        </label>
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-5 pl-2 border-l border-gray-200 dark:border-gray-800 space-y-0.5">
          {item.children.map(child => (
            <HierarchyNode key={child.name + child.level} item={child} depth={depth + 1} selectedIds={selectedIds} onToggleSelected={onToggleSelected} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ScenarioGenerator;
