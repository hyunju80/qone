
import React, { useState, useMemo, useEffect } from 'react';
import {
  X, Search, ChevronRight, Plus,
  ShieldCheck, Globe, LayoutGrid,
  Zap, Code, CheckCircle2, Edit3, Save,
  Trash2, Download, Upload, AlertCircle, RefreshCw,
  Lock, ExternalLink
} from 'lucide-react';
import { ActionLibraryItem, Project, TestAction } from '../types';
import { assetsApi } from '../api/assets';

interface ActionLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (code: string) => void;
  activeProject: Project;
}

const ActionLibrary: React.FC<ActionLibraryProps> = ({ isOpen, onClose, onInsert, activeProject }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | 'Common' | 'Domain Specific' | 'Custom'>('All');
  const [selectedAction, setSelectedAction] = useState<ActionLibraryItem | null>(null);

  // We removed local editing state as management is done in Design Center
  const [isEditing, setIsEditing] = useState(false);
  const [allActions, setAllActions] = useState<ActionLibraryItem[]>([]);

  useEffect(() => {
    if (isOpen && activeProject?.id) {
      assetsApi.getActions(activeProject.id).then(actions => {
        const mapped: ActionLibraryItem[] = actions.map(a => ({
          id: a.id,
          projectId: a.project_id || 'global',
          name: a.name,
          category: (a.category as any) || 'Custom',
          description: a.description || '',
          parameters: Object.entries(a.parameters || {}).map(([key, val]: [string, any]) => ({
            name: key,
            type: val.type || 'string',
            required: val.required !== false,
            description: val.description || ''
          })),
          example: `await ${a.name}(${Object.keys(a.parameters || {}).map(k => `"${k}"`).join(', ')});`,
          usageCount: 0,
          isPrioritized: false,
          isGlobal: !a.project_id
        }));
        setAllActions(mapped);
      }).catch(err => console.error("Failed to load actions", err));
    }
  }, [isOpen, activeProject?.id]);

  // Logic: Filter based on active project context + global items
  const filteredActions = useMemo(() => {
    return allActions.filter(action => {
      // 1. Context Filter (Must be global or match current project)
      const matchesContext = action.projectId === 'global' || action.projectId === activeProject.id;
      if (!matchesContext) return false;

      // 2. Search Filter
      const matchesSearch = action.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        action.description.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // 3. Category Filter
      const matchesCategory = activeCategory === 'All' || action.category === activeCategory;
      return matchesCategory;
    });
  }, [allActions, searchTerm, activeCategory, activeProject.id]);

  return (
    <div
      className={`fixed inset-y-0 right-0 w-[460px] bg-white dark:bg-[#16191f] border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#16191f] transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/10 rounded-lg">
              <LayoutGrid className="w-5 h-5 text-indigo-600 dark:text-indigo-400 transition-colors" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-gray-200 transition-colors">
                Action Library
              </h2>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tighter transition-colors">
                Standardized QA Functions
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Project Context & Search */}
        {!isEditing && !selectedAction && (
          <div className="p-4 space-y-4 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-800 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center justify-between bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 transition-colors">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 transition-colors" />
                  <span className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider truncate max-w-[200px] transition-colors">
                    {activeProject.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 transition-colors">
                  <Lock className="w-2.5 h-2.5 text-gray-400 dark:text-gray-500 transition-colors" />
                  <span className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase transition-colors">Context Locked</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button title="Export Project Set" className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400 border border-gray-200 dark:border-gray-700 transition-colors">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search actions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-lg py-2.5 pl-10 pr-4 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* Category Tabs */}
        {!isEditing && !selectedAction && (
          <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#16191f] transition-colors">
            {['All', 'Common', 'Domain Specific', 'Custom'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat as any)}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeCategory === cat
                  ? 'text-indigo-600 dark:text-indigo-400 border-indigo-500'
                  : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#0c0e12]/40 relative transition-colors">
          {selectedAction ? (
            /* Action Detail View */
            <div className="p-6 space-y-6 animate-in slide-in-from-right-4">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setSelectedAction(null)}
                  className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 uppercase transition-colors"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" /> Back to list
                </button>
                <div className="flex gap-2">
                  {/* Edit removed - Use Design Center */}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mono transition-colors">{selectedAction.name}</h3>
                  <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-colors ${selectedAction.isGlobal ? 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    }`}>
                    {selectedAction.isGlobal ? 'Global Standard' : 'Project Custom'}
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed transition-colors">{selectedAction.description}</p>
              </div>

              <div className="space-y-4">
                <div className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest transition-colors">Parameters</div>
                <div className="space-y-2">
                  {selectedAction.parameters.map((p, idx) => (
                    <div key={idx} className="bg-white dark:bg-[#16191f] p-3 rounded-xl border border-gray-200 dark:border-gray-800 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-indigo-600 dark:text-blue-400 mono transition-colors">{p.name}</span>
                        <span className="text-[9px] text-gray-400 dark:text-gray-600 font-bold uppercase italic transition-colors">{p.type} {p.required && '(Req)'}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{p.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <div className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest transition-colors">Implementation</div>
                <div className="bg-gray-100 dark:bg-black p-4 rounded-xl border border-gray-200 dark:border-gray-800 relative group transition-colors">
                  <code className="text-[11px] text-gray-800 dark:text-green-400 mono block overflow-x-auto whitespace-pre transition-colors">
                    {selectedAction.example}
                  </code>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    onInsert(selectedAction.example);
                    onClose();
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  <Plus className="w-4 h-4" />
                  INSERT ACTION
                </button>
              </div>
            </div>
          ) : (
            /* List View */
            <div className="p-4 space-y-2 pb-24">
              {filteredActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => setSelectedAction(action)}
                  className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#16191f] hover:border-gray-400 dark:hover:border-gray-600 transition-all group flex items-start gap-4"
                >
                  <div className={`mt-1 p-2 rounded-lg shrink-0 transition-colors ${action.isPrioritized ? 'bg-indigo-600/20 text-indigo-600 dark:text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                    }`}>
                    {action.isGlobal ? <ShieldCheck className="w-4 h-4" /> : action.isPrioritized ? <Zap className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mono">
                        {action.name.split('.').pop()}
                      </span>
                      <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-700 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors" />
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 leading-relaxed transition-colors">{action.description}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center gap-1 text-[9px] text-gray-400 dark:text-gray-600 font-bold uppercase transition-colors">
                        <CheckCircle2 className="w-2.5 h-2.5" /> {action.usageCount} uses
                      </div>
                      <div className={`text-[9px] font-bold uppercase transition-colors ${action.isGlobal ? 'text-gray-400 dark:text-gray-600' : 'text-indigo-600 dark:text-indigo-400'}`}>
                        {action.isGlobal ? 'Global' : 'Project'}
                      </div>
                    </div>
                  </div>
                </button>
              ))}

              {filteredActions.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 opacity-50 transition-colors">
                  <Search className="w-8 h-8 mb-3" />
                  <p className="text-xs font-bold uppercase tracking-widest">No matching actions</p>
                  <p className="text-[10px] mt-1 italic">Scoped to {activeProject.name}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Insight Footer */}
        {!isEditing && !selectedAction && (
          <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                <Zap className="w-3 h-3 text-white fill-white" />
              </div>
              <span className="text-[10px] font-black text-gray-400 dark:text-gray-300 uppercase tracking-widest transition-colors">Contextual Engine</span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed italic">
              "Displaying assets for <strong>{activeProject.name}</strong>. {filteredActions.filter(a => !a.isGlobal).length} specialized actions detected."
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionLibrary;
