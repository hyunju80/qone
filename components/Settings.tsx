
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Project, User, ProjectAccess, TargetDevice, CustomerAccount, ProjectEnvironment, UserRole, ObjectElement } from '../types';
import {
  Building2, Users, ShieldCheck, Plus, Trash2, Edit3,
  X, Fingerprint, Layout, Monitor, Smartphone, Globe,
  Mail, UserPlus, UserMinus, Server, Upload, CheckCircle2, AlertCircle, Info, Package, Hash, Apple, Laptop,
  Database
} from 'lucide-react';
import { MOCK_CUSTOMER } from '../constants';
import { projectsApi } from '../api/projects';

interface SettingsProps {
  user: User;
  activeProject: Project | null;
  projects: Project[];
  users: User[];
  access: ProjectAccess[];
  onUpdateProjects: (p: Project[]) => void;
  onUpdateUsers: (u: User[]) => void;
  onUpdateAccess: (a: ProjectAccess[]) => void;
  onAlert: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

const Settings: React.FC<SettingsProps> = ({
  user, activeProject, projects, users, access,
  onUpdateProjects, onUpdateUsers, onUpdateAccess, onAlert
}) => {
  const [activeTab, setActiveTab] = useState<'iam' | 'workspace'>('workspace');
  const [customer, setCustomer] = useState<CustomerAccount>(MOCK_CUSTOMER);

  // --- Workspace Config State ---
  const [editingEnv, setEditingEnv] = useState<ProjectEnvironment | null>(null);
  const [tempEnvUrl, setTempEnvUrl] = useState('');

  // --- Object Repository State ---
  const [isDefineModalOpen, setIsDefineModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [newElement, setNewElement] = useState({ name: '', selector: '', description: '' });
  const [bulkInput, setBulkInput] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);

  // --- IAM State ---
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'QA Engineer' as UserRole });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const isAtLeastManager = user.role === 'Admin' || user.role === 'Manager';

  // 플랫폼 토글 핸들러
  const toggleTargetDevice = async (device: TargetDevice) => {
    if (!activeProject || !isAtLeastManager) return;

    const currentDevices = activeProject.targetDevices || [];
    const newDevices = currentDevices.includes(device)
      ? currentDevices.filter(d => d !== device)
      : [...currentDevices, device];

    if (newDevices.length === 0) {
      onAlert("Warning", "At least one platform must be active.", 'error');
      return;
    }

    const updatedProject = { ...activeProject, targetDevices: newDevices };
    try {
      await projectsApi.update(activeProject.id, { targetDevices: newDevices });
      onUpdateProjects(projects.map(p => p.id === activeProject.id ? updatedProject : p));
    } catch (e) {
      onAlert("Error", "Failed to update platform settings.", 'error');
    }
  };

  // 모바일 식별 정보 업데이트 핸들러
  const updateMobileConfig = async (field: string, value: string) => {
    if (!activeProject || !isAtLeastManager) return;

    const updatedConfig = {
      ...(activeProject.mobileConfig || {}),
      [field]: value
    };

    const updatedProject = {
      ...activeProject,
      mobileConfig: updatedConfig
    };

    try {
      await projectsApi.update(activeProject.id, { mobileConfig: updatedConfig });
      onUpdateProjects(projects.map(p => p.id === activeProject.id ? updatedProject : p));
    } catch (e) {
      console.error("Failed to update mobile config", e);
    }
  };

  // 환경 URL 편집 시작
  const startEditEnv = (env: ProjectEnvironment, currentUrl: string) => {
    if (!isAtLeastManager) return;
    setEditingEnv(env);
    setTempEnvUrl(currentUrl);
  };

  // 환경 URL 저장
  const saveEnvUrl = async () => {
    if (!activeProject || !editingEnv) return;

    const updatedEnvs = {
      ...activeProject.environments,
      [editingEnv]: tempEnvUrl
    };

    const updatedProject = {
      ...activeProject,
      environments: updatedEnvs
    };

    try {
      await projectsApi.update(activeProject.id, { environments: updatedEnvs });
      onUpdateProjects(projects.map(p => p.id === activeProject.id ? updatedProject : p));
      setEditingEnv(null);
    } catch (e) {
      onAlert("Error", "Failed to update environment URL.", 'error');
    }
  };

  // --- Object Repository Handlers ---
  const handleDefineElement = async () => {
    if (!activeProject || !newElement.name || !newElement.selector) return;

    const element: ObjectElement = {
      id: `el_${Date.now()}`,
      ...newElement
    };

    const updatedRepo = [...(activeProject.objectRepo || []), element];

    const updatedProject = {
      ...activeProject,
      objectRepo: updatedRepo
    };

    try {
      await projectsApi.update(activeProject.id, { objectRepo: updatedRepo });
      onUpdateProjects(projects.map(p => p.id === activeProject.id ? updatedProject : p));
      setNewElement({ name: '', selector: '', description: '' });
      setIsDefineModalOpen(false);
      onAlert("Success", "Element defined successfully.", 'success');
    } catch (e) {
      onAlert("Error", "Failed to save element.", 'error');
    }
  };

  const handleBulkImport = async () => {
    if (!activeProject) return;
    try {
      const parsed = JSON.parse(bulkInput);
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array of objects.");

      const newElements: ObjectElement[] = parsed.map((item: any, idx: number) => ({
        id: `bulk_${Date.now()}_${idx}`,
        name: item.name || `element_${idx}`,
        selector: item.selector || '',
        description: item.description || ''
      }));

      const updatedRepo = [...(activeProject.objectRepo || []), ...newElements];

      const updatedProject = {
        ...activeProject,
        objectRepo: updatedRepo
      };

      await projectsApi.update(activeProject.id, { objectRepo: updatedRepo });
      onUpdateProjects(projects.map(p => p.id === activeProject.id ? updatedProject : p));
      setBulkInput('');
      setBulkError(null);
      setIsBulkModalOpen(false);
      onAlert("Success", "Bulk import successful.", 'success');
    } catch (e: any) {
      setBulkError(e.message || "Invalid JSON format or Server Error.");
    }
  };

  const handleDeleteElement = async (id: string) => {
    if (!activeProject) return;

    const updatedRepo = (activeProject.objectRepo || []).filter(el => el.id !== id);
    const updatedProject = {
      ...activeProject,
      objectRepo: updatedRepo
    };

    try {
      await projectsApi.update(activeProject.id, { objectRepo: updatedRepo });
      onUpdateProjects(projects.map(p => p.id === activeProject.id ? updatedProject : p));
    } catch (e) {
      onAlert("Error", "Failed to delete element.", 'error');
    }
  };

  // --- IAM Handlers ---
  const handleOpenInvite = () => {
    setEditingUserId(null);
    setUserForm({ name: '', email: '', role: 'QA Engineer' });
    setShowUserModal(true);
  };

  const handleEditUser = (u: User) => {
    setEditingUserId(u.id);
    setUserForm({ name: u.name, email: u.email, role: u.role });
    setShowUserModal(true);
  };

  const handleDeleteUser = (u: User) => {
    if (u.id === user.id) {
      onAlert("Warning", "자신의 계정은 삭제할 수 없습니다.", 'error');
      return;
    }
    setDeletingUser(u);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      // @ts-ignore
      await import('../api/users').then(m => m.usersApi.delete(deletingUser.id));
      onUpdateUsers(users.filter(u => u.id !== deletingUser.id));
      setShowDeleteConfirm(false);
      setDeletingUser(null);
      setDeletingUser(null);
      onAlert("Success", "User has been removed from the project.", 'success');
    } catch (e) {
      onAlert("Error", "Failed to delete user", 'error');
    }
  };

  const handleSaveUser = async () => {
    if (!userForm.name || !userForm.email || !activeProject) return;

    try {
      if (editingUserId) {
        // Update existing
        onUpdateUsers(users.map(u => u.id === editingUserId ? { ...u, ...userForm } : u));

        // Call API
        // @ts-ignore
        await import('../api/users').then(m => m.usersApi.update(editingUserId, {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role
        }));
        onAlert("Success", "User details updated.", 'success');
      } else {
        // Invite new user via API
        // @ts-ignore
        const newUser = await import('../api/users').then(m => m.usersApi.inviteToProject(activeProject.id, {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role
        }));
        // Update local list
        onUpdateUsers([...users, newUser as User]);
        onAlert("Success", "Invitation sent successfully!", 'success');
      }
      setShowUserModal(false);
      setUserForm({ name: '', email: '', role: 'QA Engineer' });
      setEditingUserId(null); // Reset editing state
    } catch (e) {
      onAlert("Error", "Failed to save user", 'error');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-[#0c0e12] transition-colors">
      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-8 overflow-x-auto no-scrollbar transition-colors">
        <button onClick={() => setActiveTab('iam')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'iam' ? 'text-indigo-600 dark:text-indigo-400 border-indigo-500' : 'text-gray-500 dark:text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'}`}>
          <Fingerprint className="w-4 h-4" /> Team & IAM
        </button>
        <button onClick={() => setActiveTab('workspace')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'workspace' ? 'text-indigo-600 dark:text-indigo-400 border-indigo-500' : 'text-gray-500 dark:text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'}`}>
          <Layout className="w-4 h-4" /> Workspace Config
        </button>
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-500 pb-20">

        {/* --- Tab 1: Team Directory & IAM (RBAC) --- */}
        {activeTab === 'iam' && (
          <div className="space-y-10">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest transition-colors mb-1">Project Team Members ({users.length})</h3>
                <p className="text-[10px] text-gray-400 dark:text-gray-600 font-bold uppercase tracking-tighter transition-colors">Authorized agents for workspace: {activeProject?.name}</p>
              </div>
              {isAtLeastManager && (
                <button onClick={handleOpenInvite} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20">
                  <UserPlus className="w-3.5 h-3.5" /> Invite to Project
                </button>
              )}
            </div>

            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-2xl transition-colors">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black uppercase text-gray-500 border-b border-gray-200 dark:border-gray-800 transition-colors">
                  <tr>
                    <th className="px-8 py-4">Identity</th>
                    <th className="px-8 py-4">Role & Permissions</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800 transition-colors">
                  {users.filter(u => u.isActive !== false).map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/20 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black transition-colors">
                            {u.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 dark:text-white transition-colors">{u.name}</span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 transition-colors">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest transition-colors ${u.role === 'Admin' ? 'bg-indigo-600 text-white' :
                            u.role === 'Manager' ? 'bg-amber-100 dark:bg-amber-600/10 text-amber-600 dark:text-amber-500 border border-amber-200 dark:border-amber-500/20' :
                              u.role === 'QA Engineer' ? 'bg-emerald-100 dark:bg-emerald-600/10 text-emerald-600 dark:text-emerald-500 border border-emerald-200 dark:border-emerald-500/20' :
                                'bg-gray-100 dark:bg-gray-800 text-gray-500'
                            }`}>
                            {u.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className={`flex justify-end gap-1 ${u.id === user.id ? 'hidden' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                          {isAtLeastManager && (
                            <>
                              <button onClick={() => handleEditUser(u)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors" title="Edit User"><Edit3 className="w-4 h-4" /></button>
                              <button onClick={() => handleDeleteUser(u)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 transition-colors" title="Remove User"><UserMinus className="w-4 h-4" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* User Create/Edit Modal */}
            {showUserModal && createPortal(
              <div className="fixed inset-0 z-[9999] flex items-center justify-center p-8 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-colors">
                <div className="relative w-full max-w-lg bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 animate-in zoom-in-95 shadow-2xl transition-colors">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/20">
                      {editingUserId ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">
                        {editingUserId ? 'Modify Team Member' : `Invite to ${activeProject?.name}`}
                      </h3>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5 transition-colors">
                        {editingUserId ? 'Update identity and permissions' : 'Initialize collaboration for this workspace'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest transition-colors">Full Name</label>
                      <input
                        value={userForm.name}
                        onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                        placeholder="e.g., Alex Johnson"
                        className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors shadow-sm dark:shadow-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest transition-colors">Email Address</label>
                      <input
                        value={userForm.email}
                        onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                        placeholder="alex@company.com"
                        className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors shadow-sm dark:shadow-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest transition-colors">Assigned Role</label>
                      <select
                        value={userForm.role}
                        onChange={e => setUserForm({ ...userForm, role: e.target.value as any })}
                        className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-700 dark:text-gray-400 outline-none focus:border-indigo-500 transition-colors shadow-sm dark:shadow-none"
                      >
                        <option value="Manager">Manager (Approver)</option>
                        <option value="QA Engineer">QA Engineer (Test Developer)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-800 pt-6 transition-colors">
                    <button onClick={() => setShowUserModal(false)} className="px-6 py-3 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Cancel</button>
                    <button
                      onClick={handleSaveUser}
                      className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-indigo-600/20 transition-all"
                    >
                      {editingUserId ? 'Update Member' : 'Send Invitation'}
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && deletingUser && createPortal(
              <div className="fixed inset-0 z-[9999] flex items-center justify-center p-8 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200 transition-colors">
                <div className="relative w-full max-w-md bg-white dark:bg-[#16191f] border border-red-200 dark:border-red-900/30 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 transition-colors">
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="p-4 bg-red-50 dark:bg-red-600/10 rounded-full text-red-500 border border-red-100 dark:border-red-500/20 animate-bounce transition-colors">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2 transition-colors">Confirm Removal</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm transition-colors">
                        Are you sure you want to remove <span className="text-gray-900 dark:text-white font-bold transition-colors">{deletingUser.name}</span>?
                        <br />
                        <span className="text-xs text-red-500 dark:text-red-400 mt-2 block font-bold uppercase tracking-widest transition-colors">This action will revoke all access immediately.</span>
                      </p>
                    </div>
                    <div className="flex gap-3 w-full">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-3 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmDeleteUser}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" /> Remove User
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>
        )}

        {/* --- Tab 2: Workspace & Infrastructure (Project-Specific) --- */}
        {activeTab === 'workspace' && (
          <div className="space-y-12 animate-in slide-in-from-bottom-2 duration-500">
            {/* Target Platforms Config */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-indigo-500 dark:text-indigo-400 transition-colors" />
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Target Platforms & Device Station</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(['PC-Web', 'Mobile-Web', 'Mobile-App'] as TargetDevice[]).map(device => {
                  const isSelected = (activeProject?.targetDevices || []).includes(device);
                  return (
                    <button
                      key={device}
                      onClick={() => toggleTargetDevice(device)}
                      className={`group relative p-6 rounded-[2rem] border transition-all text-left overflow-hidden shadow-sm dark:shadow-none ${isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-200 dark:border-indigo-500 shadow-xl shadow-indigo-600/10'
                        : 'bg-white dark:bg-[#16191f] border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 opacity-60'
                        }`}
                    >
                      <div className={`absolute top-0 right-0 p-6 transition-transform group-hover:scale-110 ${isSelected ? 'text-indigo-200 dark:text-indigo-400' : 'text-gray-100 dark:text-gray-800'}`}>
                        {device === 'PC-Web' ? <Laptop className="w-16 h-16" /> : <Smartphone className="w-16 h-16" />}
                      </div>

                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                          {device === 'PC-Web' ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>Platform</span>
                        </div>
                        <h4 className="text-xl font-black text-gray-900 dark:text-white mb-4 transition-colors">{device}</h4>
                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-100 dark:bg-green-600/10 border border-green-200 dark:border-green-500/20 rounded text-[9px] font-black text-green-600 dark:text-green-500 uppercase transition-colors">
                              <CheckCircle2 className="w-3 h-3" /> Active Station
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-[9px] font-black text-gray-500 dark:text-gray-700 uppercase transition-colors">
                              <X className="w-3 h-3" /> Inactive
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile Application Identity (Conditional) */}
            {(activeProject?.targetDevices || []).includes('Mobile-App') && (
              <div className="animate-in slide-in-from-top-4 duration-500 space-y-6">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-indigo-500 dark:text-indigo-400 transition-colors" />
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Mobile Application Identity</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-8 shadow-xl transition-colors">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-600/10 rounded-xl text-indigo-600 dark:text-indigo-400 transition-colors">
                        <Monitor className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Android Identification</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 transition-colors">
                          <Package className="w-3 h-3" /> Package Name
                        </label>
                        <input
                          type="text"
                          value={activeProject.mobileConfig?.androidPackage || ''}
                          onChange={(e) => updateMobileConfig('androidPackage', e.target.value)}
                          placeholder="e.g., com.company.appname"
                          className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-3 text-sm text-gray-900 dark:text-gray-300 focus:border-indigo-500 outline-none transition-all mono shadow-sm dark:shadow-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-8 shadow-xl transition-colors">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-gray-100 dark:bg-gray-600/10 rounded-xl text-gray-500 dark:text-gray-300 transition-colors">
                        <Apple className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">iOS Identification</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 transition-colors">
                          <Fingerprint className="w-3 h-3" /> Bundle Identifier
                        </label>
                        <input
                          type="text"
                          value={activeProject.mobileConfig?.iosBundleId || ''}
                          onChange={(e) => updateMobileConfig('iosBundleId', e.target.value)}
                          placeholder="e.g., io.company.appname"
                          className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-3 text-sm text-gray-900 dark:text-gray-300 focus:border-indigo-500 outline-none transition-all mono shadow-sm dark:shadow-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-8 shadow-xl flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 transition-colors">
                        <Hash className="w-3 h-3" /> Version Policy
                      </label>
                      <input
                        type="text"
                        value={activeProject.mobileConfig?.appVersion || ''}
                        onChange={(e) => updateMobileConfig('appVersion', e.target.value)}
                        placeholder="e.g., 1.2.0-beta"
                        className="bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-3 text-sm text-gray-900 dark:text-gray-300 focus:border-indigo-500 outline-none transition-all w-48 shadow-sm dark:shadow-none"
                      />
                    </div>
                  </div>
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-600/5 border border-indigo-100 dark:border-indigo-500/10 rounded-2xl flex items-center gap-3 max-w-md transition-colors">
                    <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 transition-colors" />
                    <p className="text-[10px] text-gray-500 italic leading-relaxed text-balance transition-colors">
                      "상기 식별자는 Oracle 에이전트가 전 세계 디바이스 팜에서 타겟 앱을 식별하고 자동 실행하는 데 사용되는 핵심 메타데이터입니다."
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Environment URLs Mapping */}
            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-8 shadow-xl transition-colors">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-indigo-500 dark:text-indigo-400 transition-colors" />
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Active Workspace: {activeProject?.name}</h3>
                </div>
                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-tighter transition-colors">Domain: {activeProject?.domain}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(['Development', 'Staging', 'Production'] as ProjectEnvironment[]).map(env => (
                  <div key={env} className={`p-5 bg-gray-50 dark:bg-[#0c0e12] border rounded-2xl transition-all shadow-sm dark:shadow-none ${editingEnv === env ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-gray-200 dark:border-gray-800'}`}>
                    <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase mb-3 flex items-center gap-2 transition-colors">
                      <Globe className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-500" /> {env} URL
                    </div>

                    {editingEnv === env ? (
                      <div className="space-y-4">
                        <input
                          autoFocus
                          value={tempEnvUrl}
                          onChange={(e) => setTempEnvUrl(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveEnvUrl()}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-indigo-400 transition-colors"
                        />
                        <div className="flex gap-2">
                          <button onClick={saveEnvUrl} className="flex-1 py-1.5 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-lg shadow-lg shadow-indigo-600/20">Save</button>
                          <button onClick={() => setEditingEnv(null)} className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[9px] font-black uppercase rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-full bg-transparent text-xs font-bold text-gray-700 dark:text-gray-300 truncate mb-4 transition-colors" title={activeProject?.environments?.[env] || 'Not Configured'}>
                          {activeProject?.environments?.[env] || 'Not Configured'}
                        </div>
                        <button
                          onClick={() => startEditEnv(env, activeProject?.environments?.[env] || '')}
                          className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 hover:underline transition-colors"
                        >
                          <Edit3 className="w-3 h-3" /> Change Entry
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Object Repository (Selector Management) */}
            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] overflow-hidden shadow-xl transition-colors">
              <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/20 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-indigo-500 dark:text-indigo-400 transition-colors" />
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors">Object Repository (SUT Mapping)</h3>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsBulkModalOpen(true)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300 text-[10px] font-black rounded-xl uppercase flex items-center gap-2 border border-gray-200 dark:border-gray-700 transition-all">
                    <Upload className="w-3.5 h-3.5" /> Bulk Import
                  </button>
                  <button onClick={() => setIsDefineModalOpen(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-xl uppercase flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all">
                    <Plus className="w-3.5 h-3.5" /> Define Element
                  </button>
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black uppercase text-gray-500 border-b border-gray-200 dark:border-gray-800 transition-colors">
                    <tr>
                      <th className="px-8 py-4">Element ID (Logic Name)</th>
                      <th className="px-8 py-4">Current Selector</th>
                      <th className="px-8 py-4">Description</th>
                      <th className="px-8 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800 transition-colors">
                    {(activeProject?.objectRepo || []).map(el => (
                      <tr key={el.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-8 py-5 text-indigo-600 dark:text-indigo-400 font-black transition-colors">{el.name}</td>
                        <td className="px-8 py-5 text-gray-700 dark:text-gray-400 mono transition-colors">{el.selector}</td>
                        <td className="px-8 py-5 text-gray-500 italic transition-colors">{el.description}</td>
                        <td className="px-8 py-5 text-right">
                          <button onClick={() => handleDeleteElement(el.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                    {(!activeProject?.objectRepo || activeProject.objectRepo.length === 0) && (
                      <tr><td colSpan={4} className="px-8 py-20 text-center text-gray-400 dark:text-gray-600 font-bold uppercase text-[10px] transition-colors">No elements mapped in repository</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* Define Element Modal */}
      {isDefineModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-8 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200 transition-colors">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 transition-colors">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 uppercase tracking-widest flex items-center gap-2 transition-colors">
              <Database className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /> Define UI Element
            </h3>
            <div className="space-y-5 mb-8">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest transition-colors">Logic Identifier (Name)</label>
                <input
                  value={newElement.name}
                  onChange={e => setNewElement({ ...newElement, name: e.target.value })}
                  placeholder="e.g., LoginSubmitButton"
                  className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors shadow-sm dark:shadow-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest transition-colors">Selector (CSS/Playwright)</label>
                <input
                  value={newElement.selector}
                  onChange={e => setNewElement({ ...newElement, selector: e.target.value })}
                  placeholder="e.g., #auth-submit-btn"
                  className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-indigo-600 dark:text-indigo-400 mono focus:border-indigo-500 outline-none transition-colors shadow-sm dark:shadow-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest transition-colors">Functional Description</label>
                <input
                  value={newElement.description}
                  onChange={e => setNewElement({ ...newElement, description: e.target.value })}
                  placeholder="Describe the element's purpose..."
                  className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-700 dark:text-gray-400 focus:border-indigo-500 outline-none transition-colors shadow-sm dark:shadow-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsDefineModalOpen(false)} className="px-6 py-3 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Cancel</button>
              <button
                onClick={handleDefineElement}
                disabled={!newElement.name || !newElement.selector}
                className="px-10 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-indigo-600/20 transition-all"
              >
                Register Element
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-8 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200 transition-colors">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 transition-colors">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tighter italic transition-colors">Bulk Import Repository</h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-8 transition-colors">Paste JSON array of elements to synchronize at scale.</p>

            <div className="mb-6">
              <div className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-4 shadow-inner transition-colors">
                <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase mb-3 transition-colors">
                  <Info className="w-3 h-3" /> Format Example
                </div>
                <pre className="text-[10px] text-indigo-600/80 dark:text-indigo-400/60 leading-tight transition-colors">
                  {`[
  { "name": "LoginBtn", "selector": "#login", "description": "Login button" },
  { "name": "UserInp", "selector": "[name=user]", "description": "Email field" }
]`}
                </pre>
              </div>

              <textarea
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
                placeholder="Paste JSON here..."
                className="w-full h-64 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 text-xs text-green-600 dark:text-green-400 mono focus:border-indigo-500 outline-none transition-colors resize-none shadow-inner"
              />

              {bulkError && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-600/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 text-[10px] font-bold uppercase transition-colors">
                  <AlertCircle className="w-4 h-4" /> {bulkError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4">
              <button onClick={() => { setIsBulkModalOpen(false); setBulkError(null); }} className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Cancel</button>
              <button
                onClick={handleBulkImport}
                className="px-14 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-2xl uppercase shadow-xl shadow-indigo-600/20 transition-all flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> Synchronize All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;