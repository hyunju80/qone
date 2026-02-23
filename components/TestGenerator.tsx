
import React, { useState, useEffect } from 'react';
import GeneratorDashboard from './GeneratorDashboard';
import { Project, TestScript, Scenario, Persona } from '../types';
import { testApi } from '../api/test';
import { Loader2 } from 'lucide-react';

interface TestGeneratorProps {
    activeProject: Project;
    onCertify: (script: Partial<TestScript>, sourceScenarioIds: string[]) => void;
    personas: Persona[];
}

const TestGenerator: React.FC<TestGeneratorProps> = ({ activeProject, onCertify, personas }) => {
    const [loading, setLoading] = useState(true);
    const [approvedScenarios, setApprovedScenarios] = useState<Scenario[]>([]);

    useEffect(() => {
        if (activeProject) {
            setLoading(true);
            testApi.getScenarios(activeProject.id)
                .then(data => {
                    // Filter only approved scenarios that DO NOT have a golden script yet.
                    const approved = data.filter(s => s.isApproved && !s.goldenScriptId);
                    setApprovedScenarios(approved);
                })
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [activeProject]);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-[#0c0e12] transition-colors">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-indigo-600 dark:text-indigo-500 animate-spin" />
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest transition-colors">Loading Scenarios...</p>
                </div>
            </div>
        );
    };

    return (
        <GeneratorDashboard
            activeProject={activeProject}
            approvedScenarios={approvedScenarios}
            onCertify={onCertify}
            personas={personas}
        />
    );
};

export default TestGenerator;
