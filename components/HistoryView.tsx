import React, { useState, useMemo } from 'react';
import {
   History, Search, Filter, Calendar, Clock, ChevronRight,
   CheckCircle2, XCircle, Info, HelpCircle, Activity, Terminal, Loader2,
   BarChart3, LayoutGrid, ArrowUpRight, Zap, Bot, Users,
   X, Download, AlertTriangle, FileText, GitBranch, MousePointer2, Timer,
   Hash, Layers, Tag, Target, Save, Wand2, Code2
} from 'lucide-react';
import { TestHistory, Project, ExecutionTrigger, TestScript, ScriptOrigin } from '../types';
import api from '../api/client';
import { testApi } from '../api/test';
import TestDashboard from './TestDashboard';
import LiveExecutionModal from './LiveExecutionModal';
import JiraSyncModal from './JiraSyncModal';

interface HistoryViewProps {
   history: TestHistory[];
   activeProject: Project;
   onRefresh?: () => void;
   onNavigateToLibrary?: (scriptId: string) => void;
   scripts?: TestScript[];
   initialTab?: 'dashboard' | 'history' | 'defects';
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, activeProject, onRefresh, onNavigateToLibrary, scripts = [], initialTab = 'dashboard' }) => {
   const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'defects'>(initialTab);

   // Sync tab if prop changes (for direct navigation from other views)
   React.useEffect(() => {
     if (initialTab) {
       setActiveTab(initialTab);
     }
   }, [initialTab]);

   // Refresh history on mount
   React.useEffect(() => {
      if (onRefresh) {
         onRefresh();
      }
   }, []);

   const [searchTerm, setSearchTerm] = useState('');
   const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed'>('all');
   const [triggerFilter, setTriggerFilter] = useState<'all' | ExecutionTrigger>('all');
   const [originFilter, setOriginFilter] = useState<'all' | 'AI' | 'AI_EXPLORATION' | 'MANUAL' | 'STEP'>('all');
   const [selectedContext, setSelectedContext] = useState<string>('All Contexts');
   const [selectedReport, setSelectedReport] = useState<TestHistory | null>(null);
   const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null);

   // Date Filter State
   const [startDate, setStartDate] = useState<string>('');
   const [endDate, setEndDate] = useState<string>('');

   // Pagination State
   const [currentPage, setCurrentPage] = useState(1);
   const [itemsPerPage, setItemsPerPage] = useState(10);
   const [summaryStats, setSummaryStats] = useState<any>(null);
   const [activeDefectsFromApi, setActiveDefectsFromApi] = useState<any[]>([]);
   const [isLoadingDefects, setIsLoadingDefects] = useState(false);

   const loadSummary = async () => {
      if (activeProject) {
         try {
            const res = await testApi.getHistorySummary(activeProject.id);
            setSummaryStats(res);
         } catch (e) {
            console.error("Failed to fetch history summary", e);
         }
      }
   };

   React.useEffect(() => {
      loadSummary();
   }, [activeProject]);

   // Refresh summary when history changes
   React.useEffect(() => {
      loadSummary();
   }, [history]);

   const loadAllActiveDefects = async () => {
      if (!activeProject?.id) return;
      setIsLoadingDefects(true);
      try {
         const data = await testApi.getActiveDefects(activeProject.id);
         setActiveDefectsFromApi(data);
      } catch (e) {
         console.error("Failed to load all active defects", e);
      } finally {
         setIsLoadingDefects(false);
      }
   };

   React.useEffect(() => {
      if (activeTab === 'defects') {
         loadAllActiveDefects();
      }
   }, [activeTab, activeProject, history]); // Refetch if history changes (e.g. after retry)

   const stats = useMemo(() => {
      if (summaryStats) return summaryStats;
      const total = history.length;
      const passed = history.filter(h => h.status === 'passed').length;
      const pipelineRuns = history.filter(h => h.trigger === 'pipeline').length;
      const scheduledRuns = history.filter(h => h.trigger === 'scheduled').length;
      const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
      return { total, passed, rate, pipelineRuns, scheduledRuns };
   }, [history]);

   // Extract unique versions and schedules for the filter dropdown
   const contextOptions = useMemo(() => {
      const versions = Array.from(new Set(history.map(h => h.deploymentVersion).filter(Boolean)));
      const schedules = Array.from(new Set(history.map(h => h.scheduleName).filter(Boolean)));
      return { versions, schedules };
   }, [history]);

   const filteredHistory = useMemo(() => {
      return history.filter(h => {
         const matchesSearch = h.scriptName.toLowerCase().includes(searchTerm.toLowerCase());
         const matchesStatus = statusFilter === 'all' || h.status === statusFilter;
         const matchesTrigger = triggerFilter === 'all' || h.trigger === triggerFilter;

         let matchesContext = true;
         if (selectedContext !== 'All Contexts') {
            matchesContext = h.deploymentVersion === selectedContext || h.scheduleName === selectedContext;
         }

         let matchesOrigin = true;
         if (originFilter === 'AI') {
            matchesOrigin = h.scriptOrigin === 'AI' || h.scriptOrigin === 'AI_EXPLORATION';
         } else if (originFilter !== 'all') {
            matchesOrigin = h.scriptOrigin === originFilter;
         }

         let matchesDate = true;
         const runTime = new Date(h.runDate).getTime();
         if (startDate) {
            matchesDate = matchesDate && runTime >= new Date(startDate).getTime();
         }
         if (endDate) {
            // End of the selected day
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            matchesDate = matchesDate && runTime <= endOfDay.getTime();
         }

         return matchesSearch && matchesStatus && matchesTrigger && matchesContext && matchesOrigin && matchesDate;
      });
   }, [history, searchTerm, statusFilter, triggerFilter, originFilter, selectedContext, startDate, endDate]);

   const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
   const paginatedHistory = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredHistory.slice(start, start + itemsPerPage);
   }, [filteredHistory, currentPage, itemsPerPage]);

   const defects = useMemo(() => {
      // Use the pre-fetched active defects from API if available, 
      // otherwise fallback to calculating from current history bundle (legacy/fallback)
      const baseData = activeDefectsFromApi.length > 0 ? activeDefectsFromApi : [];
      
      // If we don't have API data yet but we have history, we can still show what we have
      // but the user requested "Full" view, so API is primary.
      
      // Grouping logic for scores (still needed if not provided by backend)
      const failureCounts = new Map<string, number>();
      // We still use the 'history' prop to calculate frequencies/rates if possible
      history.forEach(h => {
         if (h.status === 'failed') {
            failureCounts.set(h.scriptId, (failureCounts.get(h.scriptId) || 0) + 1);
         }
      });

      const failedAssets = baseData.map(h => {
         const script = scripts.find(s => s.id === h.scriptId);
         const failCount = failureCounts.get(h.scriptId) || 1; // At least 1 if it's in baseData
         const totalRuns = history.filter(hist => hist.scriptId === h.scriptId).length || 1;
         const failRate = totalRuns > 0 ? (failCount / totalRuns) * 100 : 0;

         // Priority weight: P0=100, P1=70, P2=40, P3=10
         const priorityMap: Record<string, number> = { 'P0': 100, 'P1': 70, 'P2': 40, 'P3': 10 };
         const pScore = priorityMap[script?.priority || 'P2'] || 40;

         // Importance Score Calculation (Hybrid)
         const importanceScore = Math.round((pScore * 0.4) + (failRate * 0.3) + (Math.min(failCount * 10, 100) * 0.3));

         return {
            ...h,
            priority: script?.priority || 'P2',
            category: h.scriptCategory || script?.category || 'General',
            failCount,
            failRate,
            importanceScore,
            assetOrigin: h.scriptOrigin || script?.origin || 'MANUAL'
         };
      });

      return failedAssets.sort((a, b) => b.importanceScore - a.importanceScore);
   }, [activeDefectsFromApi, history, scripts]);

   // Reset to page 1 when filters change
   React.useEffect(() => {
      setCurrentPage(1);
   }, [searchTerm, statusFilter, triggerFilter, originFilter, selectedContext, itemsPerPage, startDate, endDate]);

   const getTriggerIcon = (trigger: ExecutionTrigger) => {
      switch (trigger) {
         case 'pipeline': return <GitBranch className="w-3.5 h-3.5" />;
         case 'manual': return <MousePointer2 className="w-3.5 h-3.5" />;
         case 'scheduled': return <Timer className="w-3.5 h-3.5" />;
         case 'ai_exploration':
         case 'manual_ai' as any: return <Bot className="w-3.5 h-3.5" />; // Cast for legacy support
         default: return <Activity className="w-3.5 h-3.5" />;
      }
   };

   const getTriggerLabel = (trigger: ExecutionTrigger) => {
      switch (trigger) {
         case 'pipeline': return 'Pipeline';
         case 'manual': return 'Manual';
         case 'scheduled': return 'Scheduled';
         case 'ai_exploration': return 'Manual'; // Map legacy triggers to Manual
         default: return 'Other';
      }
   };

   const [showSuccessModal, setShowSuccessModal] = useState(false);
   const [defectSubTab, setDefectSubTab] = useState<'active' | 'healed'>('active');
   const [healedAssets, setHealedAssets] = useState<any[]>([]);
   const [isHealing, setIsHealing] = useState<string | null>(null); // historyId being healed
   // Consolidated state: historyId -> { status, logId }
   const [healingTasks, setHealingTasks] = useState<Record<string, { status: 'started' | 'success' | 'failed', logId: string }>>({});

   /* Execution states for Quick Retry */
   const [activeRunId, setActiveRunId] = useState<string | null>(null);
   const [executingScript, setExecutingScript] = useState<TestScript | null>(null);
   const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
   const [selectedHealedAsset, setSelectedHealedAsset] = useState<any>(null);
   const [jiraTarget, setJiraTarget] = useState<TestHistory | null>(null);

   const openJiraModal = (item: TestHistory) => {
      setJiraTarget(item);
   };

   const selectedScriptPriority = useMemo(() => {
      if (!selectedReport) return 'P2';
      const script = scripts.find(s => s.id === (selectedReport as any).scriptId);
      return script?.priority || 'P2';
   }, [selectedReport, scripts]);

   const loadHealedAssets = async () => {
      try {
         const data = await testApi.getHealedAssets();
         setHealedAssets(data);
      } catch (e) {
         console.error("Failed to load healed assets", e);
      }
   };

   React.useEffect(() => {
      if (activeTab === 'defects' && defectSubTab === 'healed') {
         loadHealedAssets();
      }
   }, [activeTab, defectSubTab]);

   // Polling for self-healing status (Improved 3s Timeout pattern)
   React.useEffect(() => {
      const activeIds = Object.entries(healingTasks)
         .filter(([_, task]) => task.status === 'started')
         .map(([id, _]) => id);

      if (activeIds.length === 0) return;

      let timer: any;
      const poll = async () => {
         console.log(`[Self-Healing] Polling ${activeIds.length} active tasks...`);

         for (const hId of activeIds) {
            const task = healingTasks[hId];
            if (!task || !task.logId) continue;

            try {
               const log = await testApi.getHealingStatus(task.logId);
               console.log(`[Self-Healing] Log ${task.logId} current status: ${log.status}`);

               const status = log.status?.toLowerCase();
               if (status === 'success' || status === 'failed') {
                  setHealingTasks(prev => ({
                     ...prev,
                     [hId]: { ...prev[hId], status: status as any }
                  }));
                  setIsHealing(null);
                  if (onRefresh) onRefresh();
                  loadHealedAssets();
               }
            } catch (e) {
               console.error(`[Self-Healing] Polling failed for ${task.logId}`, e);
            }
         }

         // Schedule next poll in 3 seconds if we still have active tasks
         timer = setTimeout(poll, 3000);
      };

      timer = setTimeout(poll, 3000);
      return () => clearTimeout(timer);
   }, [healingTasks]);

   const handleRetry = async (historyId: string) => {
      const defect = defects.find(d => d.id === historyId);
      if (!defect) return;

      const script = scripts.find(s => s.id === defect.scriptId);
      if (!script) {
         alert("Original script not found.");
         return;
      }

      setExecutingScript(script);
      setExecutionStatus('running');

      try {
         if (script.steps && script.steps.length > 0) {
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
            const { run_id } = await testApi.dryRun({
               code: script.code,
               project_id: script.projectId,
               script_id: script.id,
               script_name: script.name,
               persona_name: script.persona?.name || 'Default',
               dataset: script.dataset || [],
               try_count: script.try_count || 1,
               enable_ai_test: script.enable_ai_test || false
            });
            setActiveRunId(run_id);
         }
      } catch (e) {
         console.error("Retry failed", e);
         setExecutionStatus('error');
         alert("Failed to start retry.");
      }
   };

   const handleSelfHeal = async (historyId: string) => {
      try {
         setIsHealing(historyId);
         const { log_id } = await testApi.selfHealTest(historyId);

         setHealingTasks(prev => ({
            ...prev,
            [historyId]: { status: 'started', logId: log_id }
         }));
      } catch (e) {
         console.error("Self-healing failed", e);
         setHealingTasks(prev => ({ ...prev, [historyId]: { ...prev[historyId], status: 'failed' } }));
      } finally {
         setIsHealing(null);
      }
   };

   const refreshReport = async () => {
      if (selectedReport) {
         try {
            const res = await api.get(`/history/${selectedReport.id}`);
            setSelectedReport({ ...res.data });
         } catch (e) {
            console.error("Failed to refresh history details", e);
         }
      }
   };

   const handleAssetize = async (sessionId: string) => {
      try {
         await api.post(`/exploration/${sessionId}/assetize`);
         setShowSuccessModal(true);
      } catch (e) {
         console.error("Assetization failed", e);
         alert("Failed to create assets.");
      }
   };

   const handleConfirmSuccess = async () => {
      setShowSuccessModal(false);
      await refreshReport();
      if (onRefresh) onRefresh();
   };

   const setDatePreset = (preset: 'today' | 'week' | 'month' | 'all') => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const now = new Date();

      switch (preset) {
         case 'today':
            setStartDate(today.toISOString().split('T')[0]);
            setEndDate(now.toISOString().split('T')[0]);
            break;
         case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            setStartDate(weekAgo.toISOString().split('T')[0]);
            setEndDate(now.toISOString().split('T')[0]);
            break;
         case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(today.getMonth() - 1);
            setStartDate(monthAgo.toISOString().split('T')[0]);
            setEndDate(now.toISOString().split('T')[0]);
            break;
         case 'all':
            setStartDate('');
            setEndDate('');
            break;
      }
   };

   return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0c0e12] overflow-hidden">
         {/* Tab Navigation - Design Center Style */}
         <div className="flex-none px-8 pt-2 pb-0 bg-white dark:bg-[#0c0e12] border-b border-gray-200 dark:border-gray-800 transition-colors">
            <div className="max-w-6xl mx-auto">
               <div className="flex gap-2">
                  <button
                     onClick={() => setActiveTab('dashboard')}
                     className={`px-6 py-3 text-[11px] font-black flex items-center gap-2 border-b-2 transition-all uppercase tracking-widest ${activeTab === 'dashboard'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                        }`}
                  >
                     <BarChart3 className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-indigo-500' : 'text-gray-400'}`} />
                     DASHBOARD
                  </button>
                  <button
                     onClick={() => setActiveTab('history')}
                     className={`px-6 py-3 text-[11px] font-black flex items-center gap-2 border-b-2 transition-all uppercase tracking-widest ${activeTab === 'history'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                        }`}
                  >
                     <Activity className={`w-4 h-4 ${activeTab === 'history' ? 'text-indigo-500' : 'text-gray-400'}`} />
                     EXECUTION HISTORY
                  </button>
                  <button
                     onClick={() => setActiveTab('defects')}
                     className={`px-6 py-3 text-[11px] font-black flex items-center gap-2 border-b-2 transition-all uppercase tracking-widest ${activeTab === 'defects'
                        ? 'border-red-600 text-red-600 dark:text-red-400'
                        : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                        }`}
                  >
                     <AlertTriangle className={`w-4 h-4 ${activeTab === 'defects' ? 'text-red-500' : 'text-gray-400'}`} />
                     DEFECT MANAGEMENT
                  </button>
               </div>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-6xl mx-auto pb-20">
               {activeTab === 'dashboard' && (
                  <TestDashboard
                     history={history}
                     activeProject={activeProject}
                     onViewDetail={(report) => {
                        setSelectedReport(report);
                        // We don't automatically switch tabs, just show the modal
                     }}
                  />
               )}
               {activeTab === 'history' && (
                  <>
                     {/* Stats Row */}
                     <div className="mb-10 flex gap-6">
                        <div className="flex-1 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 transition-colors shadow-sm dark:shadow-none">
                           <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase mb-2 transition-colors tracking-widest">Total Runs</div>
                           <div className="text-3xl font-black text-gray-900 dark:text-white transition-colors">{stats.total}</div>
                        </div>
                        <div className="flex-1 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 transition-colors shadow-sm dark:shadow-none">
                           <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase mb-2 transition-colors tracking-widest">Success Rate</div>
                           <div className={`text-3xl font-black ${stats.rate > 90 ? 'text-green-600 dark:text-green-500' : 'text-amber-500'}`}>{stats.rate}%</div>
                        </div>
                        <div className="flex-1 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 transition-colors shadow-sm dark:shadow-none">
                           <div className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase mb-2 transition-colors tracking-widest">Pipeline Auto</div>
                           <div className="text-3xl font-black text-gray-900 dark:text-white transition-colors">{stats.pipelineRuns}</div>
                        </div>
                        <div className="flex-1 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 transition-colors shadow-sm dark:shadow-none">
                           <div className="text-[10px] font-black text-amber-500 dark:text-amber-400 uppercase mb-2 transition-colors tracking-widest">Scheduled Runs</div>
                           <div className="text-3xl font-black text-gray-900 dark:text-white transition-colors">{stats.scheduledRuns}</div>
                        </div>
                     </div>

                     {/* Filters Bar */}
                     <div className="space-y-4 mb-6">
                        <div className="flex flex-col md:flex-row gap-4">
                           <div className="relative flex-[2]">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                              <input
                                 type="text"
                                 value={searchTerm}
                                 onChange={(e) => setSearchTerm(e.target.value)}
                                 placeholder="Search by asset name..."
                                 className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors shadow-sm dark:shadow-none placeholder:text-gray-400 dark:placeholder:text-gray-600"
                              />
                           </div>

                           {/* New Context Filter (Deployment/Batch) */}
                           <div className="relative flex-1">
                              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                              <select
                                 value={selectedContext}
                                 onChange={(e) => setSelectedContext(e.target.value)}
                                 className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-[11px] font-bold text-gray-600 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none uppercase transition-colors shadow-sm dark:shadow-none"
                              >
                                 <option value="All Contexts">Contexts</option>
                                 {contextOptions.versions.length > 0 && (
                                    <optgroup label="Deployment Releases">
                                       {contextOptions.versions.map(v => <option key={v} value={v!}>Release: {v}</option>)}
                                    </optgroup>
                                 )}
                                 {contextOptions.schedules.length > 0 && (
                                    <optgroup label="Batch Schedules">
                                       {contextOptions.schedules.map(s => <option key={s} value={s!}>Batch: {s}</option>)}
                                    </optgroup>
                                 )}
                              </select>
                           </div>

                           {/* Date Range Picker */}
                           <div className="flex items-center gap-2 flex-[2]">
                              <div className="relative flex-1">
                                 <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                                 <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl py-2 pl-9 pr-3 text-[10px] font-bold text-gray-600 dark:text-gray-400 focus:outline-none transition-colors"
                                 />
                              </div>
                              <span className="text-gray-400 text-xs">~</span>
                              <div className="relative flex-1">
                                 <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                                 <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl py-2 pl-9 pr-3 text-[10px] font-bold text-gray-600 dark:text-gray-400 focus:outline-none transition-colors"
                                 />
                              </div>
                           </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4">
                           <div className="flex items-center gap-2">
                              <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors">
                                 {(['all', 'passed', 'failed'] as const).map((s) => (
                                    <button
                                       key={s}
                                       onClick={() => setStatusFilter(s)}
                                       className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === s ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                    >
                                       {s}
                                    </button>
                                 ))}
                              </div>
                           </div>

                           <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors">
                              <div className="px-3 py-1.5 flex items-center text-[9px] font-black text-white bg-indigo-500/80 dark:bg-indigo-600/50 rounded-md shadow-sm uppercase tracking-widest mr-1">Trigger</div>
                              {(['all', 'pipeline', 'manual', 'scheduled'] as const).map((t) => (
                                 <button
                                    key={t}
                                    onClick={() => setTriggerFilter(t as any)}
                                    className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${triggerFilter === t
                                       ? t === 'pipeline' ? 'bg-purple-100 dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm' : t === 'scheduled' ? 'bg-amber-100 dark:bg-amber-600 text-amber-600 dark:text-white' : 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                       : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-400'
                                       }`}
                                 >
                                    {t}
                                 </button>
                              ))}
                           </div>

                           <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors">
                              <div className="px-3 py-1.5 flex items-center text-[9px] font-black text-white bg-emerald-500/80 dark:bg-emerald-600/50 rounded-md shadow-sm uppercase tracking-widest mr-1">Origin</div>
                              {(['all', 'AI', 'STEP'] as const).map((o) => (
                                 <button
                                    key={o}
                                    onClick={() => setOriginFilter(o)}
                                    className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${originFilter === o
                                       ? o === 'STEP' ? 'bg-emerald-100 dark:bg-emerald-600 text-emerald-600 dark:text-white shadow-sm' : o === 'AI' ? 'bg-indigo-100 dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm'
                                       : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-400'
                                       }`}
                                 >
                                    {o === 'AI' ? 'AI GEN' : o === 'STEP' ? 'STEP FLOW' : o.toUpperCase()}
                                 </button>
                              ))}
                           </div>

                           <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors ml-auto">
                              {(['all', 'today', 'week', 'month'] as const).map((p) => (
                                 <button
                                    key={p}
                                    onClick={() => setDatePreset(p)}
                                    className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all hover:text-indigo-500 text-gray-500`}
                                 >
                                    {p}
                                 </button>
                              ))}
                           </div>
                        </div>
                     </div>

                     {/* History Table */}
                     <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xl dark:shadow-2xl transition-colors">
                        <table className="w-full text-left">
                           <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-black uppercase text-gray-500 transition-colors">
                              <tr>
                                 <th className="px-6 py-4">Status</th>
                                 <th className="px-6 py-4">Origin Context</th>
                                 <th className="px-6 py-4">Golden Test Asset</th>
                                 <th className="px-6 py-4">Category</th>
                                 <th className="px-6 py-4 text-right">Execution Data</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100 dark:divide-gray-800 transition-colors">
                              {paginatedHistory.map((item) => (
                                 <tr
                                    key={item.id}
                                    onClick={async () => {
                                       if (item.trigger === 'ai_exploration') {
                                          try {
                                             const detail = await testApi.getHistoryDetail(item.id);
                                             setSelectedReport(detail);
                                          } catch (e) {
                                             console.error("Failed to fetch history details", e);
                                             setSelectedReport(item);
                                          }
                                       } else {
                                          setSelectedReport(item);
                                       }
                                    }}
                                    className="hover:bg-gray-50 dark:hover:bg-indigo-500/5 transition-all group cursor-pointer"
                                 >
                                    <td className="px-6 py-5">
                                       <div className="flex items-center gap-2">
                                          {item.status === 'passed' ? (
                                             <CheckCircle2 className="w-5 h-5 text-green-500" />
                                          ) : (
                                             <XCircle className="w-5 h-5 text-red-500" />
                                          )}
                                          <span className={`text-[10px] font-black uppercase ${item.status === 'passed' ? 'text-green-500' : 'text-red-500'}`}>
                                             {item.status}
                                          </span>
                                          {item.jira_id && (
                                             <div className="ml-2 flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-500/10 rounded border border-blue-100 dark:border-blue-500/20">
                                                <Layers className="w-2.5 h-2.5 text-blue-500" />
                                                <span className="text-[8px] font-black text-blue-600 dark:text-blue-400">{item.jira_id}</span>
                                             </div>
                                          )}
                                       </div>
                                    </td>
                                    <td className="px-6 py-5">
                                       <div className="flex flex-col gap-1.5">
                                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-black uppercase text-[9px] tracking-widest w-fit ${item.trigger === 'pipeline' ? 'bg-purple-100 dark:bg-purple-600/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' :
                                             item.trigger === 'scheduled' ? 'bg-amber-100 dark:bg-amber-600/10 text-amber-600 dark:text-amber-500 border-amber-200 dark:border-500/20' :
                                                (item.trigger === 'ai_exploration') ? 'bg-indigo-100 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20' :
                                                   'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
                                             }`}>
                                             {getTriggerIcon(item.trigger)}
                                             {getTriggerLabel(item.trigger)}
                                          </div>

                                          {item.scriptOrigin && (
                                             <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-black uppercase text-[9px] tracking-widest w-fit ${item.scriptOrigin === 'STEP' ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' :
                                                (item.scriptOrigin === 'AI' || item.scriptOrigin === 'AI_EXPLORATION') ? 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20' :
                                                   'bg-gray-50 dark:bg-gray-800/50 text-gray-500 border-gray-200 dark:border-gray-700'
                                                }`}>
                                                {item.scriptOrigin.replace('_', ' ')}
                                             </div>
                                          )}

                                          {/* Context Details (Version or Schedule Name) */}
                                          {item.deploymentVersion && (
                                             <div className="flex items-center gap-1 text-[9px] font-bold text-purple-600 dark:text-purple-300 mono opacity-80">
                                                <Layers className="w-2.5 h-2.5" /> {item.deploymentVersion}
                                             </div>
                                          )}
                                          {item.scheduleName && (
                                             <div className="flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 opacity-80">
                                                <Hash className="w-2.5 h-2.5" /> {item.scheduleName}
                                             </div>
                                          )}
                                       </div>
                                    </td>
                                    <td className="px-6 py-5">
                                       <div className="flex flex-col">
                                          <span className="text-sm font-bold text-gray-900 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{item.scriptName}</span>
                                          <span className="text-[10px] text-gray-500 dark:text-gray-600 font-medium truncate max-w-[150px]">ID: {item.scriptId}</span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-5">
                                       <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg w-fit transition-colors">
                                          <LayoutGrid className="w-3 h-3 text-indigo-500" />
                                          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">{item.scriptCategory || 'Common'}</span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                       <div className="flex flex-col items-end">
                                          <div className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300 font-medium transition-colors">
                                             <Calendar className="w-3 h-3 text-gray-400 dark:text-gray-600" /> {new Date(item.runDate).toLocaleString()}
                                          </div>
                                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                                             <Clock className="w-3 h-3" /> {item.duration}
                                          </div>
                                       </div>
                                    </td>
                                 </tr>
                              ))}
                              {filteredHistory.length === 0 && (
                                 <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                       <History className="w-10 h-10 text-gray-300 dark:text-gray-800 mx-auto mb-4 transition-colors" />
                                       <p className="text-gray-400 dark:text-gray-600 text-xs font-black uppercase tracking-widest transition-colors">No matching history results</p>
                                    </td>
                                 </tr>
                              )}
                           </tbody>
                        </table>

                        {/* Pagination Controls */}
                        {filteredHistory.length > 0 && (
                           <div className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between transition-colors">
                              <div className="flex items-center gap-3">
                                 <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Rows per page:</span>
                                 <select
                                    value={itemsPerPage}
                                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-none text-xs font-bold text-gray-600 dark:text-gray-300 rounded px-2 py-1 focus:ring-0 cursor-pointer transition-colors"
                                 >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                 </select>
                                 <span className="text-[10px] text-gray-600 dark:text-gray-600 ml-2">
                                    Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredHistory.length)} of {filteredHistory.length}
                                 </span>
                              </div>

                              <div className="flex items-center gap-2">
                                 <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-transparent hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-black text-gray-500 dark:text-gray-400 rounded transition-colors uppercase"
                                 >
                                    Previous
                                 </button>
                                 <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                       // Simple pagination logic for display
                                       let p = i + 1;
                                       if (totalPages > 5 && currentPage > 3) {
                                          p = currentPage - 2 + i;
                                       }
                                       if (p > totalPages) return null;

                                       return (
                                          <button
                                             key={p}
                                             onClick={() => setCurrentPage(p)}
                                             className={`w-7 h-7 flex items-center justify-center rounded text-[10px] font-bold transition-all ${currentPage === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                          >
                                             {p}
                                          </button>
                                       );
                                    })}
                                 </div>
                                 <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-transparent hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-black text-gray-500 dark:text-gray-400 rounded transition-colors uppercase"
                                 >
                                    Next
                                 </button>
                              </div>
                           </div>
                        )}
                     </div>
                  </>
               )}

               {activeTab === 'defects' && (
                  <div className="space-y-8 animate-in fade-in duration-500">
                     <div className="flex items-center justify-between">
                        <div>
                           <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter transition-colors">Failure Triage Center</h2>
                           <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest transition-colors mb-1">Issue Analysis & Automatic Classification</p>
                        </div>
                        <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800">
                           <button
                              onClick={() => setDefectSubTab('active')}
                              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${defectSubTab === 'active' ? 'bg-white dark:bg-red-600 text-red-600 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                           >
                              Active Defects ({defects.length})
                           </button>
                           <button
                              onClick={() => setDefectSubTab('healed')}
                              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${defectSubTab === 'healed' ? 'bg-white dark:bg-green-600 text-green-600 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                           >
                              <Zap className="w-3 h-3 inline-block mr-1" /> Healed Assets ({healedAssets.length})
                           </button>
                        </div>
                     </div>

                     {defectSubTab === 'active' ? (
                        <div className="grid grid-cols-1 gap-6">
                           {isLoadingDefects ? (
                              <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-20 flex flex-col items-center justify-center text-center transition-colors">
                                 <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-4" />
                                 <p className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Analyzing Entire Project Health...</p>
                              </div>
                           ) : defects.length === 0 ? (
                              <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-20 flex flex-col items-center justify-center text-center transition-colors">
                                 <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-6 ring-4 ring-green-500/20">
                                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                                 </div>
                                 <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">No Defects Detected</h3>
                                 <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors">All critical assets are currently passing their validation cycles.</p>
                              </div>
                           ) : (
                              defects.map(defect => {
                                 const script = scripts.find(s => s.id === defect.scriptId);
                                 const canSelfHeal = script?.enable_ai_test;

                                 return (
                                    <div key={defect.id} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 hover:border-red-500/30 transition-all shadow-sm dark:shadow-none group relative overflow-hidden">
                                       {/* Importance Score Gauge (Visual Background) */}
                                       <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 -mr-16 -mt-16 rounded-full blur-3xl group-hover:bg-red-500/10 transition-all"></div>

                                       <div className="flex flex-col md:flex-row gap-8 relative z-10">
                                          <div className="flex-1">
                                             <div className="flex items-center gap-3 mb-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${defect.priority === 'P0' ? 'bg-red-50 dark:bg-red-900/10 border-red-500 text-red-600 dark:text-red-400' :
                                                   defect.priority === 'P1' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500 text-amber-600 dark:text-amber-400' :
                                                      defect.priority === 'P2' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-500 text-blue-600 dark:text-blue-400' :
                                                         'bg-gray-50 dark:bg-gray-900/10 border-gray-200 dark:border-gray-800 text-gray-500'
                                                   }`}>
                                                   {defect.priority}
                                                </span>
                                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-900 text-gray-500 text-[10px] font-black uppercase tracking-widest rounded border border-gray-200 dark:border-gray-800 transition-colors">
                                                   {defect.category}
                                                </span>
                                                <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded border border-indigo-500/10 transition-colors">
                                                   {defect.assetOrigin}
                                                </span>
                                             </div>

                                             <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors cursor-pointer" onClick={() => setSelectedReport(defect)}>
                                                {defect.scriptName}
                                             </h3>
                                             <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 font-medium transition-colors">
                                                Last failed on <span className="text-gray-900 dark:text-white font-bold">{new Date(defect.runDate).toLocaleString()}</span> via <span className="uppercase text-indigo-500 font-bold">{defect.trigger}</span>
                                             </p>

                                             <div className="grid grid-cols-3 gap-6">
                                                <div className="p-4 bg-gray-50 dark:bg-[#0c0e12] rounded-2xl border border-gray-100 dark:border-gray-800 transition-colors">
                                                   <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Fail Freq</div>
                                                   <div className="text-lg font-black text-red-500">{defect.failCount} <span className="text-[10px] text-gray-400 font-medium tracking-normal">Times</span></div>
                                                </div>
                                                <div className="p-4 bg-gray-50 dark:bg-[#0c0e12] rounded-2xl border border-gray-100 dark:border-gray-800 transition-colors">
                                                   <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Failure Rate</div>
                                                   <div className="text-lg font-black text-amber-500">{Math.round(defect.failRate)}%</div>
                                                </div>
                                                <div className="p-4 bg-red-50 dark:bg-red-500/5 rounded-2xl border border-red-100 dark:border-red-500/10 transition-colors">
                                                   <div className="flex items-center gap-1 mb-1">
                                                      <div className="text-[9px] font-black text-red-500/70 uppercase tracking-widest">Importance</div>
                                                      <div className="relative group inline-block">
                                                         <HelpCircle className="w-2.5 h-2.5 text-red-500/50 cursor-help" />
                                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none z-[100] shadow-xl border border-white/10 font-bold uppercase tracking-tighter invisible group-hover:visible translate-y-2 group-hover:translate-y-0">
                                                            <div className="mb-1 text-indigo-400">Calculation Formula:</div>
                                                            (Priority × 40%) + (Fail Rate × 30%) + (Fail Volume × 30%)
                                                         </div>
                                                      </div>
                                                   </div>
                                                   <div className="text-lg font-black text-red-600 dark:text-red-400">{defect.importanceScore}</div>
                                                </div>
                                             </div>
                                          </div>

                                          <div className="flex-none flex flex-col justify-center gap-3 min-w-[200px]">
                                             <button
                                                onClick={() => handleRetry(defect.id)}
                                                className="w-full py-3 bg-white dark:bg-[#0c0e12] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm"
                                             >
                                                <Activity className="w-3.5 h-3.5" /> Quick Retry
                                             </button>

                                             {canSelfHeal && (() => {
                                                const latestBackendLog = defect.healing_logs && defect.healing_logs.length > 0
                                                   ? [...defect.healing_logs].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                                                   : null;

                                                const currentTask = healingTasks[defect.id] || (latestBackendLog ? { status: latestBackendLog.status } : null);
                                                const status = currentTask?.status?.toLowerCase();
                                                const isProcessing = isHealing === defect.id || status === "started" || status === "in_progress";
                                                const isSuccess = status === "success";
                                                const isFailed = status === "failed";

                                                return (
                                                   <button
                                                      onClick={() => {
                                                         if (isSuccess) {
                                                            setDefectSubTab("healed");
                                                         } else if (!isHealing && !isProcessing) {
                                                            handleSelfHeal(defect.id);
                                                         }
                                                      }}
                                                      disabled={isProcessing || (isFailed && isHealing === defect.id)}
                                                      className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all ${isProcessing
                                                         ? "bg-indigo-400 text-white cursor-wait"
                                                         : isSuccess
                                                            ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
                                                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20"
                                                         }`}
                                                   >
                                                      {isProcessing ? (
                                                         <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            Healing...
                                                         </>
                                                      ) : isSuccess ? (
                                                         <>
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            HEALED
                                                         </>
                                                      ) : (
                                                         <>
                                                            <Zap className="w-3.5 h-3.5" />
                                                            Self-Healing
                                                         </>
                                                      )}
                                                   </button>
                                                );
                                             })()}

                                             {defect.jira_id ? (
                                                <div className="w-full py-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl flex items-center justify-center gap-2 transition-all">
                                                   <Layers className="w-3.5 h-3.5 text-blue-600" />
                                                   <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 tracking-widest uppercase">Jira: {defect.jira_id}</span>
                                                </div>
                                             ) : (
                                                <button
                                                   onClick={() => openJiraModal(defect)}
                                                   className="w-full py-3 bg-white dark:bg-[#0c0e12] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm"
                                                >
                                                   <Layers className="w-3.5 h-3.5 text-blue-500" /> Assign to Jira
                                                </button>
                                             )}
                                          </div>
                                       </div>
                                    </div>
                                 );
                              })
                           )}
                        </div>
                     ) : (
                        /* HEALED ASSETS TAB */
                        <div className="grid grid-cols-1 gap-4">
                           {healedAssets.length === 0 ? (
                              <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-20 flex flex-col items-center justify-center text-center transition-colors">
                                 <div className="w-16 h-16 bg-gray-500/10 rounded-full flex items-center justify-center mb-6 ring-4 ring-gray-500/20">
                                    <Search className="w-8 h-8 text-gray-400" />
                                 </div>
                                 <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">No Healed Assets Yet</h3>
                                 <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors">Assets fixed by AI will appear here.</p>
                              </div>
                           ) : (
                              healedAssets.map(log => (
                                 <div key={log.id} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 hover:border-green-500/30 transition-all flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                       <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                                          <Zap className="w-5 h-5 text-green-500" />
                                       </div>
                                       <div>
                                          <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                             {(() => {
                                                const script = scripts.find(s => s.id === log.script_id);
                                                return script?.name || `Asset #${log.script_id.substring(0, 8)}`;
                                             })()}
                                          </h4>
                                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Repair completed on {new Date(log.created_at).toLocaleString()}</p>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                       <div className="text-right">
                                          <div className="text-[9px] font-black text-gray-400 uppercase mb-1">Status</div>
                                          <div className="text-xs font-black text-green-500 uppercase">Self-Healed Success</div>
                                       </div>
                                       <button
                                          onClick={() => setSelectedHealedAsset(log)}
                                          className="px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all border border-indigo-100 dark:border-indigo-500/20"
                                       >
                                          Detailed Log
                                       </button>
                                       <button
                                          onClick={() => {
                                             const script = scripts.find(s => s.id === log.script_id);
                                             if (script && onNavigateToLibrary) onNavigateToLibrary(script.id);
                                          }}
                                          className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                                       >
                                          View Asset
                                       </button>
                                    </div>
                                 </div>
                              ))
                           )}
                        </div>
                     )}
                  </div>
               )}
            </div>
         </div>

         {/* Intelligent Report Modal */}
         {selectedReport && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-8 animate-in fade-in duration-200">
               <div className="absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-md transition-colors" onClick={() => setSelectedReport(null)} />
               <div className="relative w-full max-w-4xl bg-white dark:bg-[#0f1115] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200 transition-colors">
                  <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/20 flex items-center justify-between transition-colors">
                     <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-3xl ${selectedReport.status === 'passed' ? 'bg-green-600/10 text-green-600 dark:text-green-500' : 'bg-red-600/10 text-red-600 dark:text-red-500'}`}>
                           {selectedReport.status === 'passed' ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                        </div>
                        <div className="min-w-0">
                           <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight truncate max-w-lg transition-colors">{selectedReport.scriptName}</h3>
                           <div className="flex flex-wrap items-center gap-3 mt-1.5">
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Execution #ID-{selectedReport.id.slice(-6)}</span>
                              <span className="w-1 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
                              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${selectedReport.trigger === 'pipeline' ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-transparent' : selectedReport.trigger === 'scheduled' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-transparent' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}>
                                 {getTriggerIcon(selectedReport.trigger)}
                                 <span className="text-[10px] font-bold uppercase tracking-widest">{selectedReport.deploymentVersion || selectedReport.scheduleName || getTriggerLabel(selectedReport.trigger)}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${selectedScriptPriority === 'P0' ? 'bg-red-50 dark:bg-red-900/10 border-red-500 text-red-600 dark:text-red-400' :
                                 selectedScriptPriority === 'P1' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500 text-amber-600 dark:text-amber-400' :
                                    selectedScriptPriority === 'P2' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-500 text-blue-600 dark:text-blue-400' :
                                       'bg-gray-50 dark:bg-gray-900/10 border-gray-200 dark:border-gray-800 text-gray-500'
                                 }`}>
                                 {selectedScriptPriority} Priority
                              </span>
                              {selectedReport.commitHash && (
                                 <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mono">Hash: {selectedReport.commitHash}</span>
                              )}
                              <span className="w-1 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
                              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{selectedReport.duration} Total Time</span>
                           </div>
                        </div>
                     </div>
                     <button onClick={() => setSelectedReport(null)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-10 custom-scrollbar">
                     {/* Origin Traceability Context */}
                     <div className="grid grid-cols-2 gap-4">
                        {selectedReport.trigger === 'pipeline' && (
                           <div className="p-5 bg-purple-50 dark:bg-purple-600/5 border border-purple-200 dark:border-purple-500/20 rounded-3xl flex items-center gap-4 transition-colors">
                              <div className="p-3 bg-purple-100 dark:bg-purple-600/10 rounded-2xl text-purple-600 dark:text-purple-400">
                                 <GitBranch className="w-6 h-6" />
                              </div>
                              <div>
                                 <div className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">Deployment Origin</div>
                                 <div className="text-sm font-bold text-gray-900 dark:text-white transition-colors">{selectedReport.deploymentVersion}</div>
                                 <div className="text-[10px] text-gray-500 font-medium">Automatic verification after code merge</div>
                              </div>
                           </div>
                        )}
                        {selectedReport.trigger === 'scheduled' && (
                           <div className="p-5 bg-amber-50 dark:bg-amber-600/5 border border-amber-200 dark:border-amber-500/20 rounded-3xl flex items-center gap-4 transition-colors">
                              <div className="p-3 bg-amber-100 dark:bg-amber-600/10 rounded-2xl text-amber-600 dark:text-amber-400">
                                 <Timer className="w-6 h-6" />
                              </div>
                              <div>
                                 <div className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Batch Context</div>
                                 <div className="text-sm font-bold text-gray-900 dark:text-white transition-colors">{selectedReport.scheduleName}</div>
                                 <div className="text-[10px] text-gray-500 font-medium">System periodic regression check</div>
                              </div>
                           </div>
                        )}
                        <div className="p-5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl flex items-center gap-4 transition-colors">
                           <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-0 rounded-2xl text-gray-400">
                              <Calendar className="w-6 h-6" />
                           </div>
                           <div>
                              <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Execution Date</div>
                              <div className="text-sm font-bold text-gray-900 dark:text-white transition-colors">{new Date(selectedReport.runDate).toLocaleString()}</div>
                              <div className="text-[10px] text-gray-500 font-medium">Completed on Node_01</div>
                           </div>
                        </div>
                     </div>

                     {/* AI Analysis Panel - DYNAMIC */}
                     {(selectedReport.trigger === 'ai_exploration' || (selectedReport as any).ai_session) ? (
                        <>
                           <div className="p-8 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] relative shadow-inner transition-colors">
                              <div className="absolute top-0 right-0 p-6 opacity-5"><Bot className="w-32 h-32" /></div>
                              <div className="flex items-center gap-3 mb-6">
                                 <Target className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                                 <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em]">Goal Definition</span>
                              </div>
                              <div className="bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 p-6 rounded-2xl mb-4 shadow-lg flex justify-between items-start gap-4 transition-colors">
                                 <div className="flex-1 min-w-0">
                                    <h4 className="text-md font-black text-gray-900 dark:text-white mb-2 leading-tight transition-colors">{(selectedReport as any).ai_session?.goal || selectedReport.aiSummary}</h4>
                                    <p className="text-xs text-indigo-600 dark:text-indigo-300 font-mono flex items-center gap-2">
                                       <span className="opacity-50">TARGET:</span>
                                       <span className="px-2 py-0.5 bg-indigo-500/10 rounded border border-indigo-500/20 text-indigo-600 dark:text-indigo-200 truncate max-w-md">
                                          {(selectedReport as any).ai_session?.target_url || (selectedReport as any).target_url}
                                       </span>
                                    </p>
                                 </div>

                                 {/* Assetize Action */}
                                 {(selectedReport as any).ai_session?.is_assetized ? (
                                    <div className="flex items-center gap-2">
                                       <div className="shrink-0 px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2 cursor-not-allowed">
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          Asset Saved
                                       </div>
                                       {(selectedReport as any).ai_session?.generated_script_id && (
                                          <button
                                             onClick={(e) => {
                                                e.stopPropagation();
                                                console.log("View in Library clicked", (selectedReport as any).ai_session?.generated_script_id);
                                                if (onNavigateToLibrary) {
                                                   onNavigateToLibrary((selectedReport as any).ai_session.generated_script_id);
                                                } else {
                                                   console.error("onNavigateToLibrary prop is missing");
                                                }
                                             }}
                                             className="shrink-0 cursor-pointer relative z-40 px-3 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase rounded-lg border border-indigo-500/30 flex items-center gap-2 transition-all">
                                             <ArrowUpRight className="w-3.5 h-3.5" />
                                             View in Library
                                          </button>
                                       )}
                                    </div>
                                 ) : (
                                    <button
                                       onClick={() => handleAssetize((selectedReport as any).ai_session?.id)}
                                       className="shrink-0 relative z-10 cursor-pointer px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase rounded-lg shadow-lg flex items-center gap-2 transition-all">
                                       <Save className="w-3.5 h-3.5" />
                                       Save as Scenario
                                    </button>
                                 )}
                              </div>
                              <div className="flex gap-2">
                                 <span className="px-3 py-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 text-[11px] font-black rounded-lg border border-indigo-500/30 transition-colors">
                                    FINAL SCORE: {(selectedReport as any).ai_session?.final_score || 0} / 100
                                 </span>
                              </div>
                           </div>

                           <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                 <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Execution Steps</span>
                              </div>

                              {/* SUCCESS MODAL OVERLAY */}
                              {showSuccessModal && (
                                 <div className="absolute inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center rounded-[2.5rem] animate-in fade-in duration-300">
                                    <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-700 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm text-center animate-in zoom-in-95 duration-300 transition-colors">
                                       <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-6 ring-4 ring-green-500/20">
                                          <CheckCircle2 className="w-8 h-8 text-green-500" />
                                       </div>
                                       <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 transition-colors">Asset Registered!</h3>
                                       <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed transition-colors">
                                          Successfully converted this exploration into a reusable <strong>Scenario</strong> and <strong>Test Asset</strong>.
                                       </p>
                                       <button
                                          onClick={handleConfirmSuccess}
                                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all uppercase tracking-wider text-xs"
                                       >
                                          Confirm & Refresh
                                       </button>
                                    </div>
                                 </div>
                              )}
                              <div className="space-y-6 pl-2">
                                 {(selectedReport as any).ai_session?.steps_data?.map((step: any, idx: number) => (
                                    <div key={idx} className="relative pl-8 border-l-2 border-gray-200 dark:border-gray-800 last:border-transparent transition-colors">
                                       <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 bg-indigo-500 border-indigo-100 dark:border-indigo-900`} />

                                       <div className="bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-indigo-500/30 transition-colors shadow-sm dark:shadow-none">
                                          <div className="flex items-center justify-between mb-3">
                                             <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest transition-colors">Step {step.step_number}</span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${(step.score_breakdown?.Action_Confidence || 0) >= 80 ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400' :
                                                   (step.score_breakdown?.Action_Confidence || 0) >= 50 ? 'border-yellow-500/30 text-yellow-600 dark:text-yellow-400' : 'border-gray-200 dark:border-gray-700 text-gray-500'
                                                   }`}>
                                                   Score: {step.score_breakdown?.Action_Confidence || 0}
                                                </span>
                                             </div>
                                             <div className="text-[10px] font-black uppercase text-gray-500 bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded transition-colors">
                                                {step.action_type}
                                             </div>
                                          </div>

                                          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 leading-relaxed transition-colors">{step.description}</h3>

                                          <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                                             <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg transition-colors">
                                                <span className="block text-gray-500 font-bold uppercase mb-2 text-[9px]">Score Breakdown</span>
                                                <div className="space-y-1.5">
                                                   {step.score_breakdown && Object.entries(step.score_breakdown).map(([key, val]) => (
                                                      <div key={key} className="flex justify-between items-center">
                                                         <span className="text-gray-500 dark:text-gray-400 text-[10px] capitalize">{key.replace('_', ' ')}</span>
                                                         <span className={`font-bold text-[10px] ${(val as number) >= 80 ? 'text-emerald-500 dark:text-emerald-400' : (val as number) >= 50 ? 'text-yellow-500 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'
                                                            }`}>{val as number}</span>
                                                      </div>
                                                   ))}
                                                </div>
                                             </div>
                                             <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg flex flex-col justify-center transition-colors">
                                                <span className="block text-gray-500 font-bold uppercase mb-1 text-[9px]">Target Selector</span>
                                                <span className="text-gray-600 dark:text-gray-300 break-all font-mono text-[10px]">{step.action_target || 'N/A'}</span>
                                             </div>
                                          </div>

                                          <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed italic bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg border border-gray-100 dark:border-gray-800/50 mb-2 transition-colors">
                                             <div className="mb-2">
                                                <span className="text-gray-500 font-bold uppercase text-[10px] block mb-1">Reasoning</span>
                                                "{step.thought}"
                                             </div>

                                             {(step.observation || step.expectation) && (
                                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-800/30 mt-2">
                                                   {step.observation && (
                                                      <div>
                                                         <span className="text-emerald-600/70 dark:text-emerald-500/70 font-bold uppercase text-[10px] block mb-1">Actual (Observation)</span>
                                                         <span className="text-gray-800 dark:text-gray-300 not-italic">{step.observation}</span>
                                                      </div>
                                                   )}
                                                   {step.expectation && (
                                                      <div>
                                                         <span className="text-indigo-500/70 dark:text-indigo-400/70 font-bold uppercase text-[10px] block mb-1">Expected Outcome</span>
                                                         <span className="text-gray-800 dark:text-gray-300 not-italic">{step.expectation}</span>
                                                      </div>
                                                   )}
                                                </div>
                                             )}
                                          </div>

                                          {step.action_value && (
                                             <div className="pt-2 border-t border-gray-100 dark:border-gray-800/50 flex gap-4 text-xs mt-2 transition-colors">
                                                <div>
                                                   <span className="text-gray-600 font-bold uppercase mr-2 text-[10px]">Input Value:</span>
                                                   <span className="text-gray-800 dark:text-gray-300 font-mono">{step.action_value.includes("password") ? "*****" : step.action_value}</span>
                                                </div>
                                             </div>
                                          )}
                                       </div>
                                    </div>
                                 ))}
                                 {!(selectedReport as any).ai_session?.steps_data && (
                                    <div className="text-center text-gray-500 py-10 text-xs">No execution steps recorded.</div>
                                 )}
                              </div>
                           </div>
                        </>
                     ) : (
                        /* STANDARD VIEW (Existing Logic) */
                        <>
                           {/* AI Analysis Panel - Dynamic/Data-driven version */}
                           {selectedReport.failureAnalysis && (
                              <div className={`p-6 rounded-3xl border ${selectedReport.status === 'passed' ? 'bg-green-50 dark:bg-green-950/10 border-green-200 dark:border-green-500/20' : 'bg-indigo-50 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-500/20'} transition-colors mb-8`}>
                                 <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                       <Bot className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                                       <h4 className="text-xs font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em]">Oracle Intelligent Analysis</h4>
                                    </div>
                                    {selectedReport.failureAnalysis?.confidence && (
                                       <div className="text-[10px] font-bold text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded-full border border-indigo-500/20">
                                          AI Confidence: {selectedReport.failureAnalysis.confidence}%
                                       </div>
                                    )}
                                 </div>
                                 <div className="space-y-4">
                                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium transition-colors">
                                       {selectedReport.failureAnalysis?.thought || selectedReport.aiSummary || (selectedReport.status === 'passed' ? "The agent successfully navigated through all assertion points. UI consistency and state transitions were 100% compliant with the Golden Script definition." : "Critical failure detected during the assertion phase. The agent encountered a mismatch between expected and actual DOM state.")}
                                    </p>
                                    {selectedReport.status === 'failed' && (
                                       <div className="flex flex-col gap-3">
                                          <div className="flex items-start gap-4 p-4 bg-red-100/50 dark:bg-red-600/5 border border-red-200 dark:border-red-500/10 rounded-2xl transition-colors">
                                             <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                             <div>
                                                <div className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Root Cause (AI Diagnostic)</div>
                                                <p className="text-xs text-red-700 dark:text-red-400 font-bold">
                                                   {selectedReport.failureAnalysis?.reason || selectedReport.failureReason || 'Logic Discrepancy'}
                                                </p>
                                             </div>
                                          </div>
                                          {selectedReport.failureAnalysis?.suggestion && (
                                             <div className="flex items-start gap-4 p-4 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/10 rounded-2xl transition-colors">
                                                <Bot className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                                <div>
                                                   <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-1">Suggested Fix</div>
                                                   <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                                                      {selectedReport.failureAnalysis.suggestion}
                                                   </p>
                                                </div>
                                             </div>
                                          )}
                                       </div>
                                    )}
                                 </div>
                              </div>
                           )}

                           {/* Console Trace Section */}
                           {(selectedReport.step_results && selectedReport.step_results.length > 0) && (
                              <div className="space-y-6 mb-8">
                                 <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-gray-600" />
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Execution Timeline</span>
                                 </div>
                                 <div className="space-y-6 pl-2">
                                    {selectedReport.step_results.map((step: any, idx: number) => (
                                       <div key={idx} className="relative pl-8 border-l-2 border-gray-200 dark:border-gray-800 last:border-transparent">
                                          <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${step.status === 'passed' ? 'bg-green-500 border-green-100 dark:border-green-900' : 'bg-red-500 border-red-100 dark:border-red-900'}`} />

                                          <div className="bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-indigo-500/30 transition-colors shadow-sm dark:shadow-none">
                                             <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                   <div className="flex items-center gap-2 mb-2">
                                                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Step {step.step_number}</span>
                                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${step.status === 'passed' ? 'border-green-500/30 text-green-600 dark:text-green-400' : 'border-red-500/30 text-red-600 dark:text-red-400'}`}>
                                                         {step.status?.toUpperCase()}
                                                      </span>
                                                      <span className="text-[10px] text-gray-400 font-mono ml-2">{step.duration}</span>
                                                   </div>

                                                   <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 leading-relaxed">{step.name}</h3>

                                                   {step.metadata?.description && (
                                                      <p className="text-[11px] text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                                                         {step.metadata.description}
                                                      </p>
                                                   )}

                                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                                      <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                                                         <div className="text-[9px] font-black text-gray-400 uppercase mb-1">Action</div>
                                                         <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{step.metadata?.action || 'action'}</div>
                                                      </div>
                                                      {step.metadata?.value && (
                                                         <div className="p-3 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-lg border border-indigo-100/50 dark:border-indigo-500/10">
                                                            <div className="text-[9px] font-black text-indigo-400 uppercase mb-1">Input / Value</div>
                                                            <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300">{step.metadata.value}</div>
                                                         </div>
                                                      )}
                                                   </div>

                                                   {step.metadata?.target && (
                                                      <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg mb-3">
                                                         <div className="text-[9px] font-black text-gray-400 uppercase mb-1">Target Element</div>
                                                         <div className="text-[10px] font-mono text-gray-600 dark:text-gray-400 break-all">{step.metadata.target}</div>
                                                      </div>
                                                   )}

                                                   {step.metadata?.assertText && (
                                                      <div className="p-3 bg-blue-50/50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/30 mb-3 flex flex-col">
                                                         <span className="text-blue-500 uppercase font-black text-[9px] mb-1 flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" /> Rule Assertion
                                                         </span>
                                                         <span className="font-mono text-[11px] text-gray-900 dark:text-white">"{step.metadata.assertText}"</span>
                                                      </div>
                                                   )}

                                                   {step.error_message && (
                                                      <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 rounded-lg">
                                                         <div className="flex items-center gap-2 mb-1 text-red-600 dark:text-red-400">
                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">Error Detail</span>
                                                         </div>
                                                         <p className="text-[10px] text-red-500 font-mono break-all font-medium">
                                                            {step.error_message}
                                                         </p>
                                                      </div>
                                                   )}
                                                </div>

                                                {step.screenshot_data && (
                                                   <div
                                                      className="w-32 h-48 flex-shrink-0 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm transition-all hover:ring-4 hover:ring-indigo-500/20 cursor-zoom-in bg-gray-100 dark:bg-gray-900 relative group/img"
                                                      onClick={() => setExpandedScreenshot(step.screenshot_data)}
                                                   >
                                                      <img
                                                         src={`data:image/jpeg;base64,${step.screenshot_data}`}
                                                         alt={`Step ${step.step_number}`}
                                                         className="w-full h-full object-cover"
                                                      />
                                                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 flex items-center justify-center transition-all">
                                                         <Search className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-100 drop-shadow-lg" />
                                                      </div>
                                                      {step.status === 'failed' && (
                                                         <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-red-600 text-white text-[8px] font-black rounded uppercase shadow-lg">ERROR STATE</div>
                                                      )}
                                                   </div>
                                                )}
                                             </div>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           )}

                           {/* Console Trace Section */}
                           <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                    <Terminal className="w-4 h-4 text-gray-600" />
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Execution Trace Logs</span>
                                 </div>
                                 <button className="flex items-center gap-2 text-[10px] font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                                    <Download className="w-3.5 h-3.5" /> RAW LOGS
                                 </button>
                              </div>
                              <div className="bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 mono text-[11px] space-y-3 shadow-inner custom-scrollbar overflow-y-auto max-h-[400px] transition-colors">
                                 {selectedReport.logs?.map((log, i) => (
                                    <div key={i} className="flex gap-4">
                                       <span className="text-gray-400 dark:text-gray-700 select-none">[{i + 1}]</span>
                                       <span className={`${log.type === 'success' ? 'text-green-600 dark:text-green-500' : ''} ${log.type === 'error' ? 'text-red-600 dark:text-red-500 font-bold' : ''} ${log.type === 'cmd' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                          {log.type === 'cmd' && <span className="text-gray-400 dark:text-gray-700 mr-2">$</span>}
                                          {log.msg}
                                       </span>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </>
                     )}
                  </div>

                  <div className="p-8 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/20 flex justify-end gap-3 transition-colors">
                     <button
                        onClick={() => setSelectedReport(null)}
                        className="px-10 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest shadow-xl shadow-indigo-600/20"
                     >
                        Close Report
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* Expanded Screenshot View */}
         {expandedScreenshot && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 animate-in fade-in zoom-in duration-200">
               <div className="absolute inset-0 bg-black/95 backdrop-blur-sm" onClick={() => setExpandedScreenshot(null)} />
               <div className="relative max-w-full max-h-full flex flex-col items-center">
                  <button
                     onClick={() => setExpandedScreenshot(null)}
                     className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors"
                  >
                     <X className="w-8 h-8" />
                  </button>
                  <img
                     src={`data:image/jpeg;base64,${expandedScreenshot}`}
                     alt="Step Execution Evidence"
                     className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
                  />
                  <div className="mt-4 px-6 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-white/80 text-[10px] font-black uppercase tracking-widest">
                     Full Resolution Evidence Capture
                  </div>
               </div>
            </div>
         )}

         {/* Live Execution Modal for Retry */}
         {activeRunId && executingScript && (
            <LiveExecutionModal
               runId={activeRunId}
               onClose={() => {
                  setActiveRunId(null);
                  setExecutingScript(null);
                  setExecutionStatus('idle');
                  if (onRefresh) onRefresh();
               }}
            />
         )}

         {/* Healed Asset Detail Modal */}
         {selectedHealedAsset && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white dark:bg-[#0c0e12] w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800">
                  <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-500/10 flex items-center justify-center">
                           <Wand2 className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                           <h2 className="text-xl font-black text-gray-900 dark:text-white">Self-Healing Detail</h2>
                           <p className="text-sm text-gray-500 font-medium">History ID: {selectedHealedAsset?.history_id}</p>
                        </div>
                     </div>
                     <button
                        onClick={() => setSelectedHealedAsset(null)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                     >
                        <X className="w-6 h-6 text-gray-400" />
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-10">
                     {/* Failure Analysis Context */}
                     <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                           <AlertTriangle className="w-4 h-4 text-amber-500" />
                           <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Original Failure Analysis (Context)</span>
                        </div>
                        {(() => {
                           const relatedHistory = history.find(h => h.id === selectedHealedAsset?.history_id);
                           const analysis = relatedHistory?.failureAnalysis;
                           if (!analysis) return <p className="text-sm text-amber-700/60 dark:text-amber-400/60 italic">No detailed analysis available for this failure.</p>;
                           return (
                              <div className="space-y-3">
                                 <div>
                                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">Reason:</span>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{analysis.reason}</p>
                                 </div>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-amber-200/50 dark:border-amber-500/10">
                                    <div>
                                       <span className="text-[9px] font-bold text-amber-800/70 dark:text-amber-300/70 uppercase">AI Diagnosis:</span>
                                       <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{analysis.thought}</p>
                                    </div>
                                    <div>
                                       <span className="text-[9px] font-bold text-amber-800/70 dark:text-amber-300/70 uppercase">Repair Strategy:</span>
                                       <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{analysis.suggestion}</p>
                                    </div>
                                 </div>
                              </div>
                           );
                        })()}
                     </div>

                     <div className="flex flex-col gap-6">
                        <div className="flex items-center gap-2">
                           <GitBranch className="w-4 h-4 text-indigo-500" />
                           <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Step Comparison (Before vs After)</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                           {/* ORIGINAL STEPS */}
                           <div className="space-y-4">
                              <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl inline-flex items-center gap-2">
                                 <History className="w-3 h-3 text-gray-500" />
                                 <span className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">Original Steps</span>
                              </div>
                              <div className="space-y-2">
                                 {(() => {
                                    const originalScript = scripts.find(s => s.id === selectedHealedAsset.script_id);
                                    const originalSteps = originalScript?.steps || [];
                                    return originalSteps.map((step: any, idx: number) => (
                                       <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-xl flex items-start gap-3 opacity-60">
                                          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{idx + 1}</span>
                                          <div className="flex-1 min-w-0">
                                             <div className="text-xs font-bold text-gray-900 dark:text-white truncate">{step.stepName || step.description}</div>
                                             <div className="text-[10px] font-mono text-gray-500 mt-1 truncate">{step.action} on {step.selectorValue || step.inputValue || '-'}</div>
                                          </div>
                                       </div>
                                    ));
                                 })()}
                              </div>
                           </div>

                           {/* HEALED STEPS */}
                           <div className="space-y-4">
                              <div className="px-4 py-2 bg-green-50 dark:bg-green-500/10 rounded-xl inline-flex items-center gap-2 border border-green-100 dark:border-green-500/20">
                                 <Zap className="w-3 h-3 text-green-500" />
                                 <span className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest">Healed Steps</span>
                              </div>
                              <div className="space-y-2">
                                 {selectedHealedAsset.modified_steps?.map((step: any, idx: number) => {
                                    const originalScript = scripts.find(s => s.id === selectedHealedAsset.script_id);
                                    const originalSteps = originalScript?.steps || [];
                                    const origStep = originalSteps[idx];
                                    const isModified = !origStep ||
                                       origStep.action !== step.action ||
                                       origStep.selectorValue !== step.selectorValue ||
                                       origStep.inputValue !== step.inputValue;

                                    return (
                                       <div key={idx} className={`p-4 ${isModified ? 'bg-green-50 dark:bg-green-500/5 ring-1 ring-green-500/20' : 'bg-gray-50 dark:bg-gray-900/40'} border border-gray-100 dark:border-gray-800 rounded-xl flex items-start gap-3 transition-all`}>
                                          <span className={`text-[10px] font-bold ${isModified ? 'text-green-600 bg-green-100 dark:bg-green-500/20' : 'text-gray-400 bg-gray-100 dark:bg-gray-800'} px-1.5 py-0.5 rounded shadow-sm`}>{idx + 1}</span>
                                          <div className="flex-1 min-w-0">
                                             <div className="flex items-center gap-2">
                                                <div className="text-xs font-bold text-gray-900 dark:text-white truncate">{step.stepName}</div>
                                                {isModified && (
                                                   <span className="text-[8px] font-black bg-green-500 text-white px-1 rounded-sm uppercase tracking-tighter">Healed</span>
                                                )}
                                             </div>
                                             <div className="text-[10px] font-mono mt-1 flex flex-wrap gap-x-2">
                                                <span className={isModified && origStep?.action !== step.action ? 'text-green-600 dark:text-green-400 font-black' : 'text-gray-500'}>{step.action}</span>
                                                <span className="text-gray-400">/</span>
                                                <span className={isModified && origStep?.selectorValue !== step.selectorValue ? 'text-green-600 dark:text-green-400 font-black' : 'text-gray-500'}>{step.selectorValue || step.inputValue || '-'}</span>
                                             </div>
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                           </div>
                        </div>
                     </div>

                     <div>
                        <div className="flex items-center gap-2 mb-4">
                           <Activity className="w-4 h-4 text-indigo-500" />
                           <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Autonomous Healing Logs</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {selectedHealedAsset.healing_steps?.map((log: any, idx: number) => (
                              <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-indigo-500/30 transition-all">
                                 <div className="flex items-center gap-3 mb-2">
                                    <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded">RECOVERY STEP {log.step_number}</span>
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ml-auto ${log.status === 'Completed' ? 'bg-green-100 text-green-600' :
                                       log.status === 'Failed' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                       }`}>
                                       {log.status}
                                    </span>
                                 </div>
                                 <p className="text-xs font-bold text-gray-900 dark:text-white mb-1">{log.description}</p>
                                 <p className="text-[11px] text-gray-600 dark:text-gray-400 italic font-medium leading-relaxed">"{log.thought}"</p>
                              </div>
                           ))}
                        </div>
                     </div>

                     <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end">
                        <button
                           onClick={() => setSelectedHealedAsset(null)}
                           className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/10"
                        >
                           CLOSE
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* Jira Assignment Modal */}
         {jiraTarget && (
            <JiraSyncModal 
               targetItem={jiraTarget}
               onClose={() => setJiraTarget(null)}
               onSuccess={() => {
                  if (onRefresh) onRefresh();
               }}
            />
         )}
      </div>
   );
};

export default HistoryView;
