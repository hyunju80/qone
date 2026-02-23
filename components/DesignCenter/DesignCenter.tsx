import React, { useState } from 'react';
import { Project, User, Persona } from '../../types';
import ObjectRepository from './ObjectRepository';
import ActionLibrary from './ActionLibrary';
import DataManagement from './DataManagement';
import PersonaManager from '../PersonaManager';
import { Database, Code, Target, Layout, Users } from 'lucide-react';

interface DesignCenterProps {
    activeProject: Project;
    user: User;
    personas: Persona[];
    onAddPersona: (persona: Persona) => void;
    onUpdatePersona: (persona: Persona) => void;
    onAlert: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

const DesignCenter: React.FC<DesignCenterProps> = ({ activeProject, user, personas, onAddPersona, onUpdatePersona, onAlert }) => {
    const [activeTab, setActiveTab] = useState<'objects' | 'actions' | 'data' | 'personas'>('personas');

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0c0e12] transition-colors">
            <div className="flex-none px-6 pt-4 pb-0">
                <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
                    <button
                        onClick={() => setActiveTab('personas')}
                        className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'personas'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        <Users className="w-4 h-4" /> Personas
                    </button>
                    <button
                        onClick={() => setActiveTab('objects')}
                        className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'objects'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        <Target className="w-4 h-4" /> Object Repository
                    </button>
                    <button
                        onClick={() => setActiveTab('actions')}
                        className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'actions'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        <Code className="w-4 h-4" /> Action Library
                    </button>
                    <button
                        onClick={() => setActiveTab('data')}
                        className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'data'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        <Database className="w-4 h-4" /> Test Data
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-6">
                {activeTab === 'personas' && (
                    <PersonaManager
                        personas={personas.filter(p => (
                            p.projectId === activeProject.id ||
                            p.projectId === 'global' ||
                            !p.projectId
                        ))}
                        activeProjectId={activeProject.id}
                        onAddPersona={onAddPersona}
                        onUpdatePersona={onUpdatePersona}
                    />
                )}
                {activeTab === 'objects' && <ObjectRepository activeProject={activeProject} onAlert={onAlert} />}
                {activeTab === 'actions' && <ActionLibrary activeProject={activeProject} onAlert={onAlert} />}
                {activeTab === 'data' && <DataManagement activeProject={activeProject} onAlert={onAlert} />}
            </div>
        </div>
    );
};

export default DesignCenter;
