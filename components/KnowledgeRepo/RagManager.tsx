import React, { useState, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Plus, Trash2, Database, Loader2, Settings2, ChevronRight, ChevronDown, AlertTriangle, Sparkles } from 'lucide-react';
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
    required: {
      depth: { keyword: '화면경로', delimiter: '>' },
      classification: { keyword: '구분' },
      title: { keyword: '화면ID / 화면명' }
    },
    custom: [] as { name: string; keyword: string }[]
  });

  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [projectCategories, setProjectCategories] = useState<CategoryNode[]>([]);

  // Selection State for items
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docItems, setDocItems] = useState<any[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Deletion State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<{ id: string, title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (activeProjectId) {
      loadDocuments();
      loadProjectInfo();
    }
  }, [activeProjectId]);

  const loadProjectInfo = async () => {
    try {
      const project = await projectsApi.getById(activeProjectId);
      const categories = project.categories || [];
      setProjectCategories(categories);

      // Auto-select if empty and categories exist
      if (!category && categories.length > 0) {
        setCategory(categories[0].name);
      }
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

  const addCustomField = () => {
    setMappingConfig({
      ...mappingConfig,
      custom: [...mappingConfig.custom, { name: '', keyword: '' }]
    });
  };

  const removeCustomField = (index: number) => {
    const newCustom = [...mappingConfig.custom];
    newCustom.splice(index, 1);
    setMappingConfig({ ...mappingConfig, custom: newCustom });
  };

  const updateCustomField = (index: number, field: 'name' | 'keyword', value: string) => {
    const newCustom = [...mappingConfig.custom];
    newCustom[index] = { ...newCustom[index], [field]: value };
    setMappingConfig({ ...mappingConfig, custom: newCustom });
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
      onAlert('Success', '문서가 성공적으로 업로드되어 데이터 추출이 완료되었습니다.', 'success');

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

  const confirmDelete = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    try {
      await scenariosApi.deleteDocument(docToDelete.id);
      onAlert('Success', 'Document and items deleted successfully.', 'success');
      loadDocuments();
      if (selectedDocId === docToDelete.id) {
        setSelectedDocId(null);
        setDocItems([]);
      }
      setDeleteModalOpen(false);
      setDocToDelete(null);
    } catch (e) {
      onAlert('Error', 'Failed to delete Document.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = (doc: any) => {
    setDocToDelete({ id: doc.id, title: doc.title });
    setDeleteModalOpen(true);
  };

  return (
    <div className="flex gap-8 h-[calc(100vh-190px)] overflow-hidden">
      {/* 1. Extraction Settings Panel (Sidebar) */}
      <div className="w-[420px] flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
        <div className="bg-white dark:bg-[#16191f] rounded-3xl border border-gray-200 dark:border-gray-800 flex flex-col shadow-sm overflow-hidden shrink-0 transition-colors">
          <div className="px-8 py-7 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl transition-all">
              <Upload className="w-6 h-6 text-indigo-500" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-[13px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-[0.15em] leading-tight">
                Extraction Settings
              </h2>
              <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight">
                Configure AI Mapping Rules
              </p>
            </div>
          </div>

          <div className="p-8 space-y-6">
            {/* General Info */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">
                  Document Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none dark:text-white"
                  placeholder="e.g., Login Screen (Auto-filled on upload)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setSubCategory('');
                    }}
                    className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none dark:text-white appearance-none"
                  >
                    <option value="">Select Category</option>
                    {projectCategories
                      .filter(cat => !cat.parentId)
                      .map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1.5">
                    Sub Category
                  </label>
                  <select
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    disabled={!category}
                    className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none dark:text-white disabled:opacity-50 appearance-none"
                  >
                    <option value="">Sub-category (Optional)</option>
                    {(() => {
                      const parentCat = projectCategories.find(c => c.name === category);
                      if (!parentCat) return null;
                      return projectCategories
                        .filter(c => c.parentId === parentCat.id)
                        .map(sub => (
                          <option key={sub.id} value={sub.name}>{sub.name}</option>
                        ));
                    })()}
                  </select>
                </div>
              </div>
            </div>

            {/* Mapping Configuration */}
            <div className="bg-gray-50 dark:bg-[#0c0e12] p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-4">
              <h3 className="text-[10px] font-black text-indigo-500 uppercase flex items-center gap-2">
                <Settings2 className="w-3 h-3" /> Extraction Mapping Rules
              </h3>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 text-indigo-400/70">Required: Depth Keyword</label>
                    <input
                      type="text"
                      value={mappingConfig.required.depth.keyword}
                      onChange={(e) => setMappingConfig({
                        ...mappingConfig,
                        required: { ...mappingConfig.required, depth: { ...mappingConfig.required.depth, keyword: e.target.value } }
                      })}
                      className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-lg py-1.5 px-3 text-xs font-medium outline-none dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 text-indigo-400/70">Depth Delimiter</label>
                    <input
                      type="text"
                      value={mappingConfig.required.depth.delimiter}
                      onChange={(e) => setMappingConfig({
                        ...mappingConfig,
                        required: { ...mappingConfig.required, depth: { ...mappingConfig.required.depth, delimiter: e.target.value } }
                      })}
                      className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-lg py-1.5 px-3 text-xs font-medium outline-none dark:text-white text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 text-indigo-400/70">Required: Class Keyword</label>
                    <input
                      type="text"
                      value={mappingConfig.required.classification.keyword}
                      onChange={(e) => setMappingConfig({
                        ...mappingConfig,
                        required: { ...mappingConfig.required, classification: { keyword: e.target.value } }
                      })}
                      className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-lg py-1.5 px-3 text-xs font-medium outline-none dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 text-indigo-400/70">Required: Title Keyword</label>
                    <input
                      type="text"
                      value={mappingConfig.required.title.keyword}
                      onChange={(e) => setMappingConfig({
                        ...mappingConfig,
                        required: { ...mappingConfig.required, title: { keyword: e.target.value } }
                      })}
                      className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-lg py-1.5 px-3 text-xs font-medium outline-none dark:text-white"
                    />
                  </div>
                </div>

                {/* Custom Fields */}
                <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-gray-400 uppercase">Custom Fields (Optional)</label>
                    <button
                      onClick={addCustomField}
                      className="p-1 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {mappingConfig.custom.map((field, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Label (e.g. Description)"
                        value={field.name}
                        onChange={(e) => updateCustomField(idx, 'name', e.target.value)}
                        className="flex-1 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-lg py-1.5 px-3 text-[10px] font-medium outline-none dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Keyword"
                        value={field.keyword}
                        onChange={(e) => updateCustomField(idx, 'keyword', e.target.value)}
                        className="flex-1 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-lg py-1.5 px-3 text-[10px] font-medium outline-none dark:text-white"
                      />
                      <button onClick={() => removeCustomField(idx)} className="text-gray-400 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[9px] text-gray-500 italic">Rules define how AI parses your documentation structure.</p>
            </div>

            {/* File Upload Area */}
            <div className="shrink-0 space-y-2 mt-2">
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-1 ml-1">
                Target File (PDF, Excel, PPT) <span className="text-red-500">*</span>
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

            <div className="pt-6 mt-8 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <button
                onClick={handleUpload}
                disabled={isUploading || !file || !title || !category}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest py-3.5 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Digesting... </> : <><Sparkles className="w-4 h-4 fill-current" /> Extract & Register Knowledge</>}
              </button>
              {/* 
              {!isUploading && (!file || !title || !category) && (
                <p className="text-[9px] text-red-500 font-bold uppercase text-center animate-pulse">
                  Required: {!file && 'File '} {!title && 'Title '} {!category && 'Category '} missing
                </p>
              )} */}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Repository Inventory Panel (Main) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white dark:bg-[#16191f] rounded-3xl border border-gray-200 dark:border-gray-800 flex flex-col flex-1 shadow-sm overflow-hidden transition-colors">
          <div className="px-8 py-7 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl transition-all">
                <Database className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-[13px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-[0.15em] leading-tight">
                  Knowledge Inventory
                </h2>
                <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight">
                  {documents.length} Registered Documents
                </p>
              </div>
            </div>
            {isLoadingDocs && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
          </div>

          <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-4 custom-scrollbar">
            {documents.length === 0 && !isLoadingDocs ? (
              <div className="text-sm text-gray-400 text-center py-10 italic">No knowledge documents registered yet.</div>
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
                        onClick={(e) => { e.stopPropagation(); openDeleteModal(doc); }}
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
                        Extracted Screens / Items
                        {isLoadingItems && <Loader2 className="w-3 h-3 animate-spin" />}
                      </h5>
                      {docItems.length === 0 && !isLoadingItems ? (
                        <p className="text-[10px] text-gray-500 italic py-2">No items extracted from this document.</p>
                      ) : (
                        docItems.map((item, idx) => (
                          <div key={item.id} className="p-3 bg-gray-50 dark:bg-[#0c0e12] border border-gray-100 dark:border-gray-800 rounded-lg space-y-3 group transition-all">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 text-[8px] text-gray-400 font-bold uppercase mb-0.5">
                                  <span className="text-indigo-500 font-black">P.{item.page_number}</span>
                                  <span>•</span>
                                  <span>{item.classification || 'No Class'}</span>
                                  <span>•</span>
                                  <span className="truncate max-w-[150px]">{item.depth_1} {item.depth_2 ? `> ${item.depth_2}` : ''}</span>
                                </div>
                                <div className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase truncate">
                                  {item.title}
                                </div>
                              </div>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            </div>

                            {/* Captured Screen Image */}
                            {item.image_path && (
                              <div className="rounded-lg overflow-hidden border border-gray-100 dark:border-gray-800 bg-black/5 dark:bg-black/40 group/img relative">
                                <img
                                  src={`http://localhost:8001${item.image_path}`}
                                  alt={`Page ${item.page_number} Screenshot`}
                                  className="w-full h-auto object-contain max-h-[300px] hover:scale-105 transition-transform duration-500 cursor-zoom-in"
                                  onClick={() => window.open(`http://localhost:8001${item.image_path}`, '_blank')}
                                />
                                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/50 backdrop-blur-md rounded text-[7px] text-white font-bold uppercase tracking-widest opacity-0 group-hover/img:opacity-100 transition-opacity">
                                  Page Screenshot
                                </div>
                              </div>
                            )}

                            {/* Extracted Custom Data */}
                            {item.content && Object.keys(item.content).filter(k => k !== 'raw_text_snippet').length > 0 && (
                              <div className="pt-2 border-t border-gray-200 dark:border-gray-800 grid grid-cols-1 gap-2">
                                {Object.entries(item.content).map(([key, value]) => {
                                  if (key === 'raw_text_snippet') return null;
                                  return (
                                    <div key={key} className="flex flex-col gap-1">
                                      <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">{key}</span>
                                      <div className="text-[10px] text-gray-600 dark:text-gray-400 bg-white dark:bg-[#16191f] p-2 rounded-lg border border-gray-100 dark:border-gray-800 break-words leading-relaxed shadow-sm">
                                        {String(value) || <span className="text-gray-300 italic">No Value Extracted</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Raw Text Toggle for Debugging */}
                            <details className="group/raw">
                              <summary className="text-[8px] font-black text-gray-400 uppercase cursor-pointer hover:text-indigo-500 transition-colors list-none flex items-center gap-1">
                                <Database className="w-2.5 h-2.5" /> Show Source Text (Raw)
                              </summary>
                              <div className="mt-2 text-[9px] font-mono text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-black/20 p-2 rounded-lg whitespace-pre-wrap break-words max-h-[150px] overflow-y-auto border border-gray-200 dark:border-gray-800">
                                {item.content?.raw_text_snippet || "No raw text stored."}
                              </div>
                            </details>
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

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && docToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-full border border-red-100 dark:border-red-500/20">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-500" />
              </div>

              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">Delete Document?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white">"{docToDelete.title}"</span>?
                  This will also remove all extracted inventory items.
                </p>
              </div>

              <div className="flex w-full gap-3">
                <button
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setDocToDelete(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-[10px] font-black uppercase transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  {isDeleting ? 'Deleting...' : 'Delete Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RagManager;
