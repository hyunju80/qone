import React, { useState } from 'react';
import RagManager from './KnowledgeRepo/RagManager';
import MapManager from './KnowledgeRepo/MapManager';

const KnowledgeRepoView: React.FC<{
  activeProjectId?: string;
  onAlert: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}> = ({ activeProjectId, onAlert }) => {
  const [activeTab, setActiveTab] = useState<'RAG' | 'MAP'>('RAG');

  if (!activeProjectId) return null;

  return (
    <div className="p-8 h-full bg-gray-50 dark:bg-[#0f1115] overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">지식 저장소</h1>
          <p className="text-gray-500 dark:text-gray-400">RAG 문서 및 Navigation Map을 관리하여 AI 시나리오 생성에 활용합니다.</p>
        </div>
        
        <div className="bg-white/50 dark:bg-[#16191f]/50 p-1.5 rounded-xl flex gap-1 w-fit border border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab('RAG')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'RAG' 
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            문서 관리 (RAG)
          </button>
          <button
            onClick={() => setActiveTab('MAP')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'MAP' 
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            앱/웹 맵 관리 (Navigation Map)
          </button>
        </div>

        {activeTab === 'RAG' && (
          <RagManager activeProjectId={activeProjectId} onAlert={onAlert} />
        )}
        
        {activeTab === 'MAP' && (
          <MapManager activeProjectId={activeProjectId} onAlert={onAlert} />
        )}
      </div>
    </div>
  );
};

export default KnowledgeRepoView;
