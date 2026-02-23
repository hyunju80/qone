
import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, Clock, Search, Filter, Plus, FileCode, CheckCircle2,
  MoreVertical, Star, Bot, User as UserIcon, X, Play, Loader2, Terminal as TerminalIcon,
  Copy, Check, Users, Database, Zap, Activity, Info, Table, AlertTriangle, ShieldAlert,
  Code, Tags, Save, Upload, FileUp, Edit3, Trash2, Maximize2, RefreshCw, UserCheck, Settings2, Hash,
  ToggleLeft, ToggleRight, Target, UserX, Globe, Smartphone, Laptop
} from 'lucide-react';
import { ScriptStatus, TestScript, ScriptOrigin, DataType, TestHistory, Persona, TestDataRow, TestEngine, Scenario, StepAsset } from '../types';
import { testApi } from '../api/test';
import { scenariosApi } from '../api/scenarios';
import LiveExecutionModal from './LiveExecutionModal';

interface AssetLibraryProps {
  scripts: TestScript[];
  steps?: StepAsset[]; // Added steps prop
  activeProjectId: string;
  personas: Persona[];
  onRecordHistory?: (history: TestHistory) => void;
  onRefresh?: () => void;
  onAlert?: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
  initialSearchTerm?: string;
}

const AssetLibrary: React.FC<AssetLibraryProps> = ({ scripts, steps = [], activeProjectId, personas, onRecordHistory, onRefresh, onAlert, initialSearchTerm = '' }) => {
  const [filter, setFilter] = useState<'ALL' | 'AI' | 'AI_EXPLORATION' | 'MANUAL' | 'FAVORITES' | 'STEP'>('ALL'); // Added STEP
  const [searchQuery, setSearchQuery] = useState(initialSearchTerm);

  // Update search query when initialSearchTerm changes (e.g. navigation from History)
  useEffect(() => {
    if (initialSearchTerm) {
      setSearchQuery(initialSearchTerm);
    }
  }, [initialSearchTerm]);
  const [viewingScript, setViewingScript] = useState<TestScript | null>(null);
  const [viewingStep, setViewingStep] = useState<StepAsset | null>(null); // Added viewingStep state
  const [executingScript, setExecutingScript] = useState<TestScript | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeViewerTab, setActiveViewerTab] = useState<'code' | 'context'>('code');

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
    engine: 'Playwright' as TestEngine,
    dataset: [] as TestDataRow[]
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

  const handleRunTest = async (script: TestScript) => {
    if (!script.isActive) return;
    setExecutingScript(script);

    try {
      const { run_id } = await testApi.dryRun(script.code);
      setActiveRunId(run_id);
    } catch (e: any) {
      console.error("Failed to start run", e);
      // Fallback or alert? For now just log.
    }
  };

  const filteredScripts = scripts.filter(script => {
    if (filter === 'STEP') return false; // Don't show scripts in STEP filter
    if (script.origin === ScriptOrigin.STEP) return false; // Exclude STEP assets from script list (handled separately)
    if (filter === 'ALL') return true;
    if (filter === 'FAVORITES') return script.isFavorite;
    return script.origin === filter;
  }).filter(script =>
    (script.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (script.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    script.tags?.some(tag => tag?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (script.id?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const filteredSteps = steps.filter(step => {
    if (filter !== 'STEP' && filter !== 'ALL') return false; // Show steps only in ALL or STEP? Ideally just STEP to avoid clutter, or ALL if desired. User asked for 'STEP' filter. Let's show in STEP only for clarity, or ALL if user expects everything.
    // Let's stick to showing steps primarily when filter is STEP or ALL.
    // Actually, usually 'ALL' mixes everything. Let's include in ALL but usually steps are distinct.
    // Given the UI structure, let's include them in ALL or just STEP.
    // Re-reading user request: "Asset library filter 'STEP' add". providing a dedicated view.
    // Let's include in ALL if it makes sense, but the rendering might differ.
    // For now, let's filter them.
    return (step.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (step.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (step.id?.toLowerCase() || '').includes(searchQuery.toLowerCase());
  });

  const handleExecutionComplete = async (status: 'success' | 'error', capturedLogs?: string) => {
    if (!executingScript) return;

    const durationStr = "N/A"; // Modal doesn't track duration yet, could infer or just leave as N/A

    // Parse logs into array of strings
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
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Failed to save history", e);
    }

    // Reset - Removed to allow user to view results. Modal must be closed manually.
    // setActiveRunId(null);
    // setExecutingScript(null);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        origin: ScriptOrigin.MANUAL
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
        is_favorite: script.isFavorite
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

  const handleToggleStepFavorite = async (e: React.MouseEvent, step: StepAsset) => {
    e.stopPropagation();
    try {
      await testApi.updateScript(step.id, { is_favorite: !step.isFavorite });
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Failed to toggle step favorite", e);
      if (onAlert) onAlert("Error", "Failed to update step.", 'error');
    }
  };

  const handleToggleStepActive = async (e: React.MouseEvent, step: StepAsset) => {
    e.stopPropagation();
    try {
      await testApi.updateScript(step.id, { is_active: !step.isActive });
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Failed to toggle step active", e);
      if (onAlert) onAlert("Error", "Failed to update step.", 'error');
    }
  };

  const handleModifyScript = (script: TestScript) => {
    setEditingScriptId(script.id);
    setNewManualScript({
      name: script.name,
      description: script.description,
      code: script.code,
      tags: script.tags?.join(', ') || '',
      engine: script.engine || 'Playwright',
      dataset: script.dataset ? [...script.dataset] : []
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
          tags: newManualScript.tags.split(',').map(t => t.trim()).filter(t => t !== ''),
          dataset: newManualScript.dataset
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
        tags: newManualScript.tags.split(',').map(t => t.trim()).filter(t => t !== ''),
        isFavorite: false,
        isActive: true,
        dataset: newManualScript.dataset
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









  const editingScript = editingScriptId ? scripts.find(s => s.id === editingScriptId) : null;

  return (
    <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto relative custom-scrollbar">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 transition-colors">Asset Library</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm transition-colors">Manage your Certified Golden Scripts and AI-generated assets.</p>
        </div>
        <button
          onClick={() => {
            setEditingScriptId(null);
            setNewManualScript({
              name: '',
              description: '',
              code: 'test(\'example\', async ({ page }) => {\n  // Implementation here\n});',
              tags: '',
              engine: 'Playwright',
              dataset: []
            });
            setShowRegisterModal(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-all text-sm font-semibold shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          Register Manual Script
        </button>
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
          {['ALL', 'FAVORITES', 'AI', 'AI_EXPLORATION', 'MANUAL', 'STEP'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${filter === f ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'}`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {filteredScripts.map(script => (
          <div key={script.id} className={`bg-white dark:bg-[#16191f] border rounded-2xl p-5 hover:border-gray-300 dark:hover:border-gray-700 transition-all group flex flex-col relative overflow-hidden ${script.isActive ? 'border-gray-200 dark:border-gray-800' : 'border-red-500/30 dark:border-red-900/30 opacity-60 grayscale'}`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 blur-2xl rounded-full" />

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
                  <button onClick={() => handleModifyScript(script)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500" title="Modify Asset"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => { setViewingScript(script); setActiveViewerTab('code'); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500" title="Asset Intelligence"><Maximize2 className="w-4 h-4" /></button>
                  {scenarios.find(s => s.goldenScriptId === script.id) && (
                    <button
                      onClick={() => setViewingScenario(scenarios.find(s => s.goldenScriptId === script.id) || null)}
                      className="p-2 hover:bg-indigo-600/10 rounded-lg text-indigo-600 dark:text-indigo-400"
                      title="View Linked Scenario"
                    >
                      <FileCode className="w-4 h-4" />
                    </button>
                  )}
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
              {script.tags?.map((t, idx) => (
                <span key={idx} className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-[9px] font-bold text-gray-500 uppercase tracking-tighter transition-colors">
                  <Hash className="w-2.5 h-2.5 text-indigo-500 opacity-50" /> {t}
                </span>
              ))}
            </div>

            <div className="mb-6 space-y-3 mt-auto relative z-10">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 transition-colors">
                  <div className="text-[8px] text-gray-600 font-black uppercase tracking-tighter mb-1">Success Rate</div>
                  <div className="text-xs font-bold text-gray-900 dark:text-gray-200 transition-colors">{script.successRate}%</div>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 transition-colors">
                  <div className="text-[8px] text-gray-600 font-black uppercase tracking-tighter mb-1">Total Runs</div>
                  <div className={`text-xs font-bold ${script.isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600'}`}>{script.runCount || 0}</div>
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
                  <div className="px-2 py-1 rounded text-[8px] font-black uppercase flex items-center justify-center gap-1 leading-none bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-300 border border-gray-200 dark:border-transparent">
                    STEP ASSET
                  </div>
                  <button
                    onClick={(e) => handleToggleStepActive(e, step)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  >
                    {step.isActive !== false ? <ToggleRight className="w-5 h-5 text-emerald-600 dark:text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400 dark:text-gray-700" />}
                  </button>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setViewingStep(step)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500" title="Asset Intelligence"><Maximize2 className="w-4 h-4" /></button>
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
            </div>

            <div className="mb-6 space-y-3 mt-auto relative z-10">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 transition-colors">
                  <div className="text-[8px] text-gray-600 font-black uppercase tracking-tighter mb-1">Success Rate</div>
                  <div className="text-xs font-bold text-gray-900 dark:text-gray-200 transition-colors">{step.successRate ?? 0}%</div>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 transition-colors">
                  <div className="text-[8px] text-gray-600 font-black uppercase tracking-tighter mb-1">Total Runs</div>
                  <div className={`text-xs font-bold ${step.isActive !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600'}`}>{step.runCount || 0}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[9px] text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> {step.updatedAt ? new Date(step.updatedAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                if (onAlert) onAlert("Info", "Coming soon!", 'info');
              }}
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
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#16191f] border-l border-gray-200 dark:border-gray-800 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 transition-colors">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/20 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-indigo-600 rounded-xl text-white">
                  {viewingScript.engine === 'Appium' ? <Smartphone className="w-5 h-5" /> : <FileCode className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Asset Intelligence Center</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{viewingScript.name}</p>
                </div>
              </div>
              <button onClick={() => setViewingScript(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#16191f] transition-colors">
              <button
                onClick={() => setActiveViewerTab('code')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeViewerTab === 'code' ? 'text-indigo-600 dark:text-indigo-400 border-indigo-500' : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                <Code className="w-3.5 h-3.5 inline mr-2" /> Code Source
              </button>
              <button
                onClick={() => setActiveViewerTab('context')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeViewerTab === 'context' ? 'text-indigo-600 dark:text-indigo-400 border-indigo-500' : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                <Bot className="w-3.5 h-3.5 inline mr-2" /> Execution Context
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-[#0c0e12] relative custom-scrollbar transition-colors">
              {activeViewerTab === 'code' ? (
                <div className="p-8">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{viewingScript.engine} Implementation</span>
                    <button
                      onClick={() => handleCopyCode(viewingScript.code)}
                      className="flex items-center gap-2 text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 uppercase tracking-widest transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy Code'}
                    </button>
                  </div>
                  <pre className="mono text-[12px] text-gray-800 dark:text-blue-300 leading-relaxed whitespace-pre p-6 bg-white dark:bg-black/40 rounded-2xl border border-gray-200 dark:border-gray-800 transition-colors">
                    {viewingScript.code}
                  </pre>
                </div>
              ) : (
                <div className="p-8 space-y-10">
                  <div className="space-y-4">
                    <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-indigo-400" /> Mapped Agent Persona
                    </div>

                    {viewingScript.persona ? (
                      <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 relative overflow-hidden animate-in fade-in duration-300 transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><Bot className="w-20 h-20" /></div>
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-bold text-gray-900 dark:text-white transition-colors">{viewingScript.persona.name}</h4>
                          <span className="px-2 py-0.5 bg-indigo-600/10 border border-indigo-500/20 text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase rounded tracking-widest transition-colors">{viewingScript.persona.skillLevel}</span>
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

                  <div className="space-y-4">
                    <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase tracking-widest flex items-center gap-2 transition-colors">
                      <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Bound Dataset (Synthetic)
                    </div>
                    <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-2xl transition-colors">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[9px] font-black uppercase text-gray-500 transition-colors">
                          <tr>
                            <th className="px-5 py-3">Field</th>
                            <th className="px-5 py-3">Value</th>
                            <th className="px-5 py-3 text-right">Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800 transition-colors">
                          {viewingScript.dataset && viewingScript.dataset.length > 0 ? viewingScript.dataset.map((row) => (
                            <tr key={row.id} className="hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-colors">
                              <td className="px-5 py-4 font-bold text-gray-700 dark:text-gray-300 mono transition-colors">{row.field}</td>
                              <td className="px-5 py-4 text-indigo-600 dark:text-blue-300 mono transition-colors">{row.value}</td>
                              <td className="px-5 py-4 text-right">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${row.type === DataType.VALID ? 'bg-green-600/10 text-green-500' : 'bg-red-600/10 text-red-500'
                                  }`}>{row.type}</span>
                              </td>
                            </tr>
                          )) : (
                            <tr><td colSpan={3} className="px-5 py-10 text-center text-gray-600 italic">No dataset mapping found for this asset.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP DETAIL VIEWER OVERLAY */}
      {viewingStep && (
        <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm" onClick={() => setViewingStep(null)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#16191f] border-l border-gray-200 dark:border-gray-800 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 transition-colors">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/20 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-emerald-600 rounded-xl text-white">
                  <Tags className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Step Asset Details</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{viewingStep.name}</p>
                </div>
              </div>
              <button onClick={() => setViewingStep(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-[#0c0e12] relative custom-scrollbar transition-colors p-6">
              <div className="mb-6">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Description</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-[#16191f] p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                  {viewingStep.description || "No description provided."}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 flex items-center justify-between">
                  <span>Steps ({viewingStep.steps.length})</span>
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded uppercase">{viewingStep.platform}</span>
                </h4>
                <div className="space-y-3">
                  {viewingStep.steps.map((step, idx) => (
                    <div key={idx} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl p-4 transition-all hover:border-indigo-500/50">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-500/20">
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
                              <span className="font-mono text-gray-700 dark:text-gray-300">{step.selectorType}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 uppercase tracking-tighter block text-[8px]">Locator Value</span>
                              <span className="font-mono text-gray-700 dark:text-gray-300 truncate" title={step.selectorValue}>{step.selectorValue}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP DETAIL VIEWER OVERLAY */}
      {viewingStep && (
        <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm" onClick={() => setViewingStep(null)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#16191f] border-l border-gray-200 dark:border-gray-800 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 transition-colors">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/20 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-emerald-600 rounded-xl text-white">
                  <Tags className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Step Asset Details</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{viewingStep.name}</p>
                </div>
              </div>
              <button onClick={() => setViewingStep(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-[#0c0e12] relative custom-scrollbar transition-colors p-6">
              <div className="mb-6">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Description</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-[#16191f] p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                  {viewingStep.description || "No description provided."}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 flex items-center justify-between">
                  <span>Steps ({viewingStep.steps.length})</span>
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded uppercase">{viewingStep.platform}</span>
                </h4>
                <div className="space-y-3">
                  {viewingStep.steps.map((step, idx) => (
                    <div key={idx} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl p-4 transition-all hover:border-indigo-500/50">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-500/20">
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
                              <span className="font-mono text-gray-700 dark:text-gray-300">{step.selectorType}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 uppercase tracking-tighter block text-[8px]">Locator Value</span>
                              <span className="font-mono text-gray-700 dark:text-gray-300 truncate" title={step.selectorValue}>{step.selectorValue}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REGISTRATION / EDIT MODAL */}
      {showRegisterModal && (
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
              <button onClick={() => setShowRegisterModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 lg:grid-cols-2 gap-10 custom-scrollbar">
              <div className="space-y-8">
                <div className="space-y-4">
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

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Basic Definition</label>
                  <div className="grid grid-cols-1 gap-4">
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

                {/* Assigned Persona Information (Read-only) */}
                {editingScript?.persona && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-indigo-400" />
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Assigned Persona Context</label>
                    </div>
                    <div className="p-6 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-2xl relative overflow-hidden group transition-colors">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Bot className="w-16 h-16 text-indigo-500 dark:text-indigo-400" /></div>
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white transition-colors">{editingScript.persona.name}</h4>
                        <span className="px-2 py-0.5 bg-indigo-600/10 border border-indigo-500/20 text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase rounded tracking-widest transition-colors">{editingScript.persona.skillLevel}</span>
                      </div>
                      <p className="text-[10px] text-gray-600 dark:text-gray-500 leading-relaxed italic mb-4 transition-colors">"{editingScript.persona.goal}"</p>
                      <div className="flex flex-wrap gap-1">
                        {editingScript.persona.traits.map((t, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-[8px] font-bold text-gray-600 dark:text-gray-600 rounded uppercase transition-colors">{t}</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-600 italic px-2">"이 페르소나는 Test Generator에서 생성 시 지정된 불변 컨텍스트입니다."</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Implementation Source</label>
                    <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 transition-colors"><FileUp className="w-3.5 h-3.5" /> Import</button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".js,.ts" onChange={handleFileUpload} />
                  </div>
                  <div className="bg-gray-50 dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden focus-within:border-indigo-500 transition-all">
                    <textarea
                      value={newManualScript.code}
                      onChange={e => setNewManualScript({ ...newManualScript, code: e.target.value })}
                      className="w-full h-64 bg-transparent p-5 mono text-[11px] text-gray-800 dark:text-green-400 outline-none resize-none transition-colors"
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Dataset Configuration</label>
                  <button onClick={addDatasetRow} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-600 hover:text-white text-gray-500 dark:text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 transition-all">
                    <Plus className="w-3.5 h-3.5" /> Add Field
                  </button>
                </div>
                <div className="bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden min-h-[400px] flex flex-col shadow-inner transition-colors">
                  <div className="p-4 grid grid-cols-3 gap-4 border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900/50 text-[9px] font-black text-gray-500 dark:text-gray-600 uppercase tracking-widest transition-colors">
                    <span>Field (ID)</span>
                    <span>Synthetic Value</span>
                    <span className="text-right">Actions</span>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
                    {newManualScript.dataset.map((row, idx) => (
                      <div key={row.id} className="p-4 grid grid-cols-3 gap-4 border-b border-gray-200 dark:border-gray-900 items-center group transition-colors">
                        <input
                          type="text"
                          value={row.field}
                          onChange={e => updateDatasetItem(idx, 'field', e.target.value)}
                          className="bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mono placeholder:text-gray-400 dark:placeholder:text-gray-800 transition-colors"
                          placeholder="FIELD_ID"
                        />
                        <input
                          type="text"
                          value={row.value}
                          onChange={e => updateDatasetItem(idx, 'value', e.target.value)}
                          className="bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-[11px] text-gray-900 dark:text-blue-300 mono placeholder:text-gray-400 dark:placeholder:text-gray-800 transition-colors"
                          placeholder="value"
                        />
                        <div className="flex justify-end gap-2">
                          <select
                            value={row.type}
                            onChange={e => updateDatasetItem(idx, 'type', e.target.value as any)}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1 text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase outline-none transition-colors"
                          >
                            <option value={DataType.VALID}>Valid</option>
                            <option value={DataType.INVALID}>Invalid</option>
                            <option value={DataType.SECURITY}>Security</option>
                          </select>
                          <button onClick={() => removeDatasetRow(idx)} className="p-1.5 text-gray-700 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
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
      )}
      {/* SCENARIO VIEWER MODAL */}
      {viewingScenario && (
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
      )}

    </div>
  );
};

export default AssetLibrary;
