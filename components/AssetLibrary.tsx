
import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, Clock, Search, Filter, Plus, FileCode, CheckCircle2,
  MoreVertical, Star, Bot, User as UserIcon, X, Play, Loader2, Terminal as TerminalIcon,
  Copy, Check, Users, Database, Zap, Activity, Info, Table, AlertTriangle, ShieldAlert,
  Code, Tags, Save, Upload, FileUp, Edit3, Edit2, Trash2, Maximize2, RefreshCw, UserCheck, Settings2, Hash,
  ToggleLeft, ToggleRight, Target, UserX, Globe, Smartphone, Laptop, Camera
} from 'lucide-react';
import { ScriptStatus, TestScript, ScriptOrigin, DataType, TestHistory, Persona, TestDataRow, TestEngine, Scenario, StepAsset, CategoryNode } from '../types';
import { testApi } from '../api/test';
import { scenariosApi } from '../api/scenarios';
import api from '../api/client';
import LiveExecutionModal from './LiveExecutionModal';

interface AssetLibraryProps {
  scripts: TestScript[];
  activeProjectId: string;
  personas: Persona[];
  onRecordHistory?: (history: TestHistory) => void;
  onRefresh?: () => void;
  onAlert?: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
  initialSearchTerm?: string;
  categories?: CategoryNode[];
}

