import React, { useState } from 'react';
import RagManager from './KnowledgeRepo/RagManager';
import MapManager from './KnowledgeRepo/MapManager';

import { Database, Map as MapIcon, Info, Search } from 'lucide-react';

const KnowledgeRepoView: React.FC<{
  activeProjectId?: string;
  onAlert: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}> = ({ activeProjectId, onAlert }) => {
  const [activeTab, setActiveTab] = useState<'RAG' | 'MAP'>('RAG');

  if (!activeProjectId) return null;

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-[#0c0e12] overflow-hidden transition-colors">
      {/* Design Center Style Tab Navigation */}
      <div className="flex-none px-6 pt-4 pb-0 bg-white dark:bg-[#111318] border-b border-gray-200 dark:border-gray-800 transition-colors">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('RAG')}
            className={`px-6 py-3 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${activeTab === 'RAG'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
          >
            <Database className="w-4 h-4" /> DOCUMENT REPOSITORY
          </button>
          <button
            onClick={() => setActiveTab('MAP')}
            className={`px-6 py-3 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${activeTab === 'MAP'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
          >
            <MapIcon className="w-4 h-4" /> ACTION FLOW MAP
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full mx-auto px-6 py-6">
          {activeTab === 'RAG' && (
            <RagManager activeProjectId={activeProjectId} onAlert={onAlert} />
          )}

          {activeTab === 'MAP' && (
            <MapManager activeProjectId={activeProjectId} onAlert={onAlert} />
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeRepoView;
