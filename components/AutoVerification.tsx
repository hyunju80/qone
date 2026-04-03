import React, { useState, useEffect } from 'react';
import {
    Play, RotateCcw, CheckCircle2, AlertCircle, Bot, Target,
    ChevronRight, Save, Activity, Globe, Smartphone, ShieldCheck,
    Search, ListChecks, ArrowRight, Loader2, Sparkles, Tablet, Square, XCircle,
    User, Lock, ChevronDown, Filter, Database, AlignLeft, CheckSquare
} from 'lucide-react';
import { Project, Persona, Scenario, TestScript, TestCase, ScriptOrigin } from '../types';
import { scenariosApi } from '../api/scenarios';
import { explorationApi, ExplorationStep } from '../api/exploration';
import { testApi } from '../api/test';

interface AutoVerificationProps {
    activeProject: Project;
    personas: Persona[];
    onRegisterAsset: (script: TestScript) => void;
    selectedScenarioId?: string | null;
    onClearScenarioId?: () => void;
    initialCategory?: string | null;
    onClearCategory?: () => void;
}

const AutoVerification: React.FC<AutoVerificationProps> = ({
    activeProject,
    personas,
    onRegisterAsset,
    selectedScenarioId: propScenarioId,
    onClearScenarioId,
    initialCategory,
    onClearCategory
}) => {
    // --- List State ---
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
    const [expandedScenarioId, setExpandedScenarioId] = useState<string | null>(null);
    const [listSearch, setListSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

    // --- Exploration State ---
    const [isRunning, setIsRunning] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [steps, setSteps] = useState<ExplorationStep[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);

    // --- Config State ---
    const [platform, setPlatform] = useState<'WEB' | 'APP'>('WEB');
    const [targetUrl, setTargetUrl] = useState(''); // Shared target
    const [selectedPersonaId, setSelectedPersonaId] = useState<string>(personas[0]?.id || '');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const selectedScenario = scenarios.find(s => s.id === selectedScenarioId);

    useEffect(() => {
        fetchScenarios();
    }, [activeProject.id]);

    // Handle Deep-Linked Scenario selection
    useEffect(() => {
        if (propScenarioId && scenarios.length > 0) {
            const found = scenarios.find(s => s.id === propScenarioId);
            if (found) {
                setSelectedScenarioId(propScenarioId);
                setExpandedScenarioId(propScenarioId);
                // Important: Clear the ID in App state after consuming it 
                // so it doesn't keep switching back if the user changes scenarios manually
                if (onClearScenarioId) {
                    onClearScenarioId();
                }
            }
        }
    }, [propScenarioId, scenarios.length]);

    // Handle Deep-Linked Category selection
    useEffect(() => {
        if (initialCategory && initialCategory !== 'ALL') {
            setSelectedCategory(initialCategory);
            if (onClearCategory) {
                onClearCategory();
            }
        }
    }, [initialCategory]);

    // Update local state when a scenario is selected to auto-populate platform/target
    useEffect(() => {
        if (selectedScenario) {
            setPlatform((selectedScenario.platform as 'WEB' | 'APP') || 'WEB');
            setTargetUrl(selectedScenario.target || '');
            setSelectedPersonaId(selectedScenario.personaId || personas[0]?.id || '');
            // Update credentials if they belong to the scenario's default or just reset
            setUsername('');
            setPassword('');
        } else {
            // Reset when nothing selected
            setTargetUrl('');
            setPlatform('WEB');
        }
    }, [selectedScenarioId, selectedScenario]);

    const fetchScenarios = async () => {
        setLoadingList(true);
        try {
            // Fetch all scenarios and filter for those ready for verification (approved but no asset yet)
            const data = await scenariosApi.getAll(activeProject.id, true);
            // Only show scenarios that don't have a golden script yet
            setScenarios(data.filter((s: Scenario) => !s.goldenScriptId));
        } catch (err) {
            console.error("Failed to fetch scenarios", err);
        } finally {
            setLoadingList(false);
        }
    };

    const uniqueCategories = Array.from(new Set(scenarios.map(s => s.category).filter(Boolean))) as string[];

    const filteredScenarios = scenarios.filter(s => {
        const matchesSearch = s.title.toLowerCase().includes(listSearch.toLowerCase()) ||
            s.description?.toLowerCase().includes(listSearch.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || s.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const runVerificationLoop = async (currentSessionId: string, initialSteps: ExplorationStep[] = []) => {
        if (!selectedScenario) return;
        setIsRunning(true);
        setError(null);
        setIsComplete(false);

        try {
            let currentSteps: ExplorationStep[] = [...initialSteps];
            let loopComplete = false;
            let loopCount = 0;
            const MAX_LOOPS = 40;

            const persona = personas.find(p => p.id === selectedPersonaId);
            const personaContext = persona ? `Name: ${persona.name}, Goal: ${persona.behavioral_goal} ` : undefined;

            // Construct a very specific goal based on scenario steps
            const scenarioGoal = `
        다음 시나리오를 충실히 따라서 테스트를 완료하세요:
        시나리오 명: ${selectedScenario.title}
설명: ${selectedScenario.description}

[수행 단계]
        ${(selectedScenario.testCases || []).map((tc, idx) => `${idx + 1}. ${tc.title}: ${(tc.steps || []).join(', ')}`).join('\n')}
        
        가장 중요한 목표는 시나리오에 기술된 흐름대로 실제 UI에서 성공적으로 동작하는지 검증하고,
    동작이 완료되면 'finish' 액션으로 종료하는 것입니다.
      `;

            while (!loopComplete && loopCount < MAX_LOOPS) {
                const stepResult = await explorationApi.step(currentSessionId, scenarioGoal, currentSteps, username, password, undefined, personaContext, undefined, platform, true);

                currentSteps = [...currentSteps, stepResult];
                setSteps(currentSteps);

                if (stepResult.status === 'Completed' || stepResult.status === 'Failed' || stepResult.action_type === 'finish') {
                    loopComplete = true;
                    setIsComplete(true);
                }

                // Check if user requested to stop via global flag
                if ((window as any).stopVerificationRequested) {
                    loopComplete = true;
                }

                loopCount++;
            }
        } catch (e: any) {
            console.error("Verification failed", e);
            setError(e.response?.data?.detail || "실행 중 오류가 발생했습니다.");
        } finally {
            setIsRunning(false);
        }
    };

    const startVerification = async () => {
        if (!selectedScenario) return;
        setSteps([]);
        setSessionId(null);
        setIsComplete(false);
        setError(null);
        setIsRunning(true);
        setIsStopping(false);
        (window as any).stopVerificationRequested = false;

        try {
            const init = await explorationApi.start({
                url: platform === 'WEB' ? (targetUrl || "http://example.com") : undefined, // Fallback
                app_package: platform === 'APP' ? targetUrl : undefined,
                platform,
                capture_screenshots: true
            });
            setSessionId(init.session_id);

            const initialStep: ExplorationStep = {
                step_number: 1,
                action_type: platform === 'WEB' ? 'navigate' : 'open_app',
                action_target: targetUrl || "http://example.com",
                action_value: '',
                thought: platform === 'WEB' ? `Navigating to target URL: ${targetUrl || 'http://example.com'} ` : `Launching App Package: ${targetUrl} `,
                description: `Initialize testing environment`,
                status: 'Completed',
                matching_score: 100,
                score_breakdown: { Goal_Alignment: 100, Page_Relevance: 100, Action_Confidence: 100 }
            };
            setSteps([initialStep]);

            await runVerificationLoop(init.session_id, [initialStep]);
        } catch (e) {
            console.error("Failed to start session", e);
            setError("세션 시작에 실패했습니다.");
            setIsRunning(false);
        }
    };

    const stopVerification = async () => {
        if (!sessionId) return;
        setIsStopping(true);
        (window as any).stopVerificationRequested = true;
        try {
            await explorationApi.stop(sessionId, platform);
        } catch (e) {
            console.error("Failed to stop session", e);
        } finally {
            setIsStopping(false);
            setIsRunning(false);
        }
    };

    const handleSaveAsAsset = async () => {
        if (!selectedScenario || steps.length === 0) return;

        const finalStatus = steps.some(s => s.status === 'Failed') ? 'failed' : 'passed';
        const personaName = personas.find(p => p.id === selectedPersonaId)?.name || "AI Agent";

        try {
            // Use UNIFIED backend saving logic (same as AI Exploration)
            await explorationApi.save({
                session_id: sessionId || `auto_${Date.now()}`,
                project_id: activeProject.id,
                url: platform === 'APP' ? targetUrl : targetUrl, // Consistent field
                goal: selectedScenario.title,
                scenario_id: selectedScenario.id, // Linking to existing scenario
                persona_id: selectedPersonaId,
                persona_name: personaName,
                history: steps,
                final_status: finalStatus,
                platform,
                capture_screenshots: true
            });

            onRegisterAsset({ id: 'reloading' } as any); // Trigger parent reload
            fetchScenarios(); // Refresh list
            setSelectedScenarioId(null);
            setSteps([]);
            setIsComplete(false);
        } catch (e) {
            console.error("Failed to save asset", e);
            alert("자산 저장에 실패했습니다.");
        }
    };

    return (
        <div className="flex h-full w-full gap-8 p-8 overflow-hidden bg-gray-50 dark:bg-[#0c0e12]">
            {/* 1. Left Panel: Ready to Verify Queue */}
            <div className="w-[550px] flex flex-col shrink-0 overflow-y-auto custom-scrollbar pr-2 pb-2 transition-all">
                <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl flex flex-col shadow-sm overflow-hidden mb-8 shrink-0">
                    <div className="px-8 py-7 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
                                <ListChecks className="w-6 h-6 text-indigo-500" />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-[13px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-[0.15em] leading-tight">
                                    Ready to Verify
                                </h2>
                                <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight">
                                    Queue: {filteredScenarios.length} Scenarios
                                </p>
                            </div>
                        </div>
                        <button onClick={fetchScenarios} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 transition-colors"><RotateCcw className="w-4 h-4" /></button>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                value={listSearch}
                                onChange={e => setListSearch(e.target.value)}
                                placeholder="Search prototypes..."
                                className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-xl py-3 pl-11 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                            />
                        </div>

                        {uniqueCategories.length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
                                <button onClick={() => setSelectedCategory('ALL')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedCategory === 'ALL' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'} `}>ALL</button>
                                {uniqueCategories.map(cat => (
                                    <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'} `}>
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="px-4 py-2 flex items-center justify-between shrink-0">
                    <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Database className="w-3 h-3" /> Scenario Repository
                    </h3>
                    <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full uppercase tracking-widest">{filteredScenarios.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                    {loadingList ? (
                        <div className="py-20 flex flex-col items-center opacity-40 animate-pulse">
                            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                            <p className="text-[11px] font-black uppercase tracking-widest">Hydrating Queue...</p>
                        </div>
                    ) : filteredScenarios.length === 0 ? (
                        <div className="py-20 flex flex-col items-center text-center opacity-30">
                            <ShieldCheck className="w-20 h-20 mb-6 text-gray-300" />
                            <p className="text-xs font-black uppercase tracking-[0.2em]">Queue Empty</p>
                        </div>
                    ) : (
                        filteredScenarios.map(s => {
                            const isExpanded = expandedScenarioId === s.id;
                            const isSelected = selectedScenarioId === s.id;
                            return (
                                <div key={s.id} className={`bg-white dark:bg-[#16191f] border transition-all duration-500 rounded-3xl overflow-hidden ${isSelected ? 'border-indigo-400 shadow-xl ring-2 ring-indigo-500/10' : 'border-gray-200 dark:border-gray-800 shadow-sm hover:border-indigo-300'} `}>
                                    <div
                                        onClick={() => {
                                            setExpandedScenarioId(isExpanded ? null : s.id);
                                            setSelectedScenarioId(s.id);
                                        }}
                                        className={`p-6 px-8 cursor-pointer flex items-center justify-between transition-all ${isExpanded ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800/50' : 'hover:bg-gray-50/50 dark:hover:bg-white/5'} `}
                                    >
                                        <div className="flex items-center gap-6 flex-1 min-w-0">
                                            <div className={`p-2.5 rounded-2xl transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-110' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:bg-indigo-50'}`}>
                                                <Target className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    {s.category && <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[8px] font-black rounded uppercase tracking-wider">{s.category}</span>}
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{(s.testCases || s.test_cases || []).length} Nodes</span>
                                                </div>
                                                <h3 className={`font-black uppercase tracking-tight transition-all ${isExpanded ? 'text-sm text-gray-900 dark:text-white' : 'text-[13px] text-gray-700 dark:text-gray-300 truncate'} `}>{s.title}</h3>
                                                {isExpanded && <p className="text-[10px] text-gray-500 font-bold tracking-tight leading-relaxed">{s.description}</p>}
                                            </div>
                                        </div>
                                        <ChevronDown className={`w-5 h-5 text-indigo-500 transition-all duration-500 ${isExpanded ? 'rotate-180 scale-125' : 'opacity-40'} `} />
                                    </div>

                                    {isExpanded && (
                                        <div className="p-8 space-y-6 bg-white dark:bg-[#111318] animate-in slide-in-from-top-2 duration-300">
                                            {(s.testCases || s.test_cases || []).map((tc, tcIdx) => (
                                                <div key={tc.id || tcIdx} className="bg-gray-50/30 dark:bg-white/5 border border-gray-100 dark:border-gray-800/50 rounded-2xl p-6 relative group/node hover:border-indigo-300 transition-all">
                                                    <div className="absolute top-8 left-0 w-1 h-3/4 bg-indigo-500/20 group-hover:bg-indigo-500 rounded-r-full transition-colors" />
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-black flex items-center justify-center text-[10px] shadow-sm">{tcIdx + 1}</span>
                                                        <span className="font-black text-xs text-gray-800 dark:text-gray-200 uppercase tracking-wide">{tc.title}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-6 pl-2">
                                                        <div className="space-y-2">
                                                            <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-1.5 ml-1"><Filter className="w-3 h-3" /> Pre-condition</label>
                                                            <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 bg-white dark:bg-black/20 p-3 rounded-xl border border-gray-100 dark:border-gray-800 leading-relaxed shadow-sm min-h-[60px]">{tc.preCondition || '-'}</div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-1.5 ml-1"><Database className="w-3 h-3" /> Input Data</label>
                                                            <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-black/20 p-3 rounded-xl border border-gray-100 dark:border-gray-800 font-mono shadow-sm min-h-[60px] truncate">{tc.inputData || 'N/A'}</div>
                                                        </div>
                                                        <div className="col-span-2 space-y-3">
                                                            <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 ml-1"><AlignLeft className="w-3 h-3" /> Steps</label>
                                                            <div className="space-y-2.5 pl-1">
                                                                {(tc.steps || []).map((step, sIdx) => (
                                                                    <div key={sIdx} className="flex gap-3 items-start group/step">
                                                                        <span className="text-[10px] font-black text-indigo-400 tabular-nums shrink-0 pt-0.5">{sIdx + 1}.</span>
                                                                        <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 leading-tight">{step}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="col-span-2 space-y-2">
                                                            <label className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest flex items-center gap-2 ml-1"><CheckCircle2 className="w-3 h-3" /> Expected Result</label>
                                                            <div className="bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-4 text-[11px] font-bold text-emerald-800 dark:text-emerald-400 italic shadow-sm leading-relaxed">"{tc.expectedResult}"</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* 2. Right Panel: Verification Console */}
            <div className="flex-1 flex flex-col overflow-hidden transition-all h-full">
                <div className="bg-white dark:bg-[#111318] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 flex flex-col shadow-sm overflow-hidden h-full">
                    {selectedScenario ? (
                        <div className="flex flex-col h-full animate-in fade-in transition-colors">
                            {/* Unified Console Header */}
                            <div className="flex items-center justify-between shrink-0 mb-8 border-b border-gray-100 dark:border-gray-800 pb-8">
                                <div className="flex items-center gap-5">
                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl shadow-sm ring-1 ring-indigo-500/20 animate-pulse">
                                        <Activity className="w-8 h-8 text-indigo-600" />
                                    </div>
                                    <div className="flex flex-col">
                                        <h2 className="text-[16px] font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight flex items-center gap-3">
                                            Autonomous Verification
                                            <div className={`h-[24px] px-3 rounded-full text-[9px] font-black uppercase flex items-center gap-2 border transition-all ${isRunning ? 'bg-amber-100 border-amber-200 text-amber-600' : isComplete ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-gray-100 border-gray-200 text-gray-500'} `}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-amber-500 animate-pulse' : isComplete ? 'bg-emerald-500' : 'bg-gray-400'} `} />
                                                {isRunning ? 'Running' : isComplete ? 'Finished' : 'Standby'}
                                            </div>
                                        </h2>
                                        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-0.5">
                                            Engine: AI-Driven Auto Exploration
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {isRunning ? (
                                        <button
                                            onClick={stopVerification}
                                            disabled={isStopping}
                                            className="px-8 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-3 shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200"
                                        >
                                            <Square className="w-4 h-4 fill-current" /> Stop Verification
                                        </button>
                                    ) : isComplete ? (
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => { setIsComplete(false); setSteps([]); }}
                                                className="px-6 py-3.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-600 text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-3 transition-all duration-200 shadow-sm hover:shadow-md"
                                            >
                                                <RotateCcw className="w-4 h-4" /> RE-VERIFY
                                            </button>
                                            <button
                                                onClick={handleSaveAsAsset}
                                                className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-3 shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200"
                                            >
                                                <Save className="w-4 h-4" /> Save as Asset
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={startVerification}
                                            className="px-10 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-3 shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 animate-in zoom-in-95"
                                        >
                                            <Play className="w-5 h-5 fill-current ml-1" /> Start Auto-Verify
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Configuration Bar */}
                            <div className="grid grid-cols-3 gap-6 mb-8 p-6 bg-gray-50/50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-gray-800/50 shrink-0">
                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Globe className="w-3 h-3 text-indigo-400" /> Target {platform === 'WEB' ? 'URL' : 'App ID'}</label>
                                    <input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder={platform === 'WEB' ? "https://example.com" : "com.example.app"} className="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-xs font-bold font-mono outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2"><User className="w-3 h-3" /> Credentials</label>
                                    <div className="flex gap-2">
                                        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="User" className="w-1/2 bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-3 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Pass" className="w-1/2 bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-3 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                                    </div>
                                </div>
                            </div>

                            {/* Execution Log */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-2">
                                <div className="flex items-center gap-3 mb-6 transition-colors">
                                    <AlignLeft className="w-4 h-4 text-emerald-500" />
                                    <span className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Execution Log Trace</span>
                                </div>

                                {steps.length === 0 && !isRunning && (
                                    <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 bg-gray-50/30 dark:bg-black/10 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800 transition-all">
                                        <Sparkles className="w-20 h-20 mb-4 opacity-10" />
                                        <p className="text-xs font-black uppercase tracking-[0.3em] opacity-40 italic">Ready to execute autonomous verification</p>
                                    </div>
                                )}

                                {error && (
                                    <div className="p-5 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl flex items-center gap-4 text-red-600 mb-8 animate-in shake transition-all">
                                        <AlertCircle className="w-6 h-6" />
                                        <span className="text-xs font-black uppercase tracking-tight">{error}</span>
                                    </div>
                                )}

                                {isComplete && steps.length > 0 && (
                                    <div className={`p-8 rounded-3xl border-2 mb-10 transition-all animate-in zoom-in-95 duration-500 ${steps[steps.length - 1]?.status === 'Failed' ? 'bg-red-50 dark:bg-red-500/5 border-red-100/50' : 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100/50'} `}>
                                        <div className="flex items-center gap-6">
                                            <div className={`p-4 rounded-2xl shadow-sm ${steps[steps.length - 1]?.status === 'Failed' ? 'bg-white text-red-600' : 'bg-white text-emerald-600'} `}>
                                                {steps[steps.length - 1]?.status === 'Failed' ? <XCircle className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] mb-1 ${steps[steps.length - 1]?.status === 'Failed' ? 'text-red-700' : 'text-emerald-700'} `}>FINAL STATUS: {steps[steps.length - 1]?.status === 'Failed' ? 'FAILED' : 'PASSED'}</h3>
                                                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-tight">Verification complete with {steps.length} successful actions.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-10 pl-6 border-l-2 border-gray-100 dark:border-gray-800/50 ml-4 relative">
                                    {steps.map((step, idx) => (
                                        <div key={idx} className="relative transition-all animate-in slide-in-from-left-4 duration-500">
                                            <div className={`absolute -left-[35px] top-6 w-5 h-5 rounded-full border-[3px] shadow-sm z-10 transition-all ${step.status === 'Completed' ? 'bg-emerald-500 border-white dark:border-[#111318]' : step.status === 'Failed' ? 'bg-red-500 border-white dark:border-[#111318]' : 'bg-indigo-500 border-white dark:border-[#111318]'} `} />
                                            <div className="bg-white dark:bg-[#0c0e12] border border-gray-100 dark:border-gray-800/80 rounded-3xl p-8 shadow-sm hover:shadow-md transition-all">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.25em]">STEP {step.step_number || idx + 1}</span>
                                                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${step.matching_score >= 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'} `}>Score: {step.matching_score ?? 0}%</div>
                                                    </div>
                                                    <div className="text-[9px] font-black uppercase text-gray-400 bg-gray-50 dark:bg-white/5 p-2 rounded-xl border border-gray-100 dark:border-gray-800">{step.action_type}</div>
                                                </div>
                                                <h4 className="text-[17px] font-black text-gray-900 dark:text-white mb-4 leading-tight uppercase tracking-tight">{step.description}</h4>
                                                <div className="grid grid-cols-2 gap-6 mb-6">
                                                    <div className="p-4 bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800/30">
                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2"><AlignLeft className="w-3 h-3" /> Execution Context</span>
                                                        <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 italic leading-relaxed">"{step.thought}"</p>
                                                    </div>
                                                    <div className="p-4 bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800/30 overflow-hidden">
                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2"><Target className="w-3 h-3" /> Target Element</span>
                                                        <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 truncate">{step.action_target || 'Global Context'}</p>
                                                    </div>
                                                </div>
                                                {step.observation && (
                                                    <div className={`p-5 rounded-2xl border-l-4 ${step.status === 'Failed' ? 'bg-red-50/30 border-red-500 text-red-800' : 'bg-emerald-50/30 border-emerald-500 text-emerald-800'} animate-in slide-in-from-top-2`}>
                                                        <span className="text-[9px] font-black uppercase tracking-widest block mb-2 opacity-60">Observation Result</span>
                                                        <p className="text-xs font-bold leading-relaxed">{step.observation}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {isRunning && (
                                        <div className="py-20 flex flex-col items-center gap-6 animate-pulse">
                                            <div className="relative">
                                                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                                                <Bot className="w-5 h-5 text-indigo-600 absolute inset-0 m-auto" />
                                            </div>
                                            <span className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em] ml-2">AI Analyzing Real-time UI...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-transparent transition-all animate-in fade-in duration-1000">
                            <div className="p-8 bg-indigo-50 dark:bg-indigo-900/10 rounded-full mb-10 shadow-inner">
                                <Activity className="w-24 h-24 text-indigo-600/20" />
                            </div>
                            <h2 className="text-xl font-black uppercase tracking-[0.2em] mb-4 text-gray-400 opacity-40">Verification Engine Standby</h2>
                            <p className="max-w-md text-xs font-bold uppercase tracking-[0.1em] text-gray-400 leading-relaxed italic opacity-40">
                                Please select a scenario from the sidebar to initialize the autonomous verification cycle.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AutoVerification;
