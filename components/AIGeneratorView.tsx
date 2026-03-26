import React, { useState } from 'react';
import { Project, User, Persona, Scenario, TestScript } from '../types';
import { Sparkles, ClipboardList, Bot, FileText, Activity, Database } from 'lucide-react';
import ScenarioGenerator from './ScenarioGenerator';
import AutoVerification from './AutoVerification';
import DataSetStudio from './DataSetStudio';

interface AIGeneratorViewProps {
    activeProject: Project | null;
    personas: Persona[];
    onApproveScenario: (scenario: Scenario) => void;
    onRegisterScript: (script: TestScript) => void;
    onSyncScript: (script: TestScript) => void;
    onAlert: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
    // State from App.tsx
    focusedTaskId: string | null;
    onClearFocus: () => void;
    draftFeatures: FeatureSummary[];
    onUpdateDraftFeatures: (features: FeatureSummary[]) => void;
    draftScenarios: Scenario[];
    onUpdateDraftScenarios: (scenarios: Scenario[]) => void;
    lastEditingScenarioId: string | null;
    onUpdateLastEditingScenarioId: (id: string | null) => void;
}

// Local interfaces for persistence (moved from App.tsx logic)
interface FeatureSummary {
    name: string;
    description: string;
    flows: string[];
}

const AIGeneratorView: React.FC<AIGeneratorViewProps> = ({
    activeProject,
    personas,
    onApproveScenario,
    onRegisterScript,
    onSyncScript,
    onAlert,
    focusedTaskId,
    onClearFocus,
    draftFeatures,
    onUpdateDraftFeatures,
    draftScenarios,
    onUpdateDraftScenarios,
    lastEditingScenarioId,
    onUpdateLastEditingScenarioId
}) => {
    // Determine the active pipeline stage
    const [activeTab, setActiveTab] = useState<'scenario' | 'verification'>('scenario');

    if (!activeProject) return null;

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0c0e12] overflow-hidden transition-colors">
            {/* Minimal Pipeline Header & Tabs */}
            <div className="flex-none px-8 pt-4 pb-0 bg-white dark:bg-[#16191f] border-b border-gray-200 dark:border-gray-800 transition-colors shrink-0">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('scenario')}
                        className={`px-6 py-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'scenario'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                            }`}
                    >
                        <FileText className="w-4 h-4" /> 1. Scenarios
                    </button>
                    <div className="w-8 flex items-center justify-center text-gray-200 dark:text-gray-800">
                        <span className="w-1 h-1 bg-current rounded-full opacity-20" />
                    </div>
                    <button
                        onClick={() => setActiveTab('verification')}
                        className={`px-6 py-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'verification'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                            }`}
                    >
                        <Activity className="w-4 h-4" /> 2. Auto-Verification
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 overflow-hidden p-0 animate-in fade-in duration-300">
                    {activeTab === 'scenario' && (

                        <ScenarioGenerator
                            activeProject={activeProject}
                            personas={personas}
                            onApproveScenario={(scenario) => {
                                onApproveScenario(scenario);
                                // Optional jump to verification automatically:
                                // setActiveTab('verification');
                            }}
                            focusedTaskId={focusedTaskId}
                            onClearFocus={onClearFocus}
                            persistedFeatures={draftFeatures}
                            onUpdatePersistedFeatures={onUpdateDraftFeatures}
                            persistedScenarios={draftScenarios}
                            onUpdatePersistedScenarios={onUpdateDraftScenarios}
                            persistedEditingId={lastEditingScenarioId}
                            onUpdatePersistedEditingId={onUpdateLastEditingScenarioId}
                            onAlert={onAlert}
                        />

                    )}
                    {activeTab === 'verification' && (

                        <AutoVerification
                            activeProject={activeProject}
                            personas={personas}
                            onRegisterAsset={(script) => {
                                onSyncScript(script);
                            }}
                        />

                    )}
                </div>
            </div>
        </div>
    );
};

export default AIGeneratorView;
