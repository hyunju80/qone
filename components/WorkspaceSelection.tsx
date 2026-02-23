
import React, { useMemo } from 'react';
import { Plus, ArrowLeft, LogOut, Globe, ChevronRight, Layout } from 'lucide-react';
import { User, Project, CustomerAccount } from '../types';

interface WorkspaceSelectionProps {
    currentUser: User;
    projects: Project[];
    selectedCustomer: CustomerAccount | null;
    onSelectProject: (project: Project) => void;
    onLogout: () => void;
    onAddProject: (data: any) => void;
    onBackToHub?: () => void;
}

const WorkspaceSelection: React.FC<WorkspaceSelectionProps> = ({
    currentUser,
    projects,
    selectedCustomer,
    onSelectProject,
    onLogout,
    onAddProject,
    onBackToHub
}) => {

    const availableProjects = useMemo(() => {
        if (!currentUser) return [];
        // If super admin and no specific customer selected (rare case in this view), show all? 
        // Actually, App.tsx logic usually filters by selectedCustomer if super admin bypassed.
        // But for strict Admin, they just see their own.

        if (currentUser.isSaaSSuperAdmin) {
            // If coming from Hub, we likely have selectedCustomer
            if (selectedCustomer) {
                return projects.filter(p => p.customerAccountId === selectedCustomer.id);
            }
            return projects;
        }
        // Regular Admin: Filter by their customerAccountId
        // Double check: backend should already filter, but frontend safety is good.
        return projects.filter(p => p.customerAccountId === currentUser.customerAccountId);
    }, [currentUser, projects, selectedCustomer]);

    const [showNewProjectModal, setShowNewProjectModal] = React.useState(false);
    const [newProjectForm, setNewProjectForm] = React.useState({ name: '', description: '', domain: 'Fintech', targetDevices: ['PC-Web'] });

    const handleCreateSubmit = () => {
        if (!newProjectForm.name) return;
        // Call the parent handler with the form data
        // We cast targetDevices to any to simplify for now, or import TargetDevice type
        onAddProject(newProjectForm);
        setShowNewProjectModal(false);
        setNewProjectForm({ name: '', description: '', domain: 'Fintech', targetDevices: ['PC-Web'] });
    };

    const handleOpenModal = () => {
        setShowNewProjectModal(true);
    };

    return (
        <div className="h-screen w-full bg-gray-50 dark:bg-[#0c0e12] flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors">
            <div className="w-full max-w-5xl animate-in zoom-in-95 duration-500 relative z-10">
                <div className="flex justify-between items-end mb-8 px-2">
                    <div>
                        <p className="text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest mb-1 transition-colors">{`Authenticated: ${currentUser.name}`}</p>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter transition-colors">Select Workspace</h1>
                        {selectedCustomer && currentUser.isSaaSSuperAdmin && (
                            <span className="text-gray-500 text-sm font-medium">Viewing as Admin for: {selectedCustomer.companyName}</span>
                        )}
                    </div>
                    <div className="flex gap-4">
                        {(currentUser.role === 'Admin' || currentUser.isSaaSSuperAdmin) && (
                            <button
                                onClick={handleOpenModal}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-xs font-black uppercase px-6 py-2 rounded-xl shadow-lg shadow-indigo-600/20"
                            >
                                <Plus className="w-4 h-4" /> Add Workspace
                            </button>
                        )}
                        {currentUser.isSaaSSuperAdmin && onBackToHub && (
                            <button onClick={onBackToHub} className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors text-xs font-bold uppercase bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/20 px-4 py-2 rounded-xl"><ArrowLeft className="w-4 h-4" /> Back to Hub</button>
                        )}
                        <button onClick={onLogout} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors text-xs font-bold uppercase"><LogOut className="w-4 h-4" /> LOGOUT SESSION</button>
                    </div>
                </div>

                {availableProjects.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl border-dashed transition-colors shadow-sm dark:shadow-none">
                        <p className="text-gray-500 dark:text-gray-400 mb-4 transition-colors">No workspaces found.</p>
                        {(currentUser.role === 'Admin' || currentUser.isSaaSSuperAdmin) && (
                            <button
                                onClick={handleOpenModal}
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 underline text-sm transition-colors"
                            >
                                Create your first workspace
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {availableProjects.map(proj => (
                            <button key={proj.id} onClick={() => onSelectProject(proj)} className="group bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 hover:border-indigo-500/50 rounded-3xl p-8 text-left transition-all hover:shadow-xl hover:shadow-indigo-600/10 flex flex-col relative overflow-hidden h-[240px] shadow-sm dark:shadow-none">
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 tracking-tight truncate transition-colors">{proj.name}</h3>
                                <p className="text-sm text-gray-500 mb-8 leading-relaxed line-clamp-3 transition-colors">{proj.description}</p>
                                <div className="mt-auto flex items-center justify-between"><span className="px-3 py-1 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-full text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-tighter transition-colors"><Globe className="w-2.5 h-2.5 inline mr-1" /> {proj.domain}</span><div className="p-2 bg-indigo-50 dark:bg-indigo-600/10 rounded-full text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all"><ChevronRight className="w-5 h-5" /></div></div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* New Project Modal */}
            {showNewProjectModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-colors">
                    <div className="relative w-full max-w-lg bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 transition-colors">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-indigo-600 rounded-2xl text-white"><Layout className="w-6 h-6" /></div>
                            <div><h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight transition-colors">New Workspace</h3><p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest transition-colors">Create a new testing environment</p></div>
                        </div>
                        <div className="space-y-4 mb-10">
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest transition-colors">Workspace Name</label><input type="text" value={newProjectForm.name} onChange={e => setNewProjectForm({ ...newProjectForm, name: e.target.value })} className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 transition-colors shadow-sm dark:shadow-none" placeholder="e.g., Q1-2024 Testing" /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest transition-colors">Domain</label><select value={newProjectForm.domain} onChange={e => setNewProjectForm({ ...newProjectForm, domain: e.target.value })} className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-700 dark:text-gray-400 outline-none transition-colors shadow-sm dark:shadow-none"><option value="Fintech">Fintech</option><option value="E-commerce">E-commerce</option><option value="Telecom">Telecom</option><option value="Healthcare">Healthcare</option><option value="Logistics">Logistics</option><option value="Other">Other</option></select></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest transition-colors">Description</label><textarea value={newProjectForm.description} onChange={e => setNewProjectForm({ ...newProjectForm, description: e.target.value })} className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white outline-none h-24 resize-none transition-colors shadow-sm dark:shadow-none" placeholder="Brief description of this workspace..." /></div>
                        </div>
                        <div className="flex justify-end gap-3"><button onClick={() => setShowNewProjectModal(false)} className="px-6 py-3 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 uppercase transition-colors">Cancel</button><button onClick={handleCreateSubmit} disabled={!newProjectForm.name} className="px-10 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-indigo-600/20">Create Workspace</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkspaceSelection;
