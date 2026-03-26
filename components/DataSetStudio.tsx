import React, { useState, useEffect } from 'react';
import {
    Database, Sparkles, Save, RotateCcw, Tablet, Search,
    CheckCircle2, AlertCircle, Plus, Trash2, Layout, Table as TableIcon,
    ShieldAlert, UserCheck, Zap, Loader2, List, Globe, Smartphone
} from 'lucide-react';
import { Project, TestScript, TestCase, Persona } from '../types';
import { testApi } from '../api/test';

interface DataSetStudioProps {
    activeProject: Project;
    onAlert: (title: string, msg: string, type: 'success' | 'error' | 'info') => void;
}

interface GeneratedDataRow {
    field: string;
    value: string;
    type: string;
    description: string;
    expected_result?: string;
}

const DataSetStudio: React.FC<DataSetStudioProps> = ({ activeProject, onAlert }) => {
    const [scripts, setScripts] = useState<TestScript[]>([]);
    const [loadingScripts, setLoadingScripts] = useState(true);
    const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
    const [listSearch, setListSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

    const [dataTypes, setDataTypes] = useState<string[]>(['VALID', 'INVALID']);
    const [variationCount, setVariationCount] = useState(3);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedData, setGeneratedData] = useState<GeneratedDataRow[]>([]);

    const selectedScript = scripts.find(s => s.id === selectedScriptId);

    useEffect(() => {
        fetchScripts();
    }, [activeProject.id]);

    const fetchScripts = async () => {
        setLoadingScripts(true);
        try {
            const data = await testApi.getScripts(activeProject.id);
            // Filter for AI Generated or Step scripts that might need data
            setScripts(data.filter(s => s.origin === 'AI' || s.origin === 'STEP' || s.origin === 'AI_EXPLORATION'));
        } catch (err) {
            console.error("Failed to fetch scripts", err);
        } finally {
            setLoadingScripts(false);
        }
    };

    const uniqueCategories = Array.from(new Set(scripts.map(s => s.category).filter(Boolean))) as string[];

    const filteredScripts = scripts.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(listSearch.toLowerCase()) ||
            s.description?.toLowerCase().includes(listSearch.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || s.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const toggleDataType = (type: string) => {
        setDataTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const handleGenerateData = async () => {
        if (!selectedScript) return;
        setIsGenerating(true);
        try {
            // Use the script's name and description (and steps if possible) as scenario context
            const scenarioContext = [{
                title: selectedScript.name,
                description: selectedScript.description,
                testCases: [{ title: 'Main Flow', steps: selectedScript.steps?.map((s: any) => s.description || s.action) || [] }]
            }];

            const result = await testApi.generateData(scenarioContext, dataTypes, variationCount);
            setGeneratedData(result.data);
            onAlert("성공", `${result.data.length}개의 테스트 데이터가 생성되었습니다.`, 'success');
        } catch (err) {
            console.error("Data generation failed", err);
            onAlert("오류", "데이터 생성 중 문제가 발생했습니다.", 'error');
        } finally {
            setIsGenerating(false);
        }
    };


    const handleSaveDataset = async () => {
        if (!selectedScript || generatedData.length === 0) return;

        try {
            // Update script with the new dataset
            // The current dataset structure in DB is JSON
            const updatedScript = await testApi.updateScript(selectedScript.id, {
                dataset: generatedData
            });

            setScripts(prev => prev.map(s => s.id === updatedScript.id ? updatedScript : s));
            onAlert("저장 완료", "데이터셋이 성공적으로 매핑되었습니다.", 'success');
        } catch (err) {
            console.error("Failed to save dataset", err);
            onAlert("오류", "데이터셋 저장에 실패했습니다.", 'error');
        }
    };

    return (
        <div className="flex h-full w-full gap-8 p-8 overflow-hidden bg-gray-50 dark:bg-[#0c0e12]">
            {/* Sidebar: Asset List */}
            <div className="w-[500px] flex flex-col shrink-0 overflow-y-auto custom-scrollbar pr-2 pb-2 transition-all">
                <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl flex flex-col shadow-sm overflow-hidden mb-8 shrink-0 transition-colors">
                    <div className="px-8 py-7 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl transition-all">
                                <Database className="w-6 h-6 text-indigo-500" />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-[13px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-[0.15em] leading-tight">
                                    Verified Test Assets
                                </h2>
                                <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight">
                                    Queue: {filteredScripts.length} Assets
                                </p>
                            </div>
                        </div>
                        <button onClick={fetchScripts} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 transition-colors"><RotateCcw className="w-4 h-4" /></button>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                value={listSearch}
                                onChange={e => setListSearch(e.target.value)}
                                placeholder="Search verified assets..."
                                className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-xl py-3 pl-11 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                            />
                        </div>

                        {uniqueCategories.length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
                                <button onClick={() => setSelectedCategory('ALL')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedCategory === 'ALL' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'} `}>ALL</button>
                                {uniqueCategories.map(cat => (
                                    <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'} `}>
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="px-4 py-2 flex items-center justify-between shrink-0">
                    <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Database className="w-3 h-3" /> Asset Repository
                    </h3>
                    <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full uppercase tracking-widest">{filteredScripts.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                    {loadingScripts ? (
                        <div className="py-20 flex flex-col items-center opacity-40 animate-pulse">
                            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                            <p className="text-[11px] font-black uppercase tracking-widest">Hydrating Assets...</p>
                        </div>
                    ) : filteredScripts.length === 0 ? (
                        <div className="py-20 flex flex-col items-center text-center opacity-30">
                            <Database className="w-20 h-20 mb-6 text-gray-300" />
                            <p className="text-xs font-black uppercase tracking-[0.2em]">No Matching Assets</p>
                        </div>
                    ) : (
                        filteredScripts.map(s => {
                            const isSelected = selectedScriptId === s.id;
                            return (
                                <div key={s.id} onClick={() => { setSelectedScriptId(s.id); setGeneratedData(s.dataset || []); }} className={`bg-white dark:bg-[#16191f] border transition-all duration-500 rounded-3xl overflow-hidden cursor-pointer ${isSelected ? 'border-indigo-400 shadow-xl ring-2 ring-indigo-500/10' : 'border-gray-200 dark:border-gray-800 shadow-sm hover:border-indigo-300'} `}>
                                    <div className="p-6 px-8 flex items-center justify-between">
                                        <div className="flex items-center gap-6 flex-1 min-w-0">
                                            <div className={`p-2.5 rounded-2xl transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-110' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:bg-indigo-50'}`}>
                                                {s.platform === 'APP' ? <Smartphone className="w-6 h-6" /> : <Globe className="w-6 h-6" />}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="text-[13px] font-black text-gray-800 dark:text-gray-100 uppercase tracking-[0.05em] truncate">{s.name}</h3>
                                                    {s.category && (
                                                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8px] font-black rounded uppercase tracking-widest">{s.category}</span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Data Rows: {s.dataset?.length || 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Main Studio Area */}
            <div className="flex-1 flex flex-col overflow-hidden transition-all h-full bg-white dark:bg-[#111318] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-sm">
                {selectedScript ? (
                    <div className="flex flex-col h-full animate-in fade-in transition-colors">
                        {/* Unified Console Header */}
                        <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white/50 dark:bg-white/5 backdrop-blur-sm shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-indigo-600/10 text-indigo-600 rounded-xl shadow-inner transition-all">
                                    <Sparkles className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-3 mb-0.5">
                                        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{selectedScript.name}</h2>
                                        <span className={`px-2 py-0.5 bg-green-500/10 text-green-500 text-[8px] font-black uppercase tracking-widest rounded-full border border-green-500/20`}>VERIFIED</span>
                                    </div>
                                    <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                        ENGINE: INTELLIGENT DATASET STUDIO
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    disabled={isGenerating}
                                    onClick={handleGenerateData}
                                    className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200"
                                >
                                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Sparkles className="w-4 h-4 fill-current text-white" />}
                                    Generate
                                </button>
                                <button
                                    disabled={generatedData.length === 0}
                                    onClick={handleSaveDataset}
                                    className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200"
                                >
                                    <Save className="w-4 h-4 text-white" />
                                    Apply & Save
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col overflow-hidden p-8 pt-6">

                            {/* Configuration Bar */}
                            <div className="grid grid-cols-4 gap-6 mb-8 p-6 bg-gray-50/50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-gray-800/50 shrink-0">
                                <div className="col-span-3 space-y-1.5">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Zap className="w-3 h-3 text-amber-500" /> Variations / Strategies</label>
                                    <div className="flex gap-2">
                                        {[
                                            { id: 'VALID', label: 'Valid', icon: UserCheck, color: 'text-green-500' },
                                            { id: 'INVALID', label: 'Invalid', icon: AlertCircle, color: 'text-amber-500' },
                                            { id: 'SECURITY', label: 'Security', icon: ShieldAlert, color: 'text-red-500' }
                                        ].map(type => (
                                            <button
                                                key={type.id}
                                                onClick={() => toggleDataType(type.id)}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${dataTypes.includes(type.id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white dark:bg-black/20 border-gray-200 dark:border-gray-800 text-gray-500'} `}
                                            >
                                                <type.icon className={`w-3.5 h-3.5 ${dataTypes.includes(type.id) ? 'text-white' : type.color}`} />
                                                {type.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2"><List className="w-3 h-3" /> Rows</label>
                                    <select
                                        value={variationCount}
                                        onChange={e => setVariationCount(Number(e.target.value))}
                                        className="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
                                    >
                                        {[3, 5, 10, 20].map(c => <option key={c} value={c}>{c} Samples</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Data Grid Area */}
                            <div className="flex-1 bg-gray-50 dark:bg-black/30 rounded-3xl border border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden shadow-inner p-1">
                                <div className="flex flex-col flex-1 overflow-hidden transition-colors">
                                    <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white/40 dark:bg-white/5 backdrop-blur-sm transition-colors">
                                        <div className="flex items-center gap-3">
                                            <TableIcon className="w-5 h-5 text-indigo-500" />
                                            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight transition-colors">DataSet Mapping Table</h3>
                                        </div>
                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-4 transition-colors">
                                            <span>Total Rows: {generatedData.length}</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-auto custom-scrollbar">
                                        {generatedData.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 space-y-4 py-20">
                                                <TableIcon className="w-20 h-20 mb-4 opacity-10" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 italic">Ready to hydrate intelligent dataset</p>
                                            </div>
                                        ) : (
                                            <table className="w-full text-left border-collapse transition-colors table-fixed">
                                                <thead className="sticky top-0 bg-gray-100/80 dark:bg-gray-900/80 backdrop-blur-md z-10 transition-colors">
                                                    <tr>
                                                        <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 transition-colors w-[150px]">Field Name</th>
                                                        <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 transition-colors w-[180px]">Generated Value</th>
                                                        <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 transition-colors w-[110px]">Type</th>
                                                        <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 transition-colors w-[220px]">Expected UI State</th>
                                                        <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 transition-colors">Rational Reasoning</th>
                                                        <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 transition-colors w-[100px] text-center">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100/50 dark:divide-gray-800/50 transition-colors">
                                                    {generatedData.map((row, idx) => (
                                                        <tr key={idx} className="group hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-colors">
                                                            <td className="px-8 py-5 text-[11px] font-black text-gray-800 dark:text-gray-200">
                                                                {row.field}
                                                            </td>
                                                            <td className="px-8 py-5">
                                                                <input
                                                                    type="text"
                                                                    value={row.value}
                                                                    onChange={(e) => {
                                                                        const newData = [...generatedData];
                                                                        newData[idx].value = e.target.value;
                                                                        setGeneratedData(newData);
                                                                    }}
                                                                    className="w-full text-[11px] font-black font-mono text-indigo-600 dark:text-indigo-400 bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-800 px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                                                                />
                                                            </td>
                                                            <td className="px-8 py-5">
                                                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${row.type === 'VALID' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                                                    row.type === 'SECURITY' ? 'bg-red-500/10 text-red-600 border border-red-500/20' :
                                                                        'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                                                    }`}>
                                                                    {row.type}
                                                                </span>
                                                            </td>
                                                            <td className="px-8 py-5">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Expected state..."
                                                                    value={row.expected_result || ''}
                                                                    onChange={(e) => {
                                                                        const newData = [...generatedData];
                                                                        newData[idx].expected_result = e.target.value;
                                                                        setGeneratedData(newData);
                                                                    }}
                                                                    className="w-full text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-800 px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm"
                                                                />
                                                            </td>
                                                            <td className="px-8 py-5">
                                                                <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed transition-colors">{row.description}</div>
                                                            </td>
                                                            <td className="px-8 py-5 text-center">
                                                                <button
                                                                    onClick={() => setGeneratedData(prev => prev.filter((_, i) => i !== idx))}
                                                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors bg-gray-50 dark:bg-gray-800 rounded-lg hover:shadow-sm"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-20 text-center transition-all">
                        <Database className="w-16 h-16 text-indigo-500 opacity-20 mb-8" />
                        <h2 className="text-2xl font-black uppercase tracking-[0.2em] text-gray-800 dark:text-gray-200 mb-4 transition-colors opacity-40">DataSet Studio</h2>
                        <p className="max-w-md text-[10px] font-bold uppercase tracking-[0.15em] leading-[2] transition-colors opacity-30 px-10">
                            Select a verified test asset to create and map intelligent datasets.<br />
                            Automatically configure valid, invalid, and security scenarios.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataSetStudio;
