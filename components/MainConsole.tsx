
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Send, Bot, Sparkles, Play, Terminal, Activity, Loader2, RefreshCw,
  AlertCircle, CheckCircle2, FileText, Download, Table as TableIcon,
  CalendarClock, Eye, Search, Zap, Hash, List, BarChart3, Clock, Key,
  ShieldCheck, Bell, ChevronRight, MessageSquare, ClipboardCheck,
  TrendingUp, PieChart, Info, ArrowUpRight, Check, X, Filter, Settings as SettingsIcon
} from 'lucide-react';
import { Message, Project, TestScript, TestHistory, TestSchedule } from '../types';
import { testApi } from '../api/test';
import { useTheme } from '../src/context/ThemeContext';

interface MainConsoleProps {
  activeProject: Project;
  assets: TestScript[];
  history: TestHistory[];
  schedules: TestSchedule[];
  messages: Message[];
  onMessagesChange: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;
  onAlert: (title: string, msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface ApprovalItem {
  id: string;
  type: 'GENERATOR' | 'HEALING' | 'JIRA';
  title: string;
  description: string;
  timestamp: string;
  urgency: 'low' | 'medium' | 'high';
}

const MOCK_APPROVALS: ApprovalItem[] = [
  { id: 'app_1', type: 'GENERATOR', title: 'Scenario Draft: Payment Cancel', description: '3 new flows generated based on Policy Manual v2.', timestamp: '12m ago', urgency: 'medium' },
  { id: 'app_2', type: 'HEALING', title: 'Self-Healing: Login Button', description: 'Selector updated from ID to ARIA-Label for stability.', timestamp: '1h ago', urgency: 'high' },
  { id: 'app_3', type: 'JIRA', title: 'Defect Ticket: API 500', description: 'Critical failure detected in Order service. Ready to sync.', timestamp: '3h ago', urgency: 'high' },
];

const AgenticHub: React.FC<MainConsoleProps> = ({
  activeProject,
  assets,
  history,
  schedules,
  messages,
  onMessagesChange,
  onAlert
}) => {

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [thoughtLog, setThoughtLog] = useState<string>('Ready for mission command...');
  const [drawerItem, setDrawerItem] = useState<ApprovalItem | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Agent Statuses
  const [agents] = useState({
    testing: { label: 'Testing', status: 'idle', color: 'indigo' },
    defect: { label: 'Defect', status: 'idle', color: 'amber' },
    reporting: { label: 'Reporting', status: 'idle', color: 'emerald' }
  });

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isProcessing) return;

    onMessagesChange(prev => [...prev, { id: `u_${Date.now()}`, role: 'user', content: textToSend } as Message]);
    setInput('');
    setIsProcessing(true);
    setActiveAgent('testing');
    setThoughtLog('Orchestrator is delegating the goal to Testing Agent...');

    try {
      const aiApi = await import('../api/ai').then(m => m.aiApi);
      const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: textToSend };
      const response = await aiApi.chat([...messages, userMsg], `Orchestrator mode. Project: ${activeProject.name}. Minimalist summary and action required.`);

      onMessagesChange(prev => [...prev, { id: `ai_${Date.now()}`, role: 'assistant', content: response.text || "Command received." } as Message]);
      setThoughtLog('Mission objective acknowledged. Monitoring execution...');
    } catch (e) {
      setThoughtLog('Error in command dispatch.');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setActiveAgent(null), 3000);
    }
  };

  const passRate = useMemo(() => {
    if (history.length === 0) return 0;
    const passed = history.filter(h => h.status === 'passed').length;
    return Math.round((passed / history.length) * 100);
  }, [history]);

  // Theme-aware styles
  const bgClass = isDark ? 'bg-[#0c0e12]' : 'bg-[#f8faff]';
  const textClass = isDark ? 'text-gray-100' : 'text-gray-900';
  const subTextClass = isDark ? 'text-gray-500' : 'text-gray-400';
  const cardBgClass = isDark ? 'bg-white/[0.02] border-white/5 backdrop-blur-sm shadow-2xl' : 'bg-white border-gray-100 shadow-sm';
  const inputBgClass = isDark ? 'bg-gray-900/50' : 'bg-white';
  const borderClass = isDark ? 'border-white/5' : 'border-gray-100';

  return (
    <div className={`flex h-full w-full ${bgClass} ${textClass} overflow-hidden font-sans relative transition-colors duration-500`}>

      {/* Background Ambience */}
      <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-tr from-[#0c0e12] via-[#11141d] to-[#0c0e12]' : 'bg-gradient-to-tr from-[#f8faff] via-[#ffffff] to-[#f8faff]'} pointer-events-none`} />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="flex-1 flex flex-col z-10 overflow-y-auto overflow-x-hidden no-scrollbar">

        {/* HEADER: Agent Orbs */}
        <header className="flex items-center justify-between px-10 py-8">
          <div className="flex items-center gap-12">
            {[agents.testing, agents.defect, agents.reporting].map(a => (
              <div key={a.label} className="flex flex-col items-center gap-3 group cursor-pointer">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center relative transition-all duration-700 ${activeAgent === a.label.toLowerCase() ? 'scale-110 shadow-[0_0_30px_rgba(79,70,229,0.3)]' : 'opacity-80'
                  }`}>
                  <div className={`absolute inset-0 rounded-full border-2 border-${a.color}-500/20 ${activeAgent === a.label.toLowerCase() ? 'animate-ping' : ''}`} />
                  <div className={`w-full h-full rounded-full ${isDark ? `bg-${a.color}-500/10 border-${a.color}-500/30` : `bg-${a.color}-50 border-${a.color}-100`} border backdrop-blur-md flex items-center justify-center transition-colors`}>
                    {a.label === 'Testing' ? <Bot className={`w-6 h-6 text-${a.color}-500`} /> :
                      a.label === 'Defect' ? <ShieldCheck className={`w-6 h-6 text-${a.color}-500`} /> :
                        <BarChart3 className={`w-6 h-6 text-${a.color}-500`} />}
                  </div>
                  {/* Status Glow */}
                  <div className={`absolute -bottom-1 w-2 h-2 rounded-full bg-${a.color}-500 shadow-[0_0_8px_rgb(99,102,241)]`} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${subTextClass} group-hover:${isDark ? 'text-gray-300' : 'text-gray-600'} transition-colors`}>{a.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className={`text-[9px] font-black ${subTextClass} uppercase tracking-widest block mb-0.5`}>Project Integrity</span>
              <span className={`text-xl font-black ${textClass} tracking-tighter transition-colors`}>{passRate}% <span className="text-[10px] text-emerald-500 uppercase tracking-widest ml-1 font-black">Stable</span></span>
            </div>
            <div className={`w-px h-10 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
            <div className="flex gap-2">
              <button className={`p-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100 shadow-sm'} border rounded-2xl hover:bg-white/10 transition-all`}><Bell className="w-5 h-5 text-gray-400" /></button>
              <button className={`p-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100 shadow-sm'} border rounded-2xl hover:bg-white/10 transition-all`}><SettingsIcon className="w-5 h-5 text-gray-400" /></button>
            </div>
          </div>
        </header>

        {/* HERO: Command Center (Centered at ~40% height) */}
        <section className="flex-1 flex flex-col items-center justify-start px-10 w-full overflow-y-visible">
          <div className="flex-[0.4] h-0" /> {/* Top Spacer to push content down to ~40% position */}
          <div className="max-w-5xl mx-auto w-full pt-4 pb-12 flex flex-col items-center">
          <div className="w-full mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
            <h1 className={`text-2xl font-black tracking-tight text-center ${textClass} mb-6 transition-colors`}>
              What is the goal for <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">today?</span>
            </h1>
            <div className="relative max-w-2xl mx-auto group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-[32px] blur opacity-10 group-focus-within:opacity-30 transition-opacity duration-500" />
              <div className={`relative flex items-center ${inputBgClass} backdrop-blur-2xl border ${borderClass} rounded-[28px] p-2 transition-all group-focus-within:${isDark ? 'border-white/10' : 'border-indigo-200'} shadow-2xl transition-all duration-500`}>
                <div className="pl-6 pr-4 opacity-50 flex items-center">
                  {isProcessing ? <Loader2 className="w-6 h-6 animate-spin text-indigo-500" /> : <Zap className="w-6 h-6 text-indigo-400" />}
                </div>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="e.g. '결제 시스템 자율 테스트 수행해줘'"
                  className={`flex-1 bg-transparent py-5 text-lg font-bold outline-none placeholder:text-gray-500/30 ${textClass} transition-colors`}
                />
                <button
                  onClick={() => handleSend()}
                  className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[24px] shadow-lg shadow-indigo-600/20 transition-all active:scale-95 ml-2"
                >
                  <ArrowUpRight className="w-6 h-6" />
                </button>
              </div>
              <div className="mt-4 flex items-center justify-center gap-6">
                <span className={`text-[10px] font-black ${isDark ? 'text-gray-600' : 'text-gray-400'} uppercase tracking-widest transition-colors`}>Active Mission:</span>
                <p className={`text-[11px] font-black tracking-[0.05em] transition-all duration-500 ${isProcessing ? 'text-indigo-500' : (isDark ? 'text-gray-500' : 'text-gray-400')}`}>
                  {thoughtLog}
                </p>
              </div>
            </div>
          </div>

          {/* DASHBOARD: Grid of Approvals & Intelligence */}
          <div className="w-full grid grid-cols-2 gap-8 mb-4 mt-10 items-stretch">

            {/* Decision Center (Approvals) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span className={`text-[10px] font-black ${subTextClass} uppercase tracking-[0.2em] transition-colors`}>Decision Center</span>
                </div>
                <span className={`text-[8px] font-black ${isDark ? 'text-gray-600 border-gray-800' : 'text-gray-400 border-gray-100 bg-white'} uppercase px-2 py-0.5 border rounded-full transition-all`}>{MOCK_APPROVALS.length} Pending</span>
              </div>
              <div className="flex flex-col gap-2 h-full">
                {MOCK_APPROVALS.map(app => (
                  <div key={app.id} onClick={() => setDrawerItem(app)} className={`p-4 ${cardBgClass} hover:${isDark ? 'bg-white/[0.04]' : 'bg-indigo-50/30'} cursor-pointer transition-all group flex items-center justify-between rounded-[28px] flex-1`}>
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-1 h-8 rounded-full ${app.urgency === 'high' ? 'bg-indigo-500' : (isDark ? 'bg-gray-800' : 'bg-gray-100')}`} />
                      <div className="min-w-0">
                        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-0.5 block">{app.type}</span>
                        <h3 className={`text-xs font-black ${textClass} tracking-tight group-hover:text-indigo-500 transition-colors truncate`}>{app.title}</h3>
                        <p className={`text-[10px] font-bold ${subTextClass} truncate`}>{app.description}</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95">Review</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Intelligence Briefing */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <PieChart className="w-3.5 h-3.5 text-emerald-500" />
                  <span className={`text-[10px] font-black ${subTextClass} uppercase tracking-[0.2em] transition-colors`}>Quality Intelligence</span>
                </div>
                <span className="text-[8px] font-bold text-emerald-500 uppercase px-2 py-0.5 bg-emerald-500/10 rounded-full italic border border-emerald-500/20">Optimized</span>
              </div>
              <div className="grid grid-cols-2 gap-3 h-full">
                <div className={`p-6 ${cardBgClass} bg-gradient-to-br from-indigo-600/10 to-transparent flex flex-col justify-between rounded-[28px] min-h-[140px]`}>
                  <div>
                    <TrendingUp className="w-5 h-5 text-indigo-500 mb-4" />
                    <span className={`text-[10px] font-black ${subTextClass} uppercase tracking-widest block mb-0.5`}>Weekly Growth</span>
                    <p className={`text-xl font-black ${textClass} tracking-tighter transition-colors`}>+12% Coverage</p>
                  </div>
                  <div className={`w-full h-1 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-full overflow-hidden mt-4`}>
                    <div className="h-full bg-indigo-500 w-[65%] shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                  </div>
                </div>
                <div className={`p-6 ${cardBgClass} bg-gradient-to-br from-emerald-600/10 to-transparent flex flex-col justify-between rounded-[28px] min-h-[140px]`}>
                  <div>
                    <ShieldCheck className="w-5 h-5 text-emerald-500 mb-4" />
                    <span className={`text-[10px] font-black ${subTextClass} uppercase tracking-widest block mb-0.5`}>Healed Issues</span>
                    <p className={`text-xl font-black ${textClass} tracking-tighter transition-colors`}>8 Resolved</p>
                  </div>
                  <div className="flex -space-x-2 mt-4">
                    <div className={`w-8 h-8 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'} border-2 ${isDark ? 'border-[#0c0e12]' : 'border-white'}`} />
                    <div className={`w-8 h-8 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} border-2 ${isDark ? 'border-[#0c0e12]' : 'border-white'}`} />
                    <div className="w-8 h-8 rounded-full bg-indigo-600 border-2 border-[#0c0e12] flex items-center justify-center text-[9px] font-black text-white">+5</div>
                  </div>
                </div>
                <div className={`col-span-2 p-6 ${cardBgClass} flex items-center justify-between group cursor-pointer hover:border-indigo-500/30 transition-all rounded-[28px]`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50 shadow-inner'} flex items-center justify-center group-hover:text-emerald-500 transition-all`}>
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <span className={`text-[9px] font-black ${subTextClass} uppercase tracking-widest block mb-0.5`}>Latest Insight</span>
                      <h4 className="text-base font-black tracking-tight">Daily QA Executive Summary</h4>
                    </div>
                  </div>
                  <button className={`p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50 shadow-sm'} group-hover:bg-indigo-600 group-hover:text-white transition-all`}><ChevronRight className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
          </div>
          </div>
          <div className="flex-[0.6]" /> {/* Bottom Spacer to ensure content stays around 40% mark */}
        </section>

        {/* FOOTER: Quick Links */}
        <footer className={`px-10 py-4 border-t ${borderClass} flex items-center justify-center gap-12 transition-colors`}>
          {[
            { label: 'Generate Scenarios', icon: Sparkles, color: 'indigo' },
            { label: 'Asset Library', icon: List, color: 'gray' },
            { label: 'Test Execution', icon: Play, color: 'emerald' },
            { label: 'Knowledge Base', icon: Zap, color: 'gray' },
            { label: 'Project Settings', icon: Key, color: 'gray' }
          ].map(l => (
            <button key={l.label} className="flex items-center gap-2 group">
              <l.icon className={`w-3.5 h-3.5 ${isDark ? 'text-gray-600 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-700'} transition-colors ${l.color !== 'gray' ? `group-hover:text-${l.color}-500` : ''}`} />
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-gray-600 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-700'} transition-colors`}>{l.label}</span>
            </button>
          ))}
        </footer>
      </div>

      {/* DRAWER: Detail Review */}
      {drawerItem && (
        <div className="absolute inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerItem(null)} />
          <div className={`relative w-[500px] h-full ${isDark ? 'bg-[#11141d]' : 'bg-white'} border-l ${borderClass} shadow-2xl animate-in slide-in-from-right duration-500 p-12 flex flex-col transition-colors`}>
            <div className="flex items-center justify-between mb-12">
              <span className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.3em] border-b-2 border-indigo-500/20 pb-1">Decision Review</span>
              <button onClick={() => setDrawerItem(null)} className={`p-2 hover:${isDark ? 'bg-white/5' : 'bg-gray-100'} rounded-full transition-all`}><X className="w-8 h-8 text-gray-400" /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-10 no-scrollbar pr-2">
              <div>
                <h2 className="text-3xl font-black tracking-tighter mb-4">{drawerItem.title}</h2>
                <p className={`text-base font-medium ${subTextClass} leading-relaxed transition-colors`}>{drawerItem.description}</p>
              </div>

              <div className={`p-8 ${isDark ? 'bg-black/40 border-white/5 shadow-inner' : 'bg-gray-50 border-gray-100 shadow-sm'} rounded-[40px] border space-y-6 transition-colors`}>
                <div className="flex items-center justify-between text-[11px] font-black text-indigo-500 uppercase tracking-widest">
                  <span>AI Reasoning Perspective</span>
                  <Bot className="w-5 h-5" />
                </div>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'} font-medium`}>
                  Based on the recent UI updates detected in the staging environment, the existing selector for "Login Submit" was found to be brittle. I have autonomously updated the reference to use the stable Accessibility ID 'btn_login_submit'.
                </p>
              </div>

              <div className="space-y-6">
                <span className={`text-[11px] font-black ${subTextClass} uppercase tracking-[0.2em] block ml-2`}>Proposed Optimization</span>
                <div className={`p-6 ${isDark ? 'bg-gray-950 border-white/5' : 'bg-white border-gray-100 shadow-md'} rounded-3xl border font-mono text-xs leading-relaxed space-y-1`}>
                  <div className="text-red-400 opacity-60">- id: "btn-login-03"</div>
                  <div className="text-emerald-400 font-bold">+ accessible_id: "btn_login_submit"</div>
                  <div className={`${isDark ? 'text-gray-600' : 'text-gray-400'} mt-2`}>  action: <span className="text-indigo-400">click()</span></div>
                </div>
              </div>
            </div>

            <div className="pt-12 flex gap-4">
              <button
                onClick={() => { onAlert('Success', 'Decision Confirmed.', 'success'); setDrawerItem(null); }}
                className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[24px] font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-xl shadow-indigo-600/30"
              >
                Approve & Execute
              </button>
              <button
                onClick={() => setDrawerItem(null)}
                className={`px-10 py-5 ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-white border-gray-100 shadow-sm hover:bg-gray-50'} text-gray-400 rounded-[24px] font-black uppercase tracking-widest text-xs transition-all`}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        .animate-ping { animation: ping 3s cubic-bezier(0, 0, 0.2, 1) infinite; }
      `}</style>
    </div>
  );
};

export default AgenticHub;
