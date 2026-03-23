import React, { useState, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Plus, Trash2, Database, Loader2, Settings2, ChevronRight, ChevronDown } from 'lucide-react';
import { scenariosApi } from '../../api/scenarios';
import { projectsApi } from '../../api/projects';
import { CategoryNode } from '../../types';

interface RagManagerProps {
  activeProjectId: string;
  onAlert: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

const RagManager: React.FC<RagManagerProps> = ({ activeProjectId, onAlert }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  
  // Mapping Config
  const [mappingConfig, setMappingConfig] = useState({
    depth_field: '화면경로',
    classification_field: '구분',
    title_field: '화면명',
    delimiter: '>'
  });

  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [projectCategories, setProjectCategories] = useState<CategoryNode[]>([]);
  
  // Selection State for items
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docItems, setDocItems] = useState<any[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  useEffect(() => {
    if (activeProjectId) {
      loadDocuments();
      loadProjectInfo();
    }
  }, [activeProjectId]);

  const loadProjectInfo = async () => {
    try {
      const project = await projectsApi.getById(activeProjectId);
      setProjectCategories(project.categories || []);
    } catch (e) {
      console.error('Failed to load project info:', e);
    }
  };

  const loadDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const docs = await scenariosApi.getDocuments(activeProjectId);
      setDocuments(docs);
    } catch (e) {
      console.error(e);
      onAlert('Error', '문서 목록을 불러오지 못했습니다.', 'error');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const loadItems = async (docId: string) => {
    if (selectedDocId === docId) {
        setSelectedDocId(null);
        setDocItems([]);
        return;
    }
    
    setSelectedDocId(docId);
    setIsLoadingItems(true);
    try {
      const items = await scenariosApi.getDocumentItems(docId);
      setDocItems(items);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      if (!title) {
        setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !title || !category) {
      onAlert('Error', '파일, 화면명(Title), 카테고리는 필수 입력입니다.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('project_id', activeProjectId);
      formData.append('title', title);
      formData.append('category', category);
      if (subCategory) formData.append('sub_category', subCategory);
      formData.append('mapping_config', JSON.stringify(mappingConfig));
      formData.append('file', file);

      await scenariosApi.uploadDocument(formData);
      onAlert('Success', '문서가 성공적으로 업로드되었습니다. 데이터 추출이 진행되었습니다.', 'success');
      
      // Reset form
      setFile(null);
      setTitle('');
      setCategory('');
      setSubCategory('');
      loadDocuments();
      
    } catch (error) {
      console.error('Upload Error:', error);
      onAlert('Error', '문서 업로드 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await scenariosApi.deleteDocument(docId);
      onAlert('Success', '문서 및 추출된 항목이 삭제되었습니다.', 'success');
      loadDocuments();
      if (selectedDocId === docId) setSelectedDocId(null);
    } catch (e) {
      onAlert('Error', '삭제 실패', 'error');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full pb-10">
      {/* 1. Left Form Panel */}
      <div className="w-full lg:w-5/12 space-y-6">
        <div className="bg-white dark:bg-[#16191f] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm overflow-y-auto max-h-[calc(100vh-250px)]">
          <h2 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest flex items-center gap-2 mb-6">
            <Upload className="w-4 h-4 text-indigo-500" /> Knowledge Extraction Settings
          </h2>
          
          <div className="space-y-6">
            {/* General Info */}
            <div className="space-y-4">
               <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">
                  화면명 (Title / Document Name) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none dark:text-white"
                  placeholder="예: 로그인 화면 (업로드 시 문서명 자동 입력)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">
                    카테고리 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                        setCategory(e.target.value);
                        setSubCategory('');
                    }}
                    className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none dark:text-white appearance-none"
                  >
                    <option value="">카테고리 선택</option>
                    {projectCategories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">
                    서브 카테고리
                  </label>
                  <select
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    disabled={!category}
                    className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none dark:text-white disabled:opacity-50 appearance-none"
                  >
                    <option value="">서브 카테고리 선택</option>
                    {/* Simplified: For now we don't have nested CategoryNode in types, but if we did we would filter */}
                  </select>
                </div>
              </div>
            </div>

            {/* Mapping Configuration */}
            <div className="bg-gray-50 dark:bg-[#0c0e12] p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-4">
              <h3 className="text-[10px] font-black text-indigo-500 uppercase flex items-center gap-2">
                <Settings2 className="w-3 h-3" /> Extraction Mapping Rules
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Depth 필드명 (PDF내)</label>
                  <input 
                    type="text" 
                    value={mappingConfig.depth_field}
                    onChange={(e) => setMappingConfig({...mappingConfig, depth_field: e.target.value})}
                    className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-lg py-1.5 px-3 text-xs font-medium outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">구분자 (Delimiter)</label>
                  <input 
                    type="text" 
                    value={mappingConfig.delimiter}
                    onChange={(e) => setMappingConfig({...mappingConfig, delimiter: e.target.value})}
                    className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-lg py-1.5 px-3 text-xs font-medium outline-none dark:text-white text-center"
                    placeholder="예: >"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">구분 필드명</label>
                  <input 
                    type="text" 
                    value={mappingConfig.classification_field}
                    onChange={(e) => setMappingConfig({...mappingConfig, classification_field: e.target.value})}
                    className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-lg py-1.5 px-3 text-xs font-medium outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">화면명 필드명</label>
                  <input 
                    type="text" 
                    value={mappingConfig.title_field}
                    onChange={(e) => setMappingConfig({...mappingConfig, title_field: e.target.value})}
                    className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-lg py-1.5 px-3 text-xs font-medium outline-none dark:text-white"
                  />
                </div>
              </div>
              <p className="text-[9px] text-gray-500 italic">문서 내 해당 키워드를 기준으로 우측의 텍스트가 추출되어 저장됩니다.</p>
            </div>

            {/* File Upload Area */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">
                문서 파일 (PDF, Excel, PPT) <span className="text-red-500">*</span>
              </label>
              <div className={`flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl transition-colors ${file ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0c0e12]'}`}>
                <div className="space-y-1 text-center">
                  {file ? (
                    <>
                      <FileText className="mx-auto h-10 w-10 text-indigo-500" />
                      <p className="text-sm font-black text-gray-700 dark:text-white truncate max-w-[200px] mt-2">{file.name}</p>
                      <button onClick={() => setFile(null)} className="text-[10px] font-black text-red-500 uppercase mt-1">Remove File</button>
                    </>
                  ) : (
                    <>
                      <Upload className="mx-auto h-10 w-10 text-gray-400" />
                      <label className="relative cursor-pointer font-black text-indigo-600 dark:text-indigo-400 uppercase text-xs block mt-2">
                        <span>Upload Knowledge Document</span>
                        <input type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.ppt,.pptx,.xlsx,.xls" />
                      </label>
                      <p className="text-[9px] text-gray-400 mt-1 uppercase">Max size: 50MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={isUploading || !file || !title || !category}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-300 dark:disabled:bg-gray-800 text-white font-black text-sm uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing Local Data...</> : 'Extract & Register Knowledge'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Repository List Panel */}
      <div className="flex-1 space-y-6 flex flex-col h-[calc(100vh-250px)]">
        <div className="bg-white dark:bg-[#16191f] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm flex flex-col flex-1 overflow-hidden">
            <h2 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest flex items-center justify-between mb-6 shrink-0">
            <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-500" /> Knowledge Inventory ({documents.length})
            </div>
            {isLoadingDocs && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
            </h2>
            
            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
            {documents.length === 0 && !isLoadingDocs ? (
                <div className="text-sm text-gray-400 text-center py-10 italic">등록된 지식 문서가 없습니다.</div>
            ) : (
                documents.map(doc => (
                <div key={doc.id} className="space-y-1">
                    <div className={`p-4 bg-gray-50 dark:bg-[#0c0e12] border ${selectedDocId === doc.id ? 'border-indigo-500 ring-1 ring-indigo-500/20' : 'border-gray-200 dark:border-gray-800'} rounded-xl flex items-center justify-between group cursor-pointer hover:border-indigo-500 transition-all`}
                         onClick={() => loadItems(doc.id)}>
                        <div className="min-w-0 pr-4 flex items-center gap-3">
                            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                                <FileText className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[8px] font-black rounded uppercase">{doc.category}</span>
                                    {doc.sub_category && <span className="text-[8px] text-gray-400 font-bold uppercase">&gt; {doc.sub_category}</span>}
                                </div>
                                <h4 className="text-xs font-black text-gray-800 dark:text-gray-200 truncate uppercase">{doc.title}</h4>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                                className="p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {selectedDocId === doc.id ? <ChevronDown className="w-4 h-4 text-indigo-500" /> : <ChevronRight className="w-4 h-4 text-gray-300" />}
                        </div>
                    </div>

                    {/* Extracted Items Drawer */}
                    {selectedDocId === doc.id && (
                        <div className="ml-8 mr-2 p-3 bg-white dark:bg-[#16191f] border-l-2 border-indigo-500 rounded-br-xl space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            <h5 className="text-[10px] font-black text-gray-400 uppercase mb-2 flex items-center justify-between">
                                Extracted Screens / Pages
                                {isLoadingItems && <Loader2 className="w-3 h-3 animate-spin" />}
                            </h5>
                            {docItems.length === 0 && !isLoadingItems ? (
                                <p className="text-[10px] text-gray-500 italic py-2">추출된 데이터가 없습니다.</p>
                            ) : (
                                docItems.map((item, idx) => (
                                    <div key={item.id} className="p-2 bg-gray-50 dark:bg-[#0c0e12] border border-gray-100 dark:border-gray-800 rounded-lg flex items-center justify-between group">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 text-[8px] text-gray-400 font-bold uppercase mb-0.5">
                                                <span>{item.classification || 'No Class'}</span>
                                                <span>•</span>
                                                <span className="truncate">{item.depth_1} {item.depth_2 ? `> ${item.depth_2}` : ''}</span>
                                            </div>
                                            <div className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase flex items-center gap-2">
                                                <span className="text-indigo-500 shrink-0">P.{item.page_number}</span>
                                                <span className="truncate">{item.title}</span>
                                            </div>
                                        </div>
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
                ))
            )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default RagManager;
