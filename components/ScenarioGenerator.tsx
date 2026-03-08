import React, { useState, useRef, useMemo } from 'react';
import {
  FileUp, Database, Globe, Search, RefreshCw, Sparkles, Square,
  CheckSquare, Trash2, Edit3, ArrowUp, ArrowDown, Plus, X, AlignLeft,
  ClipboardCopy, DatabaseZap, Layout, CheckCircle2, ChevronRight,
  Smartphone, Monitor, Filter, CheckCircle, ArrowRight, Target
} from 'lucide-react';
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
  persistedFeatures: FeatureSummary[];
  onUpdatePersistedFeatures: (features: FeatureSummary[]) => void;
  persistedScenarios: Scenario[];
  onUpdatePersistedScenarios: (scenarios: Scenario[]) => void;
  persistedEditingId: string | null;
  onUpdatePersistedEditingId: (id: string | null) => void;
}

type GenerationMode = 'upload' | 'rag' | 'browsing';
type PlatformType = 'WEB' | 'APP';

const ScenarioGenerator: React.FC<ScenarioGeneratorProps> = ({
  activeProject, personas, onApproveScenario,
  persistedScenarios, onUpdatePersistedScenarios,
  persistedEditingId, onUpdatePersistedEditingId
}) => {
  // --- Global Top Bar State ---
  const [platform, setPlatform] = useState<PlatformType>('WEB');
  const [targetInput, setTargetInput] = useState('');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(personas[0]?.id || '');

  // Sync persona selection when personas are loaded/change
  React.useEffect(() => {
    if (!selectedPersonaId && personas.length > 0) {
      setSelectedPersonaId(personas[0].id);
    }
  }, [personas, selectedPersonaId]);

  // --- Left Panel State ---
  const [generationMode, setGenerationMode] = useState<GenerationMode>('upload');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [ragQuery, setRagQuery] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string, type: string, data: string, preview?: string }[]>([]);
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

  const handleGenerate = async () => {
    setIsAnalyzing(true);
    abortControllerRef.current = new AbortController();
    try {
      let result;
      // In a real implementation, we would pass 'platform' and 'targetInput' to these APIs as well
      if (generationMode === 'browsing') {
        const urlToUse = platform === 'WEB' ? targetInput : 'APP_TARGET';
        result = await scenariosApi.analyzeUrl(urlToUse || 'http://example.com', userPrompt, activeProject.id, abortControllerRef.current.signal);
      } else if (generationMode === 'upload') {
        if (uploadedFiles.length === 0) { alert("업로드된 파일이 없습니다."); setIsAnalyzing(false); return; }
        const filesPayload = uploadedFiles.map(f => ({ name: f.name, type: f.type, data: f.data }));
        result = await scenariosApi.analyzeUpload(filesPayload, userPrompt, activeProject.id, abortControllerRef.current.signal);
      } else {
        setIsAnalyzing(false); return;
      }

      // Merge new scenarios into the existing list instead of clearing them
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
        tags: ["AI"]
      }));

      onUpdatePersistedScenarios([...persistedScenarios, ...newScenarios]);
      if (newScenarios.length > 0 && !persistedEditingId) {
        onUpdatePersistedEditingId(newScenarios[0].id);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError' && e.message !== 'canceled') alert("Generation Failed: " + e.message);
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  // --- Bulk Actions ---
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    const toApprove = persistedScenarios.filter(s => selectedIds.includes(s.id));

    // In a real scenario, we might want to loop and save all of them.
    // We will simulate it here by sending them via onApproveScenario one by one
    // or by updating db status directly if we had a bulk API.
    for (const sc of toApprove) {
      // Prepare payload as before
      const payload = {
        id: sc.id, project_id: activeProject.id, title: sc.title || "Untitled", description: sc.description || "",
        testCases: sc.testCases.map((tc, idx) => ({
          id: tc.id || `tc_gen_${Date.now()}_${idx}`, title: tc.title, preCondition: tc.preCondition || "",
          inputData: tc.inputData || "", steps: tc.steps || [], expectedResult: tc.expectedResult || "", status: tc.status
        })),
        persona_id: sc.personaId || selectedPersonaId || (personas.length > 0 ? personas[0].id : ""),
        category: sc.category,
        platform: platform,
        target: targetInput,
        is_approved: true, tags: [...(sc.tags || []), "AI"].filter((v, i, a) => a.indexOf(v) === i)
      };
      try {
        const saved = await scenariosApi.create(payload);
        onApproveScenario(saved);
      } catch (e) { console.error("Failed to approve", sc.id); }
    }
    // Remove from draft list
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
    if (selectedIds.length === filteredScenarios.length) setSelectedIds([]);
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
        {/* 2. Left Panel: Generation Modes */}
        <div className="w-[320px] bg-white dark:bg-[#111318] border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
          <div className="flex p-2 gap-1 border-b border-gray-200 dark:border-gray-800">
            {[{ id: 'upload', icon: FileUp, label: 'Upload' }, { id: 'rag', icon: Database, label: 'RAG DB' }, { id: 'browsing', icon: Globe, label: 'Browsing' }].map(tab => (
              <button key={tab.id} onClick={() => setGenerationMode(tab.id as GenerationMode)} className={`flex-1 flex flex-col items-center py-3 gap-1 rounded-lg transition-all ${generationMode === tab.id ? 'bg-indigo-600/10 text-indigo-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900'}`}>
                <tab.icon className="w-4 h-4" />
                <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
          </div>
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {generationMode === 'upload' && (
              <div className="space-y-4">
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-xl p-6 text-center hover:bg-indigo-50 dark:hover:bg-indigo-900/10 cursor-pointer">
                  <FileUp className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Upload Specs / Imgs</p>
                  <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="relative w-12 h-12 bg-gray-100 dark:bg-gray-900 border rounded-lg overflow-hidden group">
                        {file.preview ? <img src={file.preview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center p-2 text-[8px] break-all">{file.name}</div>}
                        <button onClick={() => removeFile(idx)} className="absolute top-0 right-0 bg-red-500 p-0.5"><X className="w-3 h-3 text-white" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {generationMode === 'rag' && (
              <textarea value={ragQuery} onChange={e => setRagQuery(e.target.value)} placeholder="Query Knowledge Base..." className="w-full h-32 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-xs resize-none" />
            )}
            {generationMode === 'browsing' && (
              <div className="p-3 bg-amber-500/10 rounded-xl text-[10px] text-amber-600">AI will autonomously browse the globally defined Target URL/App to extract scenarios.</div>
            )}

            <label className="text-[10px] font-black text-gray-600 uppercase">Additional Context</label>
            <textarea value={userPrompt} onChange={e => setUserPrompt(e.target.value)} placeholder="Provide specific testing requirements..." className="w-full h-24 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-xs resize-none" />
          </div>
          <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black/20">
            {isAnalyzing ? (
              <button onClick={() => abortControllerRef.current?.abort()} className="w-full bg-red-600 text-white py-3 rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2"><Square className="w-4 h-4 fill-current" /> Stop</button>
            ) : (
              <button onClick={handleGenerate} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> Generate Scenarios</button>
            )}
          </div>
        </div>

        {/* 3. Center Panel: Master List */}
        <div className="w-[360px] bg-white dark:bg-[#16191f] border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
          <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest">Draft Scenarios ({filteredScenarios.length})</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="Search..." className="w-full bg-gray-100 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-lg py-1.5 pl-9 pr-3 text-xs" />
            </div>
            <div className="flex items-center justify-between mt-2">
              <button onClick={toggleAll} className="text-[10px] text-gray-500 flex items-center gap-1 hover:text-indigo-600">
                {selectedIds.length === filteredScenarios.length && filteredScenarios.length > 0 ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> : <Square className="w-3.5 h-3.5" />}
                Select All
              </button>
              {selectedIds.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={handleBulkDelete} className="p-1 text-gray-400 hover:text-red-500 bg-gray-100 dark:bg-gray-800 rounded"><Trash2 className="w-3 h-3" /></button>
                  <button onClick={handleBulkApprove} className="px-2 py-1 bg-indigo-600 text-white text-[9px] font-bold uppercase rounded flex items-center gap-1"><ArrowRight className="w-3 h-3" /> Proceed</button>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {filteredScenarios.map(s => (
              <div key={s.id} onClick={() => onUpdatePersistedEditingId(s.id)} className={`p-3 rounded-xl border cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-all ${persistedEditingId === s.id ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111318]'}`}>
                <div className="flex items-start gap-2">
                  <div onClick={(e) => toggleSelection(e, s.id)} className="mt-0.5 text-gray-400 hover:text-indigo-600 cursor-pointer shrink-0">
                    {selectedIds.includes(s.id) ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {s.category && <div className="mb-1"><span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8px] font-black rounded uppercase tracking-wider border border-indigo-500/20">{s.category}</span></div>}
                    <div className="text-xs font-bold text-gray-900 dark:text-gray-200 truncate">{s.title || 'Untitled'}</div>
                    <div className="text-[9px] text-gray-500 mt-1 uppercase">{s.testCases.length} Nodes</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Right Panel: Detail Editor */}
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-[#0c0e12] overflow-hidden">
          {activeScenario ? (
            <div className="flex flex-col h-full animate-in fade-in">
              <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111318]">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl"><Target className="w-6 h-6" /></div>
                  <div className="flex-1 space-y-2">
                    {activeScenario.category && <div className="mb-1"><span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[9px] font-black rounded uppercase tracking-widest">{activeScenario.category}</span></div>}
                    <input value={activeScenario.title} onChange={e => updateScenarioMetadata('title', e.target.value)} className="w-full text-lg font-black bg-transparent outline-none border-b border-transparent focus:border-indigo-500" placeholder="Scenario Title" />
                    <input value={activeScenario.description} onChange={e => updateScenarioMetadata('description', e.target.value)} className="w-full text-xs text-gray-500 bg-transparent outline-none border-b border-transparent focus:border-indigo-500" placeholder="Description" />
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {activeScenario.testCases.map((tc, idx) => (
                  <div key={tc.id || idx} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-3 w-full mr-4">
                        <span className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                        <input className="flex-1 bg-transparent font-bold text-sm outline-none w-full" value={tc.title} onChange={e => updateTestCase(tc.id, 'title', e.target.value)} placeholder="Test Case Title" />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => moveTestCase(idx, 'up')} disabled={idx === 0} className="p-1 text-gray-400 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                        <button onClick={() => moveTestCase(idx, 'down')} disabled={idx === activeScenario.testCases.length - 1} className="p-1 text-gray-400 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                        <button onClick={() => deleteTestCase(tc.id)} className="p-1 text-red-500 bg-red-50 dark:bg-red-900/20 rounded ml-2"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1 mb-2"><ClipboardCopy className="w-3 h-3" /> Pre-condition</label>
                        <textarea className="w-full h-16 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-xs" value={tc.preCondition} onChange={e => updateTestCase(tc.id, 'preCondition', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1 mb-2"><DatabaseZap className="w-3 h-3" /> Input Data</label>
                        <textarea className="w-full h-16 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-xs" value={tc.inputData} onChange={e => updateTestCase(tc.id, 'inputData', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1 mb-2"><Layout className="w-3 h-3" /> Steps</label>
                        <div className="space-y-1.5 p-3 rounded-xl bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800">
                          {tc.steps.map((step, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-2 group">
                              <span className="text-[10px] text-gray-400 w-4">{sIdx + 1}.</span>
                              <input className="flex-1 bg-transparent border-none outline-none text-xs" value={step} onChange={e => { const ns = [...tc.steps]; ns[sIdx] = e.target.value; updateTestCase(tc.id, 'steps', ns); }} />
                              <button onClick={() => updateTestCase(tc.id, 'steps', tc.steps.filter((_, i) => i !== sIdx))} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                          <button onClick={() => updateTestCase(tc.id, 'steps', [...tc.steps, ''])} className="text-[10px] text-indigo-600 flex items-center gap-1 mt-2 focus:outline-none"><Plus className="w-3 h-3" /> Add Step</button>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-black text-green-600 uppercase flex items-center gap-1 mb-2"><CheckCircle2 className="w-3 h-3" /> Expected Result</label>
                        <textarea className="w-full h-16 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/50 rounded-lg p-2 text-xs text-green-800 dark:text-green-400" value={tc.expectedResult} onChange={e => updateTestCase(tc.id, 'expectedResult', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addTestCase} className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 hover:text-indigo-600 hover:border-indigo-500/50 hover:bg-white flex items-center justify-center gap-2 text-xs font-black uppercase"><Plus className="w-4 h-4" /> Add Node</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-4">
              <Layout className="w-12 h-12 opacity-20" />
              <p className="text-xs uppercase font-bold tracking-widest">Select a scenario to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScenarioGenerator;
