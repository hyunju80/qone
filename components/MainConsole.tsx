import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Send, Bot, Sparkles, Play, PlaySquare, Terminal, Activity, Loader2, RefreshCw,
  AlertCircle, CheckCircle2, FileText, Download, BookOpen, Table as TableIcon,
  CalendarClock, Eye, Search, Compass, Zap, Hash, List, BarChart3, Clock, Key,
  ShieldCheck, Bell, ChevronRight, MessageSquare, ClipboardCheck,
  TrendingUp, PieChart, Info, ArrowUpRight, Check, X, Filter, Settings as SettingsIcon
} from 'lucide-react';
import { ViewMode, Message, Project, TestScript, TestHistory, TestSchedule } from '../types';
import { testApi } from '../api/test';
import { useTheme } from '../src/context/ThemeContext';
import ReactMarkdown from 'react-markdown';
import { createPortal } from 'react-dom';
import JiraSyncModal from './JiraSyncModal';
import HealingAnalysisModal from './HealingAnalysisModal';

interface MainConsoleProps {
  activeProject: Project;
  assets: TestScript[];
  history: TestHistory[];
  schedules: TestSchedule[];
  messages: Message[];
  onMessagesChange: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;
  onAlert: (title: string, msg: string, type?: 'success' | 'error' | 'info') => void;
  onViewChange: (view: ViewMode, tab?: string) => void;
}

interface ApprovalItem {
  id: string;
  type: 'GENERATOR' | 'HEALING' | 'JIRA';
  title: string;
  description: string;
  timestamp: string;
  urgency: 'low' | 'medium' | 'high';
}

