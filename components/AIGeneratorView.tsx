import React, { useState } from 'react';
import { Project, User, Persona, Scenario, TestScript } from '../types';
import { Sparkles, ClipboardList, Bot } from 'lucide-react';
import ScenarioGenerator from './ScenarioGenerator';
import TestGenerator from './TestGenerator';

interface AIGeneratorViewProps {
    activeProject: Project | null;
    personas: Persona[];
    onApproveScenario: (scenario: Scenario) => void;
    onRegisterScript: (script: TestScript) => void;
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
    const [activeTab, setActiveTab] = useState<'scenario' | 'test'>('scenario');

    // Scenario Generator Persistence State (Moved from App.tsx or lifted here)
    // These states are now passed as props from App.tsx
    // const [draftFeatures, setDraftFeatures] = useState<FeatureSummary[]>([]);
    // const [draftScenarios, setDraftScenarios] = useState<Scenario[]>([]);
    // const [lastEditingScenarioId, setLastEditingScenarioId] = useState<string | null>(null);
    // const [focusedDiscoveryId, setFocusedDiscoveryId] = useState<string | null>(null);

    if (!activeProject) return null;

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0c0e12] overflow-hidden transition-colors">
            {/* Header & Tabs */}
            <div className="flex items-center justify-between px-8 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#16191f] transition-colors shrink-0">
                {/* Tabs */}
                <div className="flex">
                    <button
                        onClick={() => setActiveTab('scenario')}
                        className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'scenario'
                            ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-white'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        Scenario Generator
                    </button>
                    <button
                        onClick={() => setActiveTab('test')}
                        className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'test'
                            ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-white'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        Test Generator
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'scenario' ? (
                    <div className="h-full overflow-y-auto custom-scrollbar p-0 animate-in slide-in-from-right-4 duration-300 fade-in">
                        <ScenarioGenerator
                            activeProject={activeProject}
                            personas={personas}
                            onApproveScenario={onApproveScenario}
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
                ) : (
                    <div className="h-full overflow-y-auto custom-scrollbar p-0 animate-in slide-in-from-right-4 duration-300 fade-in">
                        <TestGenerator
                            activeProject={activeProject}
                            personas={personas}
                            onCertify={(script, sourceIds) => {
                                // Adapt to match what App.tsx was doing or expects
                                // TestGenerator calls onCertify with partial script and source IDs
                                // We might need to handle this here or pass it up.
                                // For now assuming onRegisterScript handles the final script.
                                // BUT wait, TestGenerator's onCertify signature is: (script: Partial<TestScript>, sourceScenarioIds: string[]) => void;
                                // App.tsx's handleRegisterManualScript takes (script: TestScript)
                                // There is a mismatch. App.tsx didn't seem to pass onCertify to TestGenerator in the snippet I saw?
                                // Let's re-check App.tsx snippet.
                                // App.tsx was passing: onRegister={handleRegisterManualScript} for GENERATOR view.
                                // But TestGenerator definition says: onCertify.
                                // So I need to bridge this.
                                if (script.name && script.code) {
                                    // Cast to TestScript or handle accordingly
                                    onRegisterScript(script as TestScript);
                                }
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIGeneratorView;
