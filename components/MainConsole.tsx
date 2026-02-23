
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, Play, Terminal, Activity, Loader2, RefreshCw, AlertCircle, CheckCircle2, FileText, Download, Table as TableIcon, CalendarClock, Eye, Search, Zap, Hash, List, BarChart3, Clock, Key } from 'lucide-react';
import LiveView from './LiveView';
import { Message, Project, TestScript, TestHistory, TestSchedule } from '../types';
import { testApi } from '../api/test';

interface MainConsoleProps {
  activeProject: Project;
  assets: TestScript[];
  history: TestHistory[];
  schedules: TestSchedule[];
  messages: Message[];
  onMessagesChange: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;
  onStartGeneration?: () => void;
  onRecordHistory?: (history: TestHistory) => void;
  onAddSchedule?: (schedule: TestSchedule) => void;
}

const MainConsole: React.FC<MainConsoleProps> = ({
  activeProject,
  assets,
  history,
  schedules,
  messages,
  onMessagesChange,
  onStartGeneration,
  onRecordHistory,
  onAddSchedule
}) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [executingScriptName, setExecutingScriptName] = useState<string>('');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const QUICK_ACTIONS = [
    { label: '테스트 목록 조회', icon: List, prompt: '현재 등록된 모든 테스트 목록 보여줘' },
    { label: '스케줄 조회', icon: Clock, prompt: '등록된 예약 스케줄 목록 알려줘' },
    { label: '테스트 추천', icon: Sparkles, prompt: '로그인 로직이 변경되었어. 관련 테스트 추천해주고 바로 실행할 수 있게 해줘' },
    { label: '오늘 Fail건 조회', icon: AlertCircle, prompt: '오늘 발생한 실패 테스트 결과만 요약해줘' },
  ];



  // Real Execution State
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [screenSrc, setScreenSrc] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket Connection for Live View
  useEffect(() => {
    if (!activeRunId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const host = '127.0.0.1:8001'; // Should be dynamic based on env, but hardcoded for local logic match
    const wsUrl = `ws://${host}/api/v1/run/ws/${activeRunId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'screen') {
          setScreenSrc(`data:image/jpeg;base64,${msg.data}`);
        } else if (msg.type === 'status') {
          const finalStatus = msg.data as 'success' | 'error';
          setExecutionStatus(finalStatus);
          if (finalStatus === 'success' || finalStatus === 'error') {
            // Keep connected for a moment to show result? Or maybe wait for user explicit action? 
            // Currently just stays connected until cleanup or next run.
          }
        }
      } catch (e) { console.error(e); }
    };

    return () => {
      ws.close();
    };
  }, [activeRunId]);

  const handleRunFromChat = async (scriptName: string) => {
    const targetScript = assets.find(s =>
      s.name.toLowerCase().includes(scriptName.toLowerCase()) ||
      scriptName.toLowerCase().includes(s.name.toLowerCase())
    );

    if (!targetScript) {
      onMessagesChange(prev => [...prev, {
        id: `${Date.now()}_err`,
        role: 'assistant',
        content: `인증된 스크립트 중 '${scriptName}'을(를) 찾을 수 없습니다.`,
        type: 'text'
      }]);
      return;
    }

    setExecutingScriptName(targetScript.name);
    setExecutionStatus('running');
    setScreenSrc(null); // Reset previous screen
    setCurrentStep(1);

    try {
      // Trigger Real Dry Run
      const { run_id } = await testApi.dryRun(targetScript.code);
      setActiveRunId(run_id);

      // Record history locally for immediate feedback (though backend also records it)
      if (onRecordHistory) {
        onRecordHistory({
          id: `h_chat_${Date.now()}`,
          scriptId: targetScript.id,
          scriptName: targetScript.name,
          runDate: new Date().toLocaleString(),
          status: 'passed', // Optimistic? Or wait? 
          duration: 'Running...',
          personaName: targetScript.persona?.name || 'Standard User',
          trigger: 'manual',
          logs: []
        });
      }

      onMessagesChange(prev => [...prev, {
        id: `sys_start_${Date.now()}`,
        role: 'assistant',
        content: `**${targetScript.name}** 테스트 실행을 시작했습니다.\n우측 화면에서 실시간 실행 과정을 확인할 수 있습니다.`,
        type: 'text'
      }]);

    } catch (e) {
      console.error("Failed to start run", e);
      setExecutionStatus('error');
    }
  };


  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isProcessing) return;

    const userMessage: Message = { id: '${Date.now()}_u', role: 'user', content: textToSend };
    onMessagesChange(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // Quick Action Intercept (Client-side fast path)
      let response: any;

      if (textToSend.includes('현재 등록된 모든 테스트 목록 보여줘')) {
        response = { function_call: { name: 'get_golden_scripts', args: {} } };
      } else if (textToSend.includes('등록된 예약 스케줄 목록 알려줘')) {
        response = { function_call: { name: 'get_test_schedules', args: {} } };
      } else if (/([가-힣a-zA-Z0-9]+)\s*관련/.test(textToSend) || /([가-힣a-zA-Z0-9]+)\s*기능이\s*변경/.test(textToSend)) {
        const match = textToSend.match(/([가-힣a-zA-Z0-9]+)\s*관련/) || textToSend.match(/([가-힣a-zA-Z0-9]+)\s*기능이\s*변경/);
        const keyword = match ? match[1] : '전체';
        response = { function_call: { name: 'recommend_tests', args: { keyword } } };
      } else if (textToSend.includes('오늘 발생한 실패 테스트')) {
        response = { function_call: { name: 'summarize_test_results', args: { reportType: 'failures' } } };
      } else {
        // Use Backend API
        // @ts-ignore
        const aiApi = await import('../api/ai').then(m => m.aiApi);
        response = await aiApi.chat([...messages, userMessage], `Active Project: ${activeProject.name}`);
      }

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.function_call) {
        const { name, args } = response.function_call;

        // Handle Tool execution response or Frontend Action

        if (name === 'recommend_tests') {
          const keyword = (args as any).keyword.toLowerCase();
          const recommended = assets.filter(a =>
            a.name.toLowerCase().includes(keyword) ||
            (a.tags && a.tags.some(t => t.toLowerCase().includes(keyword)))
          );

          if (recommended.length > 0) {
            const content = `지능형 분석 결과, **'${keyword}'** 관련 변경사항에 대해 다음 테스트 자산들을 실행할 것을 추천합니다:`;
            onMessagesChange(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content,
              type: 'report',
              reportData: {
                summary: "추천 테스트 목록",
                table: {
                  headers: ["테스트 명", "태그", "실행"],
                  rows: recommended.map(r => [r.name, r.tags?.join(', ') || '-', "RUN"])
                }
              }
            }]);
          } else {
            onMessagesChange(prev => [...prev, { id: `norec_${Date.now()}`, role: 'assistant', content: `'${keyword}'와 관련된 등록된 테스트 자산을 찾지 못했습니다.` }]);
          }
        }
        else if (name === 'summarize_test_results') {
          const type = (args as any).reportType;
          const filtered = type === 'failures' ? history.filter(h => h.status === 'failed') : history;

          const total = filtered.length;
          const passed = filtered.filter(h => h.status === 'passed').length;
          const failed = total - passed;
          const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

          const content = filtered.length > 0
            ? `프로젝트의 최근 **${total}건**의 테스트 데이터를 기반으로 생성된 요약 리포트입니다.`
            : "요약할 수 있는 테스트 실행 내역이 존재하지 않습니다.";

          if (filtered.length > 0) {
            onMessagesChange(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content,
              type: 'report',
              reportData: {
                summary: `${type === 'failures' ? '결함(Failures)' : '전체'} 결과 심층 분석`,
                metrics: [
                  { label: '전체 실행', value: total },
                  { label: '성공률', value: `${passRate}%` },
                  { label: '실패 건수', value: failed }
                ],
                table: {
                  headers: ["테스트 명", "상태", "일시"],
                  rows: filtered.slice(0, 10).map(h => [h.scriptName, h.status.toUpperCase(), h.runDate])
                }
              }
            }]);
          } else {
            onMessagesChange(prev => [...prev, { id: `nosum_${Date.now()}`, role: 'assistant', content: "데이터가 없습니다." }]);
          }
        }
        else if (name === 'create_test_schedule') {
          const scriptIds = args.scriptNames?.map((name: string) =>
            assets.find(a => a.name.toLowerCase().includes(name.toLowerCase()))?.id
          ).filter(Boolean) || [];

          if (scriptIds.length > 0 && onAddSchedule) {
            onAddSchedule({
              id: `sch_ai_${Date.now()}`,
              projectId: activeProject.id,
              name: args.name || `${args.scriptNames[0]} AI 스케줄`,
              scriptIds,
              cronExpression: args.cronExpression,
              frequencyLabel: args.frequencyLabel,
              lastRun: 'Never',
              nextRun: '자동 계산됨',
              isActive: true,
              alertConfig: { channels: ['slack'], criticalOnly: true, failureThreshold: 1 },
              priority: 'Normal'
            });
            onMessagesChange(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content: `새로운 테스트 스케줄 **'${args.name}'** 등록이 완료되었습니다.\n- 대상: ${args.scriptNames.join(', ')}\n- 주기: ${args.frequencyLabel}`
            }]);
          } else {
            onMessagesChange(prev => [...prev, { id: `nosch_${Date.now()}`, role: 'assistant', content: "스케줄을 등록할 대상 스크립트를 자산 라이브러리에서 찾을 수 없습니다. 정확한 스크립트 이름을 입력해 주세요." }]);
          }
        }
        else if (name === 'run_test_script') {
          handleRunFromChat(args.scriptName);
          onMessagesChange(prev => [...prev, { id: `run_${Date.now()}`, role: 'assistant', content: `**${args.scriptName}** 테스트를 즉시 실행합니다. 오른쪽 텔레메트리 화면을 확인해 주세요.` }]);
        }
        else if (name === 'get_test_schedules') {
          // Ideally backend returns this data, but if backend returns tool call, we can render it here from props
          const list = schedules.length > 0
            ? schedules.map(s => `- **${s.name}**: ${s.frequencyLabel}`).join('\n')
            : "현재 등록된 예약 스케줄이 없습니다.";
          onMessagesChange(prev => [...prev, { id: `list_sch_${Date.now()}`, role: 'assistant', content: `현재 프로젝트에 설정된 테스트 스케줄입니다:\n\n${list}` }]);
        }
        else if (name === 'get_golden_scripts') {
          const list = assets.map(a => `- **${a.name}**`).join('\n');
          onMessagesChange(prev => [...prev, { id: `list_gold_${Date.now()}`, role: 'assistant', content: `현재 워크스페이스에 등록된 골든 스크립트 목록입니다:\n\n${list}` }]);
        }

      } else {
        // Text Response
        onMessagesChange(prev => [...prev, {
          id: `txt_${Date.now()}`,
          role: 'assistant',
          content: response.text || "응답을 생성할 수 없습니다."
        }]);
      }
    } catch (error: any) {
      console.error("Gemini Execution Error:", error);
      let errorMsg = `분석 중 오류가 발생했습니다: ${error.message || error}`;
      if (error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('missing')) {
        errorMsg = "⚠️ **Backend Error**: API Key 설정이나 서버 상태를 확인해주세요.";
      }
      onMessagesChange(prev => [...prev, {
        id: '${Date.now()}_err',
        role: 'assistant',
        content: errorMsg,
        type: 'text'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCustomAction = (row: string[]) => {
    handleRunFromChat(row[0]);
  };

  return (
    <div className="flex h-full w-full overflow-hidden transition-colors duration-300">
      <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-800 h-full bg-gray-50 dark:bg-[#0f1115]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth custom-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-indigo-600'}`}>
                  {msg.role === 'user' ? <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">ME</span> : <Bot className="w-4 h-4 text-white" />}
                </div>
                <div className="flex flex-col gap-2">
                  <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-200 shadow-sm dark:shadow-none'}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  {msg.reportData && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      {/* Metrics Card Grid */}
                      {msg.reportData.metrics && (
                        <div className="grid grid-cols-3 gap-2">
                          {msg.reportData.metrics.map((m, i) => (
                            <div key={i} className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex flex-col items-center justify-center shadow-sm">
                              <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">{m.label}</span>
                              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{m.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Detailed Table */}
                      {msg.reportData.table && (
                        <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-md dark:shadow-xl transition-colors">
                          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/50 flex items-center justify-between">
                            <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{msg.reportData.summary}</span>
                            <BarChart3 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-gray-100 dark:bg-gray-900/50 text-gray-500 uppercase font-black text-[9px] border-b border-gray-200 dark:border-gray-700">
                              <tr>
                                {msg.reportData.table.headers.map((h, i) => <th key={i} className="px-4 py-2">{h}</th>)}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                              {msg.reportData.table.rows.map((row, i) => (
                                <tr key={i} className="hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-colors">
                                  <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-300 truncate max-w-[150px]">{row[0]}</td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${row[1] === 'PASSED' ? 'bg-green-600/10 text-green-500' : row[1] === 'FAILED' ? 'bg-red-600/10 text-red-500' : 'text-gray-500'}`}>
                                      {row[1]}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {row[2] === "RUN" ? (
                                      <button
                                        onClick={() => handleCustomAction(row)}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase transition-all"
                                      >
                                        <Play className="w-3 h-3" /> RUN
                                      </button>
                                    ) : (
                                      <span className="text-gray-600 text-[9px] mono">{row[2]}</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="flex gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-indigo-600/50 flex items-center justify-center"><Bot className="w-4 h-4 text-white" /></div>
                <div className="px-4 py-2 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm dark:shadow-none"><span className="text-[10px] text-gray-500 font-bold uppercase">Oracle is analyzing...</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 bg-gray-50 dark:bg-[#0c0e12] border-t border-gray-200 dark:border-gray-800 space-y-4 transition-colors">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <div className="flex items-center gap-2 whitespace-nowrap">
              {QUICK_ACTIONS.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(action.prompt)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-600/20 border border-gray-200 dark:border-gray-800 hover:border-indigo-500/50 rounded-full transition-all group shadow-sm dark:shadow-none"
                >
                  <action.icon className="w-3 h-3 text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="e.g., '로그인 관련 테스트 추천해줘'"
              className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl py-4 pl-5 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-gray-900 dark:text-white shadow-sm dark:shadow-inner transition-colors"
            />
            <button onClick={() => handleSend()} disabled={isProcessing} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-xl active:scale-95 transition-all shadow-lg shadow-indigo-600/20 hover:bg-indigo-500">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="w-[450px] bg-white dark:bg-[#0c0e12] flex flex-col h-full overflow-hidden border-l border-gray-200 dark:border-gray-800 transition-colors">
        <LiveView status={executionStatus} currentStepIndex={currentStep} availableDevices={activeProject.targetDevices} screenSrc={screenSrc} />
        <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className={`w-4 h-4 ${executionStatus === 'running' ? 'text-indigo-400' : 'text-gray-600'}`} />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Device Station</span>
            </div>
            <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${executionStatus === 'running' ? 'bg-indigo-600 text-white animate-pulse' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
              {executionStatus.toUpperCase()}
            </div>
          </div>
          <div className="space-y-4">
            {executingScriptName && <div className="text-xs font-bold text-gray-900 dark:text-gray-300 truncate">Asset: {executingScriptName}</div>}
            <div className="w-full h-1 bg-gray-200 dark:bg-gray-900 rounded-full overflow-hidden border border-gray-300 dark:border-gray-800 relative">
              {executionStatus === 'running' ? (
                <div className="absolute inset-0 bg-indigo-600 animate-[shimmer_2s_infinite] w-1/3 blur-sm" style={{ transform: 'skewX(-20deg)' }}>
                  <style>{`
                        @keyframes shimmer {
                            0% { left: -50%; }
                            100% { left: 150%; }
                        }
                    `}</style>
                </div>
              ) : (
                <div className="h-full bg-indigo-500 transition-all duration-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: executionStatus === 'success' ? '100%' : '0%' }} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainConsole;
