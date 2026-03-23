import React, { useState, useEffect } from 'react';
import { Target, Save, X, Trash2, Database, Loader2, CheckCircle2, Info } from 'lucide-react';
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
  
  const [isMapping, setIsMapping] = useState(false);
  const [actionMap, setActionMap] = useState<any>(null);
  
  const [savedMaps, setSavedMaps] = useState<any[]>([]);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  
  const [showMapPanel, setShowMapPanel] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [mapIdToDelete, setMapIdToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (activeProjectId) {
      loadSavedMaps();
    }
  }, [activeProjectId]);

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

  const handleMapActionFlow = async () => {
    if (!targetInput) {
      onAlert('Missing Input', 'Target URL을 입력해주세요.', 'info');
      return;
    }
    setIsMapping(true);
    try {
      // Split comma-separated string into string array
      const excludes = excludeSelectors ? excludeSelectors.split(',').map(s => s.trim()).filter(Boolean) : undefined;
      const result = await scenariosApi.mapActionFlow(targetInput, mapDepth, excludes, includeSelector);
      setActionMap(result.map); // result is { status, map }
      setShowMapPanel(true);
      onAlert('Mapping Complete', `성공적으로 분석되었습니다. 저장하여 AI 생성시 활용하세요.`, 'success');
    } catch (err: any) {
      onAlert('Mapping Error', err.message, 'error');
    } finally {
      setIsMapping(false);
    }
  };

  const handleSaveMap = async (title: string) => {
    if (!title || !actionMap) return;
    try {
      if (actionMap.id) {
        onAlert('Info', '기존 맵 덮어쓰기는 아직 지원되지 않습니다.', 'info');
      } else {
        await scenariosApi.saveActionMap({
          project_id: activeProjectId,
          title,
          url: targetInput,
          map_json: actionMap
        });
        onAlert('Map Saved', '맵이 지식 저장소에 등록되었습니다.', 'success');
      }
      setIsSaveModalOpen(false);
      setActionMap(null);
      setShowMapPanel(false);
      loadSavedMaps();
    } catch (err: any) {
      onAlert('Save Error', err.message, 'error');
    }
  };

  const handleDeleteMap = async (id: string) => {
    try {
      await scenariosApi.deleteActionMap(id);
      onAlert('Deleted', '맵이 삭제되었습니다.', 'success');
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

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* 1. Left Form Panel */}
      <div className="w-full lg:w-1/3 space-y-6">
        <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest flex items-center gap-2 mb-6">
            <Target className="w-4 h-4 text-emerald-500" /> New Map Generation
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">Target URL</label>
              <input
                type="text"
                value={targetInput}
                onChange={e => setTargetInput(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">Map Depth Strategy</label>
              <select
                value={mapDepth}
                onChange={e => setMapDepth(Number(e.target.value))}
                className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none"
              >
                <option value={1}>1-Depth (Root + 1 Level)</option>
                <option value={2}>2-Depths (Deep Mapping)</option>
                <option value={0}>0-Depth (Root Only)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">Focus Region (Optional Selector)</label>
              <input
                type="text"
                value={includeSelector}
                onChange={e => setIncludeSelector(e.target.value)}
                placeholder="e.g. main, #content"
                className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>

            <button
              onClick={handleMapActionFlow}
              disabled={isMapping || !targetInput}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-300 dark:disabled:bg-gray-800 text-white font-black text-sm uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 mt-4"
            >
              {isMapping ? <><Loader2 className="w-4 h-4 animate-spin" /> Mapping...</> : 'Start Mapping'}
            </button>
          </div>
        </div>

        {/* Existing Maps List */}
        <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <h2 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest flex items-center gap-2 mb-4 shrink-0">
            <Database className="w-4 h-4 text-indigo-500" /> Map Repository ({savedMaps.length})
          </h2>
          
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
            {isLoadingMaps ? (
              <div className="text-sm text-gray-400 text-center py-10 animate-pulse">Loading maps...</div>
            ) : savedMaps.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-10 italic">저장된 맵이 없습니다.</div>
            ) : (
              savedMaps.map(m => (
                <div key={m.id} 
                  className="p-4 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl flex items-center justify-between group hover:border-indigo-500 transition-colors cursor-pointer"
                  onClick={() => {
                    setActionMap({ ...m.map_json, id: m.id, title: m.title });
                    setShowMapPanel(true);
                  }}
                >
                  <div className="min-w-0 pr-4">
                    <h4 className="text-xs font-black text-gray-800 dark:text-gray-200 truncate uppercase">{m.title}</h4>
                    <p className="text-[10px] text-gray-500 truncate mt-1">{m.url}</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setMapIdToDelete(m.id); }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 2. Visualizer Panel */}
      <div className="flex-1 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm relative min-h-[600px] overflow-hidden">
        {showMapPanel && actionMap ? (
          <div className="absolute inset-0 flex flex-col">
             <div className="h-16 px-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#16191f] shadow-sm z-10 shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 rounded-xl"><Target className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest truncate">{actionMap.title || 'Live Captured Instance'}</h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSaveModalOpen(true)}
                  disabled={isMapping || !!actionMap.id}
                  className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> Save Map
                </button>
                <div className="w-px h-6 bg-gray-200 dark:border-gray-800 mx-2" />
                <button
                  onClick={() => { setShowMapPanel(false); setActionMap(null); }}
                  className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50/50 dark:bg-black/20">
              <MapVisualizer actionMap={actionMap} />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <Target className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest text-center">No Map Selected</p>
            <p className="text-xs text-gray-500 mt-2 text-center">Start mapping a new URL or select a saved map to visualize.</p>
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
              defaultValue={`Map - ${targetInput} (${new Date().toLocaleDateString()})`}
              className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all mb-6"
            />
            <div className="flex gap-3">
              <button onClick={() => setIsSaveModalOpen(false)} className="flex-1 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all">Cancel</button>
              <button 
                onClick={() => {
                  const input = document.getElementById('map-title-input') as HTMLInputElement;
                  handleSaveMap(input?.value || '');
                }} 
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase transition-all"
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
