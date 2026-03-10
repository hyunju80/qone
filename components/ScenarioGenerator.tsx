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

  // Sync persona selection when personas are loaded/change
  React.useEffect(() => {
    if (!selectedPersonaId && personas.length > 0) {
      setSelectedPersonaId(personas[0].id);
    }
  }, [personas, selectedPersonaId]);

  // --- Left Panel State ---
  const [generationMode, setGenerationMode] = useState<GenerationMode>('upload');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [ragQuery, setRagQuery] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string, type: string, data: string, preview?: string }[]>([]);
  const [actionMap, setActionMap] = useState<any>(null);
  const [mapDepth, setMapDepth] = useState<number>(1);
  const [excludeSelectors, setExcludeSelectors] = useState<string>('footer');
  const [includeSelector, setIncludeSelector] = useState<string>('');
  const [showMapPanel, setShowMapPanel] = useState(false);
  const [savedMaps, setSavedMaps] = useState<any[]>([]);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [selectedNodeUrl, setSelectedNodeUrl] = useState<string | null>(null);
  const [localExcludeSelectors, setLocalExcludeSelectors] = useState<string>('');
  const [localIncludeSelector, setLocalIncludeSelector] = useState<string>('');
  const [mapIdToDelete, setMapIdToDelete] = useState<string | null>(null);

  const normalizeUrl = (url: string) => {
    if (!url) return '';
    try {
      // Create a URL object to handle normalization properly
      const u = new URL(url.startsWith('http') ? url : `http://${url}`);
      // Remove trailing slash, lowercase host, ignore protocol for matching
      return (u.host.replace(/^www\./, '') + u.pathname).replace(/\/+$/, '').toLowerCase();
    } catch {
      return url.replace(/\/+$/, '').toLowerCase();
    }
  };

  useEffect(() => {
    if (selectedNodeUrl) {
      setLocalExcludeSelectors(excludeSelectors);
      setLocalIncludeSelector(includeSelector);
    }
  }, [selectedNodeUrl]);
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
    if (activeProject?.id && generationMode === 'map') {
      loadSavedMaps();
    }
  }, [activeProject?.id, generationMode]);

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

  const handleSaveMap = async (title: string) => {
    if (!actionMap) return;
    try {
      if (actionMap.id) {
        // Update existing map
        await scenariosApi.updateActionMap(actionMap.id, {
          title,
          map_json: actionMap
        });
        if (onAlert) onAlert("Success", "Map updated successfully!", 'success');
      } else {
        // Create new map
        await scenariosApi.saveActionMap({
          project_id: activeProject.id,
          url: targetInput || (platform === 'WEB' ? 'WEB' : 'APP'),
          title,
          map_json: actionMap
        });
        if (onAlert) onAlert("Success", "New map saved successfully!", 'success');
      }
      loadSavedMaps();
      setIsSaveModalOpen(false);
      // UX Refinement: Reset state after save
      setActionMap(null);
      setShowMapPanel(false);
    } catch (e: any) {
      if (onAlert) onAlert("Error", "Save failed: " + e.message, 'error');
    }
  };

  const handleDeleteMap = async (mapId: string) => {
    try {
      await scenariosApi.deleteActionMap(mapId);
      setMapIdToDelete(null);
      loadSavedMaps();
      if (onAlert) onAlert("Success", "Map deleted.", 'success');
    } catch (e: any) {
      if (onAlert) onAlert("Error", "Delete failed: " + e.message, 'error');
    }
  };

  const mergeActionMaps = (existing: any, newSub: any, targetUrl: string): any => {
    // Helper to recursively update depth for the new sub-tree
    const updateTreeDepth = (node: any, baseDepth: number): any => {
      const updatedNode = { ...node, depth: baseDepth };
      if (node.children) {
        updatedNode.children = node.children.map((c: any) => ({
          ...c,
          node: updateTreeDepth(c.node, baseDepth + 1)
        }));
      }
      return updatedNode;
    };

    // If the root matches the target URL
    if (normalizeUrl(existing.url) === normalizeUrl(targetUrl)) {
      const existingUrls = new Set((existing.children || []).map((c: any) => c.node.url));

      // Update depths of new sub-nodes relative to the existing parent's depth
      const processedNewChildren = (newSub.children || []).map((c: any) => ({
        ...c,
        node: updateTreeDepth(c.node, existing.depth + 1)
      }));

      const uniqueNewChildren = processedNewChildren.filter((c: any) => !existingUrls.has(c.node.url));

      return {
        ...existing,
        // Keep existing elements to preserve parent node state, only update if empty
        interactable_elements: (existing.interactable_elements && existing.interactable_elements.length > 0)
          ? existing.interactable_elements
          : newSub.interactable_elements,
        children: [...(existing.children || []), ...uniqueNewChildren]
      };
    }

    // Traverse children recursively to find the insertion point
    if (existing.children && existing.children.length > 0) {
      return {
        ...existing,
        children: existing.children.map((child: any) => ({
          ...child,
          node: mergeActionMaps(child.node, newSub, targetUrl)
        }))
      };
    }

    return existing;
  };

  const handleMapActionFlow = async (overrideUrl?: string) => {
    setIsMapping(true);
    try {
      const urlToUse = overrideUrl || (platform === 'WEB' ? targetInput : 'APP_TARGET');
      if (!urlToUse) {
        if (onAlert) onAlert("Requirement", "Please enter a target URL.", 'info');
        setIsMapping(false);
        return;
      }

      // Prepare selectors list
      const excludesStr = overrideUrl ? localExcludeSelectors : excludeSelectors;
      const includeStr = overrideUrl ? localIncludeSelector : includeSelector;

      const excludes = excludesStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

      const result = await scenariosApi.mapActionFlow(
        urlToUse,
        mapDepth,
        excludes,
        includeStr.trim() || undefined
      );

      if (overrideUrl && actionMap) {
        // Validation: If backend found no children, inform the user why
        if (!result.map.children || result.map.children.length === 0) {
          if (onAlert) onAlert("Mapping Info", "No new interactable elements found for this node with the current filters.", 'info');
          setIsMapping(false);
          return;
        }

        // Incremental Merging
        const mergedMap = mergeActionMaps(actionMap, result.map, overrideUrl);
        if (mergedMap === actionMap) {
          console.warn("Merging failed: Could not find node with URL", overrideUrl);
          if (onAlert) onAlert("Merge Warning", "Could not find the selected node in the current map tree to attach results.", 'error');
        }
        setActionMap({ ...mergedMap }); // Ensure new reference to trigger render
      } else {
        // Initial Mapping
        setActionMap(result.map);
      }

      setShowMapPanel(true);
      setSelectedNodeUrl(null); // Reset selection on new map capture
    } catch (e: any) {
      if (onAlert) onAlert("Mapping Error", e.message, 'error');
    } finally {
      setIsMapping(false);
    }
  };

  const handleGenerate = async () => {
    setIsAnalyzing(true);
    abortControllerRef.current = new AbortController();
    try {
      let result;
      if (generationMode === 'browsing') {
        const urlToUse = platform === 'WEB' ? targetInput : 'APP_TARGET';
        result = await scenariosApi.analyzeUrl(urlToUse || 'http://example.com', userPrompt, activeProject.id, abortControllerRef.current.signal);
      } else if (generationMode === 'upload') {
        if (uploadedFiles.length === 0) {
          if (onAlert) onAlert("Input Required", "업로드된 파일이 없습니다.", 'info');
          setIsAnalyzing(false); return;
        }
        const filesPayload = uploadedFiles.map(f => ({ name: f.name, type: f.type, data: f.data }));
        result = await scenariosApi.analyzeUpload(filesPayload, userPrompt, activeProject.id, abortControllerRef.current.signal);
      } else if (generationMode === 'map') {
        if (!actionMap) {
          if (onAlert) onAlert("Selection Required", "Please run 'Start Mapping' or select a map first.", 'info');
          setIsAnalyzing(false); return;
        }
        result = await scenariosApi.generateFromMap(actionMap, userPrompt, activeProject.id);
      } else {
        setIsAnalyzing(false); return;
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
        tags: ["AI"]
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
        is_approved: true, tags: [...(sc.tags || []), "AI"].filter((v, i, a) => a.indexOf(v) === i)
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
        {/* 2. Left Panel: Generation Modes */}
        <div className="w-[320px] bg-white dark:bg-[#111318] border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
          <div className="flex p-2 gap-1 border-b border-gray-200 dark:border-gray-800">
            {[{ id: 'upload', icon: FileUp, label: 'Upload' }, { id: 'rag', icon: Database, label: 'RAG DB' }, /* { id: 'browsing', icon: Globe, label: 'Browsing' }, */ { id: 'map', icon: Target, label: 'Map-Based' }].map(tab => (
              <button key={tab.id} onClick={() => setGenerationMode(tab.id as GenerationMode)} className={`flex-1 flex flex-col items-center py-3 gap-1 rounded-lg transition-all ${generationMode === tab.id ? 'bg-indigo-600/10 text-indigo-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900'}`}>
                <tab.icon className="w-4 h-4" />
                <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">{tab.label}</span>
              </button>
            ))}
          </div>
          <div className="flex-1 p-5 overflow-y-auto space-y-4 shadow-inner custom-scrollbar">
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
              <textarea value={ragQuery} onChange={e => setRagQuery(e.target.value)} placeholder="Query Knowledge Base..." className="w-full h-32 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-xs resize-none outline-none focus:border-indigo-500" />
            )}
            {generationMode === 'browsing' && (
              <div className="p-3 bg-amber-500/10 rounded-xl text-[10px] text-amber-600 font-bold border border-amber-500/20">AI will autonomously browse the globally defined Target URL/App to extract scenarios.</div>
            )}
            {generationMode === 'map' && (
              <div className="space-y-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl text-[10px] text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/20">
                  AI will navigate the target URL and create a strict Action Flow Map before generating scenarios.
                </div>
                <div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 transition-colors group-hover:text-indigo-600">Map Depth Strategy</label>
                      <select
                        value={mapDepth}
                        onChange={e => setMapDepth(Number(e.target.value))}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-xs outline-none font-bold focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value={1}>1-Depth (Root + 1 Level)</option>
                        <option value={2}>2-Depths (Deep Mapping)</option>
                        <option value={0}>0-Depth (Root Only)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 hover:text-indigo-600">Exclude Regions (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. nav, header, footer"
                        value={excludeSelectors}
                        onChange={e => setExcludeSelectors(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-xs outline-none font-medium focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <p className="text-[9px] text-gray-400 mt-1">* Comma-separated CSS selectors to ignore (e.g. footer)</p>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 hover:text-indigo-600">Focus Region (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. #main-content or main"
                        value={includeSelector}
                        onChange={e => setIncludeSelector(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-xs outline-none font-medium focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <p className="text-[9px] text-gray-400 mt-1">* Only map elements within this CSS selector</p>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    <div className="flex gap-2 items-start text-[9px] text-amber-700 dark:text-amber-500 font-medium leading-relaxed">
                      <div className="mt-0.5">💡</div>
                      <div>
                        GNB나 Header가 반복되는 것을 방지하려면 <b>Focus Region</b>에 메인 컨텐츠 영역의 선택자(예: <code>main</code> 또는 <code>#root</code>)를 입력하세요.
                      </div>
                    </div>
                  </div>
                </div>
                {(!actionMap || actionMap.id) ? (
                  <button onClick={() => handleMapActionFlow()} disabled={isMapping || isAnalyzing} className={`w-full text-white py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${isMapping ? 'bg-indigo-600 animate-pulse' : 'bg-slate-800 hover:bg-slate-700'}`}>
                    {isMapping ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Mapping...</>
                    ) : (
                      <>Start Flow Mapping</>
                    )}
                  </button>
                ) : (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-black uppercase tracking-wider">Map Captured</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-3 leading-tight">Flow identified with {actionMap.interactable_elements?.length || 0} base interactions and {actionMap.children?.length || 0} sub-paths.</p>
                    <div className="flex gap-4">
                      <button onClick={() => setShowMapPanel(true)} className="text-[9px] uppercase font-black text-indigo-600 hover:text-indigo-700 transition-colors">Open Visualizer</button>
                      <button onClick={() => { setActionMap(null); setShowMapPanel(false); }} className="text-[9px] uppercase font-black text-red-500 hover:text-red-600 transition-colors">Discard</button>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                  <label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2 mb-3 tracking-widest">
                    <Database className="w-3 h-3" /> Saved Maps ({savedMaps.length})
                  </label>
                  <div className="space-y-2.5 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
                    {isLoadingMaps ? (
                      <div className="text-[10px] text-gray-400 animate-pulse flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading library...</div>
                    ) : savedMaps.length === 0 ? (
                      <div className="text-[10px] text-gray-400 italic font-medium px-1">Repository is empty.</div>
                    ) : (
                      savedMaps.map(m => (
                        <div key={m.id} onClick={() => {
                          setActionMap({ ...m.map_json, id: m.id, title: m.title });
                          setShowMapPanel(true);
                          setSelectedNodeUrl(null); // Reset selection when switching maps
                        }} className={`p-2.5 rounded-xl border transition-all cursor-pointer group ${actionMap && actionMap.id === m.id ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-500 shadow-sm' : 'bg-white dark:bg-[#0c0e12] border-gray-100 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700'}`}>
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <div className="text-[10px] font-black uppercase tracking-tight truncate text-gray-700 dark:text-gray-300">{m.title}</div>
                              <div className="text-[8px] text-gray-400 truncate mt-0.5">{m.url}</div>
                            </div>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              setMapIdToDelete(m.id);
                            }} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all flex-shrink-0">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-between mb-2">
                <span>Intent Refinement</span>
                {generationMode === 'map' && actionMap && (
                  <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded text-[8px] font-black animate-in fade-in slide-in-from-right-2">
                    ACTIVE MAP: {actionMap.title || 'Captured'}
                  </span>
                )}
              </label>
              <textarea value={userPrompt} onChange={e => setUserPrompt(e.target.value)} placeholder="e.g. Focus on login failures and security nodes..." className="w-full h-24 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-[11px] resize-none outline-none focus:border-indigo-500 transition-colors" />
            </div>
          </div>
          <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black/20">
            {isAnalyzing ? (
              <button onClick={() => abortControllerRef.current?.abort()} className="w-full bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-red-600/10 transition-all"><Square className="w-4 h-4 fill-current" /> Stop Generator</button>
            ) : (
              <button onClick={handleGenerate} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 transition-all"><Sparkles className="w-4 h-4" /> Generate Scenarios</button>
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

      {/* Map Overlay Panel (Intelligence Center Style Drawer) */}
      {showMapPanel && actionMap && (
        <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowMapPanel(false)} />
          <div className="relative w-full max-w-5xl bg-white dark:bg-[#111318] flex flex-col shadow-2xl border-l border-gray-200 dark:border-gray-800 animate-in slide-in-from-right duration-300">
            <div className="h-16 px-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#16191f] shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 rounded-xl"><Target className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest">Action Flow Map</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate max-w-[200px]">{actionMap.title || 'Live Captured Instance'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSaveModalOpen(true)}
                  disabled={isMapping}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> {actionMap.id ? 'Update Map' : 'Persist Map'}
                </button>
                <div className="w-px h-6 bg-gray-200 dark:border-gray-800 mx-2" />
                <button
                  onClick={() => { setShowMapPanel(false); setSelectedNodeUrl(null); }}
                  className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-gray-50/50 dark:bg-black/40 relative">
              <MapVisualizer
                actionMap={actionMap}
                onNodeSelect={(url) => setSelectedNodeUrl(url)}
              />

              {/* Contextual Sub-mapping Form / Info Badge */}
              {selectedNodeUrl && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[100] w-[600px] animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto">
                  <div className="bg-[#0f1115] border border-gray-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl">
                          <MousePointerClick className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Selected Node Context</div>
                          <div className="text-xs font-bold text-white truncate max-w-sm">{selectedNodeUrl}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedNodeUrl(null)}
                        className="text-gray-500 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Focus Region (Override)</label>
                        <input
                          type="text"
                          placeholder="e.g. .board-list"
                          value={localIncludeSelector}
                          onChange={(e) => setLocalIncludeSelector(e.target.value)}
                          className="w-full bg-[#16191f] border border-gray-800 rounded-lg py-2 px-3 text-[10px] text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Exclude Regions (Override)</label>
                        <input
                          type="text"
                          placeholder="e.g. .ad-banner"
                          value={localExcludeSelectors}
                          onChange={(e) => setLocalExcludeSelectors(e.target.value)}
                          className="w-full bg-[#16191f] border border-gray-800 rounded-lg py-2 px-3 text-[10px] text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleMapActionFlow(selectedNodeUrl)}
                        disabled={isMapping}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        {isMapping ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : <ChevronRight className="w-4 h-4" />}
                        Explore Sub-menus Deeper
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="absolute bottom-6 left-6 p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-20 transition-all">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-6 pointer-events-none">
                    <div className="flex items-center gap-3 border-r border-gray-200 dark:border-gray-800 pr-4">
                      <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50" />
                      <span className="text-[10px] font-black uppercase tracking-tighter text-gray-700 dark:text-gray-400">Root Node / Depth 0</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                      <span className="text-[10px] font-black uppercase tracking-tighter text-gray-700 dark:text-gray-400">Transition Node / Depth 1</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Map Dialog (Q-ONE Style) */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setIsSaveModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-[#16191f] rounded-[2rem] w-full max-w-sm shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-200 dark:border-gray-800 transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20 flex justify-between items-center transition-colors">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Establish Map Signature</h3>
              <button onClick={() => setIsSaveModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-all"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Identify Map Resource</label>
                <input
                  id="map-save-title-final"
                  autoFocus
                  defaultValue={`Flow - ${targetInput || 'Unknown'} (${new Date().toLocaleDateString()})`}
                  className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-2xl py-3.5 px-5 text-sm font-black text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all shadow-inner"
                  placeholder="e.g. Navigation_Core_Path"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveMap(e.currentTarget.value);
                    }
                  }}
                />
              </div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 leading-relaxed font-bold italic flex gap-3">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Saved signatures provide cross-referenced metadata for AI scenario extraction agents.</span>
                </p>
              </div>
            </div>
            <div className="px-8 pb-8 flex gap-3">
              <button onClick={() => setIsSaveModalOpen(false)} className="flex-1 py-3.5 text-[11px] font-black uppercase text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl tracking-widest transition-all">Discard</button>
              <button
                onClick={() => {
                  const input = document.getElementById('map-save-title-final') as HTMLInputElement;
                  handleSaveMap(input?.value || '');
                }}
                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal (Q-ONE Style) */}
      {mapIdToDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 dark:bg-black/95 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setMapIdToDelete(null)}
          />
          <div className="relative bg-white dark:bg-[#111318] rounded-[2rem] w-full max-w-xs shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100 dark:border-gray-800">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 dark:border-red-900/30">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-[12px] font-black uppercase tracking-widest text-gray-900 dark:text-gray-100">Delete Action Map?</h3>
              <p className="text-[10px] text-gray-400 leading-relaxed font-bold">This action cannot be undone. All nodes and associated metadata for this map will be permanently erased.</p>
            </div>
            <div className="p-5 bg-gray-50/50 dark:bg-gray-900/30 flex gap-3 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setMapIdToDelete(null)} className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all">Cancel</button>
              <button onClick={() => handleDeleteMap(mapIdToDelete)} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-600/30 transition-all active:scale-95">Purge Map</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScenarioGenerator;
