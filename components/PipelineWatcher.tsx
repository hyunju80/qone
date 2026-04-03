import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
   Activity, GitBranch, ShieldCheck, Zap, AlertCircle,
   CheckCircle2, ChevronRight, Play, Loader2, ArrowRight,
   Code, RefreshCw, FileText, ExternalLink, X, Bug, Layout,
   Check, Terminal, Database, Sparkles, MessageSquare,
   Settings, Link, Globe, Shield, Save, Copy, Image as ImageIcon,
   User, Plus, Send, AlertTriangle, XCircle, Clock, BarChart3,
   Search, Filter, ChevronDown, List, Layers, Box, Cpu
} from 'lucide-react';
import { Project, TestScript, TestHistory, ViewMode, Scenario } from '../types';
import { useTheme } from '../src/context/ThemeContext';
import { aiApi } from '../api/ai';
import { testApi } from '../api/test';
import { scenariosApi } from '../api/scenarios';

interface PipelineWatcherProps {
   activeProject: Project;
   scripts: TestScript[];
   history: TestHistory[];
   onViewChange: (view: ViewMode, tab?: string, scenarioId?: string, category?: string) => void;
}

interface BuildInfo {
   id: string;
   version: string;
   commit: string;
   author: string;
   branch: string;
   timestamp: string;
   status: 'ANALYZING' | 'TESTING' | 'COMPLETED' | 'FAILED';
   impactScale: 'Low' | 'Medium' | 'High';
   package?: string;
   description?: string;
}

const MOCK_BUILDS: BuildInfo[] = [
   {
      id: 'b_tms_01',
      version: 'v2.4.2',
      commit: '8f2a1b9',
      author: 'hjule',
      branch: 'feature/global-travel-booking',
      timestamp: '14:45',
      status: 'TESTING',
      impactScale: 'High',
      package: 'com.tms',
      description: 'TMS 패키지: 글로벌 여행 예약 및 결제 통합 모듈 업데이트'
   },
   { id: 'b_1', version: 'v2.4.1', commit: '3c5e7d1', author: 'dev_lee', branch: 'main', timestamp: '10:20', status: 'COMPLETED', impactScale: 'Medium' },
   { id: 'b_3', version: 'v1.9.8', commit: 'a1b2c3d', author: 'senior_park', branch: 'hotfix/login', timestamp: 'Yesterday', status: 'COMPLETED', impactScale: 'Low' },
];

