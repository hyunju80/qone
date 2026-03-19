import React, { useState, useEffect } from 'react';
import { Project, TestDataset } from '../../types';
import { assetsApi } from '../../api/assets';
import { Search, Plus, Edit3, Save, X, Database, Trash2, CheckCircle2, Link, ShieldCheck, AlertTriangle, ShieldAlert, List } from 'lucide-react';

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

    const addField = () => {
        const fields = currentDataset.fields || [];
        setCurrentDataset({
            ...currentDataset,
            fields: [...fields, { key: 'new_field', type: 'string', description: '' }]
        });
    };

    const updateField = (index: number, fieldName: string, value: string) => {
        const fields = [...(currentDataset.fields || [])];
        fields[index] = { ...fields[index], [fieldName]: value };
        setCurrentDataset({ ...currentDataset, fields });
    };

    const removeField = (index: number) => {
        const fields = [...(currentDataset.fields || [])];
        const removedFieldKey = fields[index].key;
        fields.splice(index, 1);
        
        // Remove this field from all records as well
        const records = (currentDataset.records || []).map(rec => {
            const { [removedFieldKey]: _, ...rest } = rec;
            return rest;
        });

        setCurrentDataset({ ...currentDataset, fields, records });
    };

    const addRecord = () => {
        const records = currentDataset.records || [];
        const newRecord: Record<string, string> = {};
        (currentDataset.fields || []).forEach(f => {
            newRecord[f.key] = '';
        });
        setCurrentDataset({
            ...currentDataset,
            records: [...records, newRecord]
        });
    };

    const updateRecord = (rowIndex: number, fieldKey: string, value: string) => {
        const records = [...(currentDataset.records || [])];
        records[rowIndex] = { ...records[rowIndex], [fieldKey]: value };
        setCurrentDataset({ ...currentDataset, records });
    };

    const removeRecord = (rowIndex: number) => {
        const records = [...(currentDataset.records || [])];
        records.splice(rowIndex, 1);
        setCurrentDataset({ ...currentDataset, records });
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
                            name: '',
                            description: '',
                            classification: 'VALID',
                            platform: activePlatform,
                            fields: [],
                            records: []
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
                    <div key={dataset.id} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer group relative flex flex-col h-[320px]">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400`}>
                                    <Database className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-gray-900 dark:text-white truncate pr-6">{dataset.name}</h3>
                                    <div className="flex gap-2 mt-1">
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest ${
                                            dataset.classification === 'VALID' ? 'bg-green-50 dark:bg-green-500/10 text-green-600' :
                                            dataset.classification === 'INVALID' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600' :
                                            'bg-purple-50 dark:bg-purple-500/10 text-purple-600'
                                        }`}>
                                            {dataset.classification}
                                        </span>
                                        <span className="text-[8px] font-black uppercase bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded tracking-widest">
                                            {dataset.platform}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setCurrentDataset(dataset); setIsEditing(true); }}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Edit3 className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-[10px] text-gray-500 italic mb-4 line-clamp-2 min-h-[30px]">{dataset.description || 'No description'}</p>

                        <div className="flex-1 min-h-0 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-[10px] text-gray-600 dark:text-gray-400 mb-4 overflow-auto border border-gray-100 dark:border-gray-800/50 custom-scrollbar">
                            <div className="flex gap-2 mb-2 border-b border-gray-100 dark:border-gray-800 pb-1.5 overflow-x-auto">
                                {dataset.fields?.map((f, i) => (
                                    <span key={i} className="font-black text-gray-400 uppercase text-[8px] tracking-tighter shrink-0">{f.key}</span>
                                ))}
                            </div>
                            <div className="space-y-1.5">
                                {dataset.records?.slice(0, 3).map((rec, i) => (
                                    <div key={i} className="flex gap-2 text-[9px] font-mono border-b border-gray-50 dark:border-white/5 last:border-0 pb-1 opacity-70">
                                        {dataset.fields.map((f, fi) => (
                                            <span key={fi} className="truncate max-w-[60px]">{rec[f.key]}</span>
                                        ))}
                                    </div>
                                ))}
                                {(dataset.records?.length || 0) > 3 && (
                                    <div className="text-[8px] text-gray-400 italic">+{dataset.records.length - 3} more rows...</div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between mb-4 px-1">
                            <div className="flex items-center gap-2 text-[8px] font-black text-gray-400 uppercase tracking-widest">
                                <List className="w-3 h-3 text-indigo-400" />
                                {dataset.fields?.length || 0} Fields / {dataset.records?.length || 0} Records
                            </div>
                        </div>

                        <div className="space-y-2 mt-auto">
                            <div className="flex items-center gap-2 text-[8px] font-black text-gray-400 uppercase tracking-widest opacity-50">
                                <Link className="w-3 h-3 text-gray-400" />
                                No direct references found
                            </div>
                        </div>
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
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest block">1. Schema Definition (Columns)</label>
                                    <button onClick={addField} className="text-[10px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 px-2 py-1 rounded-lg font-bold hover:bg-indigo-100 transition-colors">+ Add Field</button>
                                </div>
                                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden mb-6">
                                    <table className="w-full text-left text-[11px]">
                                        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                                            <tr>
                                                <th className="px-3 py-2 font-black text-gray-400 uppercase w-1/3">Field Key</th>
                                                <th className="px-3 py-2 font-black text-gray-400 uppercase w-1/4">Type</th>
                                                <th className="px-3 py-2 font-black text-gray-400 uppercase">Description</th>
                                                <th className="px-3 py-2 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {currentDataset.fields?.map((field, idx) => (
                                                <tr key={idx} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                    <td className="p-2">
                                                        <input
                                                            value={field.key}
                                                            onChange={e => updateField(idx, 'key', e.target.value)}
                                                            className="w-full bg-transparent border-none outline-none focus:ring-0 font-bold text-gray-900 dark:text-white"
                                                            placeholder="e.g. user_id"
                                                        />
                                                    </td>
                                                    <td className="p-2 border-l border-gray-100 dark:border-gray-800">
                                                        <select
                                                            value={field.type}
                                                            onChange={e => updateField(idx, 'type', e.target.value)}
                                                            className="w-full bg-transparent border-none outline-none focus:ring-0 text-indigo-600 font-bold"
                                                        >
                                                            <option value="string">STRING</option>
                                                            <option value="number">NUMBER</option>
                                                            <option value="boolean">BOOLEAN</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-2 border-l border-gray-100 dark:border-gray-800">
                                                        <input
                                                            value={field.description || ''}
                                                            onChange={e => updateField(idx, 'description', e.target.value)}
                                                            className="w-full bg-transparent border-none outline-none focus:ring-0 text-gray-500"
                                                            placeholder="Optional description"
                                                        />
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <button onClick={() => removeField(idx)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest block">2. Dataset Records (Rows)</label>
                                    <button onClick={addRecord} className="text-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded-lg font-bold hover:bg-emerald-100 transition-colors">+ Add Row</button>
                                </div>
                                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
                                    <table className="w-full text-left text-[11px] min-w-full">
                                        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                                            <tr>
                                                {(currentDataset.fields || []).map((f, i) => (
                                                    <th key={i} className="px-3 py-2 font-black text-gray-400 uppercase min-w-[120px]">{f.key}</th>
                                                ))}
                                                <th className="px-3 py-2 w-10 sticky right-0 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {(currentDataset.records || []).map((record, rowIndex) => (
                                                <tr key={rowIndex} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                    {(currentDataset.fields || []).map((field, cellIndex) => (
                                                        <td key={cellIndex} className={`p-2 ${cellIndex > 0 ? 'border-l border-gray-100 dark:border-gray-800' : ''}`}>
                                                            <input
                                                                value={record[field.key] || ''}
                                                                onChange={e => updateRecord(rowIndex, field.key, e.target.value)}
                                                                className="w-full bg-transparent border-none outline-none focus:ring-0 font-mono text-indigo-600 dark:text-indigo-400"
                                                                placeholder="..."
                                                            />
                                                        </td>
                                                    ))}
                                                    <td className="p-2 text-center sticky right-0 bg-white dark:bg-[#16191f] group-hover:bg-gray-50 dark:group-hover:bg-white/5 border-l border-gray-100 dark:border-gray-800">
                                                        <button onClick={() => removeRecord(rowIndex)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(currentDataset.records?.length === 0 || !currentDataset.records) && (
                                                <tr>
                                                    <td colSpan={(currentDataset.fields?.length || 0) + 1} className="p-8 text-center text-gray-400 italic">No records added yet.</td>
                                                </tr>
                                            )}
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
