import React, { useState, useEffect } from 'react';
import { Project, TestAction, TestObject, TestDataset } from '../../types';
import { assetsApi } from '../../api/assets';
import { Search, Plus, Edit3, Save, X, Zap, Trash2, CheckCircle2, Link, Database } from 'lucide-react';

interface ActionLibraryProps {
    activeProject: Project;
    onAlert: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

const ActionLibrary: React.FC<ActionLibraryProps> = ({ activeProject, onAlert }) => {
    const [actions, setActions] = useState<TestAction[]>([]);
    const [objects, setObjects] = useState<TestObject[]>([]);
    const [datasets, setDatasets] = useState<TestDataset[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activePlatform, setActivePlatform] = useState<'WEB' | 'APP' | 'COMMON'>('WEB');
    const [isEditing, setIsEditing] = useState(false);
    const [currentAction, setCurrentAction] = useState<Partial<TestAction>>({});

    useEffect(() => {
        loadActions();
        loadObjects();
        loadDatasets();
    }, [activeProject.id, activePlatform]);

    const loadObjects = async () => {
        try {
            const data = await assetsApi.getObjects(activeProject.id, activePlatform);
            setObjects(data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadDatasets = async () => {
        try {
            const data = await assetsApi.getDatasets(activeProject.id);
            setDatasets(data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadActions = async () => {
        setLoading(true);
        try {
            const data = await assetsApi.getActions(activeProject.id, activePlatform);
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
                projectId: activeProject.id, // Default to current project
                platform: activePlatform,
                is_active: true
            };

            if (currentAction.id) {
                await assetsApi.updateAction(currentAction.id, actionData as any);
                onAlert("Success", "Action updated", "success");
            } else {
                await assetsApi.createAction(actionData as any);
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
                <div className="flex items-center gap-4">
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
                    <div className="bg-gray-100 dark:bg-gray-900 p-1 rounded-xl flex gap-1">
                        {(['WEB', 'APP', 'COMMON'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setActivePlatform(p)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${activePlatform === p
                                    ? 'bg-white dark:bg-[#16191f] text-indigo-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    onClick={() => {
                        setCurrentAction({
                            category: 'Custom',
                            code_content: activePlatform === 'WEB' ? 'def my_action(page):\n    # TODO: Implement action\n    pass' : 'def my_action(driver):\n    # TODO: Implement action\n    pass',
                            parameters: [],
                            platform: activePlatform
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
                    <div key={action.id} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer group relative flex flex-col h-[320px]">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${action.projectId ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'}`}>
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-gray-900 dark:text-white truncate pr-6">{action.name}</h3>
                                    <div className="flex gap-2 mt-1">
                                        <span className="text-[8px] font-black uppercase bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded tracking-widest">
                                            {action.category}
                                        </span>
                                        <span className="text-[8px] font-black uppercase bg-indigo-50 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded tracking-widest">
                                            {action.platform}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setCurrentAction(action); setIsEditing(true); }}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Edit3 className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-[10px] text-gray-500 italic mb-4 line-clamp-2 min-h-[30px]">{action.description || 'No description'}</p>

                        <div className="flex-1 min-h-0 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 font-mono text-[10px] text-gray-600 dark:text-gray-400 mb-4 overflow-hidden relative border border-gray-100 dark:border-gray-800/50">
                            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-gray-50 dark:from-gray-900 to-transparent z-10 pointer-events-none" />
                            <pre className="whitespace-pre-wrap">{action.code_content}</pre>
                        </div>

                        <div className="space-y-2 mt-auto">
                            <div className="flex items-center gap-2 text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">
                                <Link className="w-3 h-3 text-indigo-400" />
                                Linked Objects: {action.associatedObjectIds?.length || 0}
                            </div>
                            <div className="flex flex-wrap gap-1 min-h-[16px]">
                                {action.associatedObjectIds?.slice(0, 3).map(id => {
                                    const obj = objects.find(o => o.id === id);
                                    return obj ? (
                                        <span key={id} className="text-[8px] bg-indigo-50 dark:bg-indigo-500/5 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-500/10 truncate max-w-[80px]">
                                            {obj.name}
                                        </span>
                                    ) : null;
                                })}
                            </div>

                            <div className="flex items-center gap-2 text-[8px] font-black text-gray-400 uppercase tracking-widest px-1 pt-1 border-t border-gray-100 dark:border-gray-800">
                                <Database className="w-3 h-3 text-emerald-400" />
                                Global Data: {action.associatedDatasetIds?.length || 0}
                            </div>
                            <div className="flex flex-wrap gap-1 min-h-[16px]">
                                {action.associatedDatasetIds?.slice(0, 3).map(id => {
                                    const ds = datasets.find(d => d.id === id);
                                    return ds ? (
                                        <span key={id} className="text-[8px] bg-emerald-50 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-500/10 truncate max-w-[80px]">
                                            {ds.name}
                                        </span>
                                    ) : null;
                                })}
                            </div>
                        </div>
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
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Platform</label>
                                <div className="flex gap-2">
                                    {['WEB', 'APP', 'COMMON'].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setCurrentAction({ ...currentAction, platform: p as any })}
                                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${currentAction.platform === p
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                                : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 hover:border-gray-300'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                             <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Associated Objects (Direct Linkage)</label>
                                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 max-h-24 overflow-y-auto custom-scrollbar mb-4">
                                    <div className="grid grid-cols-2 gap-2">
                                        {objects.map(obj => (
                                            <label key={obj.id} className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={currentAction.associatedObjectIds?.includes(obj.id)}
                                                    onChange={(e) => {
                                                        const ids = currentAction.associatedObjectIds || [];
                                                        if (e.target.checked) setCurrentAction({ ...currentAction, associatedObjectIds: [...ids, obj.id] });
                                                        else setCurrentAction({ ...currentAction, associatedObjectIds: ids.filter(id => id !== obj.id) });
                                                    }}
                                                    className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 group-hover:text-indigo-500 transition-colors truncate">
                                                    {obj.name}
                                                </span>
                                            </label>
                                        ))}
                                        {objects.length === 0 && <p className="text-[10px] text-gray-500 italic">No objects found.</p>}
                                    </div>
                                </div>

                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Global Data Mapping (Reusable Datasets)</label>
                                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 max-h-24 overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-2 gap-2">
                                        {datasets.map(ds => (
                                            <label key={ds.id} className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={currentAction.associatedDatasetIds?.includes(ds.id)}
                                                    onChange={(e) => {
                                                        const ids = currentAction.associatedDatasetIds || [];
                                                        if (e.target.checked) setCurrentAction({ ...currentAction, associatedDatasetIds: [...ids, ds.id] });
                                                        else setCurrentAction({ ...currentAction, associatedDatasetIds: ids.filter(id => id !== ds.id) });
                                                    }}
                                                    className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 group-hover:text-emerald-500 transition-colors truncate">
                                                    {ds.name}
                                                </span>
                                            </label>
                                        ))}
                                        {datasets.length === 0 && <p className="text-[10px] text-gray-500 italic">No global data found.</p>}
                                    </div>
                                </div>
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