const PipelineWatcher: React.FC<PipelineWatcherProps> = ({ activeProject, scripts, history, onViewChange }) => {
   const { theme } = useTheme();
   const isDark = theme === 'dark';

   const [activeBuild, setActiveBuild] = useState<BuildInfo>(MOCK_BUILDS[0]);
   const [searchTerm, setSearchTerm] = useState('');
   const [selectedProvider, setSelectedProvider] = useState('GitHub');
   const [isConfigOpen, setIsConfigOpen] = useState(false);

   const intervalRef = useRef<NodeJS.Timeout | null>(null);

   // Real Intelligence States
   const [isRestarting, setIsRestarting] = useState(false);
   const [restartStep, setRestartStep] = useState<'idle' | 'analyzing' | 'executing' | 'recommending' | 'done'>('idle');
   const [executionLogs, setExecutionLogs] = useState<{ time: string, type: string, msg: string }[]>([]);
   const [identifiedScript, setIdentifiedScript] = useState<TestScript | null>(null);
   const [recommendedScenario, setRecommendedScenario] = useState<Scenario | null>(null);
   const [runId, setRunId] = useState<string | null>(null);
   const [runStats, setRunStats] = useState({ total: 0, passed: 0, failed: 0, analyzing: 0 });

   const filteredBuilds = useMemo(() => {
      return MOCK_BUILDS.filter(b => 
         b.version.toLowerCase().includes(searchTerm.toLowerCase())
      );
   }, [searchTerm]);

   useEffect(() => {
      return () => {
         if (intervalRef.current) {
            clearInterval(intervalRef.current);
         }
      };
   }, []);

   const addLog = (type: string, msg: string) => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      setExecutionLogs(prev => [...prev, { time, type, msg }]);
   };

   const handleForceRestart = async () => {
      if (intervalRef.current) {
         clearInterval(intervalRef.current);
         intervalRef.current = null;
      }

      setIsRestarting(true);
      setRestartStep('analyzing');
      setExecutionLogs([]);
      setIdentifiedScript(null);
      setRecommendedScenario(null);
      setRunStats({ total: 0, passed: 0, failed: 0, analyzing: 0 });

      addLog('BUILD', `Webhook received for ${activeBuild.package} on branch ${activeBuild.branch}`);
      addLog('AI', 'Analyzing deployment metadata vs Asset Library...');

      try {
         const analysisPrompt = `
            You are a CI/CD Intelligent Test Orchestrator. 
            Deployment Info: Package=${activeBuild.package}, Description=${activeBuild.description}, Branch=${activeBuild.branch}.
            Available Scripts: ${scripts.filter(s => s.isActive).map(s => `[ID: ${s.id}, Name: ${s.name}, Tags: ${s.tags?.join(', ')}]`).join('\n')}
            
            Identify the single most relevant test script for this deployment. 
            Return ONLY a JSON object: {"scriptId": "ID", "reason": "short explanation"}.
            Hint: Package 'com.tms' is usually related to '글로벌 여행'.
         `;

         const identification = await aiApi.chat([{ id: 'build_analysis', role: 'user', content: analysisPrompt }]);
         let scriptId = '';
         try {
            const cleaned = (identification.text || '').replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned || '{}');
            scriptId = parsed.scriptId;
            addLog('AI', `Identified core asset: ${parsed.reason}`);
         } catch {
            const activeScripts = scripts.filter(s => s.isActive);
            const found = activeScripts.find(s => s.name.includes('글로벌 여행')) || activeScripts[0];
            scriptId = found?.id;
            addLog('AI', `Causal matching identified asset: ${found?.name}`);
         }

         const targetScript = scripts.find(s => s.id === scriptId);
         setIdentifiedScript(targetScript || null);

         if (!targetScript) {
            addLog('ERROR', 'No suitable test asset found for this deployment.');
            setIsRestarting(false);
            return;
         }

         setRestartStep('executing');
         addLog('EXEC', `Triggering real-time execution for [${targetScript.name}]...`);

         const runResult = await testApi.runActiveSteps({
            script_id: scriptId,
            project_id: activeProject.id,
            steps: targetScript.steps || []
         });
         setRunId(runResult.run_id);
         setRunStats({ total: 1, passed: 0, failed: 0, analyzing: 1 });

         let isFinished = false;
         let hasStartedLog = false;
         let isProcessingCompletion = false;

         const pollStatus = async () => {
            if (isFinished) return;

            try {
               const statusRes = await testApi.getRunStatus(runResult.run_id);

               if (statusRes.status === 'running') {
                  if (!hasStartedLog) {
                     addLog('EXEC', 'Executing autonomous test steps on target device...');
                     hasStartedLog = true;
                  }
               } else if (statusRes.status === 'completed' || statusRes.status === 'failed' || statusRes.status === 'success') {
                  isFinished = true;
                  if (intervalRef.current) {
                     clearTimeout(intervalRef.current as any);
                     intervalRef.current = null;
                  }

                  if (isProcessingCompletion) return;
                  isProcessingCompletion = true;

                  const isSuccess = statusRes.status === 'success' || (statusRes.status === 'completed' && statusRes.exit_code === 0);

                  if (isSuccess) {
                     addLog('SUCCESS', `Asset [${targetScript.name}] execution COMPLETED successfully.`);
                     setRunStats({ total: 1, passed: 1, failed: 0, analyzing: 0 });
                  } else {
                     addLog('ERROR', `Asset [${targetScript.name}] execution FAILED (Exit Code: ${statusRes.exit_code})`);
                     setRunStats({ total: 1, passed: 0, failed: 1, analyzing: 0 });
                  }

                  setRestartStep('recommending');
                  addLog('AI', 'Testing finished. Analyzing coverage gap for new deployment...');

                  const gapPrompt = `
                     Test Result for [${targetScript.name}] (Package: ${activeBuild.package}) was ${isSuccess ? 'SUCCESSFUL' : 'FAILED'}.
                     However, the deployment description mentioned "${activeBuild.description}". 
                     Generate a new test scenario for a specific GAP or fix based on this feedback.
                     
                     Return ONLY a JSON Scenario object with the following STRICT structure:
                     {
                       "title": "string",
                       "description": "string",
                       "testCases": [
                         {
                           "title": "string",
                           "preCondition": "string",
                           "inputData": "string",
                           "steps": ["string"],
                           "expectedResult": "string"
                         }
                       ]
                     }
                  `;

                  const gapResult = await aiApi.chat([{ id: 'gap_analysis', role: 'user', content: gapPrompt }]);
                  try {
                     const cleanedJson = (gapResult.text || '').replace(/```json|```/g, '').trim();
                     const scenarioData = JSON.parse(cleanedJson);

                     const payload = {
                        id: `scen_gap_${Date.now()}`,
                        project_id: activeProject.id,
                        title: scenarioData.title || "New Gap Analysis Scenario",
                        description: scenarioData.description || "Auto-generated coverage for deployment delta.",
                        testCases: scenarioData.testCases || [],
                        persona_id: "p1",
                        platform: "APP",
                        category: 'CI/CD Automation',
                        is_approved: false
                     };

                     const saved = await testApi.createScenario(payload);
                     setRecommendedScenario(saved);
                     addLog('AI', `Intelligent recommendation generated: ID=${saved.id}`);
                  } catch (e) {
                     addLog('AI', 'Generating fallback recommendation for coverage validation...');
                  }

                  setRestartStep('done');
                  setIsRestarting(false);
                  return;
               }

               if (!isFinished) {
                  intervalRef.current = setTimeout(pollStatus, 2000) as any;
               }
            } catch (err) {
               console.error("Polling error", err);
               if (!isFinished) {
                  intervalRef.current = setTimeout(pollStatus, 2000) as any;
               }
            }
         };

         intervalRef.current = setTimeout(pollStatus, 1000) as any;

      } catch (err) {
         console.error("Force Restart failed", err);
         addLog('ERROR', 'Pipeline orchestration failed during execution.');
         setIsRestarting(false);
      }
   };

   const bgClass = isDark ? 'bg-[#0c0e12]' : 'bg-[#f8faff]';
   const cardBgClass = isDark ? 'bg-white/[0.02] border-white/5' : 'bg-white border-gray-200 shadow-sm';
   const textClass = isDark ? 'text-gray-100' : 'text-gray-900';
   const secondaryTextClass = isDark ? 'text-gray-500' : 'text-gray-400';

   return (
      <div className={`flex h-full w-full ${bgClass} ${textClass} overflow-hidden font-sans relative transition-colors duration-500`}>

         <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-tr from-[#0c0e12] via-[#11141d] to-[#0c0e12]' : 'bg-gradient-to-tr from-[#f8faff] via-[#ffffff] to-[#f8faff]'} pointer-events-none`} />

         <aside className={`w-[360px] flex flex-col border-r ${isDark ? 'border-white/5' : 'border-gray-200'} z-10 backdrop-blur-3xl bg-white/[0.01]`}>
            <div className="p-8 border-b border-inherit">
               <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center">
                        <Layers className="w-5 h-5 text-indigo-500" />
                     </div>
                     <div>
                        <h2 className="text-sm font-black uppercase tracking-widest">CI/CD Feed</h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Real-time Intelligence</p>
                     </div>
                  </div>
                  <button onClick={() => setIsConfigOpen(true)} className="p-2 hover:bg-white/5 rounded-lg transition-all">
                     <Settings className="w-4 h-4 text-gray-500" />
                  </button>
               </div>

               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                     type="text"
                     placeholder="Search by version..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className={`w-full ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-100 border-gray-200'} border rounded-xl py-2 pl-9 pr-4 text-[11px] font-medium outline-none focus:border-indigo-500/50 transition-all`}
                  />
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
               {filteredBuilds.map(build => (
                  <div
                     key={build.id}
                     onClick={() => setActiveBuild(build)}
                     className={`p-5 rounded-[24px] border transition-all cursor-pointer group ${activeBuild.id === build.id
                        ? (isDark ? 'bg-indigo-600/10 border-indigo-500/40 shadow-xl shadow-indigo-600/5' : 'bg-indigo-50 border-indigo-200 shadow-lg')
                        : (isDark ? 'bg-white/[0.02] border-white/5' : 'bg-white border-gray-200 hover:border-indigo-300')
                        }`}
                  >
                     <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${build.status === 'TESTING' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                           <span className={`text-[10px] font-black uppercase tracking-widest ${activeBuild.id === build.id ? 'text-indigo-500' : 'text-gray-500'}`}>{build.status}</span>
                        </div>
                        <span className="text-[9px] font-bold text-gray-500">{build.timestamp}</span>
                     </div>
                     <h3 className={`text-sm font-black tracking-tight ${activeBuild.id === build.id ? 'text-indigo-600 dark:text-indigo-400' : textClass}`}>{build.version}</h3>
                     <p className="text-[11px] font-medium text-gray-500 mt-1 mb-4 truncate">{build.branch} • {build.commit}</p>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-800" />
                           <span className="text-[10px] font-bold text-gray-500">{build.author}</span>
                        </div>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${build.impactScale === 'High' ? 'bg-red-500/10 text-red-500' : 'bg-indigo-500/10 text-indigo-500'
                           }`}>{build.impactScale} Impact</span>
                     </div>
                  </div>
               ))}
            </div>
         </aside>

         {/* MAIN: Orchestration Context */}
         <main className="flex-1 flex flex-col z-10 overflow-hidden">

            {/* Header: Current Status */}
            <header className={`p-8 border-b ${isDark ? 'border-white/5' : 'border-gray-200'} flex items-center justify-between bg-white/[0.01]`}>
               <div className="flex items-center gap-6">
                  <div className="relative">
                     <div className={`w-16 h-16 rounded-[24px] ${isDark ? 'bg-indigo-600/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-200'} border flex items-center justify-center relative overflow-hidden`}>
                        <Activity className={`w-8 h-8 ${activeBuild.status === 'TESTING' ? 'text-indigo-500 animate-pulse' : 'text-emerald-500'}`} />
                     </div>
                     {activeBuild.status === 'TESTING' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 border-4 border-[#0c0e12] animate-bounce" />
                     )}
                  </div>
                  <div>
                     <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-black tracking-tighter">{activeBuild.version}</h1>
                        <span className="px-2 py-0.5 bg-indigo-600/10 text-indigo-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-indigo-500/20">Active Deployment</span>
                     </div>
                     <p className="text-xs font-medium text-gray-500">{activeBuild.branch} — Commit: {activeBuild.commit} by {activeBuild.author}</p>
                  </div>
               </div>

               <div className="flex gap-4">
                  <div className="px-6 py-4 rounded-[28px] bg-white/[0.02] border border-white/5 flex flex-col items-end justify-center">
                     <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Time Elapsed</span>
                     <span className="text-lg font-black tracking-tight">{isRestarting ? '00:12' : '04:12'} <span className="text-[10px] text-indigo-500">Min</span></span>
                  </div>
                  <button
                     onClick={handleForceRestart}
                     disabled={isRestarting}
                     className={`px-8 py-4 ${isRestarting ? 'bg-indigo-900/50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'} text-white rounded-[28px] font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2`}
                  >
                     {isRestarting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                     {isRestarting ? 'Orchestrating...' : 'Force Restart'}
                  </button>
               </div>
            </header>

            <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">

               {/* Section 1: Intelligent Impact Analysis */}
               <section className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                     <div className="flex items-center gap-3">
                        <Cpu className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Autonomous Selection</h2>
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-500">Analysis Confidence:</span>
                        <span className="text-[10px] font-black text-emerald-500">98% High</span>
                     </div>
                  </div>

                  <div className="p-8 rounded-[40px] bg-white/[0.02] border border-white/5 backdrop-blur-3xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                        <Bot className="w-48 h-48 text-indigo-500" />
                     </div>
                     <div className="relative z-10 flex flex-col gap-6">
                        <div className="flex items-center gap-4">
                           <div className={`w-12 h-12 rounded-full ${identifiedScript ? 'bg-emerald-500/10' : 'bg-indigo-500/10'} flex items-center justify-center`}>
                              {identifiedScript ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Search className="w-6 h-6 text-indigo-500 animate-pulse" />}
                           </div>
                           <div>
                              <h3 className="text-lg font-black tracking-tight">
                                 {identifiedScript ? `Target Asset: ${identifiedScript.name}` : 'Analyzing Build Impact...'}
                              </h3>
                              <p className="text-sm text-gray-500 font-medium">
                                 {identifiedScript
                                    ? `LLM mapped this build to [${identifiedScript.name}] based on ${activeBuild.package} package changes.`
                                    : 'Qone AI is identifying the most relevant test assets for this deployment.'}
                              </p>
                           </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mt-4">
                           {[
                              { label: 'Selected Scripts', value: runStats.total || '0', icon: FileText, color: 'indigo' },
                              { label: 'Passed', value: runStats.passed || '0', icon: Check, color: 'emerald' },
                              { label: 'Running', value: runStats.analyzing || '0', icon: Loader2, color: 'amber' },
                              { label: 'Failed', value: runStats.failed || '0', icon: XCircle, color: 'red' }
                           ].map(stat => (
                              <div key={stat.label} className={`p-5 rounded-[28px] ${isDark ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100 shadow-sm'} border flex flex-col items-center gap-2`}>
                                 <stat.icon className={`w-5 h-5 text-${stat.color}-500 ${stat.color === 'amber' || (stat.label === 'Running' && Number(stat.value) > 0) ? 'animate-spin' : ''}`} />
                                 <span className="text-xl font-black">{stat.value}</span>
                                 <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest text-center">{stat.label}</span>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </section>

               <div className="grid grid-cols-2 gap-10">

                  {/* Section 2: Coverage Gaps & Proposals */}
                  <section className="space-y-6">
                     <div className="flex items-center gap-3 px-2">
                        <Sparkles className="w-5 h-5 text-violet-500" />
                        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Scenario Suggestions</h2>
                     </div>
                     <div className="flex flex-col gap-4">
                        {/* AI Recommended Scenario from real-time analysis */}
                        {recommendedScenario ? (
                           <div className="p-6 rounded-[32px] bg-indigo-600/10 border border-indigo-500/30 hover:border-indigo-500 transition-all group animate-in zoom-in-95">
                              <div className="flex items-start justify-between mb-2">
                                 <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">AI RECOMMENDATION</span>
                                 <div className="flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                    <span className="text-[9px] font-bold text-gray-600">New Insight</span>
                                 </div>
                              </div>
                              <h4 className="text-sm font-black mb-1 text-indigo-600 dark:text-indigo-400">{recommendedScenario.title}</h4>
                              <p className="text-[11px] text-gray-500 mb-6 leading-relaxed">{recommendedScenario.description}</p>
                              <button
                                 onClick={() => onViewChange(ViewMode.AI_GENERATOR, 'verification', recommendedScenario.id, 'CI/CD Automation')}
                                 className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                              >
                                 Review & Verify
                              </button>
                           </div>
                        ) : (
                           <div className="h-[120px] rounded-[32px] border-2 border-dashed border-gray-800/10 flex flex-col items-center justify-center text-gray-500 group">
                              <Bot className="w-8 h-8 mb-2 opacity-20 group-hover:animate-bounce" />
                              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Waiting for Gap Analysis...</span>
                           </div>
                        )}
                     </div>
                  </section>

                  {/* Section 3: Live Diagnostic Terminal */}
                  <section className="space-y-6">
                     <div className="flex items-center gap-3 px-2">
                        <Terminal className="w-5 h-5 text-gray-500" />
                        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Autonomous Logs</h2>
                     </div>
                     <div className={`p-8 rounded-[40px] ${isDark ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'} border flex flex-col h-[420px]`}>
                        <div className="flex-1 overflow-y-auto space-y-4 mono text-[10px] text-gray-500 custom-scrollbar pr-4">
                           {executionLogs.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center opacity-20 italic">
                                 <Terminal className="w-12 h-12 mb-4" />
                                 <span>System idle. Waiting for trigger...</span>
                              </div>
                           ) : (
                              executionLogs.map((log, i) => (
                                 <div key={i} className="flex gap-4 animate-in slide-in-from-left-2 duration-300">
                                    <span className="opacity-40 shrink-0">{log.time}</span>
                                    <span className={`font-bold shrink-0 ${log.type === 'BUILD' ? 'text-indigo-500' :
                                       log.type === 'AI' ? 'text-violet-500' :
                                          log.type === 'EXEC' ? 'text-amber-500' :
                                             log.type === 'SUCCESS' ? 'text-emerald-500' :
                                                'text-red-500'
                                       }`}>[{log.type}]</span>
                                    <span className={log.type === 'SUCCESS' ? 'text-emerald-400 font-bold' : ''}>{log.msg}</span>
                                 </div>
                              ))
                           )}
                           {isRestarting && restartStep !== 'done' && (
                              <div className="flex gap-4 animate-pulse">
                                 <span className="opacity-40 italic">...</span>
                                 <span className="text-indigo-400 font-bold italic">[AI]</span>
                                 <span className="italic">Processing next orchestration step...</span>
                              </div>
                           )}
                        </div>
                        <div className="pt-6 border-t border-gray-800 flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                              <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Active Stream Connectivity: High</span>
                           </div>
                           <Code className="w-4 h-4 text-gray-800" />
                        </div>
                     </div>
                  </section>

               </div>
            </div>
         </main>

         {/* CI/CD Integration Settings Drawer */}
         {isConfigOpen && (
            <div className="fixed inset-0 z-[100] flex justify-end">
               <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsConfigOpen(false)} />
               <div className={`relative w-[480px] h-full ${isDark ? 'bg-[#11141d] border-white/10' : 'bg-white border-gray-200'} border-l shadow-2xl animate-in slide-in-from-right duration-500 p-10 flex flex-col`}>
                  <div className="flex items-center justify-between mb-10">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                           <Link className="w-5 h-5" />
                        </div>
                        <div>
                           <h3 className="text-sm font-black uppercase tracking-widest leading-none mb-1">CI/CD Integration</h3>
                           <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Connection & Webhooks</p>
                        </div>
                     </div>
                     <button onClick={() => setIsConfigOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-all">
                        <X className="w-6 h-6 text-gray-400" />
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-8 no-scrollbar">
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Platform Provider</label>
                        <div className="grid grid-cols-2 gap-3">
                           {['GitHub', 'Jenkins', 'GitLab', 'GHA'].map(p => (
                              <button 
                                 key={p} 
                                 onClick={() => setSelectedProvider(p)}
                                 className={`py-4 px-4 rounded-2xl border text-[11px] font-black uppercase tracking-widest transition-all ${p === selectedProvider ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : (isDark ? 'bg-white/5 border-white/5 text-gray-500 hover:border-white/20' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-indigo-200')}`}
                              >
                                 {p}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center justify-between">
                           <span>Webhook Endpoint</span>
                           <button className="text-indigo-500 text-[10px] font-black flex items-center gap-1"><Copy className="w-3 h-3" /> COPY</button>
                        </label>
                        <div className={`p-5 ${isDark ? 'bg-indigo-500/5 border-white/5' : 'bg-indigo-50 border-indigo-100'} rounded-2xl border mono text-[11px] ${isDark ? 'text-indigo-300' : 'text-indigo-600'} break-all leading-relaxed font-bold`}>
                           https://qone.ai/webhooks/deploy/project_882a1b92c
                        </div>
                     </div>

                     <div className="space-y-4 pt-4 border-t border-gray-800">
                        <div className="flex items-center justify-between p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl">
                           <div className="flex items-center gap-4">
                              <Cpu className="w-6 h-6 text-emerald-500" />
                              <div>
                                 <h4 className="text-xs font-black uppercase tracking-widest mb-1">Autonomous Trigger</h4>
                                 <p className="text-[10px] text-gray-500 font-medium">Auto-test upon code deployment analysis</p>
                              </div>
                           </div>
                           <input type="checkbox" defaultChecked className="w-5 h-5 accent-indigo-600" />
                        </div>
                     </div>
                  </div>

                  <div className="pt-10 flex gap-4 mt-auto">
                     <button className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-600/20 transition-all active:scale-95">Save Changes</button>
                     <button onClick={() => setIsConfigOpen(false)} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-gray-400 rounded-2xl font-black uppercase tracking-widest text-xs transition-all">Cancel</button>
                  </div>
               </div>
            </div>
         )}

         {/* Custom Styles */}
         <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
      `}</style>
      </div>
   );
};



// Internal icon helpers
const Bot = ({ className }: { className?: string }) => (
   <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>
);

export default PipelineWatcher;
