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
    const [activeTab, setActiveTab] = useState<'scenario' | 'verification' | 'dataset'>('scenario');

    if (!activeProject) return null;

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0c0e12] overflow-hidden transition-colors">
            {/* Minimal Pipeline Header & Tabs */}
            <div className="flex items-center justify-between px-8 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#16191f] transition-colors shrink-0">
                <div className="flex gap-2 py-4">
                    <button
                        onClick={() => setActiveTab('scenario')}
                        className={`px-4 py-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'scenario'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                    >
                        <FileText className="w-3.5 h-3.5" /> 1. Scenarios
                    </button>
                    <div className="w-8 flex items-center justify-center text-gray-300 dark:text-gray-700">-</div>
                    <button
                        onClick={() => setActiveTab('verification')}
                        className={`px-4 py-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'verification'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                    >
                        <Activity className="w-3.5 h-3.5" /> 2. Auto-Verification
                    </button>
                    <div className="w-8 flex items-center justify-center text-gray-300 dark:text-gray-700">-</div>
                    <button
                        onClick={() => setActiveTab('dataset')}
                        className={`px-4 py-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'dataset'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                    >
                        <Database className="w-3.5 h-3.5" /> 3. DataSet Studio
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'scenario' && (
                    <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-0 animate-in fade-in duration-300">
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
                        />
                    </div>
                )}
                {activeTab === 'verification' && (
                    <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-0 animate-in fade-in duration-300">
                        <AutoVerification
                            activeProject={activeProject}
                            personas={personas}
                            onRegisterAsset={(script) => {
                                onSyncScript(script);
                                // Optional jump to dataset automatically:
                                // setActiveTab('dataset');
                            }}
                        />
                    </div>
                )}
                {activeTab === 'dataset' && (
                    <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-0 animate-in fade-in duration-300">
                        <DataSetStudio
                            activeProject={activeProject}
                            onAlert={onAlert}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIGeneratorView;
