import React, { useState, useEffect } from 'react';
import { List, Search, Folder, FileCode, CheckCircle2, ChevronRight, RefreshCw, Trash2, Edit2 } from 'lucide-react';
import api from '../api/client';
import { testApi } from '../api/test';
import { Project, ScriptOrigin } from '../types';

// Using TestScript for parity but mapped locally for backwards compatibility in list
interface StepAssetListItem {
    id: string;
    name: string;
    description?: string;
    platform?: string;
    origin?: string;
}

interface StepAssetListProps {
    project: Project;
    activeTab: 'WEB' | 'APP';
    onSelectAsset: (assetId: string) => void;
    refreshTrigger: number;
    setConfirmation: (config: any) => void;
}

const StepAssetList: React.FC<StepAssetListProps> = ({ project, activeTab, onSelectAsset, refreshTrigger, setConfirmation }) => {
    const [assets, setAssets] = useState<StepAssetListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const fetchAssets = async () => {
        if (!project) return;
        setLoading(true);
        try {
            const allScripts = await testApi.getScripts(project.id);
            const stepAssets = allScripts.filter(s => s.origin === ScriptOrigin.STEP && s.platform === activeTab);
            setAssets(stepAssets.map(s => ({
                id: s.id,
                name: s.name,
                description: s.description,
                platform: s.platform,
                origin: s.origin
            })));
        } catch (error) {
            console.error("Failed to fetch step assets:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAssets();
    }, [project, activeTab, refreshTrigger]);

    const filteredAssets = assets.filter(asset =>
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.description && asset.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleSelect = (id: string) => {
        setSelectedId(id);
        onSelectAsset(id);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();

        setConfirmation({
            message: "Delete saved step?",
            detail: "This action cannot be undone.",
            confirmText: "Delete",
            onConfirm: async () => {
                try {
                    await api.delete(`/scripts/${id}`);
                    fetchAssets();
                    if (selectedId === id) setSelectedId(null);
                    setConfirmation(null);
                } catch (err) {
                    console.error("Delete failed", err);
                    setConfirmation({
                        message: "Error",
                        detail: "Failed to delete asset.",
                        confirmText: "OK",
                        onConfirm: () => setConfirmation(null)
                    });
                }
            }
        });
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#16191f] border-r border-gray-200 dark:border-gray-800 w-64 transition-colors">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between transition-colors">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Folder className="w-4 h-4 text-indigo-500" />
                    Saved Steps
                </h3>
                <button
                    onClick={fetchAssets}
                    className={`text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors ${loading ? 'animate-spin' : ''}`}
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0f1115] transition-colors">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search assets..."
                        className="w-full bg-white dark:bg-[#1a1d24] text-xs text-gray-900 dark:text-gray-300 rounded-lg pl-8 pr-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500/50 border border-gray-200 dark:border-gray-800 focus:border-indigo-500 transition-all placeholder-gray-400 dark:placeholder-gray-600"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {loading && assets.length === 0 ? (
                    <div className="text-center py-8 text-xs text-gray-600">Loading...</div>
                ) : filteredAssets.length > 0 ? (
                    filteredAssets.map(asset => (
                        <div
                            key={asset.id}
                            onClick={() => handleSelect(asset.id)}
                            className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${selectedId === asset.id
                                ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30'
                                : 'bg-transparent border-transparent hover:bg-gray-100 dark:hover:bg-white/5 hover:border-gray-200 dark:hover:border-gray-800'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`pt-0.5 ${selectedId === asset.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-600 group-hover:text-gray-600 dark:group-hover:text-gray-400'}`}>
                                    <FileCode className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-xs font-bold truncate ${selectedId === asset.id ? 'text-indigo-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200'}`}>
                                        {asset.name}
                                    </div>
                                    {asset.description && (
                                        <div className="text-[10px] text-gray-600 truncate mt-0.5">
                                            {asset.description}
                                        </div>
                                    )}
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => handleDelete(e, asset.id)}
                                        className="text-gray-600 hover:text-red-400 p-1 rounded hover:bg-red-400/10"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10 text-xs text-gray-600 italic">
                        No saved steps found for {activeTab}.<br />
                        Save your current steps to see them here.
                    </div>
                )}
            </div>
        </div>
    );
};

export default StepAssetList;