const AssetLibrary: React.FC<AssetLibraryProps> = ({ scripts, activeProjectId, personas, onRecordHistory, onRefresh, onAlert, initialSearchTerm = '', categories = [] }) => {
  const [filter, setFilter] = useState<'ALL' | 'AI_GEN' | 'STEP_FLOW'>('ALL');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<'ALL' | 'WEB' | 'APP'>('ALL');
  const [searchQuery, setSearchQuery] = useState(initialSearchTerm);

  // Update search query when initialSearchTerm changes (e.g. navigation from History)
  useEffect(() => {
    if (initialSearchTerm) {
      setSearchQuery(initialSearchTerm);
    }
  }, [initialSearchTerm]);
  const [viewingScript, setViewingScript] = useState<TestScript | null>(null);
  const [executingScript, setExecutingScript] = useState<TestScript | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeViewerTab, setActiveViewerTab] = useState<'scenario' | 'steps' | 'context'>('steps');

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [viewingScenario, setViewingScenario] = useState<Scenario | null>(null);

  useEffect(() => {
    if (activeProjectId) {
      scenariosApi.getAll(activeProjectId).then(setScenarios).catch(console.error);
    }
  }, [activeProjectId]);

  // Refresh scripts on mount to ensure fresh data when navigating to this view
  useEffect(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, []);

  // Registration/Edit Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [newManualScript, setNewManualScript] = useState({
    name: '',
    description: '',
    code: 'test(\'example\', async ({ page }) => {\n  // Implementation here\n});',
    tags: '',
    category: '',
    engine: 'Playwright' as TestEngine,
    dataset: [] as TestDataRow[],
    try_count: 1,
    enable_ai_test: false,
    priority: 'P2'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Execution State
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<{ msg: string, type: 'info' | 'success' | 'error' | 'cmd' }[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'cmd' = 'info') => {
    setLogs(prev => [...prev, { msg, type }]);
  };

  /* New State for Real Execution Modal */
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const handleRunStepAsset = async (asset: TestScript) => {
    if (asset.isActive === false) return;
    try {
      const { run_id } = await testApi.runActiveSteps({
        steps: asset.steps || [],
        project_id: activeProjectId,
        platform: asset.platform || 'WEB',
        script_id: asset.id,
        script_name: asset.name,
        trigger: "manual",
        persona_name: asset.persona?.name || "Default",
        capture_screenshots: asset.captureScreenshots || false,
        dataset: asset.dataset || [],
        try_count: asset.try_count || 1,
        enable_ai_test: asset.enable_ai_test || false
      });
      setActiveRunId(run_id);
    } catch (e: any) {
      console.error("Failed to run step asset", e);
      if (onAlert) onAlert("Error", "Failed to start execution.", 'error');
    }
  };

  const handleRunTest = async (script: TestScript) => {
    if (!script.isActive) return;
    setExecutingScript(script);

    try {
      if (script.steps && script.steps.length > 0) {
        // Step-by-Step Reporting execution (AI Assets with Native Steps)
        const { run_id } = await testApi.runActiveSteps({
          steps: script.steps,
          project_id: script.projectId,
          platform: script.platform || 'WEB',
          script_id: script.id,
          script_name: script.name,
          trigger: "manual",
          persona_name: script.persona?.name || 'Default',
          capture_screenshots: script.captureScreenshots || false,
          dataset: script.dataset || [],
          try_count: script.try_count || 1,
          enable_ai_test: script.enable_ai_test || false
        });
        setActiveRunId(run_id);
      } else {
        // Standard String-based script execution
        const { run_id } = await testApi.dryRun({
          code: script.code,
          project_id: script.projectId, // Assuming TestScript extends Project resource
          script_id: script.id,
          script_name: script.name,
          persona_name: script.persona?.name || 'Default',
          dataset: script.dataset || [],
          try_count: script.try_count || 1,
          enable_ai_test: script.enable_ai_test || false
        });
        setActiveRunId(run_id);
      }
    } catch (e: any) {
      console.error("Failed to start run", e);
      // Fallback or alert? For now just log.
      if (onAlert) onAlert("Error", "Failed to start execution.", 'error');
    }
  };

  const filteredScripts = scripts.filter(script => {
    // Only 'STEP' origin assets are excluded from the Scripts list
    if (script.origin === ScriptOrigin.STEP) return false;

    // Platform Filter
    let platformMatch = platformFilter === 'ALL' || script.platform === platformFilter;

    // Origin Filter
    let originMatch = filter === 'ALL' ||
      (filter === 'AI_GEN' ? (script.origin === ScriptOrigin.AI || script.origin === ScriptOrigin.AI_EXPLORATION) : false);

    // Favorite Filter
    let favoriteMatch = !showFavoritesOnly || script.isFavorite;

    return originMatch && platformMatch && favoriteMatch;

    return originMatch && platformMatch;
  }).filter(script =>
    (script.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (script.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    script.tags?.some(tag => tag?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (script.id?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const filteredSteps = scripts.filter(script => script.origin === ScriptOrigin.STEP).filter(step => {
    // Only 'STEP_FLOW' origin or 'ALL' filter shows these
    let originMatch = filter === 'ALL' || filter === 'STEP_FLOW';

    // Favorite Filter
    let favoriteMatch = !showFavoritesOnly || step.isFavorite;

    // Platform Filter
    let platformMatch = platformFilter === 'ALL' || step.platform === platformFilter;

    return originMatch && platformMatch && favoriteMatch && (
      (step.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (step.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (step.id?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
  });

  const handleExecutionComplete = async (status: 'success' | 'error', capturedLogs?: string) => {
    // 1. Cleanup & Refresh (Always)
    // Modified: Don't set activeRunId to null here; let the user close it manually like in Step Flow.
    // setActiveRunId(null); 
    if (onRefresh) onRefresh();

    // 2. Alert (If enabled)
    // Redundant alert removed per user request
    /*
    if (onAlert) {
      if (status === 'success') {
        onAlert("Success", "Execution completed. Check results in History.", 'success');
      } else {
        onAlert("Error", "Execution failed. Check logs in History.", 'error');
      }
    }
    */

    // 3. Frontend History Save (Only for regular scripts that don't save on backend yet)
    // Modified: Skip for StepAsset or Appium runs as backend (run.py) handles history saving.
    if (!executingScript) return;
    const isStepAsset = 'steps' in executingScript;
    const isAppium = 'engine' in executingScript && executingScript.engine === 'Appium';

    if (isStepAsset || isAppium) {
      console.log("Skipping frontend history save for backend-managed run.");
      setExecutingScript(null);
      return;
    }

    const durationStr = "N/A";
    const logEntries = capturedLogs
      ? capturedLogs.split('\n').filter(line => line.trim() !== '').map(line => ({ msg: line, type: 'info' as const }))
      : [];

    const historyData = {
      project_id: activeProjectId,
      script_id: executingScript.id,
      script_name: executingScript.name,
      status: status === 'success' ? 'passed' : 'failed',
      duration: durationStr,
      persona_name: executingScript.persona?.name || 'Standard Agent',
      trigger: 'manual',
      logs: logEntries,
      run_date: new Date().toISOString()
    };

    try {
      const savedHistory = await testApi.createHistory(historyData);
      if (onRecordHistory && savedHistory) {
        onRecordHistory(savedHistory);
      }
    } catch (e) {
      console.error("Failed to save history on frontend", e);
    } finally {
      setExecutingScript(null);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [isEditingSteps, setIsEditingSteps] = useState(false);
  const [editedSteps, setEditedSteps] = useState<any[]>([]);

  const [isEditingDataset, setIsEditingDataset] = useState(false);
  const [editedDataset, setEditedDataset] = useState<TestDataRow[]>([]);

  // Internal Logic Methods
  const handleRegisterManualScript = async (script: TestScript) => {
    try {
      const payload = {
        name: script.name,
        description: script.description,
        project_id: activeProjectId,
        code: script.code,
        engine: script.engine || 'Playwright',
        tags: script.tags,
        dataset: script.dataset,
        is_active: script.isActive,
        status: ScriptStatus.CERTIFIED,
        origin: ScriptOrigin.MANUAL,
        category: script.category,
        try_count: script.try_count,
        enable_ai_test: script.enable_ai_test
      };

      await testApi.createScript(payload);
      if (onAlert) onAlert("Success", "Manual Script registered successfully.", 'success');
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Failed to register manual script", e);
      if (onAlert) onAlert("Error", "Failed to save script.", 'error');
    }
  };

  const handleUpdateScript = async (script: TestScript, suppressAlert: boolean = false) => {
    try {
      const payload = {
        name: script.name,
        description: script.description,
        code: script.code,
        engine: script.engine,
        tags: script.tags,
        dataset: script.dataset,
        is_active: script.isActive,
        is_favorite: script.isFavorite,
        capture_screenshots: script.captureScreenshots,
        category: script.category,
        steps: script.steps,
        try_count: script.try_count,
        // TODO: Rename to enable_self_healing
        enable_ai_test: script.enable_ai_test,
        priority: script.priority
      };

      await testApi.updateScript(script.id, payload);
      if (onRefresh) onRefresh();

      if (!suppressAlert && onAlert) {
        onAlert("Success", "Script updated successfully.", 'success');
      }
    } catch (e) {
      console.error("Failed to update script", e);
      if (onAlert) onAlert("Error", "Failed to update script.", 'error');
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent, script: TestScript) => {
    e.stopPropagation();
    handleUpdateScript({ ...script, isFavorite: !script.isFavorite }, true);
  };

  const handleToggleActive = (e: React.MouseEvent, script: TestScript) => {
    e.stopPropagation();
    handleUpdateScript({ ...script, isActive: !script.isActive }, true);
  };

  const handleToggleStepFavorite = async (e: React.MouseEvent, step: TestScript) => {
    e.stopPropagation();
    handleUpdateScript({ ...step, isFavorite: !step.isFavorite }, true);
  };

  const handleToggleStepActive = async (e: React.MouseEvent, step: TestScript) => {
    e.stopPropagation();
    handleUpdateScript({ ...step, isActive: !step.isActive }, true);
  };

  const handleModifyScript = (script: TestScript) => {
    setEditingScriptId(script.id);
    setNewManualScript({
      name: script.name,
      description: script.description,
      code: script.code,
      tags: script.tags?.join(', ') || '',
      category: script.category || '',
      engine: script.engine || 'Playwright',
      dataset: script.dataset ? [...script.dataset] : [],
      try_count: script.try_count || 1,
      // TODO: Rename to enable_self_healing
      enable_ai_test: script.enable_ai_test || false,
      priority: script.priority || 'P1'
    });
    setShowRegisterModal(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setNewManualScript(prev => ({
        ...prev,
        name: prev.name || file.name.split('.')[0],
        code: content
      }));
    };
    reader.readAsText(file);
  };

  const handleSaveManual = () => {
    if (!newManualScript.name || !newManualScript.code) return;

    if (editingScriptId) {
      const existing = scripts.find(s => s.id === editingScriptId);
      if (existing) {
        handleUpdateScript({
          ...existing,
          name: newManualScript.name,
          description: newManualScript.description,
          code: newManualScript.code,
          engine: newManualScript.engine,
          category: newManualScript.category,
          tags: newManualScript.tags.split(',').map(t => t.trim()).filter(t => t !== ''),
          dataset: newManualScript.dataset,
          try_count: newManualScript.try_count,
          enable_ai_test: newManualScript.enable_ai_test,
          priority: newManualScript.priority
        });
      }
    } else {
      const manualScript: TestScript = {
        id: `manual_${Date.now()}`,
        projectId: activeProjectId,
        name: newManualScript.name,
        description: newManualScript.description,
        status: ScriptStatus.CERTIFIED,
        lastRun: 'Never',
        runCount: 0,
        successRate: 0,
        code: newManualScript.code,
        engine: newManualScript.engine,
        origin: ScriptOrigin.MANUAL,
        category: newManualScript.category,
        tags: newManualScript.tags.split(',').map(t => t.trim()).filter(t => t !== ''),
        isFavorite: false,
        isActive: true,
        dataset: newManualScript.dataset,
        try_count: newManualScript.try_count,
        enable_ai_test: newManualScript.enable_ai_test,
        priority: newManualScript.priority
      };

      handleRegisterManualScript(manualScript);
    }

    setShowRegisterModal(false);
    setEditingScriptId(null);
  };

  const updateDatasetItem = (index: number, field: keyof TestDataRow, value: string) => {
    const updated = [...newManualScript.dataset];
    updated[index] = { ...updated[index], [field]: value };
    setNewManualScript({ ...newManualScript, dataset: updated });
  };

  const addDatasetRow = () => {
    const newRow: TestDataRow = {
      id: `d_${Date.now()}`,
      field: '',
      value: '',
      type: DataType.VALID,
      description: ''
    };
    setNewManualScript({ ...newManualScript, dataset: [...newManualScript.dataset, newRow] });
  };

  const removeDatasetRow = (index: number) => {
    setNewManualScript({ ...newManualScript, dataset: newManualScript.dataset.filter((_, i) => i !== index) });
  };

  // Handlers for editedDataset (Intelligence Center)
  const addEditedDatasetRow = () => {
    const newRow: TestDataRow = {
      id: `d_${Date.now()}`,
      field: '',
      value: '',
      type: DataType.VALID,
      description: ''
    };
    setEditedDataset([...editedDataset, newRow]);
  };

  const removeEditedDatasetRow = (index: number) => {
    setEditedDataset(editedDataset.filter((_, i) => i !== index));
  };

  const updateEditedDatasetItem = (index: number, field: keyof TestDataRow, value: string) => {
    const updated = [...editedDataset];
    updated[index] = { ...updated[index], [field]: value };
    setEditedDataset(updated);
  };









  const editingScript = editingScriptId ? scripts.find(s => s.id === editingScriptId) : null;

  return (
    <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto relative custom-scrollbar">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter mb-2 transition-colors">Intelligent Asset Library</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-widest transition-colors">Comprehensive repository of test assets generated via Step Flow and AI exploration.</p>
        </div>
        {/* 
        <button
          onClick={() => {
            setEditingScriptId(null);
            setNewManualScript({
              name: '',
              description: '',
              code: 'test(\'example\', async ({ page }) => {\n  // Implementation here\n});',
              tags: '',
              category: '',
              engine: 'Playwright',
              dataset: [],
              try_count: 1,
              enable_ai_test: false
            });
            setShowRegisterModal(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-all text-sm font-semibold shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          Register Manual Script
        </button>
        */}
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, desc or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors"
          />
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors">
          {(['ALL', 'WEB', 'APP'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center justify-center ${platformFilter === p ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'}`}
              title={p === 'ALL' ? 'All Platforms' : p}
            >
              <span className="text-[10px] font-black uppercase tracking-wider">{p}</span>
            </button>
          ))}
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors">
          {(['ALL', 'AI_GEN', 'STEP_FLOW'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${filter === f ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'}`}
            >
              <span>{f === 'AI_GEN' ? 'AI Gen' : f === 'STEP_FLOW' ? 'Step Flow' : f}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`p-2.5 rounded-lg border transition-all flex items-center justify-center ${showFavoritesOnly ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500 shadow-sm shadow-yellow-500/10' : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 hover:text-yellow-500/50'}`}
          title="Favorites only"
        >
          <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-yellow-500' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {filteredScripts.map(script => (
          <div key={script.id} className={`bg-white dark:bg-[#16191f] border rounded-2xl p-5 hover:border-gray-300 dark:hover:border-gray-700 transition-all group flex flex-col relative overflow-hidden ${script.isActive ? 'border-gray-200 dark:border-gray-800' : 'border-red-500/30 dark:border-red-900/30 opacity-60 grayscale'}`}>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="flex gap-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${script.isActive ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'}`}>
                  {script.engine === 'Appium' ? <Smartphone className="w-5 h-5" /> : <FileCode className="w-5 h-5" />}
                </div>
                <button
                  onClick={(e) => handleToggleFavorite(e, script)}
                  className={`p-2 rounded-lg transition-all ${script.isFavorite ? 'text-yellow-500 bg-yellow-500/10' : 'text-gray-600 hover:text-gray-400'}`}
                >
                  <Star className={`w-4 h-4 ${script.isFavorite ? 'fill-yellow-500' : ''}`} />
                </button>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <div className={`px-2 py-1 rounded text-[8px] font-black uppercase flex items-center justify-center gap-1 leading-none ${(script.origin === ScriptOrigin.AI || script.origin === ScriptOrigin.AI_EXPLORATION)
                    ? 'bg-indigo-950 text-indigo-400 border border-indigo-500/20'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-300 border border-gray-200 dark:border-transparent'
                    }`}>
                    {(script.origin === ScriptOrigin.AI || script.origin === ScriptOrigin.AI_EXPLORATION) ? <Bot className="w-2.5 h-2.5" /> : <UserIcon className="w-2.5 h-2.5" />}
                    {script.origin === ScriptOrigin.AI_EXPLORATION ? 'AI EXPLORATION' : script.origin}
                  </div>
                  <button
                    onClick={(e) => handleToggleActive(e, script)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  >
                    {script.isActive ? <ToggleRight className="w-5 h-5 text-indigo-600 dark:text-indigo-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400 dark:text-gray-700" />}
                  </button>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateScript({ ...script, captureScreenshots: !script.captureScreenshots }, true);
                    }}
                    className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${script.captureScreenshots ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500'}`}
                    title={script.captureScreenshots ? "Screenshot Capture: ON" : "Screenshot Capture: OFF"}
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleModifyScript(script)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500" title="Modify Asset"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => { setViewingScript(script); setActiveViewerTab('steps'); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500" title="Asset Intelligence"><Maximize2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            <h3 className={`font-bold mb-1 flex items-center gap-2 relative z-10 transition-colors ${script.isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
              {script.name}
              {script.isActive && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-500 line-clamp-2 mb-3 h-8 relative z-10 transition-colors">{script.description}</p>

            <div className="flex flex-wrap gap-1 mb-4 relative z-10">
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-900 border border-indigo-500/20 rounded text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter transition-colors">
                {script.engine === 'Appium' ? 'Appium' : 'Playwright'}
              </span>
              {script.category && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-500/20 rounded text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter transition-colors">
                  <Database className="w-2.5 h-2.5" /> {script.category}
                </span>
              )}
              <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter transition-colors border ${
                script.priority === 'P0' ? 'bg-red-50 dark:bg-red-900/10 border-red-500 text-red-600 dark:text-red-400' : 
                script.priority === 'P1' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500 text-amber-600 dark:text-amber-400' :
                script.priority === 'P2' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-500 text-blue-600 dark:text-blue-400' :
                'bg-gray-50 dark:bg-gray-900/10 border-gray-200 dark:border-gray-800 text-gray-500'
              }`}>
                {script.priority || 'P2'}
              </span>
              {script.tags?.map((t, idx) => (
                <span key={idx} className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-[9px] font-bold text-gray-500 uppercase tracking-tighter transition-colors">
                  <Hash className="w-2.5 h-2.5 text-indigo-500 opacity-50" /> {t}
                </span>
              ))}
            </div>

            <div className="mb-6 space-y-3 mt-auto relative z-10">
              <div className="grid grid-cols-3 gap-1">
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 transition-colors">
                  <div className="text-[7px] text-gray-600 font-black uppercase tracking-tighter mb-1">Success</div>
                  <div className="text-xs font-bold text-gray-900 dark:text-gray-200 transition-colors">{script.successRate}%</div>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 transition-colors">
                  <div className="text-[7px] text-gray-600 font-black uppercase tracking-tighter mb-1">Runs</div>
                  <div className={`text-xs font-bold ${script.isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600'}`}>{script.runCount || 0}</div>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 transition-colors">
                  <div className="text-[7px] text-gray-600 font-black uppercase tracking-tighter mb-1">Retry</div>
                  <div className={`text-xs font-bold ${script.isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600'}`}>{(script.try_count || 1) - 1}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[9px] text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> {script.lastRun}
                </div>
                <div className="flex items-center gap-1.5">
                  <UserCheck className={`w-3 h-3 ${script.isActive ? 'text-indigo-600 dark:text-indigo-500' : 'text-gray-400 dark:text-gray-700'}`} /> {script.persona?.name || 'Standard'}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleRunTest(script)}
              disabled={!script.isActive}
              className={`w-full text-[10px] font-black py-2.5 rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 relative z-10 ${script.isActive
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                }`}
            >
              <Play className="w-3.5 h-3.5" /> {script.isActive ? 'Run Test' : 'Disabled'}
            </button>
          </div>
        ))}

        {filteredSteps.map((step) => (
          <div key={step.id} className={`bg-white dark:bg-[#16191f] border rounded-2xl p-5 hover:border-gray-300 dark:hover:border-gray-700 transition-all group flex flex-col relative overflow-hidden ${step.isActive !== false ? 'border-gray-200 dark:border-gray-800' : 'border-emerald-500/30 dark:border-emerald-900/30 opacity-60 grayscale'}`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/5 blur-2xl rounded-full" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="flex gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
                  <Tags className="w-5 h-5" />
                </div>
                <button
                  onClick={(e) => handleToggleStepFavorite(e, step)}
                  className={`p-2 rounded-lg transition-all ${step.isFavorite ? 'text-yellow-500 bg-yellow-500/10' : 'text-gray-600 hover:text-gray-400'}`}
                >
                  <Star className={`w-4 h-4 ${step.isFavorite ? 'fill-yellow-500' : ''}`} />
                </button>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <div className={`px-2 py-1 rounded text-[8px] font-black uppercase flex items-center justify-center gap-1 leading-none ${(step.origin === ScriptOrigin.AI || step.origin === ScriptOrigin.AI_EXPLORATION || step.tags?.some(t => t === 'AI' || t === 'AI_EXPLORATION'))
                    ? 'bg-indigo-950 text-indigo-400 border border-indigo-500/20'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-300 border border-gray-200 dark:border-transparent'
                    }`}>
                    {(step.origin === ScriptOrigin.AI || step.origin === ScriptOrigin.AI_EXPLORATION || step.tags?.some(t => t === 'AI' || t === 'AI_EXPLORATION')) ? <Bot className="w-2.5 h-2.5" /> : <UserIcon className="w-2.5 h-2.5" />}
                    {(step.origin === ScriptOrigin.AI_EXPLORATION || step.tags?.includes('AI_EXPLORATION')) ? 'AI EXPLORATION' : 'STEP ASSET'}
                  </div>
                  <button
                    onClick={(e) => handleToggleStepActive(e, step)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  >
                    {step.isActive !== false ? <ToggleRight className="w-5 h-5 text-emerald-600 dark:text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400 dark:text-gray-700" />}
                  </button>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleModifyScript(step)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500" title="Modify Asset"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => { setViewingScript(step); setActiveViewerTab('steps'); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500" title="Asset Intelligence"><Maximize2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            <h3 className="font-bold mb-1 flex items-center gap-2 relative z-10 transition-colors text-gray-900 dark:text-gray-100">
              {step.name}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-500 line-clamp-2 mb-3 h-8 relative z-10 transition-colors">{step.description}</p>

            <div className="flex flex-wrap gap-1 mb-4 relative z-10">
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-900 border border-emerald-500/20 rounded text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter transition-colors">
                {step.platform}
              </span>
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-[9px] font-bold text-gray-500 uppercase tracking-tighter transition-colors">
                {step.steps?.length || 0} STEPS
              </span>
              <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter transition-colors border ${
                step.priority === 'P0' ? 'bg-red-50 dark:bg-red-900/10 border-red-500 text-red-600 dark:text-red-400' : 
                step.priority === 'P1' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500 text-amber-600 dark:text-amber-400' :
                step.priority === 'P2' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-500 text-blue-600 dark:text-blue-400' :
                'bg-gray-50 dark:bg-gray-900/10 border-gray-200 dark:border-gray-800 text-gray-500'
              }`}>
                {step.priority || 'P2'}
              </span>
              {step.category && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-500/20 rounded text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter transition-colors">
                  <Database className="w-2.5 h-2.5" /> {step.category}
                </span>
              )}
            </div>

            <div className="mb-6 space-y-3 mt-auto relative z-10">
              <div className="grid grid-cols-3 gap-1">
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 transition-colors">
                  <div className="text-[7px] text-gray-600 font-black uppercase tracking-tighter mb-1">Success</div>
                  <div className="text-xs font-bold text-gray-900 dark:text-gray-200 transition-colors">{step.successRate ?? 0}%</div>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 transition-colors">
                  <div className="text-[7px] text-gray-600 font-black uppercase tracking-tighter mb-1">Runs</div>
                  <div className={`text-xs font-bold ${step.isActive !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600'}`}>{step.runCount || 0}</div>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 transition-colors">
                  <div className="text-[7px] text-gray-600 font-black uppercase tracking-tighter mb-1">Retry</div>
                  <div className={`text-xs font-bold ${step.isActive !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600'}`}>{(step.try_count || 1) - 1}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[9px] text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> {step.lastRun}
                </div>
                <div className="flex items-center gap-1.5">
                  <UserCheck className={`w-3 h-3 ${step.isActive !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-700'}`} /> {step.persona?.name || 'Standard'}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleRunStepAsset(step)}
              className="w-full text-[10px] font-black py-2.5 rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 relative z-10 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
            >
              <Play className="w-3.5 h-3.5" /> Run Test
            </button>
          </div>
        ))}
      </div>

      {/* EXECUTION MONITOR OVERLAY -> Replaced with Shared Modal */}
      {activeRunId && (
        <LiveExecutionModal
          runId={activeRunId}
          onClose={() => { setActiveRunId(null); setExecutingScript(null); }}
          onComplete={handleExecutionComplete}
        />
      )}

      {/* ASSET DETAIL VIEWER OVERLAY */}
      {viewingScript && (
        <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm" onClick={() => setViewingScript(null)} />
          <div className="relative w-full max-w-4xl bg-white dark:bg-[#16191f] border-l border-gray-200 dark:border-gray-800 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 transition-colors">
            {(() => {
              const isStepFlow = viewingScript.origin === ScriptOrigin.STEP;
              const themeColor = isStepFlow ? 'emerald' : 'indigo';
              const themeBg = isStepFlow ? `bg-${themeColor}-600` : `bg-indigo-600`; // Fallback to indigo for clarity
              // We'll use a more robust way to handle classes to avoid JIT issues
              const t = {
                text: isStepFlow ? 'text-emerald-600' : 'text-indigo-600',
                textLight: isStepFlow ? 'text-emerald-400' : 'text-indigo-400',
                bg: isStepFlow ? 'bg-emerald-600' : 'bg-indigo-600',
                bgLight: isStepFlow ? 'bg-emerald-50' : 'bg-indigo-50',
                bgMuted: isStepFlow ? 'bg-emerald-50/50' : 'bg-indigo-50/50',
                bgDeep: isStepFlow ? 'bg-emerald-900/30' : 'bg-indigo-900/30',
                bgDeep2: isStepFlow ? 'bg-emerald-950/20' : 'bg-indigo-950/20',
                border: isStepFlow ? 'border-emerald-500' : 'border-indigo-500',
                borderLight: isStepFlow ? 'border-emerald-200' : 'border-indigo-200',
                borderMuted: isStepFlow ? 'border-emerald-100' : 'border-indigo-100',
                ring: isStepFlow ? 'focus:border-emerald-500' : 'focus:border-indigo-500',
                tag: isStepFlow ? 'bg-emerald-600/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400',
                button: isStepFlow ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700',
                hover: isStepFlow ? 'hover:bg-emerald-50' : 'hover:bg-indigo-50',
                shadow: isStepFlow ? 'shadow-emerald-600/20' : 'shadow-indigo-600/20'
              };

              return (
                <>
                  <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 ${t.bg} rounded-xl text-white`}>
                        {isStepFlow ? <Tags className="w-5 h-5" /> : (viewingScript.engine === 'Appium' ? <Smartphone className="w-5 h-5" /> : <FileCode className="w-5 h-5" />)}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Asset Intelligence Center</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{viewingScript.name}</p>
                      </div>
                    </div>
                    <button onClick={() => {
                      setViewingScript(null);
                      setIsEditingDataset(false);
                      setIsEditingSteps(false);
                    }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#16191f] transition-colors">
                    <button
                      onClick={() => setActiveViewerTab('scenario')}
                      className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeViewerTab === 'scenario' ? `${t.text} ${t.border}` : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                      <FileCode className="w-3.5 h-3.5 inline mr-2" /> Connected Scenario
                    </button>
                    <button
                      onClick={() => setActiveViewerTab('steps')}
                      className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeViewerTab === 'steps' ? `${t.text} ${t.border}` : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                      <Tags className="w-3.5 h-3.5 inline mr-2" /> Steps
                    </button>
                    <button
                      onClick={() => setActiveViewerTab('context')}
                      className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeViewerTab === 'context' ? `${t.text} ${t.border}` : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                      <Bot className="w-3.5 h-3.5 inline mr-2" /> Execution Context
                    </button>
                  </div>

                  <div className="flex-1 overflow-auto bg-gray-50 dark:bg-[#0c0e12] relative custom-scrollbar transition-colors">
                    {activeViewerTab === 'scenario' ? (
                      <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                        {(() => {
                          const scenario = scenarios.find(s => s.goldenScriptId === viewingScript.id);
                          if (!scenario) return (
                            <div className="bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800/50 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center">
                              <FileCode className="w-12 h-12 text-gray-400 mb-4 opacity-50" />
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">No Linked Scenario found</p>
                            </div>
                          );
                          return (
                            <>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Scenario Title</label>
                                <div className="text-lg font-bold text-gray-900 dark:text-white transition-colors">{scenario.title}</div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">{scenario.description}</p>
                              </div>

                              <div className="space-y-4">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Test Cases / Steps</label>
                                <div className="space-y-4">
                                  {scenario.testCases.map((tc, idx) => (
                                    <div key={tc.id || idx} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 transition-colors shadow-sm">
                                      <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-bold text-gray-900 dark:text-white text-sm transition-colors">{tc.title}</h4>
                                        <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-500 dark:text-gray-400 uppercase transition-colors">{tc.status}</span>
                                      </div>
                                      <div className="space-y-3">
                                        {tc.steps.map((step, sIdx) => (
                                          <div key={sIdx} className="flex gap-3 text-sm text-gray-600 dark:text-gray-300 transition-colors">
                                            <span className="text-gray-500 dark:text-gray-600 font-mono text-xs w-4 transition-colors">{sIdx + 1}.</span>
                                            <span>{step}</span>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 transition-colors">
                                        <span className={`text-[10px] font-black ${t.text} uppercase tracking-widest block mb-1 transition-colors`}>Expected Result</span>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">{tc.expectedResult}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : activeViewerTab === 'context' ? (
                      <div className="p-8 space-y-10">
                        <div className="space-y-4">
                          <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                            <UserCheck className={`w-4 h-4 ${t.textLight}`} /> Mapped Agent Persona
                          </div>

                          {viewingScript.persona ? (
                            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 relative overflow-hidden animate-in fade-in duration-300 transition-colors">
                              <div className="absolute top-0 right-0 p-4 opacity-5"><Bot className="w-20 h-20" /></div>
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white transition-colors">{viewingScript.persona.name}</h4>
                                <span className={`px-2 py-0.5 ${t.tag} text-[8px] font-black uppercase rounded tracking-widest transition-colors`}>{viewingScript.persona.skillLevel}</span>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 transition-colors">{viewingScript.persona.description}</p>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="text-[9px] font-black text-gray-500 dark:text-gray-600 uppercase block mb-1 hover:text-gray-700 dark:hover:text-gray-400 transition-colors">Behavioral Goal</span>
                                  <p className="text-[10px] text-gray-600 dark:text-gray-300 italic transition-colors">"{viewingScript.persona.goal}"</p>
                                </div>
                                <div>
                                  <span className="text-[9px] font-black text-gray-500 dark:text-gray-600 uppercase block mb-1 hover:text-gray-700 dark:hover:text-gray-400 transition-colors">Active Traits</span>
                                  <div className="flex flex-wrap gap-1">
                                    {viewingScript.persona.traits.map((t, idx) => (
                                      <span key={idx} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-[8px] font-bold text-gray-500 rounded uppercase transition-colors">{t}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800/50 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center animate-in fade-in duration-300 transition-colors">
                              <UserX className="w-12 h-12 text-gray-700 mb-4" />
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">No Agent Persona Assigned</p>
                              <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">This script executes under default system context without simulated user behavior traits.</p>
                            </div>
                          )}
                        </div>

                        <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase tracking-widest flex items-center justify-between transition-colors">
                          <div className="flex items-center gap-2">
                            <Database className={`w-4 h-4 ${t.text}`} /> Bound Dataset (Synthetic)
                          </div>
                          {!isEditingDataset ? (
                            <button
                              onClick={() => {
                                setEditedDataset(viewingScript.dataset ? [...viewingScript.dataset] : []);
                                setIsEditingDataset(true);
                              }}
                              className={`text-[10px] font-bold ${t.text} hover:opacity-80 uppercase tracking-wider flex items-center gap-1 transition-colors ${t.bgLight} dark:${t.bgDeep} px-2 py-1 rounded`}
                            >
                              <Edit2 className="w-3 h-3" /> Edit Dataset
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setIsEditingDataset(false)}
                                className="text-[10px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider transition-colors px-2 py-1"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={async () => {
                                  const updatedScript = { ...viewingScript, dataset: editedDataset };
                                  setViewingScript(updatedScript);
                                  await handleUpdateScript(updatedScript);
                                  setIsEditingDataset(false);
                                }}
                                className={`text-[10px] font-bold text-white ${t.bg} hover:opacity-90 uppercase tracking-wider flex items-center gap-1 transition-colors px-2 py-1 rounded shadow-sm`}
                              >
                                <Save className="w-3 h-3" /> Save Changes
                              </button>
                            </div>
                          )}
                        </div>

                        {isEditingDataset ? (
                          <div className="space-y-4">
                            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm transition-colors">
                              <div className="p-4 grid grid-cols-4 gap-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-[9px] font-black text-gray-400 uppercase tracking-widest transition-colors">
                                <span>Field (ID)</span>
                                <span>Value</span>
                                <span>Expected</span>
                                <span className="text-right pr-8">Type / Action</span>
                              </div>
                              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {editedDataset.map((row, idx) => (
                                  <div key={row.id} className="p-3 grid grid-cols-4 gap-4 items-center">
                                    <input
                                      type="text"
                                      value={row.field}
                                      onChange={e => updateEditedDatasetItem(idx, 'field', e.target.value)}
                                      className={`bg-transparent border-b border-transparent ${t.ring} outline-none text-[11px] font-bold ${t.text} mono transition-colors`}
                                      placeholder="FIELD_ID"
                                    />
                                    <input
                                      type="text"
                                      value={row.value || ''}
                                      onChange={e => updateEditedDatasetItem(idx, 'value', e.target.value)}
                                      className={`bg-transparent border-b border-transparent ${t.ring} outline-none text-[11px] text-gray-900 dark:text-blue-300 mono transition-colors`}
                                      placeholder="value"
                                    />
                                    <input
                                      type="text"
                                      value={row.expected_result || ''}
                                      onChange={e => updateEditedDatasetItem(idx, 'expected_result', e.target.value)}
                                      className={`bg-transparent border-b border-transparent ${t.ring} outline-none text-[11px] text-emerald-600 dark:text-emerald-400 mono transition-colors`}
                                      placeholder="expected"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <select
                                        value={row.type}
                                        onChange={e => updateEditedDatasetItem(idx, 'type', e.target.value as any)}
                                        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-1 text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase outline-none transition-colors"
                                      >
                                        <option value={DataType.VALID}>Valid</option>
                                        <option value={DataType.INVALID}>Invalid</option>
                                        <option value={DataType.SECURITY}>Security</option>
                                      </select>
                                      <button onClick={() => removeEditedDatasetRow(idx)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </div>
                                ))}
                                <button
                                  onClick={addEditedDatasetRow}
                                  className={`w-full py-4 text-[10px] font-black ${t.text} ${t.hover} dark:hover:bg-white/5 uppercase tracking-widest transition-all flex items-center justify-center gap-2`}
                                >
                                  <Plus className="w-4 h-4" /> Add Synthetic Vector
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-2xl transition-colors">
                            <table className="w-full text-left text-[11px] table-fixed">
                              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[9px] font-black uppercase text-gray-500 transition-colors">
                                <tr>
                                  <th className="px-5 py-3 w-[140px]">Field</th>
                                  <th className="px-5 py-3">Value</th>
                                  <th className="px-5 py-3 w-[180px]">Expected</th>
                                  <th className="px-5 py-3 text-right w-[80px]">Type</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 transition-colors">
                                {viewingScript.dataset && viewingScript.dataset.length > 0 ? viewingScript.dataset.map((row) => (
                                  <tr key={row.id} className={`${t.hover} dark:hover:bg-white/5 transition-colors`}>
                                    <td className="px-5 py-4 font-bold text-gray-700 dark:text-gray-300 mono transition-colors whitespace-nowrap overflow-hidden text-ellipsis">{row.field}</td>
                                    <td className={`px-5 py-4 ${t.text} dark:text-blue-300 mono transition-colors break-all`}>{row.value}</td>
                                    <td className="px-5 py-4 text-emerald-600 dark:text-emerald-400 font-bold transition-colors break-all">{row.expected_result || '-'}</td>
                                    <td className="px-5 py-4 text-right">
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${row.type === DataType.VALID ? 'bg-green-600/10 text-green-500' : 'bg-red-600/10 text-red-500'
                                        }`}>{row.type}</span>
                                    </td>
                                  </tr>
                                )) : (
                                  <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-600 italic">No dataset mapping found for this asset.</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : activeViewerTab === 'steps' ? (
                      <div className="p-8 space-y-6">
                        {viewingScript.steps && viewingScript.steps.length > 0 ? (
                          <div>
                            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center justify-between">
                              <span>Steps ({viewingScript.steps.length})</span>
                              <div className="flex items-center gap-3">
                                {viewingScript.platform && (
                                  <span className={`text-[10px] ${t.bgLight} dark:${t.bgDeep} ${t.text} px-2 py-0.5 rounded uppercase border ${t.borderLight} dark:border-gray-800`}>
                                    {viewingScript.platform}
                                  </span>
                                )}
                                {!isEditingSteps ? (
                                  <button
                                    onClick={() => {
                                      setEditedSteps(JSON.parse(JSON.stringify(viewingScript.steps || [])));
                                      setIsEditingSteps(true);
                                    }}
                                    className={`text-[10px] font-bold ${t.text} hover:opacity-80 uppercase tracking-wider flex items-center gap-1 transition-colors ${t.bgLight} dark:${t.bgDeep} px-2 py-1 rounded`}
                                  >
                                    <Edit2 className="w-3 h-3" /> Edit Steps
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => setIsEditingSteps(false)}
                                      className="text-[10px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider transition-colors px-2 py-1"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const updatedScript = { ...viewingScript, steps: editedSteps };
                                        setViewingScript(updatedScript);
                                        await handleUpdateScript(updatedScript);
                                        setIsEditingSteps(false);
                                      }}
                                      className={`text-[10px] font-bold text-white ${t.bg} hover:opacity-90 uppercase tracking-wider flex items-center gap-1 transition-colors px-2 py-1 rounded shadow-sm`}
                                    >
                                      <Save className="w-3 h-3" /> Save Changes
                                    </button>
                                  </div>
                                )}
                              </div>
                            </h4>
                            <div className="space-y-3">
                              {(isEditingSteps ? editedSteps : viewingScript.steps).map((step, idx) => (
                                <div key={idx} className={`bg-white dark:bg-[#16191f] border rounded-xl p-4 transition-all ${isEditingSteps ? `${t.border} dark:border-opacity-50 shadow-sm` : `border-gray-200 dark:border-gray-800 hover:${t.border}/50`}`}>
                                  <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
                                      {idx + 1}
                                    </div>
                                    {isEditingSteps && (
                                      <button 
                                        onClick={() => {
                                          const newSteps = editedSteps.filter((_, i) => i !== idx);
                                          // Re-index step_number starting from 1
                                          const reindexedSteps = newSteps.map((s, i) => ({ ...s, step_number: i + 1 }));
                                          setEditedSteps(reindexedSteps);
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                        title="Delete Step"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      {isEditingSteps ? (
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-2">
                                            <select
                                              value={step.action || ''}
                                              onChange={(e) => {
                                                const newSteps = [...editedSteps];
                                                newSteps[idx].action = e.target.value;
                                                setEditedSteps(newSteps);
                                              }}
                                              className={`text-[10px] font-black uppercase tracking-wider ${t.text} ${t.bgLight} dark:${t.bgDeep} px-1.5 py-1 rounded border ${t.borderLight} dark:border-opacity-30 outline-none`}
                                            >
                                              <option value="navigate">NAVIGATE</option>
                                              <option value="click">CLICK</option>
                                              <option value="type">TYPE</option>
                                              <option value="input">INPUT</option>
                                              <option value="wait">WAIT</option>
                                              <option value="finish">FINISH</option>
                                            </select>
                                            <input
                                              type="text"
                                              placeholder="Step Name"
                                              value={step.stepName || ''}
                                              onChange={(e) => {
                                                const newSteps = [...editedSteps];
                                                newSteps[idx].stepName = e.target.value;
                                                setEditedSteps(newSteps);
                                              }}
                                              className={`flex-1 text-xs font-bold text-gray-900 dark:text-white bg-transparent border-b border-gray-200 dark:border-gray-700 ${t.ring} outline-none py-0.5`}
                                            />
                                          </div>
                                          <input
                                            type="text"
                                            placeholder="Description"
                                            value={step.description || ''}
                                            onChange={(e) => {
                                              const newSteps = [...editedSteps];
                                              newSteps[idx].description = e.target.value;
                                              setEditedSteps(newSteps);
                                            }}
                                            className={`w-full text-[11px] text-gray-600 dark:text-gray-400 bg-transparent border-b border-gray-200 dark:border-gray-700 ${t.ring} outline-none py-0.5`}
                                          />
                                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                                            <div>
                                              <span className="text-gray-400 uppercase tracking-tighter block text-[8px]">Locator Type</span>
                                              <select
                                                value={step.selectorType || ''}
                                                onChange={(e) => {
                                                  const newSteps = [...editedSteps];
                                                  newSteps[idx].selectorType = e.target.value;
                                                  setEditedSteps(newSteps);
                                                }}
                                                className="w-full bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded border border-gray-200 dark:border-gray-700 outline-none font-mono text-gray-700 dark:text-gray-300"
                                              >
                                                <option value="CSS">CSS</option>
                                                <option value="XPATH">XPATH</option>
                                                <option value="ID">ID</option>
                                                <option value="ACCESSIBILITY_ID">ACCESSIBILITY ID</option>
                                                <option value="TEXT">TEXT</option>
                                              </select>
                                            </div>
                                            <div>
                                              <span className="text-gray-400 uppercase tracking-tighter block text-[8px]">Locator Value</span>
                                              <input
                                                type="text"
                                                value={step.selectorValue || ''}
                                                onChange={(e) => {
                                                  const newSteps = [...editedSteps];
                                                  newSteps[idx].selectorValue = e.target.value;
                                                  setEditedSteps(newSteps);
                                                }}
                                                className="w-full bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded border border-gray-200 dark:border-gray-700 outline-none font-mono text-gray-700 dark:text-gray-300"
                                              />
                                            </div>
                                          </div>
                                          <div className="mt-2 text-[10px]">
                                            <span className={`text-[8px] ${t.textLight} uppercase tracking-tighter block mb-0.5`}>Input Value</span>
                                            <input
                                              type="text"
                                              value={step.inputValue || ''}
                                              onChange={(e) => {
                                                const newSteps = [...editedSteps];
                                                newSteps[idx].inputValue = e.target.value;
                                                setEditedSteps(newSteps);
                                              }}
                                              className={`w-full ${t.bgMuted} dark:${t.bgDeep2} p-1.5 rounded-lg border ${t.borderMuted} dark:border-gray-800 outline-none font-mono ${t.text} dark:text-blue-300`}
                                              placeholder="e.g. {{search_query}}"
                                            />
                                          </div>
                                          <div className="mt-2 text-[10px]">
                                            <span className="text-blue-500 uppercase tracking-tighter text-[8px] mb-0.5 flex items-center gap-1">
                                              <CheckCircle2 className="w-2.5 h-2.5" /> Rule Assertion
                                            </span>
                                            <input
                                              type="text"
                                              value={step.assertText || ''}
                                              onChange={(e) => {
                                                const newSteps = [...editedSteps];
                                                newSteps[idx].assertText = e.target.value;
                                                setEditedSteps(newSteps);
                                              }}
                                              className="w-full bg-blue-50/50 dark:bg-blue-500/10 p-1.5 rounded-lg border border-blue-200 dark:border-blue-500/30 outline-none font-mono text-gray-900 dark:text-white"
                                              placeholder="e.g. {{search_query_expected}}"
                                            />
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-black uppercase tracking-wider ${t.text} ${t.bgLight} dark:${t.bgDeep} px-1.5 py-0.5 rounded border ${t.borderLight} dark:border-opacity-20`}>
                                              {step.action || 'Unknown'}
                                            </span>
                                            {step.stepName && <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{step.stepName}</span>}
                                          </div>
                                          <p className="text-[11px] text-gray-600 dark:text-gray-400 mb-2 truncate">
                                            {step.description || "No description"}
                                          </p>
                                          <div className="grid grid-cols-2 gap-2 text-[10px] bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                                            <div>
                                              <span className="text-gray-400 uppercase tracking-tighter block text-[8px]">Locator Type</span>
                                              <span className="font-mono text-gray-700 dark:text-gray-300">{step.selectorType || '-'}</span>
                                            </div>
                                            <div>
                                              <span className="text-gray-400 uppercase tracking-tighter block text-[8px]">Locator Value</span>
                                              <span className="font-mono text-gray-700 dark:text-gray-300 truncate" title={step.selectorValue}>{step.selectorValue || '-'}</span>
                                            </div>
                                          </div>
                                          {step.inputValue && (
                                            <div className={`mt-2 text-[10px] ${t.bgLight} dark:${t.bgDeep} p-2 rounded-lg border ${t.borderLight} dark:border-opacity-30 transition-colors`}>
                                              <span className={`text-[8px] ${t.textLight} uppercase tracking-tighter block mb-0.5`}>Input Value</span>
                                              <span className={`font-mono ${t.text} dark:text-blue-300`}>{step.inputValue}</span>
                                            </div>
                                          )}
                                          {step.assertText && (
                                            <div className="mt-2 text-[10px] bg-blue-50 dark:bg-blue-500/10 p-2 rounded-lg border border-blue-200 dark:border-blue-500/30 transition-colors flex flex-col">
                                              <span className="text-blue-500 uppercase tracking-tighter text-[8px] mb-0.5 flex items-center gap-1">
                                                <CheckCircle2 className="w-2.5 h-2.5" /> Rule Assertion
                                              </span>
                                              <span className="font-mono text-gray-900 dark:text-white">"{step.assertText}"</span>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                                {isEditingSteps && (
                                  <button
                                    onClick={() => {
                                      const newStep = {
                                        step_number: editedSteps.length + 1,
                                        action: 'click',
                                        stepName: '',
                                        description: '',
                                        selectorType: 'CSS',
                                        selectorValue: '',
                                        inputValue: '',
                                        assertText: '',
                                        status: 'Completed'
                                      };
                                      setEditedSteps([...editedSteps, newStep]);
                                    }}
                                    className={`w-full py-3 mt-4 border-2 border-dashed ${t.borderLight} dark:border-gray-800 rounded-xl text-[10px] font-black ${t.text} uppercase tracking-widest hover:bg-white dark:hover:bg-white/5 transition-all flex items-center justify-center gap-2`}
                                  >
                                    <Plus className="w-4 h-4" /> Add New Step
                                  </button>
                                )}
                              </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800/50 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center">
                            <Tags className="w-12 h-12 text-gray-400 mb-4 opacity-50" />
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">No detailed steps recorded</p>
                            <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">This script does not have native step-by-step metadata available for execution tracking.</p>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}


      {/* REGISTRATION / EDIT MODAL */}
      {
        showRegisterModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-8 bg-black/50 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-5xl bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[95vh] animate-in zoom-in-95 duration-200 transition-colors">
              <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/20 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-2xl text-white">
                    {editingScriptId ? <Edit3 className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight transition-colors">{editingScriptId ? 'Modify Asset Strategy' : 'Register Manual Asset'}</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Define logic, tags, and testing vectors</p>
                  </div>
                </div>
                <button onClick={() => {
                  setShowRegisterModal(false);
                  setIsEditingDataset(false);
                  setIsEditingSteps(false);
                }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 lg:grid-cols-2 gap-10 custom-scrollbar">
                <div className="space-y-6">
                  {/* Left Column: Basic Information */}
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Basic Definition</label>
                      <div className="grid grid-cols-1 gap-3">
                        <input
                          type="text"
                          value={newManualScript.name}
                          onChange={e => setNewManualScript({ ...newManualScript, name: e.target.value })}
                          className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
                          placeholder="Script Name"
                        />
                        <input
                          type="text"
                          value={newManualScript.tags}
                          onChange={e => setNewManualScript({ ...newManualScript, tags: e.target.value })}
                          className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4 text-sm text-indigo-600 dark:text-indigo-400 focus:border-indigo-500 outline-none transition-all"
                          placeholder="Tags (comma separated, e.g. Login, Mobile, Security)"
                        />
                        <textarea
                          value={newManualScript.description}
                          onChange={e => setNewManualScript({ ...newManualScript, description: e.target.value })}
                          className="w-full h-24 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4 text-sm text-gray-700 dark:text-gray-300 focus:border-indigo-500 outline-none transition-all resize-none"
                          placeholder="Describe the logic flow..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-indigo-400" />
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Asset Category</label>
                        </div>
                        <select
                          value={newManualScript.category}
                          onChange={e => setNewManualScript({ ...newManualScript, category: e.target.value })}
                          className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4 text-sm text-gray-700 dark:text-gray-300 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Select Category</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-red-400" />
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Priority Tier</label>
                        </div>
                        <select
                          value={newManualScript.priority}
                          onChange={e => setNewManualScript({ ...newManualScript, priority: e.target.value })}
                          className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4 text-sm text-gray-700 dark:text-gray-300 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                        >
                          <option value="P0">P0 - Critical Path</option>
                          <option value="P1">P1 - High Importance</option>
                          <option value="P2">P2 - Normal Operations</option>
                          <option value="P3">P3 - Low Impact</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Right Column: Execution Settings */}
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Engine & Logic Type</label>
                      <div className="flex bg-gray-100 dark:bg-[#0c0e12] p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 gap-1 transition-colors">
                        <button
                          onClick={() => setNewManualScript({ ...newManualScript, engine: 'Playwright' })}
                          className={`flex-1 py-4 px-2 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-2 ${newManualScript.engine === 'Playwright' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg border border-gray-200 dark:border-gray-700' : 'text-gray-500 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-400'}`}
                        >
                          <Globe className="w-5 h-5" /> Web (Playwright)
                        </button>
                        <button
                          onClick={() => setNewManualScript({ ...newManualScript, engine: 'Appium' })}
                          className={`flex-1 py-4 px-2 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-2 ${newManualScript.engine === 'Appium' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-400'}`}
                        >
                          <Smartphone className="w-5 h-5" /> App (Appium)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-indigo-400" />
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Retry Policy</label>
                      </div>
                      <div className="flex items-center gap-4 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-3">
                        <input
                          type="range"
                          min="0"
                          max="9"
                          value={newManualScript.try_count - 1}
                          onChange={e => setNewManualScript({ ...newManualScript, try_count: parseInt(e.target.value) + 1 })}
                          className="flex-1 accent-indigo-600"
                        />
                        <div className="flex flex-col items-center">
                          <span className="text-[14px] font-black text-indigo-600 dark:text-indigo-400">{newManualScript.try_count - 1}</span>
                          <span className="text-[8px] font-bold text-gray-400 uppercase">Retry</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-gray-500 italic px-1">"Indicates how many times to retry on failure."</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-indigo-400" />
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Self Healing Mode</label>
                      </div>
                      <div className="flex items-center justify-between bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-gray-900 dark:text-gray-200">Enable Self-Healing</span>
                          <span className="text-[9px] text-gray-500">Automatically performs self-healing if the test execution fails.</span>
                        </div>
                        <button
                          onClick={() => setNewManualScript({ ...newManualScript, enable_ai_test: !newManualScript.enable_ai_test })}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          {/* TODO: Rename field to enable_self_healing */}
                          {newManualScript.enable_ai_test ? <ToggleRight className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> : <ToggleLeft className="w-6 h-6 text-gray-400 dark:text-gray-700" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="p-8 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/20 flex justify-end gap-4 transition-colors">
                <button onClick={() => setShowRegisterModal(false)} className="px-8 py-4 text-[10px] font-black text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-widest transition-colors">CANCEL</button>
                <button
                  onClick={handleSaveManual}
                  disabled={!newManualScript.name || !newManualScript.code}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[10px] font-black px-12 py-4 rounded-2xl uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingScriptId ? 'Update Asset' : 'Register Golden Script'}
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* SCENARIO VIEWER MODAL */}
      {
        viewingScenario && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-8 bg-black/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200 transition-colors">
              <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/20 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-2xl text-white">
                    <FileCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight transition-colors">Linked Scenario Context</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Foundational Logic for Asset</p>
                  </div>
                </div>
                <button onClick={() => setViewingScenario(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Scenario Title</label>
                  <div className="text-lg font-bold text-gray-900 dark:text-white transition-colors">{viewingScenario.title}</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">{viewingScenario.description}</p>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Test Cases / Steps</label>
                  <div className="space-y-4">
                    {viewingScenario.testCases.map((tc, idx) => (
                      <div key={tc.id || idx} className="bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-gray-900 dark:text-white text-sm transition-colors">{tc.title}</h4>
                          <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-500 dark:text-gray-400 uppercase transition-colors">{tc.status}</span>
                        </div>
                        <div className="space-y-3">
                          {tc.steps.map((step, sIdx) => (
                            <div key={sIdx} className="flex gap-3 text-sm text-gray-600 dark:text-gray-300 transition-colors">
                              <span className="text-gray-500 dark:text-gray-600 font-mono text-xs w-4 transition-colors">{sIdx + 1}.</span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 transition-colors">
                          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1 transition-colors">Expected Result</span>
                          <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">{tc.expectedResult}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

    </div >
  );
};

export default AssetLibrary;
