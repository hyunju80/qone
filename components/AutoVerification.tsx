import React, { useState, useEffect } from 'react';
import {
    Play, RotateCcw, CheckCircle2, AlertCircle, Bot, Target,
    ChevronRight, Save, Activity, Globe, Smartphone, ShieldCheck,
    Search, ListChecks, ArrowRight, Loader2, Sparkles, Tablet, Square, XCircle
} from 'lucide-react';
import { Project, Persona, Scenario, TestScript, TestCase, ScriptOrigin } from '../types';
import { scenariosApi } from '../api/scenarios';
import { explorationApi, ExplorationStep } from '../api/exploration';
import { testApi } from '../api/test';

interface AutoVerificationProps {
    activeProject: Project;
    personas: Persona[];
    onRegisterAsset: (script: TestScript) => void;
}

const AutoVerification: React.FC<AutoVerificationProps> = ({ activeProject, personas, onRegisterAsset }) => {
    // --- List State ---
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
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

    const selectedScenario = scenarios.find(s => s.id === selectedScenarioId);

    useEffect(() => {
        fetchScenarios();
    }, [activeProject.id]);

    // Update local state when a scenario is selected to auto-populate platform/target
    useEffect(() => {
        if (selectedScenario) {
            if (selectedScenario.platform) setPlatform(selectedScenario.platform as 'WEB' | 'APP');
            if (selectedScenario.target) setTargetUrl(selectedScenario.target);
            if (selectedScenario.personaId) setSelectedPersonaId(selectedScenario.personaId);
        }
    }, [selectedScenario]);

    const fetchScenarios = async () => {
        setLoadingList(true);
        try {
            // Fetch all scenarios and filter for those ready for verification (approved but no asset yet)
            const data = await scenariosApi.getAll(activeProject.id, true);
            setScenarios(data);
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
            const personaContext = persona ? `Name: ${persona.name}, Goal: ${persona.goal} ` : undefined;

            // Construct a very specific goal based on scenario steps
            const scenarioGoal = `
        다음 시나리오를 충실히 따라서 테스트를 완료하세요:
        시나리오 명: ${selectedScenario.title}
설명: ${selectedScenario.description}

[수행 단계]
        ${selectedScenario.testCases.map((tc, idx) => `${idx + 1}. ${tc.title}: ${tc.steps.join(', ')}`).join('\n')}
        
        가장 중요한 목표는 시나리오에 기술된 흐름대로 실제 UI에서 성공적으로 동작하는지 검증하고,
    동작이 완료되면 'finish' 액션으로 종료하는 것입니다.
      `;

            while (!loopComplete && loopCount < MAX_LOOPS) {
                const stepResult = await explorationApi.step(
                    currentSessionId,
                    scenarioGoal,
                    currentSteps,
                    '', '', // username, password
                    undefined, // feedback
                    personaContext,
                    undefined, // override
                    platform,
                    true // capture screenshots
                );

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

        // Extract rule-based steps for the TestScript asset
        const scriptSteps = steps.map(s => {
            const isXpath = s.action_target?.startsWith('//') || s.action_target?.startsWith('(/');
            let selectorType = isXpath ? 'XPATH' : 'CSS';

            let finalSelectorValue = s.action_target || '';
            let finalInputValue = s.action_value || '';
            let finalAction = s.action_type;

            if (s.action_type === 'open_app' || s.action_type === 'activateApp') {
                selectorType = 'PACKAGE';
                finalSelectorValue = '-';
                finalInputValue = s.action_target || ''; // The package name
                finalAction = 'activateApp';
            } else if (platform === 'APP') {
                if (s.action_target?.includes(':id/') || s.action_target?.startsWith('id/')) {
                    selectorType = 'ID';
                } else if (!isXpath && !['.', '#', '[', '/', '>', ':', '='].some(c => s.action_target?.includes(c))) {
                    selectorType = 'TEXT';
                } else if (!isXpath) {
                    selectorType = 'XPATH';
                }
            } else {
                if (!['.', '#', '[', '/', '>', ':', '='].some(c => s.action_target?.includes(c)) && s.action_type === 'click') {
                    selectorType = 'TEXT';
                }
            }

            return {
                id: `step_auto_${Date.now()}_${Math.random().toString(36).substring(2, 9)} `,
                stepName: `${String(finalAction).toUpperCase()} Target`,
                action: finalAction,
                selectorType: selectorType,
                selectorValue: finalSelectorValue,
                inputValue: finalInputValue,
                description: s.description || '',
                assertText: s.expected_text || '' // Only use explicit assertions
            };
        });

        const payload = {
            name: `[Verified] ${selectedScenario.title} `,
            description: selectedScenario.description,
            project_id: activeProject.id,
            code: "/* Rule-based Verified script */",
            engine: platform === 'WEB' ? 'Playwright' : 'Appium',
            origin: ScriptOrigin.AI,
            status: 'CERTIFIED',
            platform,
            steps: scriptSteps,
            persona_id: selectedPersonaId,
            category: selectedScenario.category || 'Common',
            tags: ['AI']
        };

        try {
            const newScript = await testApi.createScript(payload);
            // Link scenario to golden script
            await scenariosApi.update(selectedScenario.id, { golden_script_id: newScript.id });
            onRegisterAsset(newScript);
            fetchScenarios(); // Refresh list
            setSelectedScenarioId(null);
            setSteps([]);
        } catch (e) {
            console.error("Failed to save asset", e);
            alert("자산 저장에 실패했습니다.");
        }
    };

    return (
        <div className="flex h-full w-full overflow-hidden bg-gray-50 dark:bg-[#0c0e12]">
            {/* List Panel (1st) */}
            <div className="w-[400px] bg-white dark:bg-[#111318] border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 transition-colors">
                <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Ready to Verify ({filteredScenarios.length})</span>
                            <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Target Queue</span>
                        </div>
                        <button onClick={fetchScenarios} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg text-gray-400"><RotateCcw className="w-4 h-4" /></button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="검색..." className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-lg py-1.5 pl-9 pr-3 text-xs outline-none focus:border-indigo-500" />
                    </div>

                    {uniqueCategories.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                            <button onClick={() => setSelectedCategory('ALL')} className={`px-2 py-1 rounded-full text-[9px] font-black uppercase whitespace-nowrap transition-all ${selectedCategory === 'ALL' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'} `}>ALL</button>
                            {uniqueCategories.map(cat => (
                                <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-2 py-1 rounded-full text-[9px] font-black uppercase whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'} `}>
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {loadingList ? (
                        <div className="py-20 flex flex-col items-center opacity-20">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                            <p className="text-[10px] font-black uppercase">Loading...</p>
                        </div>
                    ) : filteredScenarios.length === 0 ? (
                        <div className="py-20 flex flex-col items-center opacity-20 text-center">
                            <ShieldCheck className="w-12 h-12 mb-4" />
                            <p className="text-[10px] font-black uppercase">No scenarios pending</p>
                            <p className="text-[8px] mt-1 max-w-[180px]">목록이 비어있거나 필터에 맞는 항목이 없습니다.</p>
                        </div>
                    ) : (
                        filteredScenarios.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setSelectedScenarioId(s.id)}
                                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-4 ${selectedScenarioId === s.id ? 'bg-indigo-600/10 border-indigo-500 shadow-md transform scale-[1.02]' : 'bg-white dark:bg-[#16191f] border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700'} `}
                            >
                                <div className={`p-2 rounded-xl shrink-0 transition-colors ${selectedScenarioId === s.id ? 'bg-indigo-600 text-white' : 'bg-gray-50 dark:bg-gray-900 text-gray-400'} `}><ListChecks className="w-5 h-5" /></div>
                                <div className="min-w-0 flex-1">
                                    {s.category && (
                                        <div className="mb-1.5 flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8px] font-black rounded uppercase tracking-widest border border-indigo-100 dark:border-indigo-500/20">{s.category}</span>
                                        </div>
                                    )}
                                    <div className="text-xs font-black text-gray-900 dark:text-gray-200 truncate group-hover:text-indigo-600 transition-colors">{s.title}</div>
                                    <div className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 leading-relaxed">{s.description}</div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Main Verification View */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {selectedScenario ? (
                    <div className="flex flex-col h-full animate-in fade-in transition-colors">
                        {/* Context Header */}
                        <div className="px-8 py-6 bg-white dark:bg-[#111318] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between transition-colors">
                            <div className="flex items-center gap-6 flex-1">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1"><Bot className="w-3.5 h-3.5" /> Autonomous Verification</span>
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{selectedScenario.title}</h2>
                                </div>
                                <div className="h-8 w-px bg-gray-100 dark:bg-gray-800" />
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 group">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.1em] ml-1 mb-0.5">Target {platform === 'WEB' ? 'URL' : 'App ID'}</span>
                                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-1.5 focus-within:border-indigo-500 transition-all">
                                                {platform === 'WEB' ? <Globe className="w-3.5 h-3.5 text-indigo-400" /> : <Tablet className="w-3.5 h-3.5 text-indigo-400" />}
                                                <input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder={platform === 'WEB' ? "https://example.com" : "com.example.app"} className="bg-transparent text-xs w-64 outline-none font-medium" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col self-end pb-1.5">
                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Verification Status</span>
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-2 shadow-sm border ${isRunning ? 'bg-amber-100 border-amber-200 text-amber-600' : isComplete ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-gray-100 border-gray-200 text-gray-500'} `}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-amber-500 animate-pulse' : isComplete ? 'bg-emerald-500' : 'bg-gray-400'} `} />
                                            {isRunning ? 'Running' : isComplete ? 'Finished' : 'Standby'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {isRunning ? (
                                    <button
                                        onClick={stopVerification}
                                        disabled={isStopping}
                                        className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg shadow-red-600/20 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {isStopping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 fill-current" />}
                                        Stop Verification
                                    </button>
                                ) : (
                                    <>
                                        {!isComplete && (
                                            <button
                                                onClick={() => setSelectedScenarioId(null)}
                                                className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-xs font-black uppercase text-gray-500 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        {!isComplete ? (
                                            <button
                                                onClick={startVerification}
                                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                            >
                                                <Play className="w-4 h-4 fill-current" /> Auto-Verify
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => { setIsComplete(false); setSteps([]); }}
                                                    className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-xs font-black uppercase text-gray-500 transition-colors"
                                                >
                                                    Reset
                                                </button>
                                                <button
                                                    onClick={handleSaveAsAsset}
                                                    className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg shadow-green-600/20 active:scale-95 transition-all"
                                                >
                                                    <Save className="w-4 h-4" /> Save as Asset
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Left: Scenario Steps (2nd) */}
                            <div className="w-[480px] border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-black/20 overflow-y-auto p-6 space-y-4 custom-scrollbar transition-colors">
                                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2 transition-colors"><Target className="w-4 h-4 text-indigo-400" /> Scenario Steps</div>
                                {selectedScenario.testCases.map((tc, idx) => (
                                    <div key={tc.id || idx} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-3 transition-colors">
                                        <div className="flex items-center gap-3 pb-2 border-b border-gray-50 dark:border-gray-800">
                                            <span className="w-5 h-5 rounded bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-black text-indigo-600 shrink-0 transition-colors">{idx + 1}</span>
                                            <div className="text-xs font-black text-gray-900 dark:text-gray-200 truncate">{tc.title}</div>
                                        </div>

                                        {tc.preCondition && (
                                            <div className="space-y-1">
                                                <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Pre-condition</div>
                                                <div className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">{tc.preCondition}</div>
                                            </div>
                                        )}

                                        {tc.inputData && (
                                            <div className="space-y-1">
                                                <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Input Data</div>
                                                <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/5 p-2 rounded-lg border border-indigo-100 dark:border-indigo-500/10 truncate">{tc.inputData}</div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Execution Steps</div>
                                            <div className="space-y-1.5">
                                                {tc.steps.map((s, si) => (
                                                    <div key={si} className="text-[10px] text-gray-500 flex gap-2 items-start">
                                                        <span className="text-gray-300 dark:text-gray-700 font-bold tracking-tighter shrink-0 mt-0.5">STP.{si + 1}</span>
                                                        <span className="leading-tight">{s}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {tc.expectedResult && (
                                            <div className="space-y-1 pt-2 border-t border-gray-50 dark:border-gray-800">
                                                <div className="text-[8px] font-black text-green-600 dark:text-green-500 uppercase tracking-widest">Expected Result</div>
                                                <div className="text-[10px] text-green-700 dark:text-green-400 leading-tight italic">"{tc.expectedResult}"</div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Right: Execution Log (3rd) */}
                            <div className="flex-1 bg-[#f8fafc] dark:bg-black/40 overflow-y-auto p-8 space-y-6 custom-scrollbar transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2 transition-colors"><Activity className="w-4 h-4 text-green-500" /> Execution Log</div>
                                </div>

                                {steps.length === 0 && !isRunning && !error && (
                                    <div className="h-[400px] flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 border border-dashed border-gray-200 dark:border-gray-800 rounded-[2rem] space-y-4">
                                        <Sparkles className="w-12 h-12 opacity-10" />
                                        <p className="text-xs font-black uppercase tracking-widest opacity-50">Ready to execute autonomous verification</p>
                                    </div>
                                )}

                                {error && (
                                    <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 animate-in shake duration-500 transition-colors">
                                        <AlertCircle className="w-5 h-5" />
                                        <span className="text-xs font-bold">{error}</span>
                                    </div>
                                )}

                                {isComplete && steps.length > 0 && (
                                    <div className={`p-6 rounded-3xl border-2 mb-8 animate-in slide-in-from-top-4 duration-500 ${steps[steps.length - 1]?.status === 'Failed'
                                        ? 'bg-red-50 dark:bg-red-500/5 border-red-100 dark:border-red-500/20'
                                        : 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20'
                                        } `}>
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-2xl ${steps[steps.length - 1]?.status === 'Failed' ? 'bg-red-100 dark:bg-red-500/20 text-red-600' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600'} `}>
                                                {steps[steps.length - 1]?.status === 'Failed' ? <XCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className={`text - sm font - black uppercase tracking - wider mb - 1 ${steps[steps.length - 1]?.status === 'Failed' ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'} `}>
                                                    Verification {steps[steps.length - 1]?.status === 'Failed' ? 'Failed' : 'Success'}
                                                </h3>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed break-words">
                                                    {steps[steps.length - 1]?.status === 'Failed'
                                                        ? `검증 중 오류가 발생했습니다: ${steps[steps.length - 1]?.observation} `
                                                        : "시나리오의 모든 단계가 성공적으로 완료되었습니다."}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Steps</div>
                                                <div className="text-xl font-black text-gray-900 dark:text-white transition-colors">{steps.length}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    {steps.map((step, idx) => (
                                        <div key={idx} className="relative pl-8 border-l-2 border-gray-200 dark:border-gray-800 last:border-transparent transition-colors">
                                            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${step.status === 'Completed' ? 'bg-emerald-500 border-emerald-900' :
                                                step.status === 'Failed' ? 'bg-red-500 border-red-900' : 'bg-indigo-500 border-indigo-900'
                                                } `} />

                                            <div className="bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-indigo-500/30 transition-colors">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest transition-colors">Step {step.step_number || idx + 1}</span>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${step.matching_score >= 80 ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400' :
                                                            step.matching_score >= 50 ? 'border-yellow-500/30 text-yellow-600 dark:text-yellow-400' : 'border-gray-200 dark:border-gray-700 text-gray-500'
                                                            } transition-colors`}>
                                                            Score: {step.matching_score ?? 0}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-[10px] font-black uppercase text-gray-500 bg-gray-200 dark:bg-gray-900 px-2 py-1 rounded transition-colors ml-2">
                                                            {step.action_type}
                                                        </div>
                                                    </div>
                                                </div>

                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 transition-colors">{step.description}</h3>

                                                <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                                                    <div className="p-3 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-lg transition-colors">
                                                        <span className="block text-gray-500 font-bold uppercase mb-1">Score Breakdown</span>
                                                        <div className="space-y-1">
                                                            {step.score_breakdown && Object.entries(step.score_breakdown).map(([key, val]) => (
                                                                <div key={key} className="flex justify-between">
                                                                    <span className="text-gray-600 dark:text-gray-400 capitalize transition-colors">{key.replace('_', ' ')}</span>
                                                                    <span className={`font-bold transition-colors ${(val as number) >= 80 ? 'text-emerald-600 dark:text-emerald-400' : (val as number) >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                                                                        } `}>{val as number}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="p-3 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-lg transition-colors">
                                                        <span className="block text-gray-500 font-bold uppercase mb-1">Target</span>
                                                        <span className="text-gray-800 dark:text-gray-300 break-all transition-colors">{step.action_target || 'N/A'}</span>
                                                    </div>
                                                </div>

                                                <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed italic bg-white dark:bg-gray-900/30 p-3 rounded-lg border border-gray-200 dark:border-gray-800/50 mb-3 transition-colors">
                                                    <div className="mb-2">
                                                        <span className="text-gray-500 font-bold uppercase text-[10px] block mb-1">Reasoning</span>
                                                        "{step.thought}"
                                                    </div>

                                                    {(step.observation || step.expectation || step.expected_text) && (
                                                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-800/30 mt-2 transition-colors">
                                                            {step.observation && (
                                                                <div className="col-span-2">
                                                                    <span className={`${step.status === 'Failed' ? 'text-red-600/70 dark:text-red-500/70' : 'text-emerald-600/70 dark:text-emerald-500/70'} font-bold uppercase text-[10px] block mb-1 transition-colors`}>Actual (Observation)</span>
                                                                    <span className={`${step.status === 'Failed' ? 'text-red-700 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-gray-300'} not-italic transition-colors`}>{step.observation}</span>
                                                                </div>
                                                            )}
                                                            {step.expectation && (
                                                                <div>
                                                                    <span className="text-indigo-600/70 dark:text-indigo-400/70 font-bold uppercase text-[10px] block mb-1 transition-colors">Goal Intention</span>
                                                                    <span className="text-gray-700 dark:text-gray-300 not-italic transition-colors">{step.expectation}</span>
                                                                </div>
                                                            )}
                                                            {step.expected_text && step.expected_text.trim() !== "" && (
                                                                <div>
                                                                    <span className="text-blue-600/70 dark:text-blue-400/70 font-bold uppercase text-[10px] block mb-1 transition-colors flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Rule Assertion</span>
                                                                    <span className="text-gray-900 dark:text-white font-mono not-italic bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded border border-blue-200 dark:border-blue-500/30 transition-colors">"{step.expected_text}"</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {step.action_value && (
                                                    <div className="pt-2 border-t border-gray-200 dark:border-gray-800/50 flex gap-4 text-xs transition-colors">
                                                        <div>
                                                            <span className="text-gray-600 font-bold uppercase mr-2">Input Value:</span>
                                                            <span className="text-gray-600 dark:text-gray-300 font-mono transition-colors">{step.action_value.includes("password") ? "*****" : step.action_value}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {isRunning && (
                                        <div className="py-8 flex flex-col items-center gap-4 animate-in fade-in duration-500 transition-colors">
                                            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">AI Thinking...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center text-gray-400 bg-white dark:bg-[#0c0e12] transition-colors">
                        <Activity className="w-16 h-16 mb-8 opacity-10" />
                        <h2 className="text-xl font-black uppercase tracking-widest mb-2 transition-colors">Auto-Verification Engine</h2>
                        <p className="max-w-md text-xs font-medium uppercase tracking-[0.2em] leading-relaxed transition-colors opacity-50">
                            왼쪽 대기 목록에서 시나리오를 선택하여 자율 검증을 시작하세요.<br />
                            AI가 각 단계를 실제 UI에서 구동하고 결과를 자산으로 변환합니다.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AutoVerification;
