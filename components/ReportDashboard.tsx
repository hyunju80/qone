
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
   BarChart3, TrendingUp, ShieldCheck, Activity, Bug,
   AlertTriangle, CheckCircle2, XCircle, FileText,
   Download, Filter, Calendar, Zap, ArrowRight,
   PieChart, LineChart, Star, Search, X, Loader2,
   FileCode, Terminal, RefreshCw, ChevronRight, Globe, Database,
   Layers, MousePointer2, Shield, Printer, Share2, ClipboardCheck,
   Info, Target, FileDown, Clock, Cpu, ChevronDown, Save
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { TestHistory, TestScript, Project, ScriptStatus, ScriptOrigin } from '../types';
import api from '../api/client';
import { testApi } from '../api/test';

interface ReportDashboardProps {
   history: TestHistory[];
   scripts: TestScript[];
   activeProject: Project;
   onAlert?: (title: string, msg: string, type?: 'success' | 'error' | 'info') => void;
   initialTab?: string;
}

const ReportDashboard: React.FC<ReportDashboardProps> = ({ history, scripts, activeProject, onAlert, initialTab = 'summary' }) => {
   const [isExporting, setIsExporting] = useState(false);
   const [exportStep, setExportStep] = useState('');
   const [showFilter, setShowFilter] = useState(false);
   const [selectedRange, setSelectedRange] = useState('Last 7 Days');
   const [activeTrace, setActiveTrace] = useState<any>(null);
   const [showReportPreview, setShowReportPreview] = useState(false);
   const [reportContent, setReportContent] = useState<string>('');
   const [reportTitle, setReportTitle] = useState<string>('');
   const [isSaving, setIsSaving] = useState(false);
   
   const [mainTab, setMainTab] = useState<'summary' | 'saved'>(initialTab === 'saved' ? 'saved' : 'summary');
   const [savedInsights, setSavedInsights] = useState<any[]>([]);
   const [isLoadingInsights, setIsLoadingInsights] = useState(false);

   React.useEffect(() => {
      if (initialTab === 'saved') setMainTab('saved');
      else setMainTab('summary');
   }, [initialTab]);

   React.useEffect(() => {
      if (mainTab === 'saved') {
         setIsLoadingInsights(true);
         testApi.getInsights(activeProject.id)
            .then(data => setSavedInsights(data || []))
            .catch(e => console.error("Failed to load insights:", e))
            .finally(() => setIsLoadingInsights(false));
      }
   }, [mainTab, activeProject.id]);

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
         'ai_gen': scripts.filter(s => s.status === ScriptStatus.CERTIFIED && (s.origin === ScriptOrigin.AI_EXPLORATION || s.origin === ScriptOrigin.AI)),
         'step_flow': scripts.filter(s => s.status === ScriptStatus.CERTIFIED && (s.origin === ScriptOrigin.STEP || !s.origin || s.origin === ScriptOrigin.MANUAL))
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

      const enrichedAiGen = enrichScriptMetrics(groupedScripts['ai_gen']);
      const enrichedStepFlow = enrichScriptMetrics(groupedScripts['step_flow']);

      const goldenSummary = {
         ai_gen: enrichedAiGen.slice(0, 3),
         step_flow: enrichedStepFlow.slice(0, 3)
      };

      const categoryStats = {
         ai_gen: getCategoryStats(enrichedAiGen),
         step_flow: getCategoryStats(enrichedStepFlow)
      };

      // Diagnosis breakdown
      const diagnosis = {
         ui: filteredHistory.filter(h => (h.failureReason || '').toLowerCase().includes('ui') || (h.failureReason || '').toLowerCase().includes('selector') || (h.failureReason || '').toLowerCase().includes('element')).length,
         network: filteredHistory.filter(h => (h.failureReason || '').toLowerCase().includes('api') || (h.failureReason || '').toLowerCase().includes('network') || (h.failureReason || '').toLowerCase().includes('timeout')).length,
         logic: filteredHistory.filter(h => h.status === 'failed' && !(['ui', 'api', 'network', 'selector', 'timeout'].some(k => (h.failureReason || '').toLowerCase().includes(k)))).length
      };

      // Pipeline Executions
      const pipelineRuns = filteredHistory.filter(h => h.trigger === 'pipeline').length;
      const scheduledRuns = filteredHistory.filter(h => h.trigger === 'scheduled').length;

      // Defect Management
      const defectRelatedRuns = filteredHistory.filter(h => h.status === 'failed' || (h.healing_logs && h.healing_logs.length > 0) || h.jira_id);
      const defectAssetsMap = new Map();

      defectRelatedRuns.forEach(h => {
         const assetId = h.scriptId || (h as any).ai_summary || h.id;
         if (!defectAssetsMap.has(assetId)) {
            let detailedError = '';
            if (h.step_results && Array.isArray(h.step_results)) {
               const failedStep = h.step_results.find((s: any) => s.status === 'failed' || s.error_message);
               if (failedStep && failedStep.error_message) detailedError = failedStep.error_message;
            }
            // Attempt to extract detailed error from ai_session steps (ai)
            if (!detailedError && (h as any).ai_session?.steps_data && Array.isArray((h as any).ai_session.steps_data)) {
               const failedAIStep = (h as any).ai_session.steps_data.find((s: any) => s.status === 'failed' || s.error_message);
               if (failedAIStep && failedAIStep.error_message) detailedError = failedAIStep.error_message;
            }

            const rawReason = h.failureReason || '';
            const finalReason = detailedError ? `${rawReason}${rawReason ? ': ' : ''}${detailedError}` : (rawReason || 'Unknown Error');

            defectAssetsMap.set(assetId, {
               assetId,
               assetName: h.scriptName || (h as any).ai_summary || 'Ad-hoc Task',
               isAI: h.scriptOrigin === 'AI_EXPLORATION' || !!(h as any).ai_session,
               personaName: (h as any).persona_name,
               lastFailureDate: h.runDate,
               failureCount: h.status === 'failed' ? 1 : 0,
               priority: (h as any).priority || 'Medium',
               hasJira: !!h.jira_id,
               hasHealing: !!(h.healing_logs && h.healing_logs.length > 0),
               latestReason: finalReason,
               latestRecord: h
            });
         } else {
            const existing = defectAssetsMap.get(assetId);
            if (h.status === 'failed') existing.failureCount++;
            if (h.jira_id) existing.hasJira = true;
            if (h.healing_logs && h.healing_logs.length > 0) existing.hasHealing = true;
            if (new Date(h.runDate) > new Date(existing.lastFailureDate)) {
               existing.lastFailureDate = h.runDate;

               let detailedError = '';
               if (h.step_results && Array.isArray(h.step_results)) {
                  const failedStep = h.step_results.find((s: any) => s.status === 'failed' || s.error_message);
                  if (failedStep && failedStep.error_message) detailedError = failedStep.error_message;
               }
               if (!detailedError && (h as any).ai_session?.steps_data && Array.isArray((h as any).ai_session.steps_data)) {
                  const failedAIStep = (h as any).ai_session.steps_data.find((s: any) => s.status === 'failed' || s.error_message);
                  if (failedAIStep && failedAIStep.error_message) detailedError = failedAIStep.error_message;
               }

               if (detailedError || h.failureReason) {
                  const rawReason = h.failureReason || '';
                  existing.latestReason = detailedError ? `${rawReason}${rawReason ? ': ' : ''}${detailedError}` : rawReason;
               }
               existing.latestRecord = h;
            }
         }
      });

      const defectAssetsList = Array.from(defectAssetsMap.values());
      let severityDist = { critical: 0, high: 0, medium: 0, low: 0 };
      let resolutionStatus = { jira: 0, healed: 0, open: 0 };

      defectAssetsList.forEach(asset => {
         const totalAssetRuns = filteredHistory.filter(h => h.scriptId === asset.assetId || (h as any).ai_summary === asset.assetId).length;
         const scriptFailRate = totalAssetRuns > 0 ? Math.round((asset.failureCount / totalAssetRuns) * 100) : 100;

         const priorityWeight = asset.priority === 'Critical' ? 100 : asset.priority === 'High' ? 80 : asset.priority === 'Medium' ? 50 : 20;
         const failVolume = Math.min(asset.failureCount * 10, 100);
         const importance = Math.round((priorityWeight * 0.4) + (scriptFailRate * 0.3) + (failVolume * 0.3));

         // Only count severity for assets that actually failed
         if (asset.failureCount > 0) {
            if (importance >= 80) severityDist.critical++;
            else if (importance >= 60) severityDist.high++;
            else if (importance >= 40) severityDist.medium++;
            else severityDist.low++;
         }

         if (asset.hasHealing) resolutionStatus.healed++;
         if (asset.hasJira) resolutionStatus.jira++;

         if (asset.failureCount > 0 && !asset.hasHealing && !asset.hasJira) {
            resolutionStatus.open++;
         }
      });

      // Total Defect Assets is simply the count of unique assets that have a failure or a resolution
      const totalDefectAssets = defectAssetsList.length;

      return { totalRuns, passRate, goldenSummary, categoryStats, pipelineRuns, scheduledRuns, diagnosis, severityDist, resolutionStatus, totalFailedAssets: totalDefectAssets, failedAssetsList: defectAssetsList };
   }, [filteredHistory, scripts]);

   const [activeTab, setActiveTab] = useState<'ai_gen' | 'step_flow'>('ai_gen');
   const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
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

   const handleSaveInsight = async () => {
      if (!reportContent || isSaving) return;
      setIsSaving(true);
      try {
         await testApi.saveInsight(activeProject.id, {
            title: reportTitle || `Executive Intelligence Report - ${new Date().toLocaleDateString()}`,
            content_markdown: reportContent,
            insight_type: 'EXECUTIVE_SUMMARY'
         });
         if (onAlert) {
            onAlert("Saved", "Report has been pinned as the Latest Insight on the Hub.", "success");
         } else {
            alert("Report saved successfully!");
         }
      } catch (error) {
         console.error('Save failed:', error);
         if (onAlert) onAlert("Error", "Failed to save report to Hub.", "error");
      } finally {
         setIsSaving(false);
      }
   };

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
                  exploration: stats.goldenSummary.ai_gen.map(s => s.name),
                  generator: [], // Kept for backend compatibility
                  manual: stats.goldenSummary.step_flow.map(s => s.name),
                  step: []
               }
            }
         };

         // 2. Call Backend API
         setExportStep('Synthesizing Intelligence Report...');
         const response = await api.post('/exploration/analyze_report', payload);

         if (response.data && response.data.report_markdown) {
            setReportTitle(`Executive Intelligence Report - ${new Date().toLocaleDateString()}`);
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
               {mainTab === 'summary' && (
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
               )}
               {mainTab === 'summary' && (
                  <button
                     onClick={handleExport}
                     disabled={isExporting}
                     className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 transition-all rounded-xl text-[10px] font-black uppercase text-white shadow-xl shadow-indigo-600/20 disabled:opacity-50 min-w-[180px] justify-center"
                  >
                     {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                     {isExporting ? exportStep : 'Export Intelligence'}
                  </button>
               )}
            </div>
         </div>

         {/* Main Tabs */}
         <div className="flex gap-6 mb-10 border-b border-gray-200 dark:border-gray-800">
            <button onClick={() => setMainTab('summary')} className={`px-2 py-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 -mb-px ${mainTab === 'summary' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'}`}>Report Summary</button>
            <button onClick={() => setMainTab('saved')} className={`px-2 py-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 -mb-px ${mainTab === 'saved' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'}`}>Saved Insights</button>
         </div>

         {mainTab === 'summary' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col w-full">
               {/* Main Dashboard Layout (Rest of UI) */}
               <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Test Asset Summary</h3>
               </div>
               <div className="flex gap-2">
                  {['ai_gen', 'step_flow'].map((tab) => (
                     <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                           }`}
                     >
                        {tab === 'ai_gen' ? 'AI GEN' : 'Step Flow'}
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
                                    No certified assets found for {activeTab === 'ai_gen' ? 'AI GEN' : 'Step Flow'} origin.
                                 </td>
                              </tr>
                           ) : (
                              stats.goldenSummary[activeTab].map(script => (
                                 <tr key={script.id} className="hover:bg-gray-50 dark:hover:bg-indigo-500/5 transition-colors group">
                                    <td className="px-6 py-5">
                                       <div className="flex items-center gap-3">
                                          <div className={`p-2 rounded-lg transition-all ${activeTab === 'ai_gen' ? 'bg-purple-100 dark:bg-purple-600/10 text-purple-600 dark:text-purple-400' : 'bg-orange-100 dark:bg-orange-600/10 text-orange-600 dark:text-orange-400'}`}>
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
                        {activeTab === 'ai_gen' ? 'AI Generation Impact' : 'Step Flow Reusability'}
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
                        {activeTab === 'ai_gen' ? 'Assets autonomously discovered or generated by AI via exploration and scenario conversion.' :
                           'Modular step assets and manual flows ensuring consistent reliability.'}
                     </p>
                  </div>
               </div>
            </div>

            {/* Execution Summary Section */}
            <div className="flex items-center gap-3 mb-6 mt-16 px-2">
               <Activity className="w-5 h-5 text-indigo-500" />
               <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Execution Summary</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
               <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-indigo-500/30 transition-all shadow-sm dark:shadow-none flex flex-col justify-between">
                  <div>
                     <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Activity className="w-20 h-20" /></div>
                     <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Total Executions</div>
                     <div className="text-4xl font-black text-gray-900 dark:text-white transition-colors">{stats.totalRuns}</div>
                     <div className="mt-2 text-[10px] font-medium text-gray-500">Total number of tests executed across the selected period.</div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-indigo-500">
                     <TrendingUp className="w-3.5 h-3.5" /> Track active test volume
                  </div>
               </div>
               <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-indigo-500/30 transition-all shadow-sm dark:shadow-none flex flex-col justify-between">
                  <div>
                     <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><ShieldCheck className="w-20 h-20" /></div>
                     <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Success Rate (Avg)</div>
                     <div className={`text-4xl font-black ${stats.passRate > 85 ? 'text-green-500' : 'text-amber-500'}`}>{stats.passRate}%</div>
                     <div className="mt-2 text-[10px] font-medium text-gray-500">Overall percentage of tests that passed successfully.</div>
                  </div>
                  <div className="mt-4 w-full bg-gray-200 dark:bg-gray-950 h-1.5 rounded-full overflow-hidden shrink-0">
                     <div className={`h-full ${stats.passRate > 85 ? 'bg-green-500' : 'bg-amber-500'} shadow-lg`} style={{ width: `${stats.passRate}%` }} />
                  </div>
               </div>
               <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-indigo-500/30 transition-all shadow-sm dark:shadow-none flex flex-col justify-between">
                  <div>
                     <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Layers className="w-20 h-20" /></div>
                     <div className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-4 transition-colors">Pipeline Executions</div>
                     <div className="text-4xl font-black text-gray-900 dark:text-white transition-colors">{stats.pipelineRuns}</div>
                     <div className="mt-2 text-[10px] font-medium text-gray-500">Test executions triggered via CI/CD pipelines or API.</div>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                     Continuous Integration
                  </div>
               </div>
               <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-cyan-500/30 transition-all shadow-sm dark:shadow-none flex flex-col justify-between">
                  <div>
                     <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Calendar className="w-20 h-20" /></div>
                     <div className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-4">Scheduled Executions</div>
                     <div className="text-4xl font-black text-gray-900 dark:text-white transition-colors">{stats.scheduledRuns}</div>
                     <div className="mt-2 text-[10px] font-medium text-gray-500">Tests triggered automatically via the scheduler.</div>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-cyan-600/60 dark:text-cyan-500/60 uppercase tracking-tighter">
                     Continuous Integration
                  </div>
               </div>
            </div>
         </div>

         {/* Defect Summary Section */}
         <div className="flex items-center gap-3 mb-6 mt-16 px-2">
            <Shield className="w-5 h-5 text-red-500" />
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Defect Summary</h3>
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
            <div className="lg:col-span-2 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-8 shadow-sm dark:shadow-2xl relative overflow-hidden transition-colors flex flex-col">
               <div className="absolute top-0 left-0 w-full h-1 bg-red-500 opacity-20" />
               <div className="flex items-start justify-between mb-8">
                  <div className="flex flex-col gap-1">
                     <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-red-600/10 rounded-xl text-red-500">
                           <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Defect Severity Distribution</h3>
                     </div>
                     <p className="text-[10px] text-gray-400 font-medium ml-[52px]">Importance score categorizations integrating Priority, Fail Rate, and Fail Volume.</p>
                  </div>
               </div>

               <div className="flex-1 flex flex-col justify-center gap-6 mt-4">
                  {[
                     { label: 'Critical (80-100)', value: stats.severityDist.critical, count: stats.severityDist.critical, color: 'bg-red-500', textInfo: 'text-red-500' },
                     { label: 'High (60-79)', value: stats.severityDist.high, count: stats.severityDist.high, color: 'bg-orange-500', textInfo: 'text-orange-500' },
                     { label: 'Medium (40-59)', value: stats.severityDist.medium, count: stats.severityDist.medium, color: 'bg-yellow-500', textInfo: 'text-yellow-500' },
                     { label: 'Low (0-39)', value: stats.severityDist.low, count: stats.severityDist.low, color: 'bg-indigo-500', textInfo: 'text-indigo-500' }
                  ].map((item, idx) => (
                     <div key={idx} className="flex items-center gap-4">
                        <div className="w-40 flex-shrink-0">
                           <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">{item.label}</span>
                        </div>
                        <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                           <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${stats.totalFailedAssets > 0 ? (item.value / stats.totalFailedAssets) * 100 : 0}%` }} />
                        </div>
                        <div className={`w-12 text-right text-sm font-black ${item.textInfo}`}>
                           {item.count}
                        </div>
                     </div>
                  ))}
               </div>
            </div>
            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-8 shadow-sm dark:shadow-2xl flex flex-col relative overflow-hidden transition-colors">
               <div className="absolute top-0 left-0 w-full h-1 bg-green-500 opacity-20" />
               <div className="flex flex-col gap-1 mb-8">
                  <div className="flex items-center gap-3">
                     <div className="p-2.5 bg-green-600/10 rounded-xl text-green-500">
                        <ShieldCheck className="w-5 h-5" />
                     </div>
                     <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Defect Resolution</h3>
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium ml-[52px]">Tracking issue resolution workflows.</p>
               </div>

               <div className="flex-1 flex flex-col justify-center gap-4 relative">
                  {/* Resolution Types - Independent Bars */}
                  {[
                     { label: 'Jira Registered', count: stats.resolutionStatus.jira, color: 'bg-blue-500', bg: 'bg-blue-500/10', dColor: 'text-blue-500', desc: 'Reported to dev queue' },
                     { label: 'AI Healed', count: stats.resolutionStatus.healed, color: 'bg-green-500', bg: 'bg-green-500/10', dColor: 'text-green-500', desc: 'Self-corrected by AI' },
                     { label: 'Open (Unresolved)', count: stats.resolutionStatus.open, color: 'bg-gray-400 dark:bg-gray-600', bg: 'bg-gray-200 dark:bg-gray-800', dColor: 'text-gray-500 dark:text-gray-400', desc: 'Pending diagnosis' }
                  ].map((res, i) => (
                     <div key={i} className="flex flex-col gap-1 p-3 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${res.color}`} />
                              <div>
                                 <div className="text-xs font-bold text-gray-800 dark:text-gray-200">{res.label}</div>
                                 <div className="text-[9px] text-gray-500 block">{res.desc}</div>
                              </div>
                           </div>
                           <div className={`text-lg font-black ${res.dColor}`}>{res.count}</div>
                        </div>
                        <div className={`w-full h-1.5 rounded-full mt-2 ${res.bg} overflow-hidden`}>
                           <div className={`h-full ${res.color}`} style={{ width: `${stats.totalFailedAssets > 0 ? (res.count / stats.totalFailedAssets) * 100 : 0}%` }} />
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Root Cause Analysis Summary Section */}
         <div className="mb-20">
            <div className="flex items-center gap-3 mb-6 mt-16 px-2">
               <AlertTriangle className="w-5 h-5 text-orange-500" />
               <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Root Cause Analysis Summary</h3>
            </div>
            <div>
               {(() => {
                  const clusters = [
                     { id: 'ui', title: 'UI / Selector Change', icon: <MousePointer2 className="w-5 h-5" />, color: 'text-orange-500', bg: 'bg-orange-600/10', border: 'border-orange-500/20', assets: [] as any[] },
                     { id: 'timeout', title: 'Timeout / Performance', icon: <Clock className="w-5 h-5" />, color: 'text-amber-500', bg: 'bg-amber-600/10', border: 'border-amber-500/20', assets: [] as any[] },
                     { id: 'network', title: 'Network / API', icon: <Activity className="w-5 h-5" />, color: 'text-blue-500', bg: 'bg-blue-600/10', border: 'border-blue-500/20', assets: [] as any[] },
                     { id: 'logic', title: 'Logic Error / Assertion', icon: <Cpu className="w-5 h-5" />, color: 'text-red-500', bg: 'bg-red-600/10', border: 'border-red-500/20', assets: [] as any[] }
                  ];

                  (stats.failedAssetsList || []).forEach(asset => {
                     if (asset.failureCount === 0) return;
                     const reason = (asset.latestReason || '').toLowerCase();

                     if (reason.includes('timeout') || reason.includes('exceeded') || reason.includes('waiting')) {
                        clusters[1].assets.push(asset);
                     } else if (reason.includes('selector') || reason.includes('element') || reason.includes('visible') || reason.includes('not found') || reason.includes('clickable') || reason.includes('intercepted')) {
                        clusters[0].assets.push(asset);
                     } else if (reason.includes('network') || reason.includes('api') || reason.includes('500') || reason.includes('refused') || reason.includes('disconnected') || reason.includes('socket') || reason.includes('fetch')) {
                        clusters[2].assets.push(asset);
                     } else {
                        clusters[3].assets.push(asset);
                     }
                  });

                  const totalFailures = clusters.reduce((acc, c) => acc + c.assets.length, 0);

                  if (totalFailures === 0) {
                     return (
                        <div className="p-12 text-center text-gray-600 italic">
                           No assets with failures detected in the selected period.
                        </div>
                     );
                  }

                  return (
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {clusters.map(cluster => (
                           <div key={cluster.id} className="flex flex-col border border-gray-200 dark:border-gray-800/80 rounded-3xl bg-white dark:bg-[#1f232b] shadow-sm transition-all h-[550px] overflow-hidden">
                              {/* Header Section */}
                              <div className={`flex flex-col p-6 bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 w-full`}>
                                 <div className="flex items-center gap-4 mb-4">
                                    <div className={`p-4 rounded-2xl ${cluster.bg} ${cluster.color}`}>
                                       {cluster.icon}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                       <div className="text-sm font-black text-gray-900 dark:text-white tracking-wide uppercase leading-tight">{cluster.title}</div>
                                       <div className="text-[10px] text-gray-500 font-bold bg-white dark:bg-gray-900 px-2 py-0.5 rounded-full inline-flex w-fit border border-gray-200 dark:border-gray-700">
                                          {cluster.assets.length} Asset{cluster.assets.length !== 1 && 's'}
                                       </div>
                                    </div>
                                 </div>
                                 <div className="px-3 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-xs font-black border border-red-100 dark:border-transparent text-center">
                                    {cluster.assets.reduce((sum, a) => sum + a.failureCount, 0)} Total Failures
                                 </div>
                              </div>

                              {/* Asset List Section */}
                              <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4 bg-gray-50/30 dark:bg-black/20">
                                 {cluster.assets.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-xs font-bold text-gray-400 italic">No failures in this category.</div>
                                 ) : (
                                    cluster.assets.map(asset => (
                                       <div key={asset.assetId} className="flex flex-col gap-3 p-4 rounded-2xl border border-gray-200 dark:border-gray-800/60 bg-white dark:bg-[#16191f] hover:border-indigo-500/50 transition-colors shadow-sm relative group overflow-hidden">
                                          {asset.isAI && <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[8px] font-black px-2 py-1 rounded-bl-xl uppercase tracking-widest z-10 shadow-sm">AI</div>}
                                          <div className="flex items-start justify-between gap-3 pr-6 relative z-0">
                                             <div className="font-bold text-gray-800 dark:text-gray-200 text-sm leading-snug break-all">
                                                {asset.assetName}
                                             </div>
                                             <button
                                                onClick={async () => {
                                                   try {
                                                      const detail = await testApi.getHistoryDetail(asset.latestRecord.id);
                                                      setActiveTrace({ ...detail, type: asset.isAI ? 'ai' : 'standard' });
                                                   } catch (e) {
                                                      console.error("Failed to load history detail:", e);
                                                   }
                                                }}
                                                className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/40 transition-colors flex-shrink-0 shadow-sm absolute -top-1 -right-1"
                                                title="Investigate"
                                             >
                                                <Search className="w-4 h-4" />
                                             </button>
                                          </div>

                                          <div className="flex flex-wrap items-center gap-2">
                                             {asset.hasHealing && <span className="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-green-200 dark:border-transparent">Healed</span>}
                                             <div className="text-[10px] text-red-500 font-bold flex items-center gap-1 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full border border-red-100 dark:border-transparent">
                                                <Shield className="w-3 h-3" /> {asset.failureCount} Failures
                                             </div>
                                          </div>

                                          <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug line-clamp-3 mt-1 pt-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-transparent rounded-b-xl px-1 -mb-1 pb-1 font-medium">
                                             {asset.latestReason || 'No detailed error message.'}
                                          </div>

                                          <div className="text-[9px] text-gray-400 font-mono mt-2 w-full text-right bg-transparent">
                                             {new Date(asset.lastFailureDate).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                          </div>
                                       </div>
                                    ))
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>
                  );
               })()}
            </div>
         </div>
      </div>
   ) : (
            <div className="animate-in fade-in duration-300">
               {isLoadingInsights ? (
                  <div className="flex justify-center p-32"><Loader2 className="w-10 h-10 animate-spin text-indigo-500 opacity-50" /></div>
               ) : savedInsights.length === 0 ? (
                  <div className="text-center p-32 text-gray-400 font-medium bg-gray-50 dark:bg-[#16191f] rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                     <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                     <p>No saved intelligence reports were found.</p>
                     <p className="text-xs mt-2 opacity-60">Reports saved from the Summary view will appear here.</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                     {savedInsights.map(insight => (
                        <div key={insight.id} onClick={() => { setReportContent(insight.content_markdown); setReportTitle(insight.title || 'Executive Intelligence Report'); setShowReportPreview(true); }} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 p-8 rounded-[2rem] flex flex-col justify-between cursor-pointer hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all group overflow-hidden relative">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors pointer-events-none" />
                           <div>
                              <div className="flex items-center gap-3 mb-6">
                                 <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform"><FileText className="w-5 h-5" /></div>
                                 <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-black text-gray-900 dark:text-white truncate">{insight.title || 'Untitled Report'}</h3>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mt-0.5">{new Date(insight.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                 </div>
                              </div>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium line-clamp-4 leading-relaxed bg-gray-50 dark:bg-black/20 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                 {insight.content_markdown.replace(/[#*`_>]/g, '').substring(0, 180)}...
                              </p>
                           </div>
                           <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400">View Full Briefing</span>
                              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </div>
         )}

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
                           <div className="flex gap-3">
                              <button
                                 onClick={handleSaveInsight}
                                 disabled={isSaving}
                                 className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-all shadow-sm disabled:opacity-50"
                              >
                                 {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                 Save as Insight
                              </button>
                              <button
                                 onClick={() => window.print()}
                                 className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/20"
                              >
                                 <Printer className="w-4 h-4" /> Download
                              </button>
                           </div>
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

         {/* ACTIVE TRACE MODAL (View-Only) */}
         {activeTrace && createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 sm:p-12 animate-in fade-in duration-300 print:hidden">
               <div className="absolute inset-0 bg-black/50 dark:bg-black/90 backdrop-blur-xl" onClick={() => setActiveTrace(null)} />
               <div className="relative w-full max-w-5xl h-full max-h-[90vh] bg-[#fdfdfd] dark:bg-[#16191f] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden text-gray-900 dark:text-gray-100 border-[12px] border-gray-200/50 dark:border-white/10 transition-colors">
                  <button onClick={() => setActiveTrace(null)} className="absolute top-8 right-8 p-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl z-[200] hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">
                     <X className="w-4 h-4" />
                  </button>
                  <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                     <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-black uppercase tracking-wider">Analysis View</span>
                     </div>
                     <h2 className="text-3xl font-black mb-6">Investigate: {activeTrace.scriptName || activeTrace.ai_summary || 'Unknown Asset'}</h2>
                     <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-2xl font-mono text-sm mb-8 border border-red-100 dark:border-red-900/30">
                        {activeTrace.failureReason || activeTrace.error_msg || 'No specific error message captured.'}
                     </div>

                     {activeTrace.type === 'ai' && activeTrace.ai_session?.steps_data && (
                        <div>
                           <h3 className="text-xl font-bold mb-4">Execution Steps</h3>
                           <div className="space-y-4">
                              {activeTrace.ai_session.steps_data.map((step: any, idx: number) => (
                                 <div key={idx} className="bg-white dark:bg-[#1f232b] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                       <span className="text-indigo-500 text-xs font-black uppercase">Step {step.step_number}</span>
                                       <span className="text-gray-600 dark:text-gray-400 text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded uppercase">{step.action_type}</span>
                                    </div>
                                    <div className="text-gray-800 dark:text-gray-200 text-sm font-bold mb-2">{step.description}</div>
                                    <div className="text-gray-600 dark:text-gray-400 text-xs italic bg-gray-50 dark:bg-black/20 p-2 rounded border border-gray-100 dark:border-white/5">
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
                     )}
                     {(activeTrace.type === 'standard' || (activeTrace.type === 'ai' && (!activeTrace.ai_session?.steps_data || activeTrace.ai_session.steps_data.length === 0))) && (
                        <div className="space-y-6">
                           {activeTrace.failureAnalysis && (
                              <div className="p-6 rounded-3xl border bg-indigo-50 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-500/20 mb-8">
                                 <div className="flex items-center gap-3 mb-4">
                                    <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest">Oracle Intelligent Analysis</h4>
                                 </div>
                                 <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{activeTrace.failureAnalysis.thought || 'Critical failure detected.'}</p>
                                 <div className="mt-4 p-4 bg-red-100/50 border border-red-200 rounded-2xl">
                                    <div className="text-[10px] font-black text-red-500 uppercase mb-1">Root Cause (AI Diagnostic)</div>
                                    <p className="text-xs text-red-700 font-bold">{activeTrace.failureAnalysis.reason || activeTrace.failureReason}</p>
                                 </div>
                              </div>
                           )}

                           {(activeTrace.step_results && activeTrace.step_results.length > 0) ? (
                              <div className="space-y-6 mb-8">
                                 <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-bold">Execution Timeline</h3>
                                 </div>
                                 <div className="space-y-4 pl-2">
                                    {activeTrace.step_results.map((step: any, idx: number) => (
                                       <div key={idx} className="relative pl-8 border-l-2 border-gray-200 dark:border-gray-800">
                                          <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${step.status === 'passed' ? 'bg-green-500 border-green-100' : 'bg-red-500 border-red-100'}`} />
                                          <div className="bg-white dark:bg-[#1f232b] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                                             <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xs font-black text-gray-400 uppercase">Step {step.step_number}</span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${step.status === 'passed' ? 'border-green-500/30 text-green-600' : 'border-red-500/30 text-red-600'}`}>
                                                   {step.status?.toUpperCase()}
                                                </span>
                                             </div>
                                             <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{step.name}</h3>

                                             <div className="grid grid-cols-2 gap-3 mb-3">
                                                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                                                   <div className="text-[9px] font-black text-gray-400 uppercase mb-1">Action</div>
                                                   <div className="text-[11px] font-bold text-indigo-600 uppercase">{step.metadata?.action || 'action'}</div>
                                                </div>
                                                {step.metadata?.value && (
                                                   <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
                                                      <div className="text-[9px] font-black text-indigo-400 uppercase mb-1">Input / Value</div>
                                                      <div className="text-[11px] font-bold text-indigo-600">{step.metadata.value}</div>
                                                   </div>
                                                )}
                                             </div>

                                             {step.error_message && (
                                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600">
                                                   <div className="text-[10px] font-black uppercase mb-1">Error Detail</div>
                                                   <p className="text-[10px] font-mono break-all">{step.error_message}</p>
                                                </div>
                                             )}
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           ) : (
                              <div className="text-gray-500 text-center py-20 italic">No detailed steps were recorded for this standard execution.</div>
                           )}
                        </div>
                     )}
                  </div>
               </div>
            </div>,
            document.body
         )}
      </div >
   );
};


// Internal icon helper
const Bot = ({ className }: { className?: string }) => (
   <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>
);

export default ReportDashboard;
