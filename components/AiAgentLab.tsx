import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Globe,
  Target,
  User,
  Smartphone,
  Loader2,
  Send,
  MessageSquare,
  History,
  Terminal,
  ChevronRight,
  Eye,
  Camera,
  Cpu,
  MousePointer2,
  Keyboard,
  Compass,
  Square
} from 'lucide-react';
import { Persona, Device, Message } from '../types';
import { deviceFarmApi } from '../api/deviceFarm';
import { explorationApi, ExplorationStep } from '../api/exploration';

interface AiAgentLabProps {
  activeProject: any;
  personas: Persona[];
  onHistoryUpdate?: () => void;
}

const AiAgentLab: React.FC<AiAgentLabProps> = ({ activeProject, personas, onHistoryUpdate }) => {
  // --- Config State ---
  const [targetUrl, setTargetUrl] = useState('');
  const [goal, setGoal] = useState('');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [platform, setPlatform] = useState<'WEB' | 'APP'>('WEB');
  const [deviceId, setDeviceId] = useState('');
  const [appPackage, setAppPackage] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);

  // --- Session State ---
  const [phase, setPhase] = useState<'CONFIG' | 'RUNNING' | 'COMPLETED'>('CONFIG');
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // --- Interaction State ---
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [executionSteps, setExecutionSteps] = useState<ExplorationStep[]>([]);

  // --- UI Control ---
  const [showMonitor, setShowMonitor] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    action_type: '',
    action_target: '',
    action_value: '',
    thought: ''
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [executionSteps]);

  useEffect(() => {
    if (platform === 'APP') {
      deviceFarmApi.getDevices().then(setDevices).catch(console.error);
    }
  }, [platform]);

  // --- Actions ---

  const addChatMessage = (role: 'user' | 'assistant', content: string) => {
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      role,
      content
    }]);
  };

  const handleStartLab = async () => {
    if (platform === 'WEB' && (!targetUrl || !goal)) {
      setError("Please provide both Target URL and Goal.");
      return;
    }
    if (platform === 'APP' && !goal) {
      setError("Please provide a Goal for App exploration.");
      return;
    }

    setError(null);
    setPhase('RUNNING');
    setIsRunning(true);
    stopRequestedRef.current = false;
    setExecutionSteps([]);
    setChatMessages([
      { id: '1', role: 'assistant', content: `[시스템] 목표 "${goal}"(으)로 에이전트를 초기화합니다.` },
      { id: '2', role: 'assistant', content: "알겠습니다. 이제 자율 주행을 시작합니다. 우측의 실행 트레이스를 확인해 주세요." }
    ]);

    try {
      const init = await explorationApi.start({
        url: targetUrl,
        platform,
        device_id: deviceId,
        app_package: appPackage,
        capture_screenshots: true // Defaulted to true for Lab
      });
      setSessionId(init.session_id);
      await runAgentLoop(init.session_id, []);
    } catch (e: any) {
      setError(e.message || "Failed to start session.");
      setIsRunning(false);
      setPhase('CONFIG');
    }
  };

  function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
    ]);
  }

  const runAgentLoop = async (sid: string, currentSteps: ExplorationStep[], feedback?: string, overrideNext?: any) => {
    setIsRunning(true);
    stopRequestedRef.current = false;
    try {
      let stepsArray = [...currentSteps];
      let loopComplete = false;
      let loopCount = 0;
      const MAX_LOOPS = 40;

      const persona = personas.find(p => p.id === selectedPersonaId);
      const personaContext = persona ? `Name: ${persona.name}, Traits: ${persona.traits.join(', ')}` : undefined;

      while (!loopComplete && loopCount < MAX_LOOPS) {
        if (stopRequestedRef.current) break;
        setChatMessages(prev => [...prev.filter(m => m.id !== 'searching'), { id: 'searching', role: 'assistant', content: "다음 단계를 생각 중입니다..." }]);

        const stepResult = await withTimeout(explorationApi.step(
          sid,
          goal,
          stepsArray,
          username,
          password,
          loopCount === 0 ? feedback : undefined,
          personaContext,
          loopCount === 0 ? overrideNext : undefined,
          platform,
          true
        ), 60000);

        if (stopRequestedRef.current) break;

        stepsArray = [...stepsArray, stepResult];
        setExecutionSteps(stepsArray);

        // Add thought to chat
        setChatMessages(prev => [
          ...prev.filter(m => m.id !== 'searching'),
          {
            id: `thought-${loopCount}-${Date.now()}`,
            role: 'assistant',
            content: `**Step ${stepResult.step_number}**: ${stepResult.thought}`
          }
        ]);

        if (stepResult.status === 'Completed' || stepResult.status === 'Failed' || stepResult.action_type === 'finish') {
          loopComplete = true;
          setPhase('COMPLETED');
          addChatMessage('assistant', stepResult.status === 'Completed' ? "목표에 도달했습니다! 작업을 완료했습니다." : "문제가 발생하여 더 이상 진행할 수 없습니다.");
        }
        loopCount++;
      }
    } catch (e: any) {
      const errorMsg = e.message === 'TIMEOUT' 
        ? "[오류] 에이전트 응답이 60초 이상 지연되어 중단되었습니다. 네트워크 상태를 확인하시거나 탐색을 다시 시작해 주세요."
        : `[오류] 탐색 루프 중 문제가 발생했습니다: ${e.message || "알 수 없는 오류"}`;
      setError(errorMsg);
      addChatMessage('assistant', errorMsg);
      setPhase('COMPLETED');
    } finally {
      setIsRunning(false);
      setChatMessages(prev => prev.filter(m => m.id !== 'searching'));
    }
  };

  const handleUserInstruction = async () => {
    if (!userInput.trim() || !sessionId || isRunning) return;

    const instruction = userInput.trim();
    setUserInput('');
    addChatMessage('user', instruction);

    setPhase('RUNNING');
    await runAgentLoop(sessionId, executionSteps, instruction);
  };

  const handleStopLab = async () => {
    if (!sessionId) return;
    stopRequestedRef.current = true;
    setIsRunning(false);
    try {
      await explorationApi.stop(sessionId, platform);
      addChatMessage('assistant', "[시스템] 사용자에 의해 탐색이 중지되었습니다.");
    } catch (e) {
      console.error("Stop failed", e);
    }
  };

  const handleDeleteStep = (idx: number) => {
    const nextSteps = [...executionSteps];
    nextSteps.splice(idx, 1);
    setExecutionSteps(nextSteps);
  };

  const handleApplyEdit = async (idx: number) => {
    if (!sessionId) return;
    const prevSteps = executionSteps.slice(0, idx);
    setExecutionSteps(prevSteps);
    setEditingStepIndex(null);
    setPhase('RUNNING');

    await runAgentLoop(sessionId, prevSteps, undefined, {
      action_type: editForm.action_type,
      action_target: editForm.action_target,
      action_value: editForm.action_value,
      thought: editForm.thought
    });
  };

  const handleSaveAsset = async () => {
    if (!sessionId) return;
    setIsRunning(true);
    try {
      const pName = personas.find(p => p.id === selectedPersonaId)?.name || 'AI Agent';
      await explorationApi.save({
        session_id: sessionId,
        project_id: activeProject.id,
        url: platform === 'APP' ? appPackage : targetUrl,
        goal,
        history: executionSteps,
        final_status: executionSteps.some(s => s.status === 'Failed') ? 'failed' : 'passed',
        persona_id: selectedPersonaId || undefined,
        persona_name: pName,
        platform,
        capture_screenshots: true
      });
      setIsSaved(true);
      if (onHistoryUpdate) onHistoryUpdate();
      addChatMessage('assistant', "성공! 이 탐색 결과가 레포지토리에 골든 에셋으로 등록되었습니다.");
    } catch (err) {
      setError("Failed to register asset.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setPhase('CONFIG');
    setExecutionSteps([]);
    setChatMessages([]);
    setGoal('');
    setTargetUrl('');
    setIsSaved(false);
    setError(null);
  };

  // --- Render Helpers ---

  if (phase === 'CONFIG') {
    return (
      <div className="h-full bg-gray-50/50 dark:bg-[#0c0e12] p-8 overflow-y-auto custom-scrollbar flex items-center justify-center">
        <div className="w-full max-w-5xl space-y-8 animate-in fade-in zoom-in-95 duration-1000">

          {/* Minimal Status Bar */}
          <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-indigo-600 rounded-lg">
                <Compass className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">AI Agent Lab</span>
                <span className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest transition-colors tracking-[0.2em]">Initialization Ready</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> System Online</span>
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Neural Link Active</span>
            </div>
          </div>

          <div className="bg-white/40 dark:bg-[#16191f]/40 backdrop-blur-xl border border-gray-200 dark:border-gray-800/50 rounded-[3rem] p-12 shadow-2xl space-y-12 transition-all">
            {/* Unified Command Input (Large Goal) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] flex items-center gap-2">
                  <Target className="w-3.5 h-3.5" /> Set Primary Mission
                </label>
                <span className="text-[9px] text-gray-400 font-bold uppercase italic">Agent will focus all resources on this anchor</span>
              </div>
              <div className="relative group">
                <div className="absolute inset-0 bg-indigo-500/5 blur-2xl group-focus-within:bg-indigo-500/10 transition-all rounded-3xl" />
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Type your mission goal here... (e.g., 'Go to Amazon, search for M3 MacBook Pro, and add the cheapest one to cart')"
                  className="relative w-full bg-white/80 dark:bg-[#0c0e12]/80 border-2 border-transparent focus:border-indigo-500/50 rounded-[2rem] p-8 text-xl font-medium placeholder:text-gray-300 dark:placeholder:text-gray-700 outline-none transition-all h-40 resize-none shadow-inner leading-relaxed text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Discrete System Matrix (Sub Configs) */}
            <div className="grid grid-cols-4 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Target Engine</label>
                <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10">
                  <button
                    className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-2 ${platform === 'WEB' ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-md' : 'text-gray-400'}`}
                    onClick={() => setPlatform('WEB')}
                  >
                    <Globe className="w-3.5 h-3.5" /> WEB
                  </button>
                  <button
                    className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-2 ${platform === 'APP' ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-md' : 'text-gray-400'}`}
                    onClick={() => setPlatform('APP')}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> APP
                  </button>
                </div>
              </div>

              <div className="col-span-2 space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">{platform === 'WEB' ? 'Starting URL' : 'App Identifier'}</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400">
                    {platform === 'WEB' ? <Globe className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                  </div>
                  <input
                    type="text"
                    value={platform === 'WEB' ? targetUrl : appPackage}
                    onChange={(e) => platform === 'WEB' ? setTargetUrl(e.target.value) : setAppPackage(e.target.value)}
                    placeholder={platform === 'WEB' ? "https://test.example.com" : "com.package.id"}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-xs dark:text-white outline-none focus:border-indigo-500/50 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Agent Persona</label>
                <select
                  value={selectedPersonaId}
                  onChange={(e) => setSelectedPersonaId(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-2.5 px-3 text-[10px] font-bold dark:text-white outline-none focus:border-indigo-500/50 cursor-pointer appearance-none"
                >
                  <option value="">Default AI Explorer</option>
                  {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-8 pt-2">
              <div className="flex-1 flex gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block pl-1">Credential: ID</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-transparent border-b border-gray-200 dark:border-white/10 py-1.5 px-1 text-xs dark:text-white outline-none focus:border-indigo-500 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-700"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block pl-1">Credential: PW</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-transparent border-b border-gray-200 dark:border-white/10 py-1.5 px-1 text-xs dark:text-white outline-none focus:border-indigo-500 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-700"
                  />
                </div>
              </div>

              <div className="w-[300px] pt-4">
                {error && (
                  <div className="mb-4 text-red-500 text-[10px] font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" /> {error}
                  </div>
                )}
                <button
                  onClick={handleStartLab}
                  disabled={isRunning}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black text-[11px] tracking-[0.2em] uppercase transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  Launch Mission
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // INTERACTIVE LAB UI (40/60 Split)
  return (
    <div className="h-full flex flex-col bg-gray-50/50 dark:bg-[#0c0e12] overflow-hidden">

      {/* Dynamic Header */}
      <div className="px-8 py-5 bg-white dark:bg-[#16191f] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between z-20 shadow-sm transition-colors">
        <div className="flex items-center gap-5">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Active Lab Session</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white line-clamp-1 max-w-xl transition-colors">
              Goal: <span className="text-gray-500 dark:text-gray-400 font-bold ml-1 italic">{goal}</span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isRunning && phase === 'RUNNING' && (
            <button
              onClick={handleStopLab}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-600/20 transition-all active:scale-[0.98] animate-in slide-in-from-right-2"
            >
              <Square className="w-4 h-4 fill-current" /> Stop Mission
            </button>
          )}
          {phase === 'COMPLETED' && (
            <button
              onClick={handleSaveAsset}
              disabled={isRunning || isSaved}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${isSaved ? 'bg-emerald-500 text-white shadow-lg' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 shadow-lg'}`}
            >
              {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              {isSaved ? 'Asset Saved' : 'Save as Asset'}
            </button>
          )}
          <button
            onClick={handleReset}
            className="p-2.5 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-indigo-500 rounded-xl transition-all"
            title="Reset Lab"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Split Content */}
      <div className="flex-1 flex overflow-hidden border-t border-gray-100 dark:border-gray-800">

        {/* LEFT: Command Center (40%) */}
        <div className="w-[40%] flex flex-col bg-[#f8fafc] dark:bg-[#0c0e12] transition-colors relative shadow-[10px_0_15px_-5px_rgba(0,0,0,0.05)] z-10 border-r border-gray-200 dark:border-white/5">
          <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50 dark:bg-white/5 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              <span className="text-[10px] font-black text-gray-500 dark:text-gray-300 uppercase tracking-widest">Comm Link</span>
            </div>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-white dark:bg-[#16191f] text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-800 rounded-tl-none'
                  }`}>
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">
                    {msg.role === 'assistant' ? 'Agent AI' : 'Commander'}
                  </div>
                  <div className="text-sm leading-relaxed font-medium">
                    {msg.content.includes("**Step") ? (
                      <div className="space-y-2">
                        {msg.content.split(':').map((p, i) => i === 0 ? <div key={i} className="text-indigo-500 font-black">{p}</div> : <div key={i}>{p}</div>)}
                      </div>
                    ) : msg.content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-6 bg-gray-50/80 dark:bg-[#0c0e12] border-t border-gray-200 dark:border-gray-800 transition-colors">
            <div className="relative group">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUserInstruction()}
                disabled={isRunning}
                placeholder={isRunning ? "에이전트가 처리 중입니다..." : "추가 지시사항이나 목표를 조정하세요..."}
                className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-700 rounded-2xl py-4 pl-5 pr-14 text-sm outline-none focus:border-indigo-500 transition-all disabled:opacity-50 shadow-sm"
              />
              <button
                onClick={handleUserInstruction}
                disabled={!userInput.trim() || isRunning}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-30 shadow-lg shadow-indigo-600/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[9px] text-gray-400 mt-3 flex items-center gap-1.5 px-1 font-bold">
              <Eye className="w-3 h-3 text-indigo-400" /> 에이전트가 사용자의 피드백을 실시간으로 분석하여 다음 단계에 반영합니다.
            </p>
          </div>
        </div>

        {/* RIGHT: Agentic Trace (60%) */}
        <div className="w-[60%] flex flex-col bg-white dark:bg-[#111318] transition-colors relative">

          {/* Main Visual Monitor (Optional) */}
          {showMonitor && (
            <div className="p-6 pb-0 shrink-0 h-[45%] animate-in slide-in-from-top duration-300">
              <div className="w-full h-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-white/5 rounded-3xl overflow-hidden shadow-xl relative group transition-colors">
                <div className="absolute top-4 left-4 z-10 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-[9px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2 border border-white/10">
                  <Camera className="w-3 h-3 text-emerald-400" /> Live Execution View
                </div>
                {executionSteps.length > 0 && (
                  <div className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-indigo-600 rounded-lg text-xs font-black text-white shadow-lg">
                    Step {executionSteps[executionSteps.length - 1].step_number}
                  </div>
                )}
                <img
                  src={executionSteps.length > 0 && executionSteps[executionSteps.length - 1].screenshot ? `data:image/jpeg;base64,${executionSteps[executionSteps.length - 1].screenshot}` : 'https://placehold.co/800x600/16191f/374151?text=Awaiting+Visual...'}
                  alt="Agent View"
                  className="w-full h-full object-contain bg-gray-100 dark:bg-black transition-all duration-500"
                />
                {executionSteps.length > 0 && (
                  <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent pt-20">
                    <p className="text-white text-sm font-bold drop-shadow-md">
                      {executionSteps[executionSteps.length - 1].description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline Scroll */}
          <div className="flex-1 overflow-y-auto p-8 pt-6 custom-scrollbar bg-white/20 dark:bg-black/10 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-8 border-b border-gray-200 dark:border-white/5 pb-4">
              <Terminal className="w-5 h-5 text-indigo-500" />
              <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">Agentic Execution Trace</h3>
              <button
                onClick={() => setShowMonitor(!showMonitor)}
                className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${showMonitor ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-indigo-500'}`}
              >
                <Camera className="w-3.5 h-3.5" /> {showMonitor ? 'Hide View' : 'Live View'}
              </button>
              {isRunning && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
            </div>

            {executionSteps.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center opacity-20 dark:opacity-10 grayscale">
                <Terminal className="w-16 h-16 mb-4" />
                <p className="text-xs font-black uppercase tracking-widest">Awaiting initialization...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {executionSteps.map((step, idx) => (
                  <div key={idx} className="relative pl-10 border-l-2 border-indigo-100 dark:border-indigo-900/30 last:border-transparent pb-8 transition-colors">
                    <div className={`absolute -left-[11px] top-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${step.status === 'Completed' ? 'bg-emerald-500 border-emerald-950 text-white' :
                      step.status === 'Failed' ? 'bg-red-500 border-red-950 text-white' :
                        'bg-indigo-600 border-indigo-950 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]'
                      }`}>
                      {step.status === 'Completed' ? <CheckCircle2 className="w-3 h-3" /> : step.step_number}
                    </div>

                    <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[1.5rem] p-6 shadow-sm group hover:border-indigo-500/50 transition-all duration-300">
                      <div className="flex items-start justify-between mb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <div className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5 transition-colors">
                              {step.action_type === 'click' ? <MousePointer2 className="w-2.5 h-2.5" /> :
                                step.action_type === 'type' ? <Keyboard className="w-2.5 h-2.5" /> :
                                  <Globe className="w-2.5 h-2.5" />}
                              {step.action_type}
                            </div>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${step.matching_score >= 80 ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                              'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                              }`}>Score: {step.matching_score ?? 0}</span>
                          </div>
                          <h4 className="text-sm font-black text-gray-900 dark:text-white transition-colors">{step.description}</h4>
                        </div>

                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingStepIndex(idx);
                              setEditForm({
                                action_type: step.action_type,
                                action_target: step.action_target,
                                action_value: step.action_value || '',
                                thought: step.thought
                              });
                            }}
                            className="p-2 bg-gray-50 dark:bg-gray-800 hover:text-indigo-500 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <Eye className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteStep(idx)}
                            className="p-2 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-lg transition-all"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {editingStepIndex === idx ? (
                        <div className="mt-4 p-5 bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl space-y-4 animate-in zoom-in-95">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1.5">Action Type</label>
                              <select
                                value={editForm.action_type}
                                onChange={e => setEditForm({ ...editForm, action_type: e.target.value })}
                                className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 cursor-pointer"
                              >
                                <option value="click">Click</option>
                                <option value="type">Type</option>
                                <option value="navigate">Navigate</option>
                                <option value="wait">Wait</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1.5">Selector/Target</label>
                              <input
                                type="text"
                                value={editForm.action_target}
                                onChange={e => setEditForm({ ...editForm, action_target: e.target.value })}
                                className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => handleApplyEdit(idx)}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                          >
                            Apply Changes & Retry from Here
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="p-3 bg-gray-50/50 dark:bg-[#0c0e12] border border-gray-100 dark:border-gray-800 rounded-xl transition-colors">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Observation</span>
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium italic transition-colors">"{step.observation || 'No direct observation recorded.'}"</p>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-gray-400 font-bold uppercase transition-colors">
                            <span className="flex items-center gap-1.5"><Globe className="w-3 h-3 text-indigo-400" /> {step.action_target?.slice(0, 30)}...</span>
                            {step.action_value && <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400"><Keyboard className="w-3 h-3" /> {step.action_value.includes("password") ? "****" : step.action_value}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiAgentLab;
