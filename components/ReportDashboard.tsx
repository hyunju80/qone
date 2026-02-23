
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
   BarChart3, TrendingUp, ShieldCheck, Activity, Bug,
   AlertTriangle, CheckCircle2, XCircle, FileText,
   Download, Filter, Calendar, Zap, ArrowRight,
   PieChart, LineChart, Star, Search, X, Loader2,
   FileCode, Terminal, RefreshCw, ChevronRight, Globe, Database,
   Layers, MousePointer2, Shield, Printer, Share2, ClipboardCheck,
   Info, Target, FileDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { TestHistory, TestScript, Project, ScriptStatus, ScriptOrigin, StepAsset } from '../types';
import api from '../api/client';

interface ReportDashboardProps {
   history: TestHistory[];
   scripts: TestScript[];
   steps: StepAsset[];
   activeProject: Project;
}

const ReportDashboard: React.FC<ReportDashboardProps> = ({ history, scripts, steps, activeProject }) => {
   const [isExporting, setIsExporting] = useState(false);
   const [exportStep, setExportStep] = useState('');
   const [showFilter, setShowFilter] = useState(false);
   const [selectedRange, setSelectedRange] = useState('Last 7 Days');
   const [activeTrace, setActiveTrace] = useState<any>(null);
   const [showReportPreview, setShowReportPreview] = useState(false);
   const [reportContent, setReportContent] = useState<string>('');

   const filteredHistory = useMemo(() => {
      const now = new Date();
      return history.filter(h => {
         const runDate = new Date(h.runDate);
         if (selectedRange === 'Last 24 Hours') {
            return (now.getTime() - runDate.getTime()) <= 24 * 60 * 60 * 1000;
         }
         if (selectedRange === 'Last 7 Days') {
            return (now.getTime() - runDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
         }
         if (selectedRange === 'Last 30 Days') {
            return (now.getTime() - runDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
         }
         return true; // All / Custom
      });
   }, [history, selectedRange]);

   const stats = useMemo(() => {
      const totalRuns = filteredHistory.length;
      const passedRuns = filteredHistory.filter(h => h.status === 'passed').length;
      const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

      // Group Scripts by Origin for Golden Summary
      const groupedScripts = {
         [ScriptOrigin.AI_EXPLORATION]: scripts.filter(s => s.status === ScriptStatus.CERTIFIED && s.origin === ScriptOrigin.AI_EXPLORATION),
         [ScriptOrigin.AI]: scripts.filter(s => s.status === ScriptStatus.CERTIFIED && (s.origin === ScriptOrigin.AI)), // Handle flexible origin string if needed
         [ScriptOrigin.MANUAL]: scripts.filter(s => s.status === ScriptStatus.CERTIFIED && (!s.origin || s.origin === ScriptOrigin.MANUAL)),
         [ScriptOrigin.STEP]: steps // Use steps directly for STEP origin
      };

      // Calculate Utilization & Stability per Script based on FILTERED history
      const enrichScriptMetrics = (list: any[]) => list.map(s => {
         // Filter runs for this script that are within the selected range
         const scriptRuns = filteredHistory.filter(h => h.scriptId === s.id);
         const runCount = scriptRuns.length;
         const successCount = scriptRuns.filter(r => r.status === 'passed').length;
         const stability = runCount > 0 ? Math.round((successCount / runCount) * 100) : 0;
         // Utilization relative to total runs in this PERIOD
         const utilization = totalRuns > 0 ? (runCount / totalRuns) * 100 : 0;
         const lastRun = scriptRuns.length > 0 ? scriptRuns[0].runDate : 'N/A';

         return { ...s, stability, utilization, lastRun, runCount };
      }).sort((a, b) => b.utilization - a.utilization); // Show all (sorted)

      const getCategoryStats = (metricsList: any[]) => {
         const totalCount = metricsList.length;
         const avgStability = totalCount > 0
            ? Math.round(metricsList.reduce((sum, item) => sum + item.stability, 0) / totalCount)
            : 0;
         return { totalCount, avgStability };
      };

      const enrichedExploration = enrichScriptMetrics(groupedScripts[ScriptOrigin.AI_EXPLORATION]);
      const enrichedGenerator = enrichScriptMetrics(groupedScripts[ScriptOrigin.AI]);
      const enrichedManual = enrichScriptMetrics(groupedScripts[ScriptOrigin.MANUAL]);
      const enrichedStep = enrichScriptMetrics(groupedScripts[ScriptOrigin.STEP]);

      const goldenSummary = {
         exploration: enrichedExploration.slice(0, 3),
         generator: enrichedGenerator.slice(0, 3),
         manual: enrichedManual.slice(0, 3),
         step: enrichedStep.slice(0, 3)
      };

      const categoryStats = {
         exploration: getCategoryStats(enrichedExploration),
         generator: getCategoryStats(enrichedGenerator),
         manual: getCategoryStats(enrichedManual),
         step: getCategoryStats(enrichedStep)
      };

      // Diagnosis breakdown
      const diagnosis = {
         ui: filteredHistory.filter(h => (h.failureReason || '').toLowerCase().includes('ui') || (h.failureReason || '').toLowerCase().includes('selector') || (h.failureReason || '').toLowerCase().includes('element')).length,
         network: filteredHistory.filter(h => (h.failureReason || '').toLowerCase().includes('api') || (h.failureReason || '').toLowerCase().includes('network') || (h.failureReason || '').toLowerCase().includes('timeout')).length,
         logic: filteredHistory.filter(h => h.status === 'failed' && !(['ui', 'api', 'network', 'selector', 'timeout'].some(k => (h.failureReason || '').toLowerCase().includes(k)))).length
      };

      // AI Stats
      const aiExplorations = filteredHistory.filter(h => h.trigger === 'ai_exploration').length;
      const scheduledRuns = filteredHistory.filter(h => h.trigger === 'scheduled').length;

      return { totalRuns, passRate, goldenSummary, categoryStats, aiExplorations, scheduledRuns, diagnosis };
   }, [filteredHistory, scripts]);

   const [activeTab, setActiveTab] = useState<'exploration' | 'generator' | 'manual' | 'step'>('exploration');
   const [failurePage, setFailurePage] = useState(1);
   const failureItemsPerPage = 10;
   const trendPoints = useMemo(() => {
      // Calculate trend based on filtered History
      // Default: Last 7 days, showing filtered data if available.

      const pts = [];
      for (let i = 6; i >= 0; i--) {
         const d = new Date();
         d.setDate(d.getDate() - i);
         const dateStr = d.toISOString().split('T')[0];

         const dailyRuns = filteredHistory.filter(h => h.runDate.startsWith(dateStr));
         if (dailyRuns.length === 0) {
            pts.push(0);
         } else {
            const dailyPass = dailyRuns.filter(r => r.status === 'passed').length;
            pts.push(Math.round((dailyPass / dailyRuns.length) * 100));
         }
      }
      return pts.length > 0 ? pts : [0, 0, 0, 0, 0, 0, 0];
   }, [filteredHistory]);

   // ... (rest of export logic)

   const handleExport = async () => {
      setIsExporting(true);
      setExportStep('Aggregating Telemetry...');

      try {
         // 1. Prepare Data for AI Analysis
         setExportStep('Analyzing Failure Patterns...');

         const topFailures = filteredHistory
            .filter(h => h.status === 'failed')
            .slice(0, 5)
            .map(h => ({
               asset: (h as any).script_name || (h as any).ai_summary || 'Unknown Asset',
               reason: h.failureReason,
               date: h.runDate
            }));

         const payload = {
            project_name: activeProject.name,
            period: selectedRange,
            stats: {
               totalRuns: stats.totalRuns,
               passRate: stats.passRate,
               diagnosis: stats.diagnosis,
               topFailures: topFailures,
               goldenSummary: {
                  exploration: stats.goldenSummary.exploration.map(s => s.name),
                  generator: stats.goldenSummary.generator.map(s => s.name),
                  manual: stats.goldenSummary.manual.map(s => s.name),
                  step: stats.goldenSummary.step.map(s => s.name)
               }
            }
         };

         // 2. Call Backend API
         setExportStep('Synthesizing Intelligence Report...');
         const response = await api.post('/exploration/analyze_report', payload);

         if (response.data && response.data.report_markdown) {
            setReportContent(response.data.report_markdown);
            setShowReportPreview(true);
         } else {
            throw new Error("No report generated");
         }

         setExportStep('Report Ready!');
      } catch (error) {
         console.error('Export failed:', error);
         setExportStep('Analysis Failed');
         alert('Failed to generate AI Report. Please try again.');
      }

      await new Promise(r => setTimeout(r, 500));
      setIsExporting(false);
   };

   return (
      <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar relative bg-white dark:bg-[#0c0e12] transition-colors">
         {/* Header Section */}
         <div className="flex items-center justify-between mb-10">
            <div>
               <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter mb-2 transition-colors">Quality Intelligence</h2>
               <p className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-widest flex items-center gap-2 transition-colors">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  Performance & AI Diagnostic Analytics for {activeProject.name}
               </p>
            </div>
            <div className="flex gap-3 relative">
               <div className="relative">
                  <button
                     onClick={() => setShowFilter(!showFilter)}
                     className={`flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-900 border transition-all rounded-xl text-[10px] font-black uppercase ${showFilter ? 'border-indigo-500 text-indigo-600 dark:text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'border-gray-200 dark:border-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                     <Filter className="w-4 h-4" /> {selectedRange}
                  </button>
                  {showFilter && (
                     <div className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl z-50 p-2 overflow-hidden animate-in fade-in slide-in-from-top-2 transition-colors">
                        {['Last 24 Hours', 'Last 7 Days', 'Last 30 Days', 'Custom Range'].map(range => (
                           <button
                              key={range}
                              onClick={() => { setSelectedRange(range); setShowFilter(false); }}
                              className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedRange === range ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'}`}
                           >
                              {range}
                           </button>
                        ))}
                     </div>
                  )}
               </div>
               <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 transition-all rounded-xl text-[10px] font-black uppercase text-white shadow-xl shadow-indigo-600/20 disabled:opacity-50 min-w-[180px] justify-center"
               >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isExporting ? exportStep : 'Export Intelligence'}
               </button>
            </div>
         </div>

         {/* Main Dashboard Layout (Rest of UI) */}
         <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Golden Summary (By Origin)</h3>
               </div>
               <div className="flex gap-2">
                  {['exploration', 'generator', 'manual', 'step'].map((tab) => (
                     <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                           }`}
                     >
                        {tab === 'exploration' ? 'AI Exploration' : tab === 'generator' ? 'AI Generator' : tab === 'manual' ? 'Manual' : 'Step Builder'}
                     </button>
                  ))}
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
               <div className="lg:col-span-3 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2rem] overflow-hidden shadow-sm dark:shadow-2xl flex flex-col transition-colors">
                  <div className="flex-1">
                     <table className="w-full text-left">
                        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#1f232b] border-b border-gray-200 dark:border-gray-800 text-[10px] font-black uppercase text-gray-500 transition-colors">
                           <tr>
                              <th className="px-6 py-4">Asset Name</th>
                              <th className="px-6 py-4">Context / Description</th>
                              <th className="px-6 py-4 text-center">Utilization</th>
                              <th className="px-6 py-4 text-center whitespace-nowrap w-[130px]">Stability</th>
                              <th className="px-6 py-4 text-right whitespace-nowrap w-[120px]">Last Verified</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 transition-colors">
                           {stats.goldenSummary[activeTab].length === 0 ? (
                              <tr>
                                 <td colSpan={5} className="px-6 py-10 text-center text-gray-500 text-xs italic">
                                    No certified assets found for {activeTab === 'exploration' ? 'AI Exploration' : activeTab === 'generator' ? 'AI Generator' : activeTab === 'manual' ? 'Manual' : 'Step Builder'} origin.
                                 </td>
                              </tr>
                           ) : (
                              stats.goldenSummary[activeTab].map(script => (
                                 <tr key={script.id} className="hover:bg-gray-50 dark:hover:bg-indigo-500/5 transition-colors group">
                                    <td className="px-6 py-5">
                                       <div className="flex items-center gap-3">
                                          <div className={`p-2 rounded-lg transition-all ${activeTab === 'exploration' ? 'bg-purple-100 dark:bg-purple-600/10 text-purple-600 dark:text-purple-400' : activeTab === 'generator' ? 'bg-blue-100 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400' : activeTab === 'manual' ? 'bg-gray-100 dark:bg-gray-700/30 text-gray-400' : 'bg-orange-100 dark:bg-orange-600/10 text-orange-600 dark:text-orange-400'}`}>
                                             <FileCode className="w-4 h-4" />
                                          </div>
                                          <span className="text-xs font-bold text-gray-900 dark:text-gray-200 transition-colors">{script.name}</span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-5">
                                       <span className="text-[11px] text-gray-500 line-clamp-1 italic">{script.description || 'No description provided'}</span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                       <div className="flex flex-col items-center gap-1">
                                          <span className="text-[11px] font-bold text-gray-900 dark:text-white transition-colors">{script.utilization.toFixed(1)}%</span>
                                          <div className="w-16 h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                                             <div className="h-full bg-indigo-500" style={{ width: `${script.utilization}%` }} />
                                          </div>
                                          <span className="text-[9px] text-gray-500 dark:text-gray-600">{script.runCount} Runs</span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                       <span className={`px-2 py-1 text-[10px] font-black rounded ${script.stability >= 90 ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-500' :
                                          script.stability >= 70 ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500' : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-500'
                                          }`}>
                                          {script.stability}% Stable
                                       </span>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                       <span className="text-[10px] font-mono text-gray-500">
                                          {script.lastRun !== 'N/A' ? new Date(script.lastRun).toLocaleDateString() : '-'}
                                       </span>
                                    </td>
                                 </tr>
                              ))
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>

               <div className="bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/20 rounded-[2.5rem] p-8 flex flex-col justify-center relative overflow-hidden h-full shadow-lg transition-colors">
                  <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12"><Shield className="w-32 h-32 text-indigo-400" /></div>
                  <div className="relative z-10">
                     <div className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-2 transition-colors">
                        {activeTab === 'exploration' ? 'Auto-Discovery Impact' : activeTab === 'generator' ? 'Generation Efficiency' : activeTab === 'manual' ? 'Manual Reliability' : 'Modular Step Reusability'}
                     </div>
                     <div className="flex items-baseline gap-2 mb-2">
                        <div className="text-5xl font-black text-gray-900 dark:text-white transition-colors">
                           {stats.categoryStats[activeTab].totalCount}
                        </div>
                        <div className="text-sm font-bold text-indigo-600 dark:text-indigo-300 transition-colors">
                           Assets
                        </div>
                     </div>
                     <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-lg border border-indigo-500/20 dark:border-indigo-500/30 mb-4 transition-colors">
                        <Activity className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-200">
                           Avg Stability: {stats.categoryStats[activeTab].avgStability}%
                        </span>
                     </div>
                     <p className="text-xs text-indigo-600/80 dark:text-indigo-300/80 leading-relaxed font-medium transition-colors">
                        {activeTab === 'exploration' ? 'Active assets autonomously discovered and certified by AI.' :
                           activeTab === 'generator' ? 'Scenarios converted to robust scripts via AI Generator.' :
                              activeTab === 'manual' ? 'Manually crafted golden paths serving as baseline.' :
                                 'Modular step assets reused across multiple scenarios.'}
                     </p>
                  </div>
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10 mt-10">
               <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-indigo-500/30 transition-all shadow-sm dark:shadow-none">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Activity className="w-20 h-20" /></div>
                  <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Total Executions</div>
                  <div className="text-4xl font-black text-gray-900 dark:text-white transition-colors">{stats.totalRuns}</div>
                  <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-green-500">
                     <TrendingUp className="w-3.5 h-3.5" /> +14.2% vs Last Week
                  </div>
               </div>
               <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-indigo-500/30 transition-all shadow-sm dark:shadow-none">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><ShieldCheck className="w-20 h-20" /></div>
                  <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Success Rate (Avg)</div>
                  <div className={`text-4xl font-black ${stats.passRate > 85 ? 'text-green-500' : 'text-amber-500'}`}>{stats.passRate}%</div>
                  <div className="mt-4 w-full bg-gray-200 dark:bg-gray-950 h-1.5 rounded-full overflow-hidden">
                     <div className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${stats.passRate}%` }} />
                  </div>
               </div>
               <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-indigo-500/30 transition-all shadow-sm dark:shadow-none">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Zap className="w-20 h-20" /></div>
                  <div className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-4 transition-colors">AI Explorations</div>
                  <div className="text-4xl font-black text-gray-900 dark:text-white transition-colors">{stats.aiExplorations}</div>
                  <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                     Autonomous Sessions
                  </div>
               </div>
               <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-cyan-500/30 transition-all shadow-sm dark:shadow-none">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Calendar className="w-20 h-20" /></div>
                  <div className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-4">Scheduled Executions</div>
                  <div className="text-4xl font-black text-gray-900 dark:text-white transition-colors">{stats.scheduledRuns}</div>
                  <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-cyan-600/60 dark:text-cyan-500/60 uppercase tracking-tighter">
                     Automated Pipeline Runs
                  </div>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
            <div className="lg:col-span-2 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-8 shadow-sm dark:shadow-2xl relative overflow-hidden transition-colors">
               <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 opacity-20" />
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                     <div className="p-2.5 bg-indigo-600/10 rounded-xl text-indigo-400">
                        <LineChart className="w-5 h-5" />
                     </div>
                     <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Global Success Trend</h3>
                  </div>
               </div>
               <div className="h-[280px] w-full relative group">
                  <svg className="w-full h-full" viewBox="0 0 700 200">
                     <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                           <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                           <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                        </linearGradient>
                     </defs>
                     <path d={`M 0,${200 - trendPoints[0]} ${trendPoints.map((p, i) => `L ${i * 116},${200 - p}`).join(' ')}`} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                     <path d={`M 0,${200 - trendPoints[0]} ${trendPoints.map((p, i) => `L ${i * 116},${200 - p}`).join(' ')} L 700,200 L 0,200 Z`} fill="url(#gradient)" />
                     {trendPoints.map((p, i) => (
                        <circle key={i} cx={i * 116} cy={200 - p} r="4" fill="currentColor" className="text-gray-900 dark:text-[#16191f]" stroke="#6366f1" strokeWidth="2" />
                     ))}
                  </svg>
               </div>
            </div>
            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-8 shadow-sm dark:shadow-2xl flex flex-col relative overflow-hidden transition-colors">
               <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 opacity-20" />
               <div className="flex items-center gap-3 mb-8">
                  <div className="p-2.5 bg-amber-600/10 rounded-xl text-amber-500">
                     <PieChart className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Failure Diagnosis</h3>
               </div>
               <div className="flex-1 flex flex-col items-center justify-center py-6">
                  <div className="relative w-40 h-40">
                     <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" className="text-gray-100 dark:text-[#1f2937]" strokeWidth="4" />
                        <circle cx="16" cy="16" r="14" fill="none" stroke="#6366f1" strokeWidth="4" strokeDasharray="100" strokeDashoffset={100 - (stats.diagnosis.ui * 20)} />
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black text-gray-900 dark:text-white transition-colors">{history.filter(h => h.status === 'failed').length}</span>
                        <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Failures</span>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Failure Analysis Table */}
         <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] overflow-hidden shadow-sm dark:shadow-2xl mb-20 transition-colors">
            <div className="p-8 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-950/20 transition-colors">
               <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-red-600/10 rounded-xl text-red-500">
                     <Bug className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Recent Failure Analysis & Root Cause</h3>
               </div>
            </div>
            <table className="w-full text-left">
               <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black uppercase text-gray-500 border-b border-gray-200 dark:border-gray-800 transition-colors">
                  <tr>
                     <th className="px-8 py-4">Failed Asset / Goal</th>
                     <th className="px-8 py-4 whitespace-nowrap w-[150px]">Failure Category</th>
                     <th className="px-8 py-4">Root Cause Hint</th>
                     <th className="px-8 py-4 text-center">Occurred At</th>
                     <th className="px-8 py-4 text-right">Analysis</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 transition-colors">
                  {(() => {
                     const failures = filteredHistory.filter(h => h.status === 'failed');
                     const totalPages = Math.ceil(failures.length / failureItemsPerPage);

                     if (failures.length === 0) {
                        return (
                           <tr>
                              <td colSpan={5} className="px-8 py-12 text-center text-gray-600 italic">
                                 No failures detected in the selected period.
                              </td>
                           </tr>
                        );
                     }

                     const paginatedFailures = failures.slice((failurePage - 1) * failureItemsPerPage, failurePage * failureItemsPerPage);

                     return (
                        <>
                           {paginatedFailures.map(h => {
                              const isAI = h.trigger === 'ai_exploration';
                              const reason = (h.failureReason || 'Unknown Error').toLowerCase();
                              let category = 'Logic Error';
                              if (reason.includes('timeout')) category = 'Timeout / Performance';
                              if (reason.includes('element') || reason.includes('selector') || reason.includes('found')) category = 'UI / Selector Change';
                              if (reason.includes('network') || reason.includes('api') || reason.includes('500')) category = 'Network / API';

                              return (
                                 <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                    <td className="px-8 py-5 font-bold text-gray-700 dark:text-gray-300 text-sm">
                                       {isAI ? ((h as any).ai_summary || 'Ad-hoc Task') : (h as any).script_name || 'Unknown Script'}
                                       {isAI && <div className="text-[10px] text-indigo-500 dark:text-indigo-400 font-normal mt-1">AI Exploration: {(h as any).persona_name || 'Default'}</div>}
                                    </td>
                                    <td className="px-8 py-5 whitespace-nowrap">
                                       <span className={`px-2 py-1 border text-[9px] font-black uppercase rounded tracking-tighter ${category.includes('UI') ? 'bg-orange-600/10 border-orange-500/20 text-orange-600 dark:text-orange-500' :
                                          category.includes('Network') ? 'bg-blue-600/10 border-blue-500/20 text-blue-600 dark:text-blue-500' :
                                             'bg-red-600/10 border-red-500/20 text-red-600 dark:text-red-500'
                                          }`}>
                                          {category}
                                       </span>
                                    </td>
                                    <td className="px-8 py-5 text-xs text-gray-500 italic leading-tight max-w-xs truncate">
                                       {h.failureReason || 'No detailed error message captured.'}
                                    </td>
                                    <td className="px-8 py-5 text-center text-xs text-gray-400 font-mono">
                                       {new Date(h.runDate).toLocaleString()}
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                       <button
                                          onClick={async () => {
                                             if (isAI) {
                                                try {
                                                   const res = await api.get(`/history/${h.id}`);
                                                   setActiveTrace({ ...res.data, type: 'ai' });
                                                } catch (e) {
                                                   console.error(e);
                                                }
                                             } else {
                                                setActiveTrace({ ...h, type: 'standard' });
                                             }
                                          }}
                                          className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 uppercase tracking-widest flex items-center gap-2 ml-auto py-1.5 px-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all"
                                       >
                                          Investigate <ChevronRight className="w-3.5 h-3.5" />
                                       </button>
                                    </td>
                                 </tr>
                              );
                           })}
                           {/* Pagination Footer */}
                           {totalPages > 1 && (
                              <tr>
                                 <td colSpan={5} className="px-8 py-4 border-t border-gray-200 dark:border-gray-800 transition-colors">
                                    <div className="flex items-center justify-between">
                                       <div className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">
                                          Showing {(failurePage - 1) * failureItemsPerPage + 1} - {Math.min(failurePage * failureItemsPerPage, failures.length)} of {failures.length} Failures
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <button
                                             onClick={() => setFailurePage(p => Math.max(1, p - 1))}
                                             disabled={failurePage === 1}
                                             className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg text-xs font-bold text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-all border border-gray-200 dark:border-transparent"
                                          >
                                             Previous
                                          </button>
                                          <div className="px-2 text-xs font-bold text-gray-500">
                                             Page {failurePage} / {totalPages}
                                          </div>
                                          <button
                                             onClick={() => setFailurePage(p => Math.min(totalPages, p + 1))}
                                             disabled={failurePage === totalPages}
                                             className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg text-xs font-bold text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-all border border-gray-200 dark:border-transparent"
                                          >
                                             Next
                                          </button>
                                       </div>
                                    </div>
                                 </td>
                              </tr>
                           )}
                        </>
                     );
                  })()}
               </tbody>
            </table>
         </div>

         {/* REPORT PREVIEW MODAL */}
         {
            showReportPreview && createPortal(
               <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 sm:p-12 animate-in fade-in duration-300 print:p-0 print:static print:block print:bg-white">
                  {/* Global Print Styles Injection */}
                  <style>
                     {`
                        @media print {
                           #root { display: none !important; }
                           body { background: white !important; overflow: visible !important; height: auto !important; }
                           /* Ensure Portal container is visible */
                           html, body { width: 100%; margin: 0; padding: 0; }
                           /* Aggressive reset for ReactMarkdown content */
                           h1, h2, h3, p, li { page-break-inside: avoid; }
                           a { text-decoration: none; color: black; }
                        }
                     `}
                  </style>

                  <div className="absolute inset-0 bg-black/50 dark:bg-black/90 backdrop-blur-xl print:hidden transition-colors" onClick={() => setShowReportPreview(false)} />
                  <div className="relative w-full max-w-5xl h-full max-h-[90vh] bg-[#fdfdfd] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 text-gray-900 border-[12px] border-gray-200/50 dark:border-white/10 print:border-none print:shadow-none print:w-full print:max-w-none print:h-auto print:max-h-none print:rounded-none print:overflow-visible transition-colors">
                     <button onClick={() => setShowReportPreview(false)} className="absolute top-8 right-8 p-3 bg-gray-900 text-white rounded-2xl z-[200] hover:bg-gray-800 transition-colors print:hidden"><X className="w-4 h-4" /></button>
                     <div className="flex-1 overflow-auto p-12 custom-scrollbar print:overflow-visible print:h-auto print:p-0">
                        <div className="flex items-center justify-between mb-8 print:hidden">
                           <h1 className="text-3xl font-black text-gray-900">Executive Intelligence Report</h1>
                           <button
                              onClick={() => window.print()}
                              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/20"
                           >
                              <Printer className="w-4 h-4" /> Download PDF / Print
                           </button>
                        </div>

                        <div className="prose prose-lg max-w-none text-gray-700 bg-white p-10 rounded-xl border border-gray-200 shadow-sm print:shadow-none print:border-none print:p-0 print:prose-sm">
                           {/* Print Header */}
                           <div className="hidden print:block mb-8 border-b-2 border-indigo-600 pb-4">
                              <h1 className="text-3xl font-black text-gray-900">Executive QA Intelligence Report</h1>
                              <p className="text-gray-500 mt-2 text-sm">Generated by Q-ONE AI Engine • {activeProject.name}</p>
                           </div>
                           <ReactMarkdown
                              components={{
                                 h1: ({ node, ...props }) => <h1 className="text-2xl font-black text-indigo-900 mb-6 border-b pb-4 border-indigo-100 print:text-xl print:mb-4" {...props} />,
                                 h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4 flex items-center gap-2 before:content-[''] before:w-1.5 before:h-6 before:bg-indigo-500 before:rounded-full before:mr-2 print:page-break-after-avoid print:text-lg" {...props} />,
                                 h3: ({ node, ...props }) => <h3 className="text-lg font-bold text-gray-800 mt-6 mb-3 print:page-break-after-avoid print:text-base" {...props} />,
                                 strong: ({ node, ...props }) => <span className="font-extrabold text-indigo-700 bg-indigo-50 px-1 rounded print:bg-transparent print:text-black print:font-bold" {...props} />,
                                 ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-2 mb-6 text-sm" {...props} />,
                                 li: ({ node, ...props }) => <li className="text-gray-700 leading-relaxed pl-1" {...props} />
                              }}
                           >
                              {reportContent || "> **Generating Report...**"}
                           </ReactMarkdown>
                        </div>

                        <div className="mt-12 pt-8 border-t border-gray-200 flex justify-between text-xs text-gray-400 font-mono print:fixed print:bottom-4 print:left-8 print:right-8">
                           <span>Generated by Q-ONE AI Engine</span>
                           <span>{new Date().toLocaleString()}</span>
                        </div>
                     </div>
                  </div>
               </div>,
               document.body
            )
         }

         {/* DETAILED TRACE OVERLAY (Functional Sidebar) */}
         {
            activeTrace && (
               <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
                  <div className="absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-md transition-colors" onClick={() => setActiveTrace(null)} />
                  <div className="relative w-full max-w-2xl bg-white dark:bg-[#0f1115] border-l border-gray-200 dark:border-gray-800 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 transition-colors">
                     <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 flex items-center justify-between transition-colors">
                        <div className="flex items-center gap-4">
                           <div className={`p-3 rounded-2xl ${activeTrace.type === 'ai' ? 'bg-indigo-100 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                              {activeTrace.type === 'ai' ? <Bot className="w-8 h-8" /> : <Terminal className="w-8 h-8" />}
                           </div>
                           <div>
                              <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight transition-colors">
                                 {activeTrace.type === 'ai' ? 'AI Exploration Session' : 'Execution Trace'}
                              </h3>
                              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">ID: {activeTrace.id}</p>
                           </div>
                        </div>
                        <button onClick={() => setActiveTrace(null)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl text-gray-500 transition-colors border border-gray-200 dark:border-gray-800">
                           <X className="w-6 h-6" />
                        </button>
                     </div>

                     <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">

                        {activeTrace.type === 'ai' && activeTrace.ai_session ? (
                           <>
                              <div className="p-8 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] relative overflow-hidden shadow-sm dark:shadow-inner transition-colors">
                                 <div className="absolute top-0 right-0 p-6 opacity-5"><Bot className="w-32 h-32" /></div>
                                 <div className="flex items-center gap-3 mb-6">
                                    <Target className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                                    <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em] transition-colors">Goal Definition</span>
                                 </div>
                                 <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2 leading-tight transition-colors">{activeTrace.ai_session.goal}</h4>
                                 <p className="text-xs text-gray-500 font-mono">Target: {activeTrace.ai_session.target_url}</p>
                                 <div className="mt-4 flex gap-2">
                                    <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold rounded">
                                       Score: {activeTrace.ai_session.final_score} / 100
                                    </span>
                                 </div>
                              </div>

                              <div className="space-y-6">
                                 <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Execution Steps</span>
                                 </div>
                                 <div className="space-y-4">
                                    {activeTrace.ai_session.steps_data.map((step: any, idx: number) => (
                                       <div key={idx} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 relative shadow-sm dark:shadow-none transition-colors">
                                          <div className="flex justify-between items-start mb-2">
                                             <span className="text-indigo-500 dark:text-indigo-400 text-xs font-black uppercase transition-colors">Step {step.step_number}</span>
                                             <span className="text-gray-600 dark:text-gray-500 text-[10px] bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded uppercase transition-colors">{step.action_type}</span>
                                          </div>
                                          <div className="text-gray-800 dark:text-gray-300 text-sm font-bold mb-2 transition-colors">{step.description}</div>
                                          <div className="text-gray-600 dark:text-gray-500 text-xs italic bg-gray-50 dark:bg-black/20 p-2 rounded border border-gray-100 dark:border-white/5 transition-colors">
                                             "{step.thought}"
                                          </div>
                                          {step.score_breakdown && (
                                             <div className="mt-3 grid grid-cols-3 gap-2">
                                                {Object.entries(step.score_breakdown).map(([k, v]) => (
                                                   <div key={k} className="bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded text-center transition-colors">
                                                      <div className="text-[8px] text-gray-500 uppercase">{k.replace('_', ' ')}</div>
                                                      <div className={`text-xs font-bold ${Number(v) > 70 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>{v as number}</div>
                                                   </div>
                                                ))}
                                             </div>
                                          )}
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           </>
                        ) : (
                           <div className="text-gray-500 text-center py-20">
                              Standard execution log visualization placeholder.
                           </div>
                        )}

                     </div>
                  </div>
               </div>
            )
         }
      </div >
   );
};


// Internal icon helper
const Bot = ({ className }: { className?: string }) => (
   <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>
);

export default ReportDashboard;
