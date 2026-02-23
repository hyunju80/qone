import React, { useState } from 'react';
import { X, Save, Tag, Hash, FileText } from 'lucide-react';
import { assetsApi } from '../api/assets';

interface ObjectRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    initialData: {
        name: string;
        selectorType: string;
        selectorValue: string;
    };
    onRegistered: (obj: any) => void;
}

const ObjectRegistrationModal: React.FC<ObjectRegistrationModalProps> = ({ isOpen, onClose, projectId, initialData, onRegistered }) => {
    const [name, setName] = useState(initialData.name);
    const [description, setDescription] = useState('');
    const [selectorType, setSelectorType] = useState(initialData.selectorType);
    const [selectorValue, setSelectorValue] = useState(initialData.selectorValue);
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!name || !selectorValue) return;
        setIsSaving(true);
        try {
            const payload = {
                project_id: projectId,
                name,
                description,
                selector_type: selectorType,
                value: selectorValue,
                is_active: true
            };
            const result = await assetsApi.createObject(payload);
            onRegistered(result);
            onClose();
        } catch (err) {
            console.error("Failed to register object", err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Register New Object</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-500"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-8 space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest">Logical Name</label>
                        <div className="relative">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                placeholder="e.g. login_confirm_button"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest">Description</label>
                        <div className="relative">
                            <FileText className="absolute left-4 top-3 w-4 h-4 text-gray-400" />
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-indigo-500 transition-all min-h-[80px]"
                                placeholder="What does this object do?"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest">Type</label>
                            <select
                                value={selectorType}
                                onChange={(e) => setSelectorType(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-2xl py-3 px-4 text-xs font-bold outline-none"
                            >
                                <option value="ID">ID</option>
                                <option value="XPATH">XPATH</option>
                                <option value="ACCESSIBILITY_ID">ACCESSIBILITY_ID</option>
                                <option value="CSS">CSS</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest">Value</label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-indigo-400" />
                                <input
                                    type="text"
                                    value={selectorValue}
                                    onChange={(e) => setSelectorValue(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-2xl py-3 pl-8 pr-4 text-[10px] font-mono outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-6 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-gray-500 font-bold text-xs uppercase tracking-widest">Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !name}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {isSaving ? 'Registering...' : <><Save className="w-4 h-4" /> Register Object</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ObjectRegistrationModal;
