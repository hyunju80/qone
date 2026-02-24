import React, { useState, useEffect } from 'react';
import { Project, TestDataset } from '../../types';
import { assetsApi } from '../../api/assets';
import { Search, Plus, Edit3, Save, X, Database, Trash2 } from 'lucide-react';

interface DataManagementProps {
    activeProject: Project;
    onAlert: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ activeProject, onAlert }) => {
    const [datasets, setDatasets] = useState<TestDataset[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activePlatform, setActivePlatform] = useState<'WEB' | 'APP' | 'COMMON'>('WEB');
    const [isEditing, setIsEditing] = useState(false);
    const [currentDataset, setCurrentDataset] = useState<Partial<TestDataset>>({});

    useEffect(() => {
        loadDatasets();
    }, [activeProject.id, activePlatform]);

    const loadDatasets = async () => {
        setLoading(true);
        try {
            const data = await assetsApi.getDatasets(activeProject.id, activePlatform);
            setDatasets(data);
        } catch (e) {
            console.error(e);
            onAlert("Error", "Failed to load datasets", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            if (currentDataset.id) {
                // Update logic
                await assetsApi.updateDataset(currentDataset.id, currentDataset);
                onAlert("Success", "Dataset updated", "success");
            } else {
                await assetsApi.createDataset({
                    ...currentDataset,
                    projectId: activeProject.id,
                    platform: activePlatform,
                    is_active: true,
                    generation_source: 'MANUAL'
                });
                onAlert("Success", "Dataset created", "success");
            }
            setIsEditing(false);
            loadDatasets();
        } catch (e) {
            console.error(e);
            onAlert("Error", "Failed to save dataset", "error");
        }
    };

    const addKeyValuePair = () => {
        const currentData = currentDataset.data || [];
        setCurrentDataset({
            ...currentDataset,
            data: [...currentData, { key: '', value: '', type: 'string', description: '' }]
        });
    };

    const updateKeyValuePair = (index: number, field: string, value: string) => {
        const currentData = [...(currentDataset.data || [])];
        currentData[index] = { ...currentData[index], [field]: value };
        setCurrentDataset({ ...currentDataset, data: currentData });
    };

    const removeKeyValuePair = (index: number) => {
        const currentData = [...(currentDataset.data || [])];
        currentData.splice(index, 1);
        setCurrentDataset({ ...currentDataset, data: currentData });
    };

    const filteredDatasets = datasets.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search datasets..."
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
                        setCurrentDataset({
                            classification: 'VALID',
                            platform: activePlatform,
                            data: [{ key: 'username', value: 'testuser', type: 'string', description: 'Login ID' }]
                        });
                        setIsEditing(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> New Dataset
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-auto pb-20">
                {filteredDatasets.map(dataset => (
                    <div key={dataset.id} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-indigo-500 transition-all cursor-pointer group relative">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                                <div className={`p-2 rounded-lg bg-indigo-100 text-indigo-600`}>
                                    <Database className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">{dataset.name}</h3>
                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${dataset.classification === 'VALID' ? 'bg-green-100 text-green-600' :
                                        dataset.classification === 'INVALID' ? 'bg-red-100 text-red-600' :
                                            dataset.classification === 'SECURITY' ? 'bg-purple-100 text-purple-600' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>
                                        {dataset.classification}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mb-4 line-clamp-2 h-8">{dataset.description || 'No description'}</p>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 mb-4 h-24 overflow-auto">
                            {dataset.data.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="flex justify-between mb-1 border-b border-gray-200 dark:border-gray-800 last:border-0 pb-1 last:pb-0">
                                    <span className="font-bold">{item.key}</span>
                                    <span className="font-mono text-gray-500 truncate max-w-[100px]">{item.value}</span>
                                </div>
                            ))}
                            {dataset.data.length > 3 && <div className="text-center text-[10px] text-gray-400 mt-1">+{dataset.data.length - 3} more items</div>}
                        </div>
                        <button
                            onClick={() => { setCurrentDataset(dataset); setIsEditing(true); }}
                            className="w-full py-2 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-600 hover:text-white text-gray-600 dark:text-gray-400 rounded-lg text-xs font-bold transition-all"
                        >
                            Edit Data
                        </button>
                    </div>
                ))}
            </div>

            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-[#16191f] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white">Define Test Dataset</h3>
                            <button onClick={() => setIsEditing(false)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Name</label>
                                    <input
                                        value={currentDataset.name || ''}
                                        onChange={e => setCurrentDataset({ ...currentDataset, name: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm"
                                        placeholder="e.g. Valid Login User"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Classification</label>
                                    <select
                                        value={currentDataset.classification}
                                        onChange={e => setCurrentDataset({ ...currentDataset, classification: e.target.value as any })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <option value="VALID">VALID</option>
                                        <option value="INVALID">INVALID</option>
                                        <option value="SECURITY">SECURITY</option>
                                        <option value="EDGE_CASE">EDGE CASE</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Description</label>
                                <textarea
                                    value={currentDataset.description || ''}
                                    onChange={e => setCurrentDataset({ ...currentDataset, description: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm h-16 resize-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Platform</label>
                                <div className="flex gap-2 mb-2">
                                    {['WEB', 'APP', 'COMMON'].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setCurrentDataset({ ...currentDataset, platform: p as any })}
                                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${currentDataset.platform === p
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
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase block">Data Pairs (Key-Value)</label>
                                    <button onClick={addKeyValuePair} className="text-xs text-indigo-600 font-bold hover:underline">+ Add Item</button>
                                </div>
                                <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-900">
                                            <tr>
                                                <th className="px-3 py-2 text-xs font-black text-gray-500 uppercase w-1/4">Key</th>
                                                <th className="px-3 py-2 text-xs font-black text-gray-500 uppercase w-1/3">Value</th>
                                                <th className="px-3 py-2 text-xs font-black text-gray-500 uppercase">Description</th>
                                                <th className="px-3 py-2 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                            {currentDataset.data?.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="p-2">
                                                        <input
                                                            value={item.key}
                                                            onChange={e => updateKeyValuePair(idx, 'key', e.target.value)}
                                                            className="w-full bg-transparent border-none outline-none focus:ring-0 font-bold text-gray-900 dark:text-white placeholder-gray-400"
                                                            placeholder="Key"
                                                        />
                                                    </td>
                                                    <td className="p-2 border-l border-gray-100 dark:border-gray-800">
                                                        <input
                                                            value={item.value}
                                                            onChange={e => updateKeyValuePair(idx, 'value', e.target.value)}
                                                            className="w-full bg-transparent border-none outline-none focus:ring-0 font-mono text-indigo-600 placeholder-gray-400"
                                                            placeholder="Value"
                                                        />
                                                    </td>
                                                    <td className="p-2 border-l border-gray-100 dark:border-gray-800">
                                                        <input
                                                            value={item.description || ''}
                                                            onChange={e => updateKeyValuePair(idx, 'description', e.target.value)}
                                                            className="w-full bg-transparent border-none outline-none focus:ring-0 text-gray-500 placeholder-gray-400"
                                                            placeholder="Description"
                                                        />
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <button onClick={() => removeKeyValuePair(idx)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 flex justify-end gap-2 shrink-0">
                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 text-sm font-bold">Cancel</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                                <Save className="w-4 h-4" /> Save Dataset
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataManagement;
