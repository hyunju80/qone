import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, ShieldCheck, AlertCircle, CheckCircle2, Globe, Target, User, Smartphone, Loader2 } from 'lucide-react';
import { Persona, Device } from '../types';
import { deviceFarmApi } from '../api/deviceFarm';

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
    const [platform, setPlatform] = useState<'WEB' | 'APP'>('WEB');
    const [deviceId, setDeviceId] = useState('');
    const [appPackage, setAppPackage] = useState('');
    const [captureScreenshots, setCaptureScreenshots] = useState(false);
    const [devices, setDevices] = useState<Device[]>([]);

    useEffect(() => {
        if (platform === 'APP') {
            deviceFarmApi.getDevices().then(setDevices).catch(console.error);
        }
    }, [platform]);
    const [isRunning, setIsRunning] = useState(false);
    const [steps, setSteps] = useState<ExplorationStep[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);
    const [userFeedback, setUserFeedback] = useState('');
    const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<{ action_type: string, action_target: string, action_value: string, thought: string }>({ action_type: '', action_target: '', action_value: '', thought: '' });

    const handleReset = () => {
        setSteps([]);
        setSessionId(null);
        setIsComplete(false);
        setIsSaved(false);
        setError(null);
        setUserFeedback('');
        setGoal('');
        setTargetUrl('');
    };

    const runExplorationLoop = async (currentSessionId: string, initialSteps: ExplorationStep[], feedback?: string, overrideNextStep?: Partial<ExplorationStep>) => {
        setIsRunning(true);
        setError(null);
        setIsComplete(false);
        setIsSaved(false);

        try {
            let currentSteps = [...initialSteps];
            let loopComplete = false;
            let loopCount = 0;
            const MAX_LOOPS = 50;

            const persona = personas.find(p => p.id === selectedPersonaId);
            const personaContext = persona ? `Name: ${persona.name}, Traits: ${persona.traits.join(', ')}, Skills: ${persona.skillLevel}` : undefined;

            while (!loopComplete && loopCount < MAX_LOOPS) {
                let stepResult;

                // If the user provided explicit step overrides for the first loop
                if (loopCount === 0 && overrideNextStep) {
                    stepResult = await explorationApi.step(
                        currentSessionId,
                        goal,
                        currentSteps,
                        username,
                        password,
                        feedback,
                        personaContext,
                        overrideNextStep, // Pass explicit command to backend
                        platform,
                        captureScreenshots
                    );
                } else {
                    stepResult = await explorationApi.step(
                        currentSessionId,
                        goal,
                        currentSteps,
                        username,
                        password,
                        loopCount === 0 ? feedback : undefined,
                        personaContext,
                        undefined,
                        platform,
                        captureScreenshots
                    );
                }

                currentSteps = [...currentSteps, stepResult];
                setSteps(currentSteps);

                if (stepResult.status === 'Completed' || stepResult.status === 'Failed' || stepResult.action_type === 'finish') {
                    loopComplete = true;
                    setIsComplete(true);
                } else if (loopCount >= MAX_LOOPS - 1) {
                    // Reached max loops without completion or failure
                    loopComplete = true;
                    setIsComplete(true);
                }
                loopCount++;
            }
        } catch (e: any) {
            console.error("Exploration failed", e);
            setError(e.response?.data?.detail || "Failed to execute exploration. Check logs.");
            setIsComplete(true);
        } finally {
            setIsRunning(false);
        }
    };

    const handleStart = async () => {
        if (platform === 'WEB' && (!targetUrl || !goal)) {
            setError("Please provide both Target URL and Goal for Web exploration.");
            return;
        }
        if (platform === 'APP' && !goal) {
            setError("Please provide a Goal for App exploration.");
            return;
        }
        setError(null);
        setSteps([]);
        setSessionId(null);
        setIsComplete(false);
        setIsSaved(false);
        setUserFeedback('');
        setIsRunning(true);

        try {
            const init = await explorationApi.start({
                url: targetUrl,
                platform,
                device_id: deviceId,
                app_package: appPackage,
                capture_screenshots: captureScreenshots
            });
            setSessionId(init.session_id);
            await runExplorationLoop(init.session_id, []);
        } catch (e: any) {
            console.error("Failed to start session:", e);
            setError("Failed to start session. Check logs.");
            setIsRunning(false);
            setIsComplete(true);
        }
    };

    const handleContinue = async () => {
        if (!sessionId) return;
        if (!userFeedback.trim()) return;

        await runExplorationLoop(sessionId, steps, userFeedback);
        setUserFeedback('');
    };

    const handleDeleteStep = (index: number) => {
        const newSteps = [...steps];
        newSteps.splice(index, 1);
        setSteps(newSteps);
        // Note: We can't easily undo the browser state natively here, but we can drop it from LLM context.
    };

    const handleApplyEdit = async (index: number) => {
        if (!sessionId) return;

        // Truncate history to before this step
        const prevSteps = steps.slice(0, index);
        setSteps(prevSteps);
        setEditingStepIndex(null);

        // Execute the override
        await runExplorationLoop(sessionId, prevSteps, undefined, {
            action_type: editForm.action_type,
            action_target: editForm.action_target,
            action_value: editForm.action_value,
            thought: editForm.thought
        });
    };

    const handleFinishAndSave = async () => {
        if (!sessionId) return;
        setIsRunning(true);
        try {
            const finalStatus = steps.some(s => s.status === 'Failed') ? 'failed' : 'passed';
            const personaName = personas.find(p => p.id === selectedPersonaId)?.name || "AI Agent";

            await explorationApi.save({
                session_id: sessionId,
                project_id: activeProject.id,
                url: platform === 'APP' ? appPackage : targetUrl,
                goal: goal,
                history: steps,
                final_status: finalStatus,
                persona_id: selectedPersonaId || undefined,
                persona_name: personaName,
                platform,
                capture_screenshots: captureScreenshots
            })
            console.log("Asset saved successfully");
            setIsSaved(true);
            if (onHistoryUpdate) onHistoryUpdate();
        } catch (saveErr) {
            console.error("Failed to save asset:", saveErr);
            setError("Failed to save asset.");
        } finally {
            try {
                await explorationApi.stop(sessionId);
            } catch (ignore) { }
            setIsRunning(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50/50 dark:bg-[#0c0e12] p-8 overflow-hidden flex flex-col transition-all duration-700">
            <div className="grid grid-cols-12 gap-8 h-full overflow-hidden">
                {/* Left Control Panel */}
                <div className="col-span-4 flex flex-col overflow-y-auto custom-scrollbar pr-2 h-full">

                    {/* Configuration Card */}
                    <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden flex flex-col shadow-sm min-h-full shrink-0 transition-colors">
                        <div className="px-8 py-7 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 shrink-0 transition-colors">
                            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl transition-all">
                                <Smartphone className="w-6 h-6 text-indigo-500" />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-[13px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-[0.15em] leading-tight transition-colors">
                                    Configuration
                                </h2>
                                <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight transition-colors">
                                    Define Agent Target & Goal
                                </p>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">

                            {/* Platform Toggle */}
                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                                <button
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${platform === 'WEB' ? 'bg-white dark:bg-[#16191f] text-indigo-600 shadow-sm dark:shadow-none border border-gray-200 dark:border-indigo-500/30' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}
                                    onClick={() => setPlatform('WEB')}
                                >
                                    <Globe className="w-4 h-4" /> Web Browser
                                </button>
                                <button
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${platform === 'APP' ? 'bg-white dark:bg-[#16191f] text-indigo-600 shadow-sm dark:shadow-none border border-gray-200 dark:border-indigo-500/30' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}
                                    onClick={() => setPlatform('APP')}
                                >
                                    <Smartphone className="w-4 h-4" /> Mobile App
                                </button>
                            </div>

                            {platform === 'WEB' ? (
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
                            ) : (
                                <>
                                    {/* Device Selection */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Target Device</label>
                                        <div className="relative group">
                                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-indigo-400 transition-colors" />
                                            <select
                                                value={deviceId}
                                                onChange={(e) => setDeviceId(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors appearance-none cursor-pointer"
                                            >
                                                <option value="">Auto-Select Connected Device</option>
                                                {devices.map(d => (
                                                    <option key={d.id} value={d.id}>{d.alias} ({d.os} {d.specs?.osVersion})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    {/* App Package */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">App Package (Optional)</label>
                                        <div className="relative group">
                                            <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-indigo-400 transition-colors" />
                                            <input
                                                type="text"
                                                value={appPackage}
                                                onChange={(e) => setAppPackage(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors"
                                                placeholder="com.example.app"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

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

                            {/* Advanced Settings */}
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-4 transition-colors">
                                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Advanced Settings</h3>
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={captureScreenshots}
                                            onChange={(e) => setCaptureScreenshots(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`block w-10 h-6 rounded-full transition-colors ${captureScreenshots ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${captureScreenshots ? 'transform translate-x-4' : ''}`}></div>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Capture screenshots for every step</span>
                                        <span className="text-[10px] text-gray-500">Enable for debugging. May slow down execution speed.</span>
                                    </div>
                                </label>
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

                            <div className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
                                {error && (
                                    <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-xs">
                                        <AlertCircle className="w-4 h-4" />
                                        {error}
                                    </div>
                                )}

                                <button
                                    onClick={handleStart}
                                    disabled={isRunning}
                                    className={`w-full py-3.5 px-6 rounded-xl font-black text-xs tracking-widest uppercase transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98] ${
                                        isRunning
                                            ? 'bg-indigo-400 cursor-not-allowed opacity-80'
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                        }`}
                                >
                                    {isRunning ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-4 h-4 fill-current" /> Start Agent
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Output Panel */}
                <div className="col-span-8 flex flex-col overflow-y-auto custom-scrollbar pr-2 h-full gap-6">
                    {/* Stats Header */}
                    {steps.length > 0 && (
                        <div className="grid grid-cols-3 gap-4 shrink-0 transition-all">
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
                    <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-sm flex flex-col overflow-hidden min-h-full shrink-0 transition-colors">
                        <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white/50 dark:bg-white/5 backdrop-blur-sm shrink-0 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl transition-all">
                                    <Target className="w-6 h-6 text-emerald-500" />
                                </div>
                                <div className="flex flex-col">
                                    <h2 className="text-[13px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-[0.15em] leading-tight transition-colors">
                                        Execution Log
                                    </h2>
                                    <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight transition-colors">
                                        Self-Driving Agent Progress
                                    </p>
                                </div>
                            </div>
                            {isRunning && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
                        </div>

                        <div className="p-8 pt-6 space-y-6 font-medium">

                            {steps.length === 0 ? (
                                <div className="py-40 flex flex-col items-center justify-center text-gray-400 opacity-40">
                                    <Target className="w-16 h-16 mb-4" />
                                    <p className="text-md font-bold uppercase tracking-widest">Ready to Execute</p>
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
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            disabled={isSaved}
                                                            onClick={() => {
                                                                if (editingStepIndex === step.step_number - 1) {
                                                                    setEditingStepIndex(null);
                                                                } else {
                                                                    setEditingStepIndex(step.step_number - 1);
                                                                    setEditForm({
                                                                        action_type: step.action_type,
                                                                        action_target: step.action_target,
                                                                        action_value: step.action_value || '',
                                                                        thought: step.thought
                                                                    });
                                                                }
                                                            }} className={`text-[10px] font-bold ${isSaved ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-500 hover:underline'}`}>
                                                            {editingStepIndex === step.step_number - 1 ? 'Cancel Edit' : 'Edit & Retry'}
                                                        </button>
                                                        {!isSaved && (
                                                            <button onClick={() => handleDeleteStep(step.step_number - 1)} className="text-[10px] font-bold text-red-500 hover:underline">
                                                                Drop Step
                                                            </button>
                                                        )}
                                                        <div className="text-[10px] font-black uppercase text-gray-500 bg-gray-200 dark:bg-gray-900 px-2 py-1 rounded transition-colors ml-2">
                                                            {step.action_type}
                                                        </div>
                                                    </div>
                                                </div>

                                                {editingStepIndex === step.step_number - 1 ? (
                                                    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-xl mb-4 space-y-3 border border-indigo-500/30">
                                                        <h4 className="text-xs font-bold text-indigo-500">Manual Override Options</h4>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500">Action Type</label>
                                                                <select value={editForm.action_type} onChange={e => setEditForm({ ...editForm, action_type: e.target.value })} className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-700 rounded py-1 px-2 text-xs">
                                                                    <option value="click">Click</option>
                                                                    <option value="type">Type</option>
                                                                    <option value="scroll">Scroll</option>
                                                                    <option value="wait">Wait</option>
                                                                    <option value="navigate">Navigate</option>
                                                                    <option value="finish">Finish</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500">Target Selector</label>
                                                                <input type="text" value={editForm.action_target} onChange={e => setEditForm({ ...editForm, action_target: e.target.value })} className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-700 rounded py-1 px-2 text-xs" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-gray-500">Input Value</label>
                                                            <input type="text" value={editForm.action_value} onChange={e => setEditForm({ ...editForm, action_value: e.target.value })} className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-700 rounded py-1 px-2 text-xs" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-gray-500">Reasoning / Thought (Optional)</label>
                                                            <input type="text" value={editForm.thought} onChange={e => setEditForm({ ...editForm, thought: e.target.value })} className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-700 rounded py-1 px-2 text-xs" />
                                                        </div>
                                                        <button onClick={() => handleApplyEdit(step.step_number - 1)} disabled={isRunning} className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded">
                                                            Apply & Resume Execution From Here
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
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

                                                            {(step.observation || step.expectation || step.expected_text) && (
                                                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-800/30 mt-2 transition-colors">
                                                                    {step.observation && (
                                                                        <div className="col-span-2">
                                                                            <span className="text-emerald-600/70 dark:text-emerald-500/70 font-bold uppercase text-[10px] block mb-1 transition-colors">Actual (Observation)</span>
                                                                            <span className="text-gray-700 dark:text-gray-300 not-italic transition-colors">{step.observation}</span>
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
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {isSaved ? (
                                        <div className="mt-8 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center animate-in zoom-in-95 duration-300">
                                            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                                                <CheckCircle2 className="w-8 h-8 text-white" />
                                            </div>
                                            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 transition-colors">Asset Saved Successfully!</h3>
                                            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 max-w-xs mx-auto transition-colors">
                                                The exploration session has been converted into a TestScript and is now available in the Asset Library.
                                            </p>
                                            <button
                                                onClick={handleReset}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 mx-auto"
                                            >
                                                <Play className="w-4 h-4" /> Start New Exploration
                                            </button>
                                        </div>
                                    ) : (isComplete && sessionId && (
                                        <div className="mt-6 border-t border-gray-200 dark:border-gray-800 pt-6 animate-in fade-in slide-in-from-bottom-2">
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 transition-colors">Provide Feedback to Continue</h3>
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    value={userFeedback}
                                                    onChange={(e) => setUserFeedback(e.target.value)}
                                                    className="flex-1 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-3 px-4 text-sm focus:border-indigo-500 outline-none transition-colors"
                                                    placeholder="e.g., Use correct password: password12"
                                                    onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                                                    disabled={isRunning}
                                                />
                                                <button
                                                    onClick={handleContinue}
                                                    disabled={isRunning || !userFeedback.trim()}
                                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                                                >
                                                    {isRunning ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" /> : <Play className="w-4 h-4" />}
                                                    Continue
                                                </button>
                                            </div>
                                            <div className="mt-4 flex justify-end">
                                                <button
                                                    onClick={handleFinishAndSave}
                                                    disabled={isRunning}
                                                    className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-900 dark:text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                                                >
                                                    <ShieldCheck className="w-4 h-4" />
                                                    Finish & Save Asset
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiExploration;
