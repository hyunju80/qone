import React, { useState, useEffect } from 'react';
import { Target, Save, X, Trash2, Database, Loader2, CheckCircle2, Info, ChevronRight, Edit2, Check, RotateCcw, Map, GitBranch } from 'lucide-react';
import { scenariosApi } from '../../api/scenarios';
import MapVisualizer from '../MapVisualizer';

interface MapManagerProps {
  activeProjectId: string;
  onAlert: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

const MapManager: React.FC<MapManagerProps> = ({ activeProjectId, onAlert }) => {
  const [targetInput, setTargetInput] = useState('');
  const [mapDepth, setMapDepth] = useState(1);
  const [excludeSelectors, setExcludeSelectors] = useState('');
  const [includeSelector, setIncludeSelector] = useState('');
  const [contentSelector, setContentSelector] = useState('');

  const [isMapping, setIsMapping] = useState(false);
  const [actionMap, setActionMap] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<{ id: string, url: string, title: string } | null>(null);

  const [savedMaps, setSavedMaps] = useState<any[]>([]);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);

  const [showMapPanel, setShowMapPanel] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [mapIdToDelete, setMapIdToDelete] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamedTitle, setRenamedTitle] = useState('');
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);

  const sidebarTopRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeProjectId) {
      loadSavedMaps();
    }
  }, [activeProjectId]);

  const mergeSubTree = (node: any, targetId: string, newSubTree: any): any => {
    if (node.node_id === targetId) {
      return { ...node, children: newSubTree.children || [] };
    }
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: node.children.map((childWrap: any) => ({
          ...childWrap,
          node: mergeSubTree(childWrap.node, targetId, newSubTree)
        }))
      };
    }
    return node;
  };

  const handleMapActionFlow = async () => {
    if (!targetInput) return;
    setIsMapping(true);
    try {
      const excludes = excludeSelectors.trim() ? excludeSelectors.split(',').map(s => s.trim()).filter(Boolean) : undefined;
      const result = await scenariosApi.mapActionFlow(
        targetInput,
        mapDepth,
        excludes,
        includeSelector,
        contentSelector
      );

      if (selectedNode && actionMap) {
        // Expansion Mode
        const updatedTree = mergeSubTree(actionMap, selectedNode.id, result.map);
        setActionMap(updatedTree);
        onAlert('Success', `Sub-nodes added to ${selectedNode.title}`, 'success');
        setSelectedNode(null);
      } else {
        // Fresh Mapping
        setActionMap(result.map);
        setShowMapPanel(true);
        onAlert('Success', 'Initial mapping completed.', 'success');
      }
    } catch (err: any) {
      onAlert('Mapping Error', err.message, 'error');
    } finally {
      setIsMapping(false);
    }
  };

  const handleNodeSelect = (node: any) => {
    setTargetInput(node.url);
    setSelectedNode({ id: node.id, url: node.url, title: node.title });
    sidebarTopRef.current?.scrollIntoView({ behavior: 'smooth' });
    onAlert("Node Selected", `Focusing on: ${node.title}`, "info");
  };

  const loadSavedMaps = async () => {
    setIsLoadingMaps(true);
    try {
      const maps = await scenariosApi.listActionMaps(activeProjectId);
      setSavedMaps(maps);
    } catch (e) {
      console.error(e);
      onAlert("Error", "맵 목록을 불러오지 못했습니다.", "error");
    } finally {
      setIsLoadingMaps(false);
    }
  };


  const handleSaveMap = async (title: string) => {
    if (!title || !actionMap) return;
    try {
      if (actionMap.id) {
        // Update existing map with new title and expanded map_json
        await scenariosApi.updateActionMap(actionMap.id, {
          title,
          map_json: actionMap
        });
        onAlert('Map Updated', '기존 맵 데이터가 성공적으로 업데이트되었습니다.', 'success');
      } else {
        // Create new map
        await scenariosApi.saveActionMap({
          project_id: activeProjectId,
          title,
          url: targetInput,
          map_json: actionMap
        });
        onAlert('Map Saved', '새로운 맵이 성공적으로 저장되었습니다.', 'success');
      }
      setIsSaveModalOpen(false);
      loadSavedMaps();
    } catch (err: any) {
      onAlert('Save Error', err.message, 'error');
    }
  };

  const handleDeleteMap = async (id: string) => {
    try {
      await scenariosApi.deleteActionMap(id);
      onAlert('Deleted', 'The map has been removed from the repository.', 'success');
      setMapIdToDelete(null);
      if (actionMap?.id === id) {
        setActionMap(null);
        setShowMapPanel(false);
      }
      loadSavedMaps();
    } catch (err: any) {
      onAlert('Delete Error', err.message, 'error');
    }
  };

  const handleUpdateMapTitle = async () => {
    if (!actionMap?.id || !renamedTitle.trim()) return;
    setIsUpdatingTitle(true);
    try {
      await scenariosApi.updateActionMap(actionMap.id, { title: renamedTitle });
      setActionMap({ ...actionMap, title: renamedTitle });
      setSavedMaps(savedMaps.map(m => m.id === actionMap.id ? { ...m, title: renamedTitle } : m));
      setIsRenaming(false);
      onAlert("Success", "맵 이름이 수정되었습니다.", "success");
    } catch (e) {
      console.error(e);
      onAlert("Error", "이름 수정에 실패했습니다.", "error");
    } finally {
      setIsUpdatingTitle(false);
    }
  };


  return (
    <div className="flex gap-8 h-[calc(100vh-190px)] overflow-hidden">
      {/* 1. Map Configuration & Registry Panel (Sidebar) */}
      <div className="w-[420px] flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
        <div ref={sidebarTopRef} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl flex flex-col shadow-sm overflow-hidden shrink-0 transition-colors">
          <div className={`px-8 py-7 border-b ${selectedNode ? 'border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-900/10' : 'border-gray-100 dark:border-gray-800'} flex items-center justify-between transition-all`}>
            <div className="flex items-center gap-4">
              <div className={`p-2.5 ${selectedNode ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-50 text-emerald-500'} rounded-xl transition-all`}>
                {selectedNode ? <RotateCcw className="w-6 h-6" /> : <Target className="w-6 h-6" />}
              </div>
              <div className="flex flex-col">
                <h2 className={`text-[13px] font-black ${selectedNode ? 'text-indigo-600' : 'text-gray-800 dark:text-gray-200'} uppercase tracking-[0.15em] leading-tight`}>
                  {selectedNode ? 'Sub-node Expansion' : 'Map Setting'}
                </h2>
                <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight">
                  {selectedNode ? `Adding nodes to ${selectedNode.title}` : 'Analyze UI Action Flows'}
                </p>
              </div>
            </div>
            {selectedNode && (
              <button
                onClick={() => { setSelectedNode(null); setTargetInput(''); }}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                title="Clear Selection"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="p-8 space-y-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">Target URL</label>
              <input
                type="text"
                value={targetInput}
                onChange={e => setTargetInput(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none dark:text-white"
              />
            </div>

            {!selectedNode && (
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">Map Depth Strategy</label>
                <select
                  value={mapDepth}
                  onChange={e => setMapDepth(Number(e.target.value))}
                  className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none dark:text-white appearance-none"
                >
                  <option value={1}>1-Depth (Root + 1 Level)</option>
                  <option value={2}>2-Depths (Deep Mapping)</option>
                  <option value={0}>0-Depth (Root Only)</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">Focus Region (Optional Selector)</label>
              <input
                type="text"
                value={includeSelector}
                onChange={e => setIncludeSelector(e.target.value)}
                placeholder="e.g. main, #content"
                className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none dark:text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">Main Content Area (Sub-pages)</label>
              <input
                type="text"
                value={contentSelector}
                onChange={e => setContentSelector(e.target.value)}
                placeholder="e.g. #content, main"
                className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none dark:text-white"
              />
              <p className="mt-1.5 text-[8px] text-gray-400 font-bold uppercase tracking-widest leading-tight">
                * Used for Depth 1+ nodes to avoid redundant header/footer mapping.
              </p>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">Exclude Selectors (Optional)</label>
              <input
                type="text"
                value={excludeSelectors}
                onChange={e => setExcludeSelectors(e.target.value)}
                placeholder="e.g. header, footer, .ads"
                className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none dark:text-white"
              />
            </div>

            <div className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={handleMapActionFlow}
                disabled={isMapping || !targetInput}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest py-3.5 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isMapping ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {selectedNode ? 'Expanding...' : 'Mapping...'}</>
                ) : (
                  <>{selectedNode ? <><GitBranch className="w-4 h-4" /> Add Sub-nodes (+1 Depth)</> : <><Map className="w-4 h-4" /> Start Mapping</>}</>
                )}
              </button>
              {selectedNode && (
                <p className="mt-3 text-[10px] text-gray-400 dark:text-gray-500 text-center font-bold uppercase tracking-widest leading-relaxed">
                  * Recurring areas (header, footer, etc.) <br /> will be skipped based on exclude settings.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Map Repository List Group */}
        <div className="flex flex-col gap-1">
          <div className="px-4 py-1 flex items-center justify-between shrink-0">
            <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Database className="w-3 h-3" /> Map Repository
            </h3>
            <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full uppercase tracking-widest">{savedMaps.length}</span>
          </div>
          <div className="flex flex-col gap-2">
          {isLoadingMaps ? (
            <div className="text-sm text-gray-400 text-center py-10 animate-pulse uppercase tracking-widest font-black text-[10px]">Loading maps...</div>
          ) : savedMaps.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-10 italic">No maps stored in repository.</div>
          ) : (
            savedMaps.map(m => (
              <div key={m.id}
                className={`p-4 bg-white dark:bg-[#16191f] border ${actionMap?.id === m.id ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-md' : 'border-gray-100 dark:border-gray-800 shadow-sm'} rounded-2xl flex items-center justify-between group hover:border-indigo-500 transition-all cursor-pointer`}
                onClick={() => {
                  setActionMap({ ...m.map_json, id: m.id, title: m.title });
                  setShowMapPanel(true);
                }}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl transition-all group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 shadow-sm">
                    <Target className={`w-4 h-4 ${actionMap?.id === m.id ? 'text-indigo-500 font-bold' : 'text-gray-400 opacity-70'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-[8px] font-black rounded uppercase tracking-wider shadow-sm">FLOW MAP</span>
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{Object.keys(m.map_json || {}).length} Nodes</span>
                    </div>
                    <h4 className="text-[11px] font-black text-gray-800 dark:text-gray-200 truncate uppercase tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {m.title}
                    </h4>
                    <p className="text-[9px] text-gray-400 truncate mt-0.5 opacity-60 font-bold tracking-tight">
                      {m.url}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMapIdToDelete(m.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className={`w-4 h-4 transition-all ${actionMap?.id === m.id ? 'text-indigo-500 translate-x-0.5' : 'text-gray-300 group-hover:text-indigo-400'}`} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>

      {/* 2. Visualizer Panel (Main) */}
      <div className="flex-1 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-sm relative overflow-hidden transition-colors">
        {showMapPanel && actionMap ? (
          <div className="absolute inset-0 flex flex-col">
            <div className="px-8 py-7 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#16191f] shadow-sm z-10 shrink-0">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-xl transition-all shrink-0">
                  <Target className="w-6 h-6" />
                </div>
                <div className="flex flex-col flex-1 min-w-0 max-w-[calc(100%-250px)]">
                  {isRenaming ? (
                    <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 w-full">
                      <input
                        type="text"
                        value={renamedTitle}
                        onChange={(e) => setRenamedTitle(e.target.value)}
                        className="flex-1 min-w-0 bg-white dark:bg-black/40 border-2 border-emerald-500/50 dark:border-emerald-500/30 rounded-xl py-2.5 px-4 text-sm font-black outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-lg"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateMapTitle();
                          if (e.key === 'Escape') setIsRenaming(false);
                        }}
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={handleUpdateMapTitle}
                          disabled={isUpdatingTitle}
                          className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                          title="Save Changes"
                        >
                          {isUpdatingTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setIsRenaming(false)}
                          className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 group/title min-w-0">
                      <h2 className="text-[15px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-[0.15em] leading-tight truncate min-w-0">
                        {actionMap.title || 'Live Captured Instance'}
                      </h2>
                      {actionMap.id && (
                        <button
                          onClick={() => {
                            setRenamedTitle(actionMap.title || '');
                            setIsRenaming(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-indigo-500 opacity-0 group-hover/title:opacity-100 transition-all bg-gray-50 dark:bg-gray-800/50 rounded-lg shrink-0"
                          title="Edit Map Name"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight mt-1.5 ml-0.5 truncate overflow-hidden">
                    Action Flow Visualizer
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 ml-6">
                <button
                  onClick={() => setIsSaveModalOpen(true)}
                  disabled={isMapping}
                  className="flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98] whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" /> {actionMap.id ? 'Update Map' : 'Save Map'}
                </button>
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-2 shrink-0" />
                <button
                  onClick={() => { setShowMapPanel(false); setActionMap(null); }}
                  className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl transition-all hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50/50 dark:bg-black/20">
              <MapVisualizer actionMap={actionMap} onNodeSelect={handleNodeSelect} />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 transition-colors">
            <div className="p-8 bg-gray-50 dark:bg-gray-900/30 rounded-full mb-6 border border-gray-100 dark:border-gray-800 flex items-center justify-center">
              <Target className="w-16 h-16 opacity-20" />
            </div>
            <p className="text-xsm font-black uppercase tracking-widest text-center text-gray-800 dark:text-gray-200 mb-2 transition-colors opacity-40">No Map Selected</p>
            <p className="text-xs text-gray-500 mt-2 text-center max-w-xs transition-colors opacity-30 px-10">Start mapping a new URL or select a saved map from the repository to visualize.</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#16191f] rounded-2xl w-full max-w-sm shadow-2xl p-6 border border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-black uppercase tracking-widest mb-4">Save Action Map</h3>
            <input
              id="map-title-input"
              defaultValue={`Action Flow Map - ${targetInput} (${new Date().toLocaleDateString()})`}
              className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all mb-6"
            />
            <div className="flex gap-3">
              <button onClick={() => setIsSaveModalOpen(false)} className="flex-1 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all">Cancel</button>
              <button
                onClick={() => {
                  const input = document.getElementById('map-title-input') as HTMLInputElement;
                  handleSaveMap(input?.value || '');
                }}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {mapIdToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#16191f] rounded-2xl w-full max-w-xs shadow-2xl p-6 border border-gray-200 dark:border-gray-800 text-center">
            <Trash2 className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h3 className="text-sm font-black uppercase tracking-widest mb-2">Delete Map?</h3>
            <p className="text-xs text-gray-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setMapIdToDelete(null)} className="flex-1 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all">Cancel</button>
              <button onClick={() => handleDeleteMap(mapIdToDelete)} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapManager;
