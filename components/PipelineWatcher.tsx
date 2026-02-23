
import React, { useState } from 'react';
import {
   Activity, GitBranch, ShieldCheck, Zap, AlertCircle,
   CheckCircle2, ChevronRight, Play, Loader2, ArrowRight,
   Code, RefreshCw, FileText, ExternalLink, X, Bug, Layout,
   Check, Terminal, Database, Sparkles, MessageSquare,
   Settings, Link, Globe, Shield, Save, Copy, Image as ImageIcon,
   User, Plus, Send, AlertTriangle, XCircle
} from 'lucide-react';
import { PipelineStep, ApprovalTask, Project, TestScript, ScriptStatus, ScriptOrigin } from '../types';

interface PipelineWatcherProps {
   activeProject: Project;
   scripts: TestScript[];
   tasks: ApprovalTask[];
   onUpdateTasks: (tasks: ApprovalTask[]) => void;
   onUpdateScript?: (script: TestScript) => void;
   onAddScript?: (script: TestScript) => void;
   onReviewInGenerator?: (scriptId: string) => void;
}

interface CIConfig {
   provider: 'GitHub' | 'GitLab' | 'Jenkins' | 'CircleCI';
   webhookUrl: string;
   targetBranch: string;
   autoHealEnabled: boolean;
   apiKey: string;
}

