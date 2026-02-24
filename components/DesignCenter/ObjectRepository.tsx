import React, { useState, useEffect } from 'react';
import { Project, TestObject } from '../../types';
import { assetsApi } from '../../api/assets';
import { Search, Plus, Trash2, Edit3, Save, X, Target, CheckCircle2 } from 'lucide-react';

interface ObjectRepositoryProps {
    activeProject: Project;
    onAlert: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

const ObjectRepository: React.FC<ObjectRepositoryProps> = ({ activeProject, onAlert }) => {
    const [objects, setObjects] = useState<TestObject[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activePlatform, setActivePlatform] = useState<'WEB' | 'APP' | 'COMMON'>('WEB');
    const [isEditing, setIsEditing] = useState(false);
    const [currentObject, setCurrentObject] = useState<Partial<TestObject>>({});

    useEffect(() => {
        loadObjects();
    }, [activeProject.id, activePlatform]);

    const loadObjects = async () => {
        setLoading(true);
        try {
            const data = await assetsApi.getObjects(activeProject.id, activePlatform);
            setObjects(data);
        } catch (e) {
            console.error(e);
            onAlert("Error", "Failed to load objects", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            if (currentObject.id) {
                await assetsApi.updateObject(currentObject.id, currentObject);
                onAlert("Success", "Object updated", "success");
            } else {
                await assetsApi.createObject({
                    ...currentObject,
                    projectId: activeProject.id,
                    is_active: true,
                    platform: activePlatform
                });
                onAlert("Success", "Object created", "success");
            }
            setIsEditing(false);
            loadObjects();
        } catch (e) {
            console.error(e);
            onAlert("Error", "Failed to save object", "error");
        }
    };

    const filteredObjects = objects.filter(o =>
        o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.value.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search objects..."
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
                    onClick={() => { setCurrentObject({ selector_type: activePlatform === 'WEB' ? 'css' : 'ACCESSIBILITY_ID', platform: activePlatform }); setIsEditing(true); }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> New Object
                </button>
            </div>

            <div className="flex-1 overflow-auto bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                        <tr>
                            <th className="px-6 py-3 text-xs font-black text-gray-500 uppercase tracking-wider w-1/5">Name</th>
                            <th className="px-6 py-3 text-xs font-black text-gray-500 uppercase tracking-wider w-[10%]">Type</th>
                            <th className="px-6 py-3 text-xs font-black text-gray-500 uppercase tracking-wider w-1/4">Value</th>
                            <th className="px-6 py-3 text-xs font-black text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-xs font-black text-gray-500 uppercase tracking-wider w-[10%]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {filteredObjects.map(obj => (
                            <tr key={obj.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white text-sm">{obj.name}</td>
                                <td className="px-6 py-4 text-xs text-gray-500 uppercase font-bold">{obj.selector_type}</td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono truncate max-w-[200px]" title={obj.value}>{obj.value}</td>
                                <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 italic truncate max-w-xs" title={obj.description}>{obj.description || '-'}</td>
                                <td className="px-6 py-4 flex gap-2">
                                    <button onClick={() => { setCurrentObject(obj); setIsEditing(true); }} className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"><Edit3 className="w-4 h-4" /></button>
                                </td>
                            </tr>
                        ))}
                        {filteredObjects.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Target className="w-8 h-8 opacity-20" />
                                        <p className="text-sm">No objects found.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-[#16191f] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white">Define Test Object</h3>
                            <button onClick={() => setIsEditing(false)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Name</label>
                                <input
                                    value={currentObject.name || ''}
                                    onChange={e => setCurrentObject({ ...currentObject, name: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm"
                                    placeholder="e.g. Login Button"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Type</label>
                                    <select
                                        value={currentObject.selector_type}
                                        onChange={e => setCurrentObject({ ...currentObject, selector_type: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <option value="css">CSS</option>
                                        <option value="xpath">XPath</option>
                                        <option value="id">ID</option>
                                        <option value="text">Text</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Value</label>
                                    <input
                                        value={currentObject.value || ''}
                                        onChange={e => setCurrentObject({ ...currentObject, value: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm font-mono"
                                        placeholder=".btn-login"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Description</label>
                                <textarea
                                    value={currentObject.description || ''}
                                    onChange={e => setCurrentObject({ ...currentObject, description: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm h-20 resize-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Platform</label>
                                <div className="flex gap-2">
                                    {['WEB', 'APP', 'COMMON'].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setCurrentObject({ ...currentObject, platform: p as any })}
                                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${currentObject.platform === p
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                                : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 hover:border-gray-300'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 flex justify-end gap-2">
                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 text-sm font-bold">Cancel</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                                <Save className="w-4 h-4" /> Save Object
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ObjectRepository;
