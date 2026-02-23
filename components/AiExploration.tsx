import React, { useState } from 'react';
import { Play, RotateCcw, ShieldCheck, AlertCircle, CheckCircle2, Globe, Target, User } from 'lucide-react';
import { Persona } from '../types';

import { explorationApi, ExplorationStep } from '../api/exploration';

interface AiExplorationProps {
    activeProject: any; // Using any for now to avoid strict type issues, can refine later
    personas: Persona[];
    onHistoryUpdate?: () => void;
}

// Interface defined in api/exploration.ts

const AiExploration: React.FC<AiExplorationProps> = ({ activeProject, personas, onHistoryUpdate }) => {
    const [targetUrl, setTargetUrl] = useState('');
    const [goal, setGoal] = useState('');
    const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');
    const [username, setUsername] = useState(''); // Added
    const [password, setPassword] = useState(''); // Added
    const [isRunning, setIsRunning] = useState(false);
    const [steps, setSteps] = useState<ExplorationStep[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleStart = async () => {
        if (!targetUrl || !goal) {
            setError("Please provide both Target URL and Goal.");
            return;
        }
        setError(null);
        setIsRunning(true);
        setSteps([]);

        let sessionId = "";

        try {
            // 1. Start Session
            const init = await explorationApi.start(targetUrl);
            sessionId = init.session_id;

            // 2. Execution Loop
            let currentSteps: ExplorationStep[] = [];
            let isComplete = false;
            let loopCount = 0;
            const MAX_LOOPS = 10; // Safety break

            while (!isComplete && loopCount < MAX_LOOPS) {
                // Execute Step
                const stepResult = await explorationApi.step(sessionId, goal, currentSteps, username, password);

                currentSteps = [...currentSteps, stepResult];
                setSteps(currentSteps);

                if (stepResult.status === 'Completed' || stepResult.status === 'Failed' || stepResult.action_type === 'finish') {
                    isComplete = true;
                }
                loopCount++;
            }

            // 3. Auto-Save History
            try {
                const finalStatus = currentSteps.some(s => s.status === 'Failed') ? 'failed' : 'passed';
                const personaName = personas.find(p => p.id === selectedPersonaId)?.name || "AI Agent";

                // Save History
                await explorationApi.save({
                    session_id: sessionId,
                    project_id: activeProject.id,
                    url: targetUrl,
                    goal: goal,
                    history: currentSteps,
                    final_status: finalStatus,
                    persona_id: selectedPersonaId || undefined,
                    persona_name: personaName
                });
                console.log("History saved successfully");
                if (onHistoryUpdate) onHistoryUpdate(); // Call onHistoryUpdate if it exists
            } catch (saveErr) {
                console.error("Failed to save history:", saveErr);
            }

        } catch (e: any) {
            console.error("Exploration failed", e);
            setError(e.response?.data?.detail || "Failed to execute exploration. Check logs.");
        } finally {
            // 3. Cleanup
            if (sessionId) {
                try {
                    await explorationApi.stop(sessionId);
                } catch (ignore) {
                    // Ignore cleanup errors
                }
            }
            setIsRunning(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0f1115] text-gray-600 dark:text-gray-300 p-6 overflow-hidden transition-colors">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3 transition-colors">
                        <span className="p-2 bg-indigo-600 rounded-lg"><ShieldCheck className="w-6 h-6 text-white" /></span>
                        AI Autonomous Agent (Multi-Turn)
                    </h1>
                    <p className="text-gray-500 text-sm mt-2 font-medium">Self-driving execution loop: Analyze → Decide → Act → Verify.</p>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 h-full overflow-hidden">
                {/* Left Control Panel */}
                <div className="col-span-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">

                    {/* Configuration Card */}
                    <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-5 transition-colors">
                        <h2 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4 transition-colors">Configuration</h2>

                        {/* Target URL */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Target URL</label>
                            <div className="relative group">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                    type="text"
                                    value={targetUrl}
                                    onChange={(e) => setTargetUrl(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors"
                                    placeholder="https://example.com"
                                />
                            </div>
                        </div>

                        {/* Goal */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Exploration Goal</label>
                            <div className="relative group">
                                <Target className="absolute left-3 top-3 w-4 h-4 text-gray-600 group-focus-within:text-indigo-400 transition-colors" />
                                <textarea
                                    value={goal}
                                    onChange={(e) => setGoal(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors h-24 resize-none"
                                    placeholder="e.g. 'Go to My Page and Check Points'"
                                />
                            </div>
                        </div>

                        {/* Persona Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Persona</label>
                            <div className="relative group">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-indigo-400 transition-colors" />
                                <select
                                    value={selectedPersonaId}
                                    onChange={(e) => setSelectedPersonaId(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors appearance-none cursor-pointer"
                                >
                                    <option value="">Select a Persona (Optional)</option>
                                    {personas.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Credentials (Optional) */}
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-4 transition-colors">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Login Credentials (Optional)</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-xs text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors"
                                    placeholder="Username / Email"
                                />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-xs text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors"
                                    placeholder="Password"
                                />
                            </div>
                            <p className="text-[10px] text-gray-600 leading-tight">
                                <ShieldCheck className="w-3 h-3 inline mr-1 text-emerald-500" />
                                Secure Mode: Credentials are local-only.
                            </p>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-xs">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleStart}
                            disabled={isRunning}
                            className={`w-full py-4 rounded-xl font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${isRunning
                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                                }`}
                        >
                            {isRunning ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" /> Start Agent
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Output Panel */}
                <div className="col-span-8 flex flex-col gap-6 overflow-hidden h-full">
                    {/* Stats Header */}
                    {steps.length > 0 && (
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl p-4 transition-colors">
                                <div className="text-xs text-gray-500 uppercase font-bold">Steps Executed</div>
                                <div className="text-2xl font-black text-gray-900 dark:text-white transition-colors">{steps.length}</div>
                            </div>
                            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl p-4 transition-colors">
                                <div className="text-xs text-gray-500 uppercase font-bold">Last Action</div>
                                <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 truncate transition-colors">
                                    {steps[steps.length - 1].action_type.toUpperCase()}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl p-4 transition-colors">
                                <div className="text-xs text-gray-500 uppercase font-bold">Status</div>
                                <div className="text-2xl font-black text-emerald-500 dark:text-emerald-400">{steps[steps.length - 1].status}</div>
                            </div>
                        </div>
                    )}

                    {/* Steps list */}
                    <div className="flex-1 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 overflow-y-auto custom-scrollbar transition-colors">
                        <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-4 sticky top-0 bg-white dark:bg-[#16191f] pb-4 border-b border-gray-200 dark:border-gray-800 z-10 flex items-center gap-2 transition-colors">
                            <RotateCcw className="w-4 h-4 text-gray-500" /> Execution Log
                        </h2>

                        {steps.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                                <Target className="w-16 h-16 mb-4" />
                                <p className="text-sm font-bold uppercase tracking-widest">Ready to Execute</p>
                                <p className="text-xs mt-2">Configure target and goal to begin multi-turn execution.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {steps.map((step) => (
                                    <div key={step.step_number} className="relative pl-8 border-l-2 border-gray-200 dark:border-gray-800 last:border-transparent transition-colors">
                                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${step.status === 'Completed' ? 'bg-emerald-500 border-emerald-900' :
                                            step.status === 'Failed' ? 'bg-red-500 border-red-900' : 'bg-indigo-500 border-indigo-900'
                                            }`} />

                                        <div className="bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-indigo-500/30 transition-colors">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest transition-colors">Step {step.step_number}</span>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${step.matching_score >= 80 ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400' :
                                                        step.matching_score >= 50 ? 'border-yellow-500/30 text-yellow-600 dark:text-yellow-400' : 'border-gray-200 dark:border-gray-700 text-gray-500'
                                                        } transition-colors`}>
                                                        Score: {step.matching_score ?? 0}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] font-black uppercase text-gray-500 bg-gray-200 dark:bg-gray-900 px-2 py-1 rounded transition-colors">
                                                    {step.action_type}
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
                                                                    }`}>{val as number}</span>
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

                                                {(step.observation || step.expectation) && (
                                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-800/30 mt-2 transition-colors">
                                                        {step.observation && (
                                                            <div>
                                                                <span className="text-emerald-600/70 dark:text-emerald-500/70 font-bold uppercase text-[10px] block mb-1 transition-colors">Actual (Observation)</span>
                                                                <span className="text-gray-700 dark:text-gray-300 not-italic transition-colors">{step.observation}</span>
                                                            </div>
                                                        )}
                                                        {step.expectation && (
                                                            <div>
                                                                <span className="text-indigo-600/70 dark:text-indigo-400/70 font-bold uppercase text-[10px] block mb-1 transition-colors">Expected Outcome</span>
                                                                <span className="text-gray-700 dark:text-gray-300 not-italic transition-colors">{step.expectation}</span>
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
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiExploration;