const PipelineWatcher: React.FC<PipelineWatcherProps> = ({ activeProject, scripts, tasks, onUpdateTasks, onUpdateScript, onAddScript, onReviewInGenerator }) => {
   const [activeStep, setActiveStep] = useState(3);
   const [showApprovalModal, setShowApprovalModal] = useState<ApprovalTask | null>(null);

   // CI/CD Config State
   const [isConfigOpen, setIsConfigOpen] = useState(false);
   const [ciConfig, setCiConfig] = useState<CIConfig>({
      provider: 'GitHub',
      webhookUrl: `https://qone.ai/hooks/project/${activeProject.id}`,
      targetBranch: 'production',
      autoHealEnabled: true,
      apiKey: 'sk-••••••••••••••••'
   });

   // Jira Modal State
   const [showJiraModal, setShowJiraModal] = useState(false);
   const [jiraForm, setJiraForm] = useState({
      title: '[Regression] Checkout Flow - button#pay ID mismatch',
      description: 'AI Analysis: The payment button selector failed after deployment v2.4.1. The element ID was changed in the source code, causing the Golden Script to break.',
      priority: 'High',
      assignee: 'QA Lead'
   });
   const [isPostingToJira, setIsPostingToJira] = useState(false);

   const [steps, setSteps] = useState<PipelineStep[]>([
      {
         id: '1',
         label: 'Impact Analysis',
         status: 'completed',
         timestamp: '14:20:05',
         description: 'CI/CD Webhook received. Analyzing code diff via Git API.',
         details: ['Detected changes in components/Auth/Login.tsx', '6 Golden Scripts identified as impacted']
      },
      {
         id: '2',
         label: 'Auto Execution',
         status: 'completed',
         timestamp: '14:21:12',
         description: 'Spinning up 4 Docker instances. Parallel execution started.',
         details: ['4 Scripts Passed', '1 Script Failed (Diagnosing...)', '1 Script Pending']
      },
      {
         id: '3',
         label: 'Result Diagnosis',
         status: 'active',
         timestamp: '14:22:45',
         description: 'AI analyzing failure root cause. Comparing current DOM vs Golden state.',
         details: ['Failure in Login Flow Verification', 'Probable Cause: UI Change (Button ID)']
      },
      {
         id: '4',
         label: 'Heuristic Feedback',
         status: 'pending',
         timestamp: 'Pending',
         description: 'Waiting for diagnostic results and human approval.',
      }
   ]);

   const handleApproveHealing = () => {
      if (!showApprovalModal || !onUpdateScript) return;
      const script = scripts.find(s => s.id === showApprovalModal.scriptId);
      if (script && showApprovalModal.proposedCode) {
         const updatedCode = script.code.replace(showApprovalModal.originalCode!, showApprovalModal.proposedCode!);
         onUpdateScript({ ...script, code: updatedCode });
      }
      // 작업을 목록에서 제거
      onUpdateTasks(tasks.filter(t => t.id !== showApprovalModal.id));
      setShowApprovalModal(null);
   };

   const handlePostJira = () => {
      setIsPostingToJira(true);
      setTimeout(() => {
         setIsPostingToJira(false);
         setShowJiraModal(false);
         alert('Issue successfully synchronized with Jira Cloud.');
      }, 2000);
   };

   const handleReviewInGenerator = (taskId?: string) => {
      const targetTaskId = taskId || showApprovalModal?.id;
      const task = tasks.find(t => t.id === targetTaskId);

      if (task && onReviewInGenerator) {
         // 더 이상 여기서 onAddScript를 호출하지 않음.
         // 단순히 Generator 화면으로 이동하면서 Task ID만 전달함.
         onReviewInGenerator(task.id);
         setShowApprovalModal(null);
      }
   };

   const handleIgnoreTask = (taskId: string) => {
      onUpdateTasks(tasks.filter(t => t.id !== taskId));
      setShowApprovalModal(null);
   };

   return (
      <div className="flex h-full w-full overflow-hidden bg-white dark:bg-[#0c0e12] transition-colors">
         {/* Left Column: Pipeline Watcher Timeline */}
         <div className="flex-[1.5] flex flex-col border-r border-gray-200 dark:border-gray-800 h-full overflow-hidden relative transition-colors">
            <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/10 transition-colors">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 transition-colors">
                        <Activity className="w-6 h-6 animate-pulse" />
                     </div>
                     <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight transition-colors">Active Deployment Pipeline</h2>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Watcher: production-branch-v2.4.1</span>
                           <button onClick={() => setIsConfigOpen(true)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-indigo-500 dark:text-indigo-400 transition-colors">
                              <Settings className="w-3.5 h-3.5" />
                           </button>
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/20 rounded-full text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase flex items-center gap-2 transition-colors">
                        <GitBranch className="w-3 h-3" /> {ciConfig.provider} Connected
                     </div>
                     <div className="px-3 py-1 bg-green-50 dark:bg-green-600/10 border border-green-200 dark:border-green-500/20 rounded-full text-[10px] font-black text-green-600 dark:text-green-500 uppercase flex items-center gap-2 transition-colors">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> CI Healthy
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 p-4 rounded-2xl transition-colors shadow-sm dark:shadow-none">
                     <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase mb-1 transition-colors">Impacted Assets</div>
                     <div className="text-xl font-black text-gray-900 dark:text-white transition-colors">6 Scripts</div>
                  </div>
                  <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 p-4 rounded-2xl transition-colors shadow-sm dark:shadow-none">
                     <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase mb-1 transition-colors">Current Progress</div>
                     <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 transition-colors">82% Complete</div>
                  </div>
                  <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 p-4 rounded-2xl transition-colors shadow-sm dark:shadow-none">
                     <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase mb-1 transition-colors">Diagnostic Mode</div>
                     <div className="text-xl font-black text-amber-500">Heuristic</div>
                  </div>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10 relative">
               <div className="absolute left-[54px] top-10 bottom-10 w-0.5 bg-gray-200 dark:bg-gray-800 transition-colors" />
               <div className="space-y-12">
                  {steps.map((step, idx) => (
                     <div key={step.id} className="relative pl-20 group">
                        <div className={`absolute left-[44px] top-0 w-6 h-6 rounded-full border-4 border-white dark:border-[#0c0e12] z-10 flex items-center justify-center transition-all ${step.status === 'completed' ? 'bg-indigo-500' :
                              step.status === 'active' ? 'bg-indigo-600 animate-ping' :
                                 'bg-gray-200 dark:bg-gray-800'
                           }`}>
                           {step.status === 'completed' && <Check className="w-3 h-3 text-white stroke-[4]" />}
                        </div>
                        {step.status === 'active' && (
                           <div className="absolute left-[44px] top-0 w-6 h-6 rounded-full bg-indigo-600 z-10 flex items-center justify-center">
                              <Loader2 className="w-3 h-3 text-white animate-spin" />
                           </div>
                        )}
                        <div className={`flex flex-col transition-all ${step.status === 'pending' ? 'opacity-30' : 'opacity-100'}`}>
                           <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400 transition-colors">Step 0{idx + 1}: {step.label}</span>
                              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-600 mono transition-colors">{step.timestamp}</span>
                           </div>
                           <h3 className={`text-lg font-bold mb-2 ${step.status === 'active' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-300'} transition-colors`}>{step.description}</h3>
                           {step.details && (
                              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mt-2 space-y-2 transition-colors">
                                 {step.details.map((detail, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
                                       <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                       {detail}
                                    </div>
                                 ))}
                              </div>
                           )}
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Right Column: Action Center */}
         <div className="flex-1 bg-gray-50 dark:bg-[#0f1115] flex flex-col h-full overflow-hidden transition-colors">
            <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-[#16191f]/50 overflow-y-auto custom-scrollbar transition-colors">
               <div className="flex items-center gap-2 mb-6">
                  <Zap className="w-4 h-4 text-indigo-500 dark:text-indigo-400 fill-current transition-colors" />
                  <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pipeline Action Center</h2>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-600/10 border border-red-200 dark:border-red-500/20 rounded-2xl transition-colors">
                     <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <div>
                           <div className="text-xs font-black text-red-500 uppercase tracking-tighter leading-none mb-1">Regression Detected</div>
                           <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium transition-colors">Checkout Flow failed assertions.</div>
                        </div>
                     </div>
                     <button
                        onClick={() => setShowJiraModal(true)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[9px] font-black uppercase rounded-lg shadow-lg shadow-red-600/20 transition-all active:scale-95"
                     >
                        Create Jira
                     </button>
                  </div>

                  <div className="text-xs font-black text-gray-500 uppercase tracking-widest pt-4">Requires User Approval ({tasks.length})</div>

                  <div className="space-y-3">
                     {tasks.map(task => (
                        <div key={task.id} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:border-indigo-500/40 transition-all group shadow-sm dark:shadow-none">
                           <div className="flex items-center justify-between mb-3">
                              <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${task.type === 'SELF_HEALING' ? 'bg-indigo-100 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400' :
                                    task.type === 'NEW_SCENARIO' ? 'bg-purple-100 dark:bg-purple-600/20 text-purple-600 dark:text-purple-400' :
                                       'bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-500'
                                 } transition-colors`}>
                                 {task.type.replace('_', ' ')}
                              </div>
                              <span className="text-[9px] text-gray-500 dark:text-gray-600 font-bold transition-colors">{task.createdAt}</span>
                           </div>
                           <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2 leading-tight transition-colors">{task.title}</h4>
                           <p className="text-[10px] text-gray-500 mb-5 leading-relaxed">{task.description}</p>
                           <button
                              onClick={() => setShowApprovalModal(task)}
                              className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 hover:border-indigo-500/50 rounded-xl text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                           >
                              {task.type === 'NEW_SCENARIO' ? 'Review & Certify' : 'Review Solution'} <ChevronRight className="w-3 h-3" />
                           </button>
                        </div>
                     ))}
                     {tasks.length === 0 && (
                        <div className="py-10 text-center bg-gray-100 dark:bg-gray-900/20 rounded-3xl border border-dashed border-gray-300 dark:border-gray-800 transition-colors">
                           <CheckCircle2 className="w-8 h-8 text-indigo-500/20 dark:text-indigo-400/20 mx-auto mb-2 transition-colors" />
                           <p className="text-[10px] font-black text-gray-500 dark:text-gray-700 uppercase tracking-widest transition-colors">No Pending Approvals</p>
                        </div>
                     )}
                  </div>
               </div>
            </div>

            <div className="p-8 shrink-0 border-t border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-950/20 transition-colors">
               <div className="flex items-center gap-3 mb-6">
                  <Database className="w-4 h-4 text-gray-500 dark:text-gray-600 transition-colors" />
                  <h3 className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase tracking-widest transition-colors">Heuristic Diagnosis Logs</h3>
               </div>
               <div className="space-y-4 mono text-[10px] text-gray-500 h-32 overflow-y-auto">
                  <div className="flex gap-2">
                     <span className="text-gray-600 dark:text-gray-700 select-none transition-colors">14:23:01</span>
                     <span className="text-indigo-500 dark:text-indigo-400 transition-colors">[AI]</span> Matching DOM snapshot of deployment v2.4.1...
                  </div>
                  <div className="flex gap-2">
                     <span className="text-gray-600 dark:text-gray-700 select-none transition-colors">14:23:04</span>
                     <span className="text-indigo-500 dark:text-indigo-400 transition-colors">[AI]</span> Discrepancy found: button[id="submit"] is missing.
                  </div>
                  <div className="flex gap-2">
                     <span className="text-gray-600 dark:text-gray-700 select-none transition-colors">14:23:08</span>
                     <span className="text-indigo-500 dark:text-indigo-400 transition-colors">[AI]</span> Heuristic check: button[id="auth_submit"] found at same coordinates.
                  </div>
                  <div className="flex gap-2 animate-pulse">
                     <span className="text-gray-600 dark:text-gray-700 select-none transition-colors">14:23:15</span>
                     <span className="text-gray-400">Waiting for user interaction via Action Center...</span>
                  </div>
               </div>
            </div>
         </div>

         {/* CI/CD CONFIG SIDEBAR PANEL */}
         {isConfigOpen && (
            <div className="fixed inset-0 z-[110] flex justify-end">
               <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsConfigOpen(false)} />
               <div className="relative w-[400px] bg-white dark:bg-[#16191f] border-l border-gray-200 dark:border-gray-800 h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col transition-colors">
                  <div className="p-8 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/20 transition-colors">
                     <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 rounded-xl">
                           <Settings className="w-5 h-5 text-white" />
                        </div>
                        <div>
                           <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">CI/CD Integration</h3>
                           <p className="text-[10px] text-gray-500 font-bold uppercase">Pipeline Connection Settings</p>
                        </div>
                     </div>
                     <button onClick={() => setIsConfigOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-8">
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pipeline Provider</label>
                        <div className="grid grid-cols-2 gap-2">
                           {['GitHub', 'GitLab', 'Jenkins', 'CircleCI'].map(p => (
                              <button
                                 key={p}
                                 onClick={() => setCiConfig({ ...ciConfig, provider: p as any })}
                                 className={`py-3 px-4 rounded-xl border text-[10px] font-black uppercase transition-all ${ciConfig.provider === p ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-white dark:bg-[#0c0e12] border-gray-200 dark:border-gray-800 text-gray-600 hover:border-gray-300 dark:hover:border-gray-700'}`}
                              >
                                 {p}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Target Watcher Branch</label>
                        <div className="relative">
                           <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                           <input
                              type="text"
                              value={ciConfig.targetBranch}
                              onChange={e => setCiConfig({ ...ciConfig, targetBranch: e.target.value })}
                              className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-3 pl-10 pr-4 text-xs text-gray-900 dark:text-white outline-none focus:border-indigo-500 transition-colors shadow-sm dark:shadow-none"
                              placeholder="e.g., main"
                           />
                        </div>
                     </div>

                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center justify-between">
                           <span>Webhook URL</span>
                           <button className="text-indigo-500 dark:text-indigo-400 flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"><Copy className="w-3 h-3" /> COPY</button>
                        </label>
                        <div className="p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-gray-800 rounded-xl text-[10px] text-gray-500 dark:text-gray-400 mono break-all transition-colors">
                           {ciConfig.webhookUrl}
                        </div>
                     </div>

                     <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800 transition-colors">
                        <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-600/5 border border-indigo-100 dark:border-indigo-500/10 rounded-2xl transition-colors">
                           <div className="flex items-center gap-3">
                              <Shield className="w-5 h-5 text-indigo-500 dark:text-indigo-400 transition-colors" />
                              <div className="flex flex-col">
                                 <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Autonomous Healing</span>
                                 <span className="text-[9px] text-gray-500">Auto-apply fixes for minor UI changes</span>
                              </div>
                           </div>
                           <input
                              type="checkbox"
                              checked={ciConfig.autoHealEnabled}
                              onChange={e => setCiConfig({ ...ciConfig, autoHealEnabled: e.target.checked })}
                              className="w-5 h-5 accent-indigo-600"
                           />
                        </div>
                     </div>
                  </div>

                  <div className="p-8 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/20 transition-colors">
                     <button
                        onClick={() => setIsConfigOpen(false)}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2"
                     >
                        <Save className="w-4 h-4" /> Save Connection
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* JIRA ISSUE MODAL */}
         {showJiraModal && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-200">
               <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-colors" onClick={() => setShowJiraModal(false)} />
               <div className="relative w-full max-w-4xl bg-white dark:bg-[#1d1f24] border border-gray-200 dark:border-[#2d2f36] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90vh] transition-colors">
                  <div className="p-8 border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-[#25272d] flex items-center justify-between transition-colors">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#0052cc] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                           <Bug className="w-6 h-6" />
                        </div>
                        <div>
                           <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight transition-colors">Create Jira Issue</h3>
                           <p className="text-xs text-blue-500 dark:text-blue-400 font-bold uppercase tracking-widest mt-1 transition-colors">AI-Enriched Regression Report</p>
                        </div>
                     </div>
                     <button onClick={() => setShowJiraModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500 transition-colors">
                        <X className="w-6 h-6" />
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-10 flex flex-col gap-8 custom-scrollbar">
                     <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-6">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Issue Summary</label>
                              <input
                                 type="text"
                                 value={jiraForm.title}
                                 onChange={e => setJiraForm({ ...jiraForm, title: e.target.value })}
                                 className="w-full bg-gray-50 dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4 text-sm text-gray-900 dark:text-white focus:border-blue-500 outline-none transition-all shadow-sm dark:shadow-none"
                              />
                           </div>

                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Issue Description</label>
                              <textarea
                                 value={jiraForm.description}
                                 onChange={e => setJiraForm({ ...jiraForm, description: e.target.value })}
                                 className="w-full h-40 bg-gray-50 dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4 text-sm text-gray-700 dark:text-gray-300 focus:border-blue-500 outline-none resize-none leading-relaxed transition-colors shadow-sm dark:shadow-none"
                              />
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Priority</label>
                                 <div className="bg-gray-50 dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 flex items-center gap-2 text-xs font-bold text-red-500 transition-colors shadow-sm dark:shadow-none">
                                    <AlertTriangle className="w-4 h-4" /> {jiraForm.priority}
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Assignee</label>
                                 <div className="bg-gray-50 dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 transition-colors shadow-sm dark:shadow-none">
                                    <User className="w-4 h-4 text-blue-500 dark:text-blue-400" /> {jiraForm.assignee}
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="space-y-6">
                           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Failure Evidence (Captured Snapshot)</label>
                           <div className="relative group border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-3xl overflow-hidden bg-gray-100 dark:bg-black/40 transition-colors">
                              <div className="aspect-video w-full relative">
                                 <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 dark:from-indigo-950/40 via-white dark:via-black to-red-100 dark:to-red-950/20 transition-colors" />
                                 <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                                    <div className="w-16 h-16 bg-red-100 dark:bg-red-600/20 rounded-full flex items-center justify-center mb-4 border border-red-200 dark:border-red-500/30 transition-colors">
                                       <ImageIcon className="w-8 h-8 text-red-500" />
                                    </div>
                                    <h4 className="text-sm font-black text-red-500 uppercase mb-1">UI Logic Failure</h4>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-600 font-bold uppercase tracking-widest transition-colors">Captured at Step: Payment Verification</p>
                                 </div>
                                 <div className="absolute top-4 left-4 right-4 h-8 bg-white dark:bg-gray-900/80 rounded-lg border border-gray-200 dark:border-white/5 flex items-center px-3 gap-2 transition-colors">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    <div className="h-1 w-20 bg-gray-200 dark:bg-gray-700 rounded-full transition-colors" />
                                 </div>
                                 <div className="absolute bottom-4 left-4 right-4 p-4 bg-red-50 dark:bg-red-600/20 border border-red-100 dark:border-red-500/40 rounded-2xl backdrop-blur-md transition-colors">
                                    <div className="flex items-center gap-3">
                                       <XCircle className="w-6 h-6 text-red-500" />
                                       <div className="h-2 w-32 bg-red-500/40 rounded-full" />
                                    </div>
                                 </div>
                              </div>
                              <div className="p-4 bg-gray-50 dark:bg-[#25272d] border-t border-gray-200 dark:border-gray-800 flex items-center justify-between transition-colors">
                                 <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <Database className="w-3.5 h-3.5" /> DOM_SNAPSHOT_24.PNG
                                 </span>
                                 <button className="text-[9px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest hover:underline transition-colors">View Full Res</button>
                              </div>
                           </div>

                           <div className="p-6 bg-gray-50 dark:bg-gray-950/40 border border-gray-200 dark:border-gray-800 rounded-3xl transition-colors">
                              <div className="flex items-center gap-2 mb-4">
                                 <Terminal className="w-4 h-4 text-gray-500 dark:text-gray-600 transition-colors" />
                                 <span className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase tracking-widest transition-colors">Diagnostic Meta-data</span>
                              </div>
                              <div className="space-y-2 mono text-[9px] text-gray-500 italic">
                                 <div>» ENVIRONMENT: PRODUCTION-STAGING_01</div>
                                 <div>» USER_AGENT: CHROME/124.0 (LINUX)</div>
                                 <div>» FAILURE_STEP: POST_PAYMENT_REDIRECT</div>
                                 <div className="text-red-500/70">» STACKTRACE: ERROR: SELECTOR TIMEOUT (#SUBMIT_BTN)</div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="p-8 border-t border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-[#25272d] flex justify-end gap-3 transition-colors">
                     <button
                        onClick={() => setShowJiraModal(false)}
                        className="px-10 py-4 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest"
                     >
                        Cancel
                     </button>
                     <button
                        onClick={handlePostJira}
                        disabled={isPostingToJira}
                        className="px-14 py-4 bg-[#0052cc] hover:bg-[#0047b3] text-white text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest shadow-xl shadow-blue-600/30 flex items-center gap-2"
                     >
                        {isPostingToJira ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {isPostingToJira ? 'Synchronizing...' : 'Create & Sync Issue'}
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* APPROVAL MODAL */}
         {showApprovalModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-200">
               <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-colors" onClick={() => setShowApprovalModal(null)} />
               <div className="relative w-full max-w-4xl bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden max-h-[90vh] transition-colors">
                  <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/20 flex items-center justify-between transition-colors">
                     <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${showApprovalModal.type === 'NEW_SCENARIO' ? 'bg-purple-100 dark:bg-purple-600/10 text-purple-600 dark:text-purple-400' : 'bg-indigo-100 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400'} transition-colors`}>
                           {showApprovalModal.type === 'SELF_HEALING' ? <RefreshCw className="w-8 h-8" /> :
                              showApprovalModal.type === 'NEW_SCENARIO' ? <Sparkles className="w-8 h-8" /> :
                                 <Bug className="w-8 h-8" />}
                        </div>
                        <div>
                           <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight transition-colors">{showApprovalModal.title}</h3>
                           <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Pending Approval Mode: {showApprovalModal.type.replace('_', ' ')}</p>
                        </div>
                     </div>
                     <button onClick={() => setShowApprovalModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500 transition-colors">
                        <X className="w-6 h-6" />
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
                     <div className={`p-6 border rounded-3xl ${showApprovalModal.type === 'NEW_SCENARIO' ? 'bg-purple-50 dark:bg-purple-600/5 border-purple-200 dark:border-purple-500/20' : 'bg-indigo-50 dark:bg-indigo-600/5 border-indigo-200 dark:border-indigo-500/20'} transition-colors`}>
                        <div className="flex items-center gap-3 mb-4">
                           <Bot className={`w-6 h-6 ${showApprovalModal.type === 'NEW_SCENARIO' ? 'text-purple-500 dark:text-purple-400' : 'text-indigo-500 dark:text-indigo-400'} transition-colors`} />
                           <h4 className={`text-[10px] font-black uppercase tracking-widest ${showApprovalModal.type === 'NEW_SCENARIO' ? 'text-purple-500 dark:text-purple-400' : 'text-indigo-500 dark:text-indigo-400'} transition-colors`}>Contextual Analysis</h4>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium transition-colors">{showApprovalModal.description}</p>
                     </div>

                     <div className="grid grid-cols-2 gap-6 h-[300px]">
                        {showApprovalModal.originalCode ? (
                           <>
                              <div className="flex flex-col">
                                 <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase mb-3 flex items-center gap-2 transition-colors">
                                    <Terminal className="w-3.5 h-3.5" /> Golden Script (Original)
                                 </div>
                                 <div className="flex-1 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl p-4 mono text-[11px] text-red-600 dark:text-red-400 overflow-auto transition-colors">
                                    <code>{showApprovalModal.originalCode}</code>
                                 </div>
                              </div>
                              <div className="flex flex-col">
                                 <div className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase mb-3 flex items-center gap-2 transition-colors">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Proposed Self-Healing Patch
                                 </div>
                                 <div className="flex-1 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/40 rounded-2xl p-4 mono text-[11px] text-indigo-600 dark:text-indigo-300 overflow-auto transition-colors">
                                    <code>{showApprovalModal.proposedCode}</code>
                                 </div>
                              </div>
                           </>
                        ) : (
                           <div className="col-span-2 flex flex-col">
                              <div className={`text-[10px] font-black uppercase mb-3 flex items-center gap-2 ${showApprovalModal.type === 'NEW_SCENARIO' ? 'text-purple-500 dark:text-purple-400' : 'text-indigo-500 dark:text-indigo-400'} transition-colors`}>
                                 <Sparkles className="w-3.5 h-3.5" /> AI Generated Sequence
                              </div>
                              <div className={`flex-1 border rounded-2xl p-6 mono text-[12px] overflow-auto ${showApprovalModal.type === 'NEW_SCENARIO' ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-500/40 text-purple-600 dark:text-purple-300' : 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-500/40 text-indigo-600 dark:text-indigo-300'} transition-colors`}>
                                 <code>{showApprovalModal.proposedCode}</code>
                              </div>
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="p-8 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/20 flex justify-end gap-3 transition-colors">
                     <button
                        onClick={() => handleIgnoreTask(showApprovalModal.id)}
                        className="px-8 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest"
                     >
                        Ignore
                     </button>
                     <button
                        onClick={() => handleReviewInGenerator()}
                        className={`px-8 py-3 bg-white dark:bg-[#16191f] border hover:bg-gray-50 dark:hover:bg-opacity-10 text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest flex items-center gap-2 ${showApprovalModal.type === 'NEW_SCENARIO' ? 'border-purple-200 dark:border-purple-500/40 text-purple-500 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500' : 'border-indigo-200 dark:border-indigo-500/40 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500'
                           }`}
                     >
                        <ExternalLink className="w-4 h-4" />
                        Review in Generator
                     </button>
                     {showApprovalModal.type === 'SELF_HEALING' && (
                        <button
                           onClick={handleApproveHealing}
                           className="px-12 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest shadow-xl shadow-indigo-600/30 flex items-center gap-2"
                        >
                           <Check className="w-4 h-4" />
                           Apply Self-Healing
                        </button>
                     )}
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

// Internal icon helpers
const Bot = ({ className }: { className?: string }) => (
   <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>
);

export default PipelineWatcher;
