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
        <div className="flex h-full w-full overflow-hidden bg-gray-50 dark:bg-[#0c0e12]">
            {/* Sidebar: Asset List */}
            <div className="w-[300px] border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111318] flex flex-col shrink-0 transition-colors">
                <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-indigo-50/30 dark:bg-indigo-500/5 space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-3.5 bg-indigo-600 rounded-full" />
                            <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">Verified Test Assets</span>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                            Select a verified test asset to create and map intelligent datasets.
                        </p>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search assets..."
                            value={listSearch}
                            onChange={(e) => setListSearch(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-gray-800 rounded-xl py-2 pl-9 pr-4 text-[11px] outline-none focus:border-indigo-500/50 transition-all"
                        />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => setSelectedCategory('ALL')}
                            className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase transition-all ${selectedCategory === 'ALL' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200'}`}
                        >
                            All
                        </button>
                        {uniqueCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase transition-all ${selectedCategory === cat ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {loadingScripts ? (
                        <div className="py-20 flex flex-col items-center opacity-20">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                            <p className="text-[10px] font-black uppercase">Loading...</p>
                        </div>
                    ) : filteredScripts.length === 0 ? (
                        <div className="py-20 flex flex-col items-center opacity-20 text-center">
                            <Database className="w-12 h-12 mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No matching assets</p>
                            <p className="text-[8px] mt-1 max-w-[180px]">검색 결과가 없거나 Step 2에서 검증을 완료하고 자산을 생성하세요.</p>
                        </div>
                    ) : (
                        filteredScripts.map(s => (
                            <button
                                key={s.id}
                                onClick={() => { setSelectedScriptId(s.id); setGeneratedData(s.dataset || []); }}
                                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3 ${selectedScriptId === s.id ? 'bg-indigo-600/10 border-indigo-500 shadow-md' : 'bg-white dark:bg-[#16191f] border-gray-200 dark:border-gray-800 hover:border-gray-300'}`}
                            >
                                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg shrink-0 transition-colors">
                                    {s.platform === 'APP' ? <Smartphone className="w-4 h-4 text-indigo-500" /> : <Globe className="w-4 h-4 text-indigo-500" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs font-black text-gray-900 dark:text-gray-200 truncate">{s.name}</div>
                                        {s.category && (
                                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 text-[8px] font-black rounded uppercase shrink-0">
                                                {s.category}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[9px] text-gray-500 mt-0.5 line-clamp-1">Data Rows: {s.dataset?.length || 0}</div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Main Studio Area */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {selectedScript ? (
                    <div className="flex flex-col h-full animate-in fade-in transition-colors">
                        {/* Header / Config */}
                        <div className="px-8 py-6 bg-white dark:bg-[#111318] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between transition-colors">
                            <div className="flex items-center gap-8">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Intelligent DataSet Generation</span>
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight truncate max-w-sm">{selectedScript.name}</h2>
                                </div>

                                <div className="h-8 w-px bg-gray-100 dark:bg-gray-800" />

                                <div className="flex items-center gap-3">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Strategies:</span>
                                    <div className="flex gap-1">
                                        {[
                                            { id: 'VALID', label: 'Valid', icon: UserCheck, color: 'text-green-500' },
                                            { id: 'INVALID', label: 'Invalid', icon: AlertCircle, color: 'text-amber-500' },
                                            { id: 'SECURITY', label: 'Security', icon: ShieldAlert, color: 'text-red-500' }
                                        ].map(type => (
                                            <button
                                                key={type.id}
                                                onClick={() => toggleDataType(type.id)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase transition-all ${dataTypes.includes(type.id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white dark:bg-[#16191f] border-gray-200 dark:border-gray-800 text-gray-500'}`}
                                            >
                                                <type.icon className={`w-3 h-3 ${dataTypes.includes(type.id) ? 'text-white' : type.color}`} />
                                                {type.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Rows:</span>
                                    <select
                                        value={variationCount}
                                        onChange={e => setVariationCount(Number(e.target.value))}
                                        className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-1 text-[10px] font-black outline-none focus:border-indigo-500 transition-colors"
                                    >
                                        {[3, 5, 10, 20].map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    disabled={isGenerating}
                                    onClick={handleGenerateData}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                >
                                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 fill-current" />}
                                    Generate Data
                                </button>
                                <button
                                    disabled={generatedData.length === 0}
                                    onClick={handleSaveDataset}
                                    className="px-6 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg shadow-green-600/20 active:scale-95 transition-all"
                                >
                                    <Save className="w-4 h-4" />
                                    Apply & Save
                                </button>
                            </div>
                        </div>

                        {/* Data Grid Area */}
                        <div className="flex-1 overflow-hidden p-8 flex flex-col transition-colors">
                            <div className="bg-white dark:bg-[#111318] border border-gray-200 dark:border-gray-800 rounded-[2rem] flex flex-col flex-1 overflow-hidden shadow-sm transition-colors">
                                <div className="px-8 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between transition-colors">
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
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                                            <Search className="w-12 h-12 opacity-10" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">No data generated yet. Click 'Generate Data' above.</p>
                                        </div>
                                    ) : (
                                        <table className="w-full text-left border-collapse transition-colors table-fixed">
                                            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/50 backdrop-blur-md z-10 transition-colors">
                                                <tr>
                                                    <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 transition-colors w-[150px]">Field Name</th>
                                                    <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 transition-colors w-[150px]">Value</th>
                                                    <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 transition-colors w-[100px]">Data Type</th>
                                                    <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 transition-colors w-[200px]">Expected UI Response</th>
                                                    <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 transition-colors">Rational/Description</th>
                                                    <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 transition-colors w-[80px]">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 transition-colors">
                                                {generatedData.map((row, idx) => (
                                                    <tr key={idx} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                        <td className="px-8 py-4 text-[11px] font-black text-gray-900 dark:text-gray-200">
                                                            {row.field}
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <input
                                                                type="text"
                                                                value={row.value}
                                                                onChange={(e) => {
                                                                    const newData = [...generatedData];
                                                                    newData[idx].value = e.target.value;
                                                                    setGeneratedData(newData);
                                                                }}
                                                                className="w-full text-[11px] font-medium font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-500/20 outline-none focus:border-indigo-500 transition-colors"
                                                            />
                                                        </td>
                                                        <td className="px-8 py-4 text-[10px]">
                                                            <span className={`px-2 py-0.5 rounded font-black uppercase ${row.type === 'VALID' ? 'bg-green-100 text-green-600' :
                                                                row.type === 'SECURITY' ? 'bg-red-100 text-red-600' :
                                                                    'bg-amber-100 text-amber-600'
                                                                }`}>
                                                                {row.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <input
                                                                type="text"
                                                                placeholder="Expected UI Text..."
                                                                value={row.expected_result || ''}
                                                                onChange={(e) => {
                                                                    const newData = [...generatedData];
                                                                    newData[idx].expected_result = e.target.value;
                                                                    setGeneratedData(newData);
                                                                }}
                                                                className="w-full text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-500/20 outline-none focus:border-emerald-500 transition-colors"
                                                            />
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 transition-colors">{row.description}</div>
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <button
                                                                onClick={() => setGeneratedData(prev => prev.filter((_, i) => i !== idx))}
                                                                className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
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
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center text-gray-400 bg-white dark:bg-[#0c0e12] transition-colors">
                        <Layout className="w-16 h-16 mb-8 opacity-10" />
                        <h2 className="text-xl font-black uppercase tracking-widest mb-2 transition-colors">DataSet Studio</h2>
                        <p className="max-w-md text-xs font-medium uppercase tracking-[0.2em] leading-relaxed transition-colors opacity-50">
                            검증된 자산을 선택하여 지능형 테스트 데이터셋을 생성하고 매핑하세요.<br />
                            정상, 비정상, 보안 시나리오를 위한 다양한 데이터가 자동으로 구성됩니다.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataSetStudio;
