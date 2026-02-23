import React, { useState, useEffect } from 'react';
import { Project, TestAction } from '../../types';
import { assetsApi } from '../../api/assets';
import { Search, Plus, Edit3, Save, X, Zap, Trash2 } from 'lucide-react';

interface ActionLibraryProps {
    activeProject: Project;
    onAlert: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

const ActionLibrary: React.FC<ActionLibraryProps> = ({ activeProject, onAlert }) => {
    const [actions, setActions] = useState<TestAction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [currentAction, setCurrentAction] = useState<Partial<TestAction>>({});

    useEffect(() => {
        loadActions();
    }, [activeProject.id]);

    const loadActions = async () => {
        setLoading(true);
        try {
            const data = await assetsApi.getActions(activeProject.id);
            setActions(data);
        } catch (e) {
            console.error(e);
            onAlert("Error", "Failed to load actions", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            // Prepare data
            const actionData = {
                ...currentAction,
                project_id: currentAction.project_id || activeProject.id, // Default to current project if not global
                is_active: true
            };

            if (currentAction.id) {
                await assetsApi.updateAction(currentAction.id, actionData);
                onAlert("Success", "Action updated", "success");
            } else {
                await assetsApi.createAction(actionData);
                onAlert("Success", "Action created", "success");
            }
            setIsEditing(false);
            loadActions();
        } catch (e) {
            console.error(e);
            onAlert("Error", "Failed to save action", "error");
        }
    };

    const filteredActions = actions.filter(a =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search actions..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <button
                    onClick={() => {
                        setCurrentAction({
                            category: 'Custom',
                            code_content: 'def my_action(page):\n    # TODO: Implement action\n    pass',
                            parameters: []
                        });
                        setIsEditing(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> New Action
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-auto pb-20">
                {filteredActions.map(action => (
                    <div key={action.id} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-indigo-500 transition-all cursor-pointer group relative">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                                <div className={`p-2 rounded-lg ${action.project_id ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">{action.name}</h3>
                                    <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                        {action.category}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mb-4 line-clamp-2 h-8">{action.description || 'No description'}</p>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-600 dark:text-gray-400 mb-4 overflow-hidden h-24 relative">
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50 dark:to-gray-900 z-10 pointer-events-none" />
                            <pre>{action.code_content}</pre>
                        </div>
                        <button
                            onClick={() => { setCurrentAction(action); setIsEditing(true); }}
                            className="w-full py-2 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-600 hover:text-white text-gray-600 dark:text-gray-400 rounded-lg text-xs font-bold transition-all"
                        >
                            Edit Action
                        </button>
                    </div>
                ))}
            </div>

            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-[#16191f] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white">Define Test Action</h3>
                            <button onClick={() => setIsEditing(false)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Name</label>
                                    <input
                                        value={currentAction.name || ''}
                                        onChange={e => setCurrentAction({ ...currentAction, name: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm"
                                        placeholder="e.g. LoginToDashboard"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Category</label>
                                    <input
                                        value={currentAction.category || ''}
                                        onChange={e => setCurrentAction({ ...currentAction, category: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm"
                                        placeholder="e.g. Custom"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Description</label>
                                <textarea
                                    value={currentAction.description || ''}
                                    onChange={e => setCurrentAction({ ...currentAction, description: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm h-16 resize-none"
                                />
                            </div>
                            <div className="flex-1 flex flex-col">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Implementation (Python/Playwright)</label>
                                <textarea
                                    value={currentAction.code_content || ''}
                                    onChange={e => setCurrentAction({ ...currentAction, code_content: e.target.value })}
                                    className="w-full bg-gray-900 text-gray-100 border border-gray-800 rounded-lg px-4 py-3 text-sm font-mono flex-1 min-h-[200px]"
                                    placeholder="def my_action(page): ..."
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 flex justify-end gap-2 shrink-0">
                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 text-sm font-bold">Cancel</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                                <Save className="w-4 h-4" /> Save Action
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActionLibrary;