const AgenticHub: React.FC<MainConsoleProps> = ({
  activeProject,
  assets,
  history,
  schedules,
  messages,
  onMessagesChange,
  onAlert,
  onViewChange
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [thoughtLog, setThoughtLog] = useState<string>('Ready for mission command...');
  const [drawerItem, setDrawerItem] = useState<ApprovalItem | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingInsight, setIsLoadingInsight] = useState(true);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [latestInsight, setLatestInsight] = useState<any>(null);
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
  const [selectedJiraItem, setSelectedJiraItem] = useState<TestHistory | null>(null);
  const [selectedHealingItem, setSelectedHealingItem] = useState<TestHistory | null>(null);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (!activeProject?.id) return;

    // 1. Fetch Summary Data (Quality Intelligence)
    setIsLoadingSummary(true);
    testApi.getHistorySummary(activeProject.id).then(summary => {
      setSummaryData(summary);
      setIsLoadingSummary(false);
    }).catch(() => setIsLoadingSummary(false));

    // 2. Fetch Latest Insight
    setIsLoadingInsight(true);
    testApi.getLatestInsight(activeProject.id).then(insight => {
      setLatestInsight(insight);
      setIsLoadingInsight(false);
    }).catch(() => setIsLoadingInsight(false));

    // 3. Fetch Data for Decision Center (Approvals)
    setIsLoadingApprovals(true);
    const fetchApprovals = async () => {
      try {
        const [scenarios, pendingHeals, historyRes] = await Promise.all([
          testApi.getScenarios(activeProject.id),
          testApi.getPendingHealing(activeProject.id),
          testApi.getHistory(activeProject.id)
        ]);

        const mapped: ApprovalItem[] = [];

        // 1. Pending Scenarios
        scenarios.filter((s: any) => !s.is_approved).forEach((s: any) => {
          mapped.push({
            id: s.id || '',
            type: 'GENERATOR',
            title: `Scenario Draft: ${s.title}`,
            description: s.description || `${s.testCases?.length || 0} cases generated.`,
            timestamp: s.created_at ? new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'New',
            urgency: 'medium'
          });
        });

        // 2. Pending Healing
        pendingHeals.slice(0, 5).forEach((h: any) => {
          mapped.push({
            id: h.id || '',
            type: 'HEALING',
            title: `Healing Needed: ${h.scriptName}`,
            description: `Failure detected. Self-healing is enabled for this asset.`,
            timestamp: h.runDate ? new Date(h.runDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
            urgency: 'high'
          });
        });

        // 3. Current Defects (Jira)
        const latestHistoryMap = new Map<string, any>();
        historyRes.forEach((h: any) => {
          if (h.script_id && !latestHistoryMap.has(h.script_id)) {
            latestHistoryMap.set(h.script_id, h);
          }
        });

        const currentDefects = Array.from(latestHistoryMap.values())
          .filter((h: any) => h.status === 'failed' && !h.jira_id);

        currentDefects.slice(0, 5).forEach((h: any) => {
          mapped.push({
            id: h.id || '',
            type: 'JIRA',
            title: `Defect Sync: ${h.scriptName}`,
            description: h.failureReason || 'Critical failure. Ready to sync with Jira.',
            timestamp: h.runDate ? new Date(h.runDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            urgency: 'high'
          });
        });

        // 4. Calculate Scenario Verification Count (Autonomous Testing Repository)
        const pVerification = scenarios.filter((s: any) => (s.is_approved || s.isApproved) && (!s.golden_script_id && !s.goldenScriptId)).length;
        setPendingVerificationCount(pVerification);

        setApprovals(mapped);
      } catch (e) {
        console.error("Error fetching approvals", e);
      } finally {
        setIsLoadingApprovals(false);
      }
    };
    fetchApprovals();
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeProject.id]);

  const [agents] = useState({
    testing: { label: 'Testing', status: 'idle', color: 'indigo' },
    defect: { label: 'Defect', status: 'idle', color: 'amber' },
    reporting: { label: 'Reporting', status: 'idle', color: 'emerald' }
  });

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isProcessing) return;

    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: textToSend };
    onMessagesChange(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);
    setThoughtLog('Orchestrator is analyzing the goal...');

    try {
      const aiApi = await import('../api/ai').then(m => m.aiApi);
      const [scriptList, summary] = await Promise.all([
        testApi.getScripts(activeProject.id),
        testApi.getHistorySummary(activeProject.id)
      ]);

      const context = `
        Current Project: ${activeProject.name}
        Total Assets: ${scriptList.length}
        Available Tests: ${scriptList.map(s => `"${s.name}" (ID: ${s.id}, Origin: ${s.origin})`).join(', ')}
        Last Run Pass Rate: ${summary.rate}%
      `;
      const response = await aiApi.chat([...messages, userMsg], context);

      const lowerResp = response.text?.toLowerCase() || '';
      if (lowerResp.includes('test') || lowerResp.includes('crawl')) setActiveAgent('testing');
      else if (lowerResp.includes('fail') || lowerResp.includes('retry') || lowerResp.includes('defect')) setActiveAgent('defect');
      else if (lowerResp.includes('report') || lowerResp.includes('insight') || lowerResp.includes('summary')) setActiveAgent('reporting');

      setThoughtLog('Mission plan synthesized. Waiting for execution command...');
      onMessagesChange(prev => [...prev, { id: `ai_${Date.now()}`, role: 'assistant', content: response.text || "Command received." } as Message]);
    } catch (e) {
      setThoughtLog('Error in mission coordination.');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setActiveAgent(null), 5000);
    }
  };

  const bgClass = isDark ? 'bg-[#0c0e12]' : 'bg-[#f8faff]';
  const textClass = isDark ? 'text-gray-100' : 'text-gray-900';
  const subTextClass = isDark ? 'text-gray-500' : 'text-gray-400';
  const cardBgClass = isDark ? 'bg-white/[0.02] border-white/5 backdrop-blur-sm shadow-2xl' : 'bg-white border-gray-100 shadow-sm';
  const inputBgClass = isDark ? 'bg-gray-900/50' : 'bg-white';
  const borderClass = isDark ? 'border-white/5' : 'border-gray-100';

  return (
    <div className={`flex h-full w-full ${bgClass} ${textClass} overflow-hidden font-sans relative transition-colors duration-500`}>
      <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-tr from-[#0c0e12] via-[#11141d] to-[#0c0e12]' : 'bg-gradient-to-tr from-[#f8faff] via-[#ffffff] to-[#f8faff]'} pointer-events-none`} />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="flex-1 flex flex-col z-10 overflow-y-auto overflow-x-hidden no-scrollbar">

        <header className="flex items-center justify-between px-10 py-8">
          <div className="flex items-center gap-12">
            {[agents.testing, agents.defect, agents.reporting].map(a => (
              <div key={a.label} className="flex flex-col items-center gap-3 group cursor-pointer">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center relative transition-all duration-700 ${activeAgent === a.label.toLowerCase() ? 'scale-110 shadow-[0_0_30px_rgba(79,70,229,0.3)]' : 'opacity-80'}`}>
                  <div className={`absolute inset-0 rounded-full border-2 border-${a.color}-500/20 ${activeAgent === a.label.toLowerCase() ? 'animate-ping' : ''}`} />
                  <div className={`w-full h-full rounded-full ${isDark ? `bg-${a.color}-500/10 border-${a.color}-500/30` : `bg-${a.color}-50 border-${a.color}-100`} border backdrop-blur-md flex items-center justify-center transition-colors`}>
                    {a.label === 'Testing' ? <Bot className={`w-6 h-6 text-${a.color}-500`} /> :
                      a.label === 'Defect' ? <ShieldCheck className={`w-6 h-6 text-${a.color}-500`} /> :
                        <BarChart3 className={`w-6 h-6 text-${a.color}-500`} />}
                  </div>
                  <div className={`absolute -bottom-1 w-2 h-2 rounded-full bg-${a.color}-500 shadow-[0_0_8px_rgb(99,102,241)]`} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${subTextClass} group-hover:${isDark ? 'text-gray-300' : 'text-gray-600'} transition-colors`}>{a.label}</span>
              </div>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-6">
            <div
              onClick={() => onViewChange(ViewMode.HISTORY, 'defects')}
              className={`flex items-center gap-3 px-5 py-2.5 ${cardBgClass} rounded-2xl border ${borderClass} cursor-pointer hover:border-rose-500/30 transition-all group shadow-sm`}
            >
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-rose-500" />
                {summaryData?.active_defects > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                )}
              </div>
              <div className="flex flex-col">
                <span className={`text-[8px] font-black ${subTextClass} uppercase tracking-widest leading-tight`}>Active Defects</span>
                <span className={`text-base font-black ${textClass} leading-tight`}>{summaryData?.active_defects || 0}</span>
              </div>
              <ChevronRight className="w-3 h-3 text-gray-500 group-hover:text-rose-500 ml-1 transition-colors" />
            </div>
          </div>
        </header>

        <section className="flex-1 flex flex-col items-center justify-start px-10 w-full overflow-y-visible">
          <div className="flex-[0.4] h-0" />
          <div className="max-w-5xl mx-auto w-full pt-4 pb-12 flex flex-col items-center">
            <div className="w-full mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
              <h1 className={`text-2xl font-black tracking-tight text-center ${textClass} mb-6 transition-colors`}>
                What is the goal for <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">today?</span>
              </h1>
              <div className="relative max-w-2xl mx-auto group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-[32px] blur opacity-10 group-focus-within:opacity-30 transition-opacity duration-500" />
                <div className={`relative flex items-center ${inputBgClass} backdrop-blur-2xl border ${borderClass} rounded-[28px] p-2 transition-all shadow-2xl duration-500`}>
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
                  {isProcessing ? (
                    <button onClick={() => { setIsProcessing(false); setThoughtLog('Mission aborted.'); }} className="px-6 py-4 bg-red-600/20 text-red-500 border border-red-500/30 rounded-[24px] text-[10px] font-black uppercase tracking-widest ml-2">Stop</button>
                  ) : (
                    <button onClick={() => handleSend()} className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[24px] shadow-lg shadow-indigo-600/20 active:scale-95 ml-2"><ArrowUpRight className="w-6 h-6" /></button>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-center gap-6">
                  <span className={`text-[10px] font-black ${isDark ? 'text-gray-600' : 'text-gray-400'} uppercase tracking-widest`}>Active Mission:</span>
                  <p className={`text-[11px] font-black tracking-[0.05em] ${isProcessing ? 'text-indigo-500' : (isDark ? 'text-gray-500' : 'text-gray-400')}`}>{thoughtLog}</p>
                </div>
              </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-8 mb-4 mt-10 items-stretch">
              {/* Decision Center */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-2 pb-3 mb-4 border-b border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-indigo-500" />
                    <span className={`text-[11px] font-black ${subTextClass} uppercase tracking-[0.2em]`}>Decision Center</span>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full`}>{approvals.length} Pending</span>
                </div>
                <div className="flex flex-col gap-2 h-full max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {isLoadingApprovals && approvals.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center opacity-30 py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>
                  ) : approvals.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 border-2 border-dashed border-gray-500/20 rounded-[28px] py-20">
                      <CheckCircle2 className="w-10 h-10 mb-2" />
                      <span className="text-[10px] font-bold">Clear Sky - No pending decisions</span>
                    </div>
                  ) : (
                    approvals.map(app => {
                      const themeMap: any = {
                        HEALING: { text: 'text-indigo-500', bg: 'bg-indigo-600', hoverBg: 'hover:bg-indigo-600', softBg: 'hover:bg-indigo-500/[0.05]', darkSoftBg: 'hover:bg-indigo-500/10', stick: 'bg-indigo-500', btnBg: 'bg-indigo-500/10' },
                        JIRA: { text: 'text-amber-500', bg: 'bg-amber-600', hoverBg: 'hover:bg-amber-600', softBg: 'hover:bg-amber-500/[0.05]', darkSoftBg: 'hover:bg-amber-500/10', stick: 'bg-amber-500', btnBg: 'bg-amber-500/10' },
                        GENERATOR: { text: 'text-violet-500', bg: 'bg-violet-600', hoverBg: 'hover:bg-violet-600', softBg: 'hover:bg-violet-500/[0.05]', darkSoftBg: 'hover:bg-violet-500/10', stick: 'bg-violet-500', btnBg: 'bg-violet-500/10' }
                      };
                      const t = themeMap[app.type] || themeMap.HEALING;

                      const handleAction = async (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (app.type === 'GENERATOR') {
                          setDrawerItem(app);
                        } else {
                          setIsFetchingDetail(true);
                          try {
                            const detail = await testApi.getHistoryDetail(app.id);
                            if (app.type === 'JIRA') {
                              setSelectedJiraItem(detail);
                            } else {
                              setSelectedHealingItem(detail);
                            }
                          } catch (e) {
                            onAlert('Error', 'Failed to fetch detail information.', 'error');
                          } finally {
                            setIsFetchingDetail(false);
                          }
                        }
                      };

                      return (
                        <div
                          key={`${app.type}-${app.id}`}
                          onClick={handleAction}
                          className={`p-4 ${cardBgClass} ${isDark ? t.darkSoftBg : t.softBg} cursor-pointer group flex items-center justify-between rounded-[28px] shrink-0 transition-all active:scale-[0.99]`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className={`w-1 h-8 rounded-full ${app.urgency === 'high' ? t.stick : 'bg-gray-500'}`} />
                            <div className="min-w-0">
                              <span className={`text-[8px] font-black ${t.text} uppercase tracking-widest mb-0.5 block`}>{app.type}</span>
                              <h3 className="text-xs font-black truncate">{app.title}</h3>
                              <p className={`text-[10px] font-bold ${subTextClass} truncate`}>{app.description}</p>
                            </div>
                          </div>
                          <button
                            onClick={handleAction}
                            disabled={isFetchingDetail}
                            title={app.type === 'GENERATOR' ? 'Review Draft' : 'Review Detail & Proceed'}
                            className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-2xl 
                              ${isDark ? 'bg-white/5' : t.btnBg} ${t.text} 
                              hover:${t.bg} hover:text-white hover:shadow-lg transition-all 
                              hover:scale-110 active:scale-90 disabled:opacity-50 disabled:scale-100 group/btn`}
                          >
                            {isFetchingDetail && (app.type === 'JIRA' || app.type === 'HEALING') ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quality Intelligence */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-2 pb-3 mb-4 border-b border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-emerald-500" />
                    <span className={`text-[11px] font-black ${subTextClass} uppercase tracking-[0.2em]`}>Quality Intelligence</span>
                  </div>
                  <span className="text-[9px] font-black text-emerald-500 uppercase px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">Optimized</span>
                </div>
                <div className="grid grid-cols-2 gap-3 h-full">
                  {/* Card 1: Golden Asset Fleet */}
                  {isLoadingSummary && !summaryData ? (
                    <div className={`col-span-2 py-20 flex items-center justify-center opacity-30 ${cardBgClass} rounded-[28px]`}><Loader2 className="w-6 h-6 animate-spin" /></div>
                  ) : (
                    <>
                      <div
                        onClick={() => onViewChange(ViewMode.LIBRARY)}
                        className={`p-6 ${cardBgClass} bg-gradient-to-br from-indigo-600/10 to-transparent flex flex-col justify-between rounded-[28px] min-h-[140px] group border ${isDark ? 'border-white/5' : 'border-gray-100'} hover:border-indigo-500/30 cursor-pointer transition-all shadow-sm`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                              <Zap className="w-3 h-3 fill-indigo-500" /> Asset Fleet
                            </div>
                            <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[8px] font-black text-emerald-500 flex items-center gap-1">
                              <TrendingUp className="w-2 h-2" /> +{summaryData?.weekly_growth || 0}
                            </div>
                          </div>
                          <p className={`text-3xl font-black ${textClass} tracking-tighter leading-none mb-1 transition-colors uppercase`}>{summaryData?.total_assets || 0}</p>
                          <span className={`text-[9px] font-black ${subTextClass} uppercase tracking-widest block opacity-70`}>Total Validated Assets</span>
                        </div>

                        <div className="mt-4 space-y-1.5">
                          <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-widest">
                            <span className={subTextClass}>Stability Score</span>
                            <span className="text-emerald-500">
                              {summaryData?.total_assets ? Math.round(((summaryData.total_assets - summaryData.active_defects) / summaryData.total_assets) * 100) : 100}%
                            </span>
                          </div>
                          <div className={`w-full h-1 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                            <div
                              className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                              style={{ width: `${summaryData?.total_assets ? ((summaryData.total_assets - summaryData.active_defects) / summaryData.total_assets) * 100 : 100}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Scenario Verification (Replacement for Active Defects) */}
                      <div
                        onClick={() => onViewChange(ViewMode.AI_GENERATOR, 'verification')}
                        className={`p-6 ${cardBgClass} bg-gradient-to-br from-violet-600/10 to-transparent flex flex-col justify-between rounded-[28px] min-h-[140px] group border ${isDark ? 'border-white/5' : 'border-gray-100'} hover:border-violet-500/30 cursor-pointer transition-all shadow-sm`}
                      >
                        <div>
                          <div className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Sparkles className="w-3 h-3 fill-violet-500" /> Scenario Repository
                          </div>
                          <p className={`text-3xl font-black ${textClass} tracking-tighter leading-none mb-1 transition-colors uppercase`}>{pendingVerificationCount}</p>
                          <span className={`text-[9px] font-black ${subTextClass} uppercase tracking-widest block opacity-70`}>Pending Verification</span>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          <div className="flex -space-x-2">
                            {[0, 1, 2].map(i => (
                              <div key={i} className={`w-5 h-5 rounded-full border-2 ${isDark ? 'border-[#11141d] bg-gray-800' : 'border-white bg-gray-100'} flex items-center justify-center`}>
                                <Zap className="w-2.5 h-2.5 text-violet-500" />
                              </div>
                            ))}
                          </div>
                          <span className="text-[8px] font-black text-violet-500 underline uppercase tracking-widest">Verify Now</span>
                        </div>
                      </div>
                    </>
                  )}
                  <div onClick={() => latestInsight && setShowInsightModal(true)} className={`col-span-2 p-5 ${cardBgClass} flex items-center justify-between group cursor-pointer border hover:border-indigo-500/30 rounded-[28px] relative`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:text-emerald-500`}>
                        {isLoadingInsight ? <Loader2 className="w-5 h-5 animate-spin opacity-30" /> : <FileText className="w-6 h-6" />}
                      </div>
                      <div>
                        <span className={`text-[9px] font-black ${subTextClass} uppercase tracking-widest block mb-0.5`}>Latest Insight</span>
                        <h4 className="text-base font-black tracking-tight">{latestInsight?.title || 'No insights available'}</h4>
                        <span
                          onClick={(e) => { e.stopPropagation(); onViewChange(ViewMode.REPORTS, 'saved'); }}
                          className="text-[10px] bg-transparent text-gray-400 hover:text-emerald-500 mt-1.5 inline-flex items-center gap-1 font-bold transition-colors cursor-pointer"
                        >
                          View All Reports <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                    <button className="p-3 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all"><ChevronRight className="w-5 h-5" /></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-[0.6]" />
        </section>

        {/* FOOTER: Quick Links restored successfully */}
        <footer className={`px-10 py-4 border-t ${borderClass} flex items-center justify-center gap-12 transition-colors`}>
          {[
            { label: 'Test Agent', icon: Sparkles, color: 'indigo', view: ViewMode.AI_EXPLORATION },
            { label: 'Test Step Flow', icon: List, color: 'yellow', view: ViewMode.STEP_RUNNER },
            { label: 'Test Result', icon: BarChart3, color: 'emerald', view: ViewMode.HISTORY, tab: 'dashboard' },
            { label: 'Test Schedule', icon: CalendarClock, color: 'gray', view: ViewMode.SCHEDULES },
            { label: 'Knowledge Base', icon: BookOpen, color: 'rose', view: ViewMode.KNOWLEDGE_REPO }
          ].map(l => (
            <button
              key={l.label}
              onClick={() => onViewChange(l.view as ViewMode, l.tab)}
              className="flex items-center gap-2 group hover:scale-105 transition-all active:scale-95"
            >
              <l.icon className={`w-3.5 h-3.5 ${isDark ? 'text-gray-600 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-700'} transition-colors ${l.color !== 'gray' ? `group-hover:text-${l.color}-500` : ''}`} />
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-gray-600 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-700'} transition-colors`}>{l.label}</span>
            </button>
          ))}
        </footer>
      </div>

      {showInsightModal && latestInsight && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 sm:p-12 animate-in fade-in duration-300 print:p-0 print:static print:block print:bg-white">
          {/* Global Print Styles Injection */}
          <style>
            {`
                @media print {
                   #root { display: none !important; }
                   body { background: white !important; overflow: visible !important; height: auto !important; }
                   html, body { width: 100%; margin: 0; padding: 0; }
                   h1, h2, h3, p, li { page-break-inside: avoid; }
                   a { text-decoration: none; color: black; }
                }
             `}
          </style>

          <div className="absolute inset-0 bg-black/50 dark:bg-black/90 backdrop-blur-xl print:hidden transition-colors" onClick={() => setShowInsightModal(false)} />
          <div className="relative w-full max-w-5xl h-full max-h-[90vh] bg-[#fdfdfd] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 text-gray-900 border-[12px] border-gray-200/50 dark:border-white/10 print:border-none print:shadow-none print:w-full print:max-w-none print:h-auto print:max-h-none print:rounded-none print:overflow-visible transition-colors">
            <button onClick={() => setShowInsightModal(false)} className="absolute top-8 right-8 p-3 bg-gray-900 text-white rounded-2xl z-[200] hover:bg-gray-800 transition-colors print:hidden"><X className="w-4 h-4" /></button>
            <div className="flex-1 overflow-auto p-12 custom-scrollbar print:overflow-visible print:h-auto print:p-0">
              <div className="flex items-center justify-between mb-8 print:hidden">
                <h1 className="text-3xl font-black text-gray-900">Executive Intelligence Report</h1>
                <div className="flex gap-3">
                  <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/20">
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              </div>

              <div className="prose prose-lg max-w-none text-gray-700 bg-white p-10 rounded-xl border border-gray-200 shadow-sm print:shadow-none print:border-none print:p-0 print:prose-sm">
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
                  {latestInsight.content_markdown || "> **No valid content available.**"}
                </ReactMarkdown>
              </div>

              <div className="mt-12 pt-8 border-t border-gray-200 flex justify-between text-xs text-gray-400 font-mono print:fixed print:bottom-4 print:left-8 print:right-8">
                <span>Generated by Q-ONE AI Engine</span>
                <span>{latestInsight.created_at ? new Date(latestInsight.created_at).toLocaleString() : new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {drawerItem && (
        <div className="absolute inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerItem(null)} />
          <div className={`relative w-[500px] h-full ${isDark ? 'bg-[#11141d]' : 'bg-white'} border-l ${borderClass} shadow-2xl animate-in slide-in-from-right p-12 flex flex-col`}>
            <div className="flex justify-between mb-12">
              <span className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.3em]">Decision Review</span>
              <button onClick={() => setDrawerItem(null)}><X className="w-8 h-8 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-10 custom-scrollbar pr-2">
              <div>
                <h2 className="text-3xl font-black mb-4">{drawerItem.title}</h2>
                <div className={`p-6 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${borderClass} mb-6`}>
                  <p className="text-sm leading-relaxed opacity-80">{drawerItem.description}</p>
                </div>

                {drawerItem.type === 'HEALING' || drawerItem.type === 'JIRA' ? (
                  <button
                    onClick={async () => {
                      setIsFetchingDetail(true);
                      try {
                        const detail = await testApi.getHistoryDetail(drawerItem.id);
                        if (drawerItem.type === 'JIRA') {
                          setSelectedJiraItem(detail);
                        } else {
                          setSelectedHealingItem(detail);
                        }
                        setDrawerItem(null);
                      } catch (e) {
                        onAlert('Error', 'Failed to fetch detail information.', 'error');
                      } finally {
                        setIsFetchingDetail(false);
                      }
                    }}
                    disabled={isFetchingDetail}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2"
                  >
                    {isFetchingDetail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    Review Detailed {drawerItem.type === 'JIRA' ? 'Defect' : 'Analysis'}
                  </button>
                ) : (
                  <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">AI Suggestion</span>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-400 font-medium leading-relaxed">
                      This scenario has been generated based on your requirements. Review the steps and approve to register it as a gold standard test asset.
                    </p>
                  </div>
                )}
              </div>
            </div>
            {drawerItem.type === 'GENERATOR' && (
              <div className="pt-12 flex gap-4">
                <button onClick={async () => {
                  if (!drawerItem) return;
                  try {
                    const scenariosApi = await import('../api/scenarios').then(m => m.scenariosApi);
                    await scenariosApi.update(drawerItem.id, { is_approved: true });
                    onAlert('Success', 'Scenario has been approved and registered as an asset.', 'success');
                    setApprovals(prev => prev.filter(a => a.id !== drawerItem.id));
                    setDrawerItem(null);
                    fetchData();
                  } catch (e) {
                    onAlert('Error', 'Failed to process the requested action.', 'error');
                  }
                }} className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[24px] font-black uppercase text-xs transition-all shadow-xl shadow-indigo-600/30">Approve & Execute</button>
                <button onClick={() => setDrawerItem(null)} className="px-10 py-5 bg-white/5 text-gray-400 rounded-[24px] font-black uppercase text-xs">Dismiss</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Decision Specialized Modals */}
      {selectedJiraItem && (
        <JiraSyncModal
          targetItem={selectedJiraItem}
          onClose={() => setSelectedJiraItem(null)}
          onSuccess={() => {
            onAlert('Success', 'Defect ticket has been synced with Jira.', 'success');
            setApprovals(prev => prev.filter(a => a.id !== selectedJiraItem.id));
            fetchData();
          }}
        />
      )}

      {selectedHealingItem && (
        <HealingAnalysisModal
          targetItem={selectedHealingItem}
          onClose={() => setSelectedHealingItem(null)}
          onSuccess={() => {
            onAlert('Mission Hand-off', 'Self-healing process started. Check progress in Defect Management.', 'success');
            setApprovals(prev => prev.filter(a => a.id !== selectedHealingItem.id));
            fetchData();
          }}
        />
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.2); border-radius: 10px; }
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        .animate-ping { animation: ping 3s cubic-bezier(0, 0, 0.2, 1) infinite; }
      `}</style>
    </div>
  );
};
export default AgenticHub;
