
import React, { useState, useMemo } from 'react';
import {
   History, Search, Filter, Calendar, Clock, ChevronRight,
   CheckCircle2, XCircle, Info, Activity, Terminal,
   BarChart3, LayoutGrid, ArrowUpRight, Zap, Bot, Users,
   X, Download, AlertTriangle, FileText, GitBranch, MousePointer2, Timer,
   Hash, Layers, Tag, Target, Save
} from 'lucide-react';
import { TestHistory, Project, ExecutionTrigger } from '../types';
import api from '../api/client';

interface HistoryViewProps {
   history: TestHistory[];
   activeProject: Project;
   onRefresh?: () => void;
   onNavigateToLibrary?: (scriptId: string) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, activeProject, onRefresh, onNavigateToLibrary }) => {
   //console.log('HistoryView received history:', history);

   // Refresh history on mount
   React.useEffect(() => {
      if (onRefresh) {
         onRefresh();
      }
   }, []);

   const [searchTerm, setSearchTerm] = useState('');
   const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed'>('all');
   const [triggerFilter, setTriggerFilter] = useState<'all' | ExecutionTrigger>('all');
   const [selectedContext, setSelectedContext] = useState<string>('All Contexts');
   const [selectedReport, setSelectedReport] = useState<TestHistory | null>(null);

   // Pagination State
   const [currentPage, setCurrentPage] = useState(1);
   const [itemsPerPage, setItemsPerPage] = useState(10);

   const stats = useMemo(() => {
      const total = history.length;
      const passed = history.filter(h => h.status === 'passed').length;
      const pipelineRuns = history.filter(h => h.trigger === 'pipeline').length;
      const aiExplorationRuns = history.filter(h => h.trigger === 'ai_exploration' || (h.trigger as any) === 'manual_ai').length;
      const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
      return { total, passed, rate, pipelineRuns, aiExplorationRuns };
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

         return matchesSearch && matchesStatus && matchesTrigger && matchesContext;
      });
   }, [history, searchTerm, statusFilter, triggerFilter, selectedContext]);

   const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
   const paginatedHistory = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredHistory.slice(start, start + itemsPerPage);
   }, [filteredHistory, currentPage, itemsPerPage]);

   // Reset to page 1 when filters change
   React.useEffect(() => {
      setCurrentPage(1);
   }, [searchTerm, statusFilter, triggerFilter, selectedContext, itemsPerPage]);

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
         case 'ai_exploration': return 'AI_Exploration';
         default: return 'Other';
      }
   };

   const [showSuccessModal, setShowSuccessModal] = useState(false);

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

   return (
      <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto custom-scrollbar">
         {/* Header & Stats Dashboard */}
         <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
               <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 transition-colors">Execution History</h2>
               <p className="text-gray-500 dark:text-gray-400 text-sm transition-colors">Review asset performance and AI failure analysis for {activeProject.name}.</p>
            </div>

            <div className="grid grid-cols-4 gap-4">
               <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 min-w-[120px] transition-colors shadow-sm dark:shadow-none">
                  <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase mb-1 transition-colors">Total Runs</div>
                  <div className="text-2xl font-black text-gray-900 dark:text-white transition-colors">{stats.total}</div>
               </div>
               <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 min-w-[120px] transition-colors shadow-sm dark:shadow-none">
                  <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase mb-1 transition-colors">Success Rate</div>
                  <div className={`text-2xl font-black ${stats.rate > 90 ? 'text-green-600 dark:text-green-500' : 'text-amber-500'}`}>{stats.rate}%</div>
               </div>
               <div className="bg-purple-600/5 border border-purple-500/20 rounded-2xl p-4 min-w-[120px]">
                  <div className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase mb-1 transition-colors">Pipeline Auto</div>
                  <div className="text-2xl font-black text-gray-900 dark:text-white transition-colors">{stats.pipelineRuns}</div>
               </div>
               <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-4 min-w-[120px]">
                  <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase mb-1 transition-colors">AI Exploration</div>
                  <div className="text-2xl font-black text-gray-900 dark:text-white transition-colors">{stats.aiExplorationRuns}</div>
               </div>
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
                     placeholder="Search by script name..."
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
                     <option value="All Contexts">All Contexts</option>
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
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
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

               <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors">
                  {(['all', 'pipeline', 'manual', 'scheduled', 'ai_exploration'] as const).map((t) => (
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
            </div>
         </div>

         {/* History Table */}
         <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xl dark:shadow-2xl transition-colors">
            <table className="w-full text-left">
               <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-black uppercase text-gray-500 transition-colors">
                  <tr>
                     <th className="px-6 py-4">Status</th>
                     <th className="px-6 py-4">Origin Context</th>
                     <th className="px-6 py-4">Golden Script Asset</th>
                     <th className="px-6 py-4">Persona</th>
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
                                 const res = await api.get(`/history/${item.id}`);
                                 setSelectedReport({ ...res.data });
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
                           </div>
                        </td>
                        <td className="px-6 py-5">
                           <div className="flex flex-col gap-1.5">
                              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-black uppercase text-[9px] tracking-widest w-fit ${item.trigger === 'pipeline' ? 'bg-purple-100 dark:bg-purple-600/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' :
                                 item.trigger === 'scheduled' ? 'bg-amber-100 dark:bg-amber-600/10 text-amber-600 dark:text-amber-500 border-amber-200 dark:border-amber-500/20' :
                                    (item.trigger === 'ai_exploration') ? 'bg-indigo-100 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20' :
                                       'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
                                 }`}>
                                 {getTriggerIcon(item.trigger)}
                                 {getTriggerLabel(item.trigger)}
                              </div>

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
                              <Users className="w-3 h-3 text-indigo-500" />
                              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">{item.personaName}</span>
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
                              <div className="text-sm font-bold text-gray-900 dark:text-white transition-colors">{selectedReport.runDate}</div>
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
                                          Successfully converted this exploration into a reusable <strong>Scenario</strong> and <strong>Test Script</strong>.
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
                           {/* AI Analysis Panel (Static/Summary for non-full AI runs) */}
                           <div className={`p-6 rounded-3xl border ${selectedReport.status === 'passed' ? 'bg-green-50 dark:bg-green-950/10 border-green-200 dark:border-green-500/20' : 'bg-indigo-50 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-500/20'} transition-colors`}>
                              <div className="flex items-center gap-3 mb-4">
                                 <Bot className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                                 <h4 className="text-xs font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em]">Oracle Intelligent Analysis</h4>
                              </div>
                              <div className="space-y-4">
                                 <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium transition-colors">
                                    {selectedReport.aiSummary || (selectedReport.status === 'passed' ? "The agent successfully navigated through all assertion points. UI consistency and state transitions were 100% compliant with the Golden Script definition." : "Critical failure detected during the assertion phase. The agent encountered a mismatch between expected and actual DOM state.")}
                                 </p>
                                 {selectedReport.status === 'failed' && (
                                    <div className="flex items-center gap-3 p-4 bg-red-100 dark:bg-red-600/10 border border-red-200 dark:border-red-500/20 rounded-2xl transition-colors">
                                       <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                                       <div>
                                          <div className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-0.5">Failure Type: {selectedReport.failureReason || 'Logic Discrepancy'}</div>
                                          <p className="text-xs text-red-600/80 dark:text-red-400/80 italic">"UI Selector mismatch or API Timeout detected during the execution flow."</p>
                                       </div>
                                    </div>
                                 )}
                              </div>
                           </div>

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
                                 {selectedReport.logs.map((log, i) => (
                                    <div key={i} className="flex gap-4">
                                       <span className="text-gray-400 dark:text-gray-700 select-none">[{i + 1}]</span>
                                       <span className={`
                                       ${log.type === 'success' ? 'text-green-600 dark:text-green-500' : ''}
                                       ${log.type === 'error' ? 'text-red-600 dark:text-red-500 font-bold' : ''}
                                       ${log.type === 'cmd' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400'}
                                    `}>
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
                     <button className="flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest">
                        <FileText className="w-4 h-4" /> Export Data
                     </button>
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
      </div>
   );
};

export default HistoryView;
