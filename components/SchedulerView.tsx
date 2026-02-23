
import React, { useState } from 'react';
import {
   CalendarClock, Plus, Clock, Bell, ShieldAlert,
   Trash2, Edit3, Check, X, ToggleLeft, ToggleRight,
   ChevronRight, MoreVertical, Play, AlertCircle,
   CheckCircle2, Info, Send, Mail, MessageSquare,
   Target, Settings2, BarChart, History, Zap, ExternalLink,
   GitBranch, Sparkles, Activity, ShieldCheck
} from 'lucide-react';
import { TestSchedule, TestScript, Project, Incident, TriggerStrategy } from '../types';
import { schedulesApi } from '../api/schedules';

interface SchedulerViewProps {
   schedules: TestSchedule[];
   scripts: TestScript[];
   activeProject: Project;
   onUpdateSchedule: (schedule: TestSchedule) => void;
   onAddSchedule: (schedule: TestSchedule) => void;
   onDeleteSchedule: (id: string) => void;
   onAlert: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

const SchedulerView: React.FC<SchedulerViewProps> = ({
   schedules, scripts, activeProject, onUpdateSchedule, onAddSchedule, onDeleteSchedule, onAlert
}) => {
   const [showModal, setShowModal] = useState(false);
   const [editingId, setEditingId] = useState<string | null>(null);
   const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null); // Added state
   const [showIncidentModal, setShowIncidentModal] = useState<TestSchedule | null>(null);
   const [form, setForm] = useState<Partial<TestSchedule>>({
      name: '',
      scriptIds: [],
      cronExpression: '0 0 * * *',
      frequencyLabel: '매일 자정',
      isActive: true,
      priority: 'Normal',
      triggerStrategy: 'SCHEDULE',
      alertConfig: { channels: ['slack'], criticalOnly: false, failureThreshold: 1 }
   });

   // Script Selection UI State
   const [scriptSearch, setScriptSearch] = useState('');
   const [showSelectedOnly, setShowSelectedOnly] = useState(false);
   const [showCronPresets, setShowCronPresets] = useState(false);

   const handleEdit = (sch: TestSchedule) => {
      setForm({ ...sch });
      setEditingId(sch.id);
      setShowModal(true);
   };

   const handleToggleActive = async (sch: TestSchedule) => {
      try {
         const updated = await schedulesApi.update(sch.id, { isActive: !sch.isActive });
         onUpdateSchedule(updated);
      } catch (e) {
         console.error("Failed to toggle schedule", e);
      }
   };

   const handleSave = async () => {
      if (!form.name || form.scriptIds?.length === 0) return;

      try {
         if (editingId) {
            const updated = await schedulesApi.update(editingId, form);
            onUpdateSchedule(updated);
            onAlert("Success", "Schedule updated.", 'success');
         } else {
            const newSchPayload = {
               projectId: activeProject.id,
               name: form.name,
               scriptIds: form.scriptIds,
               cronExpression: form.cronExpression,
               frequencyLabel: form.frequencyLabel,
               isActive: form.isActive,
               priority: form.priority,
               triggerStrategy: form.triggerStrategy || 'SCHEDULE',
               alertConfig: form.alertConfig
            };
            const created = await schedulesApi.create(newSchPayload);
            onAddSchedule(created);
            onAlert("Success", "Schedule created.", 'success');
         }
         setShowModal(false);
         setEditingId(null);
      } catch (e) {
         console.error("Failed to save schedule", e);
         onAlert("Error", "Failed to save schedule.", 'error');
      }
   };

   const handleDelete = (id: string) => {
      setDeleteConfirmId(id);
   };

   const confirmDelete = async () => {
      if (!deleteConfirmId) return;
      try {
         await schedulesApi.delete(deleteConfirmId);
         onDeleteSchedule(deleteConfirmId);
         onAlert("Success", "Schedule deleted.", 'success');
      } catch (e) {
         console.error("Failed to delete schedule", e);
         onAlert("Error", "Failed to delete schedule.", 'error');
      } finally {
         setDeleteConfirmId(null);
      }
   };

   const toggleScriptSelection = (id: string) => {
      setForm(prev => {
         const ids = prev.scriptIds || [];
         return {
            ...prev,
            scriptIds: ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]
         };
      });
   };

   const toggleAlertChannel = (channel: any) => {
      setForm(prev => {
         const channels = prev.alertConfig?.channels || [];
         return {
            ...prev,
            alertConfig: {
               ...prev.alertConfig!,
               channels: channels.includes(channel) ? channels.filter(c => c !== channel) : [...channels, channel]
            }
         };
      });
   };

   const getStrategyBadge = (strategy: TriggerStrategy | undefined) => {
      switch (strategy) {
         case 'DEPLOYMENT':
            return <span className="px-2 py-0.5 bg-purple-600/10 text-purple-400 border border-purple-500/20 rounded text-[8px] font-black uppercase flex items-center gap-1"><GitBranch className="w-2 h-2" /> Deployment Trigger</span>;
         case 'BOTH':
            return <span className="px-2 py-0.5 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded text-[8px] font-black uppercase flex items-center gap-1"><Sparkles className="w-2 h-2" /> Hybrid Policy</span>;
         default:
            return <span className="px-2 py-0.5 bg-gray-800 text-gray-400 border border-gray-700 rounded text-[8px] font-black uppercase flex items-center gap-1"><Clock className="w-2 h-2" /> Scheduled</span>;
      }
   };

   return (
      <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto custom-scrollbar">
         <div className="flex items-center justify-between mb-10">
            <div>
               <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter mb-2 transition-colors">Smart Scheduler</h2>
               <p className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-widest transition-colors">Autonomous planning & incident orchestration policies.</p>
            </div>
            <button
               onClick={() => { setEditingId(null); setForm({ name: '', scriptIds: [], cronExpression: '0 0 * * *', frequencyLabel: '매일 자정', isActive: true, priority: 'Normal', triggerStrategy: 'SCHEDULE', alertConfig: { channels: ['slack'], criticalOnly: false, failureThreshold: 1 } }); setScriptSearch(''); setShowSelectedOnly(false); setShowModal(true); }}
               className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-xl shadow-indigo-600/20 text-xs font-black uppercase"
            >
               <Plus className="w-4 h-4" /> Create New Batch Job
            </button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {schedules.map(sch => {
               const hasIncident = sch.incidentHistory && sch.incidentHistory.length > 0;
               return (
                  <div key={sch.id} className={`bg-white dark:bg-[#16191f] border rounded-[2rem] p-6 transition-all group flex flex-col relative overflow-hidden ${sch.isActive ? 'border-gray-200 dark:border-gray-800 hover:border-indigo-500/30 shadow-xl shadow-gray-200/50 dark:shadow-black/50' : 'border-red-500/20 dark:border-red-900/20 opacity-60 grayscale'}`}>

                     {/* Alert Active Badge */}
                     {sch.isActive && hasIncident && (
                        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white rounded-full text-[8px] font-black uppercase animate-pulse shadow-lg shadow-red-600/40 z-10">
                           <Bell className="w-2.5 h-2.5" /> Alert Triggered
                        </div>
                     )}

                     <div className="flex justify-between items-start mb-6 relative">
                        <div className={`p-3 rounded-2xl transition-all ${sch.priority === 'Critical' ? 'bg-red-600/10 text-red-600 dark:text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400'}`}>
                           {sch.triggerStrategy === 'DEPLOYMENT' ? <GitBranch className="w-6 h-6" /> : <CalendarClock className="w-6 h-6" />}
                        </div>
                        <div className="flex items-center gap-1">
                           <button onClick={() => handleToggleActive(sch)} className="p-2 hover:bg-gray-800 rounded-xl transition-all">
                              {sch.isActive ? <ToggleRight className="w-6 h-6 text-indigo-600 dark:text-indigo-500 transition-colors" /> : <ToggleLeft className="w-6 h-6 text-gray-400 dark:text-gray-700 transition-colors" />}
                           </button>
                        </div>
                     </div>

                     <div className="mb-4">
                        <div className="flex items-center gap-2 mb-1.5">
                           {getStrategyBadge(sch.triggerStrategy)}
                        </div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight transition-colors">{sch.name}</h3>
                        <div className="flex items-center gap-2 mt-2">
                           <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${sch.priority === 'Critical' ? 'bg-red-600/10 dark:bg-red-600/20 text-red-600 dark:text-red-500' : 'bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400'}`}>
                              {sch.priority} Priority
                           </span>
                           {sch.triggerStrategy !== 'DEPLOYMENT' && (
                              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                 <Clock className="w-3 h-3 text-gray-700" /> {sch.frequencyLabel}
                              </span>
                           )}
                        </div>
                     </div>

                     <div className="space-y-3 mb-6 flex-1">
                        <div className="bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl p-3 transition-colors">
                           <div className="text-[9px] font-black text-gray-600 uppercase mb-2 flex items-center justify-between">
                              <span>Target Assets</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold transition-colors">{sch.scriptIds.length} Scripts</span>
                           </div>
                           <div className="flex flex-wrap gap-1.5">
                              {sch.scriptIds.slice(0, 3).map(sid => (
                                 <span key={sid} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-[9px] font-bold text-gray-600 dark:text-gray-500 transition-colors">
                                    {scripts.find(s => s.id === sid)?.name || sid}
                                 </span>
                              ))}
                              {sch.scriptIds.length > 3 && <span className="text-[9px] text-gray-700 ml-1 font-bold">+{sch.scriptIds.length - 3}</span>}
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                           <div className="flex flex-col p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 transition-colors">
                              <span className="text-[8px] font-black text-gray-600 uppercase tracking-tighter mb-1">Threshold</span>
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-300">
                                 <ShieldAlert className="w-3 h-3 text-amber-500" /> {sch.alertConfig.failureThreshold} Fail
                              </div>
                           </div>
                           <div className="flex flex-col p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 transition-colors">
                              <span className="text-[8px] font-black text-gray-600 uppercase tracking-tighter mb-1">Channels</span>
                              <div className="flex gap-1">
                                 {sch.alertConfig.channels.map(c => (
                                    <div key={c} className="w-4 h-4 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex items-center justify-center" title={c}>
                                       {c === 'slack' && <MessageSquare className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400 transition-colors" />}
                                       {c === 'email' && <Mail className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400 transition-colors" />}
                                       {c === 'jira' && <Target className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400 transition-colors" />}
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="pt-6 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2 transition-colors">
                        <button
                           onClick={() => setShowIncidentModal(sch)}
                           className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${hasIncident ? 'bg-red-600/10 hover:bg-red-600 text-red-600 dark:text-red-500 hover:text-white border border-red-500/20' : 'bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-800'}`}
                        >
                           <History className="w-3.5 h-3.5" /> {hasIncident ? 'View Incidents' : 'No Alerts'}
                        </button>
                        <div className="flex gap-1 transition-opacity">
                           <button onClick={() => handleEdit(sch)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white transition-colors"><Edit3 className="w-4 h-4" /></button>
                           <button onClick={() => handleDelete(sch.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                     </div>
                  </div>
               );
            })}

            <div
               onClick={() => { setEditingId(null); setScriptSearch(''); setShowSelectedOnly(false); setShowModal(true); }}
               className="border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-[2rem] p-8 flex flex-col items-center justify-center group hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-all cursor-pointer min-h-[340px]"
            >
               <div className="w-16 h-16 rounded-[2rem] bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-all group-hover:border-indigo-500/30 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                  <Plus className="w-8 h-8 text-gray-700 group-hover:text-indigo-400" />
               </div>
               <p className="text-xs font-black text-gray-500 dark:text-gray-600 uppercase tracking-widest group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Initialize Batch Policy</p>
            </div>
         </div>

         {/* MODAL: INCIDENT HISTORY */}
         {showIncidentModal && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-8 animate-in fade-in duration-300">
               <div className="absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-md transition-colors" onClick={() => setShowIncidentModal(null)} />
               <div className="relative w-full max-w-3xl bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[85vh] animate-in zoom-in-95 transition-colors">
                  <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 flex items-center justify-between transition-colors">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-600/10 border border-red-500/20 rounded-2xl text-red-500">
                           <Bell className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                           <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase tracking-widest transition-colors">Incident History Trace</h3>
                           <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Job: {showIncidentModal.name}</p>
                        </div>
                     </div>
                     <button onClick={() => setShowIncidentModal(null)} className="p-3 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-2xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors border border-gray-200 dark:border-gray-800">
                        <X className="w-6 h-6" />
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                     {showIncidentModal.incidentHistory?.map((inc) => (
                        <div key={inc.id} className="relative pl-8 border-l border-gray-200 dark:border-gray-800 transition-colors">
                           <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                           <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase tracking-widest mono transition-colors">{inc.timestamp}</span>
                              <div className="flex items-center gap-2">
                                 <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest transition-colors">Dispatched to {inc.channel}</span>
                              </div>
                           </div>

                           <div className="bg-gray-50 dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-inner relative overflow-hidden group transition-colors">
                              <div className="absolute top-0 left-0 w-1 h-full bg-red-500 opacity-50" />
                              <div className="flex items-center gap-3 mb-4">
                                 <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-white fill-white" />
                                 </div>
                                 <div>
                                    <div className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tighter transition-colors">Oracle Intelligence bot <span className="text-gray-400 dark:text-gray-600 ml-1 font-bold">12:12 PM</span></div>
                                    <div className="text-xs font-bold text-red-500 dark:text-red-400 transition-colors">{inc.summary}</div>
                                 </div>
                              </div>
                              <p className="text-[12px] text-gray-600 dark:text-gray-400 font-medium leading-relaxed italic mb-4 transition-colors">"{inc.details}"</p>
                              <div className="flex gap-2">
                                 <button className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-white text-[9px] font-black rounded-lg border border-gray-200 dark:border-gray-700 transition-all uppercase flex items-center gap-1.5 shadow-sm">
                                    <ExternalLink className="w-3 h-3" /> View Trace
                                 </button>
                                 <button className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-600/10 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 hover:text-white text-[9px] font-black rounded-lg border border-indigo-200 dark:border-indigo-500/20 transition-all uppercase">
                                    Acknowledge
                                 </button>
                              </div>
                           </div>
                        </div>
                     ))}

                     {(!showIncidentModal.incidentHistory || showIncidentModal.incidentHistory.length === 0) && (
                        <div className="py-20 text-center flex flex-col items-center">
                           <CheckCircle2 className="w-12 h-12 text-gray-300 dark:text-gray-800 mb-4 transition-colors" />
                           <p className="text-sm font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest transition-colors">No Incidents Recorded</p>
                           <p className="text-xs text-gray-400 dark:text-gray-700 mt-1 uppercase tracking-widest transition-colors">System nodes are operating within threshold parameters.</p>
                        </div>
                     )}
                  </div>

                  <div className="p-8 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 flex justify-end transition-colors">
                     <button onClick={() => setShowIncidentModal(null)} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest shadow-xl shadow-indigo-600/30">
                        Close Monitor
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* MODAL: DELETE CONFIRMATION */}
         {deleteConfirmId && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-8 animate-in fade-in duration-200">
               <div className="absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-md transition-colors" onClick={() => setDeleteConfirmId(null)} />
               <div className="relative w-full max-w-md bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2rem] shadow-2xl p-8 flex flex-col items-center text-center animate-in zoom-in-95 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-red-600/10 flex items-center justify-center mb-6">
                     <Trash2 className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 transition-colors">Delete Schedule?</h3>
                  <p className="text-gray-500 text-sm mb-8">
                     This action cannot be undone. The schedule and its configuration will be permanently removed.
                  </p>
                  <div className="flex gap-3 w-full">
                     <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-black rounded-xl transition-all uppercase"
                     >
                        Cancel
                     </button>
                     <button
                        onClick={confirmDelete}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-xl transition-all uppercase shadow-lg shadow-red-600/20"
                     >
                        Delete
                     </button>
                  </div>
               </div>
            </div>
         )}
         {/* MODAL: Create/Edit Schedule */}
         {showModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-200">
               <div className="absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-md transition-colors" onClick={() => setShowModal(false)} />
               <div className="relative w-full max-w-5xl bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[95vh] transition-colors">
                  <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/20 flex items-center justify-between transition-colors">
                     <div className="flex items-center gap-4">
                        <div className="p-4 bg-indigo-600 rounded-3xl text-white">
                           <CalendarClock className="w-8 h-8" />
                        </div>
                        <div>
                           <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight transition-colors">{editingId ? 'Modify Orchestration Job' : 'Initialize Autonomous Job'}</h3>
                           <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Configure frequency, test assets, and incident policies.</p>
                        </div>
                     </div>
                     <button onClick={() => { setShowModal(false); setScriptSearch(''); setShowSelectedOnly(false); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-10 flex flex-col gap-10 custom-scrollbar">
                     <div className="grid grid-cols-2 gap-10">
                        <div className="space-y-8">
                           <div className="space-y-3">
                              <label className="text-[10px] font-black text-gray-500 font-bold uppercase tracking-widest block transition-colors">Job Name</label>
                              <input
                                 type="text"
                                 value={form.name}
                                 onChange={e => setForm({ ...form, name: e.target.value })}
                                 className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-2xl px-5 py-4 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                                 placeholder="e.g., Nightly Payment Regression"
                              />
                           </div>

                           {/* New Strategy Selector Section */}
                           <div className="space-y-4">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block flex items-center gap-2">
                                 <Activity className="w-3.5 h-3.5 text-indigo-400" /> Trigger Strategy
                              </label>
                              <div className="flex bg-gray-50 dark:bg-[#0c0e12] p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 gap-1 transition-colors">
                                 <button
                                    onClick={() => setForm({ ...form, triggerStrategy: 'SCHEDULE' })}
                                    className={`flex-1 py-3 px-2 rounded-xl text-[9px] font-black uppercase transition-all flex flex-col items-center gap-1.5 ${form.triggerStrategy === 'SCHEDULE' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg border border-gray-200 dark:border-gray-700' : 'text-gray-500 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-400'}`}
                                 >
                                    <Clock className="w-4 h-4" /> Schedule Only
                                 </button>
                                 <button
                                    onClick={() => setForm({ ...form, triggerStrategy: 'DEPLOYMENT' })}
                                    className={`flex-1 py-3 px-2 rounded-xl text-[9px] font-black uppercase transition-all flex flex-col items-center gap-1.5 ${form.triggerStrategy === 'DEPLOYMENT' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-400'}`}
                                 >
                                    <GitBranch className="w-4 h-4" /> Post-Deployment
                                 </button>
                                 <button
                                    onClick={() => setForm({ ...form, triggerStrategy: 'BOTH' })}
                                    className={`flex-1 py-3 px-2 rounded-xl text-[9px] font-black uppercase transition-all flex flex-col items-center gap-1.5 ${form.triggerStrategy === 'BOTH' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-400'}`}
                                 >
                                    <Sparkles className="w-4 h-4" /> Hybrid Loop
                                 </button>
                              </div>

                              {form.triggerStrategy !== 'SCHEDULE' && (
                                 <div className="p-4 bg-purple-600/5 border border-purple-500/20 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
                                    <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-gray-500 italic leading-relaxed">
                                       "Pipeline Watcher와 연동되어 배포 Webhook 수신 시 이 배치 작업이 즉시 트리거됩니다. 별도의 배포 후 검증 파이프라인을 구축할 필요가 없습니다."
                                    </p>
                                 </div>
                              )}
                           </div>

                           {(form.triggerStrategy === 'SCHEDULE' || form.triggerStrategy === 'BOTH') && (
                              <div className="space-y-4 animate-in slide-in-from-top-2">
                                 <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Time Frequency (CRON)</label>
                                    <div className="px-2 py-0.5 bg-indigo-600/10 border border-indigo-500/20 rounded text-[9px] font-black text-indigo-400">Regular Interval</div>
                                 </div>
                                 <div className="grid grid-cols-2 gap-3">
                                    <div className="relative">
                                       <input
                                          type="text"
                                          value={form.cronExpression}
                                          onChange={e => setForm({ ...form, cronExpression: e.target.value })}
                                          className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-2xl px-5 py-4 text-xs font-bold text-gray-600 dark:text-gray-400 mono outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600"
                                          placeholder="* * * * *"
                                       />
                                       <div className="absolute right-2 top-2">
                                          <div className="relative">
                                             <button
                                                onClick={() => setShowCronPresets(!showCronPresets)}
                                                className={`p-2 rounded-lg transition-colors ${showCronPresets ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                                             >
                                                <Settings2 className="w-4 h-4" />
                                             </button>

                                             {showCronPresets && (
                                                <>
                                                   <div className="fixed inset-0 z-40" onClick={() => setShowCronPresets(false)} />
                                                   <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 transition-colors">
                                                      {[
                                                         { label: 'Every Minute', value: '* * * * *' },
                                                         { label: 'Every 10 Minutes', value: '*/10 * * * *' },
                                                         { label: 'Every 30 Minutes', value: '*/30 * * * *' },
                                                         { label: 'Every Hour', value: '0 * * * *' },
                                                         { label: 'Daily (Midnight)', value: '0 0 * * *' },
                                                         { label: 'Weekly (Mon)', value: '0 0 * * 1' },
                                                         { label: 'Monthly (1st)', value: '0 0 1 * *' }
                                                      ].map(preset => (
                                                         <button
                                                            key={preset.label}
                                                            onClick={() => {
                                                               setForm({
                                                                  ...form,
                                                                  cronExpression: preset.value,
                                                                  frequencyLabel: preset.label // Auto-fill label
                                                               });
                                                               setShowCronPresets(false);
                                                            }}
                                                            className="w-full text-left px-4 py-3 text-[10px] font-bold text-gray-500 hover:bg-indigo-50 dark:text-gray-400 dark:hover:bg-indigo-600/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors border-b border-gray-100 dark:border-gray-800/50 last:border-0"
                                                         >
                                                            {preset.label}
                                                         </button>
                                                      ))}
                                                   </div>
                                                </>
                                             )}
                                          </div>
                                       </div>
                                    </div>
                                    <input
                                       type="text"
                                       value={form.frequencyLabel}
                                       onChange={e => setForm({ ...form, frequencyLabel: e.target.value })}
                                       className="bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-2xl px-5 py-4 text-xs font-bold text-gray-600 dark:text-gray-400 outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600"
                                       placeholder="e.g., 매주 월요일"
                                    />
                                 </div>
                              </div>
                           )}

                           <div className="space-y-4">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block font-bold transition-colors">Priority Tier</label>
                              <div className="flex bg-gray-50 dark:bg-[#0c0e12] p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 transition-colors">
                                 {['Critical', 'High', 'Normal'].map(p => (
                                    <button
                                       key={p}
                                       onClick={() => setForm({ ...form, priority: p as any })}
                                       className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${form.priority === p ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-500 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-400'}`}
                                    >
                                       {p}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        </div>

                        <div className="space-y-8">
                           <div className="space-y-3">
                              <div className="flex items-center justify-between mb-2">
                                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Script Selection</label>
                                 <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">{form.scriptIds?.length} Selected</span>
                              </div>

                              {/* Search & Filter Controls */}
                              <div className="flex gap-2 mb-2">
                                 <input
                                    type="text"
                                    value={scriptSearch}
                                    onChange={(e) => setScriptSearch(e.target.value)}
                                    placeholder="Search scripts..."
                                    className="flex-1 bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-gray-300 focus:border-indigo-500 outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600"
                                 />
                                 <button
                                    onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${showSelectedOnly ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-600 dark:text-indigo-400' : 'bg-gray-50 dark:bg-[#0c0e12] border-gray-200 dark:border-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                 >
                                    {showSelectedOnly ? 'Selected Only' : 'Show All'}
                                 </button>
                              </div>

                              <div className="bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-2xl h-[280px] overflow-y-auto p-4 space-y-2 custom-scrollbar shadow-inner transition-colors">
                                 {scripts
                                    .filter(s => {
                                       const matchesSearch = s.name.toLowerCase().includes(scriptSearch.toLowerCase());
                                       const isSelected = form.scriptIds?.includes(s.id);
                                       if (showSelectedOnly) return isSelected && matchesSearch;
                                       return matchesSearch;
                                    })
                                    .map(s => (
                                       <div
                                          key={s.id}
                                          onClick={() => toggleScriptSelection(s.id)}
                                          className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${form.scriptIds?.includes(s.id) ? 'bg-indigo-600/10 border-indigo-500/40' : 'bg-white dark:bg-gray-900 border-transparent hover:border-gray-200 dark:hover:border-gray-700'}`}
                                       >
                                          <div className="flex flex-col">
                                             <span className={`text-xs font-bold ${form.scriptIds?.includes(s.id) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>{s.name}</span>
                                             <span className="text-[9px] text-gray-400 dark:text-gray-600">{s.tags?.join(', ')}</span>
                                          </div>
                                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${form.scriptIds?.includes(s.id) ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                                             {form.scriptIds?.includes(s.id) && <Check className="w-3 h-3 text-white" />}
                                          </div>
                                       </div>
                                    ))}

                                 {scripts.filter(s => {
                                    const matchesSearch = s.name.toLowerCase().includes(scriptSearch.toLowerCase());
                                    const isSelected = form.scriptIds?.includes(s.id);
                                    if (showSelectedOnly) return isSelected && matchesSearch;
                                    return matchesSearch;
                                 }).length === 0 && (
                                       <div className="text-center py-10 text-gray-400 dark:text-gray-600 text-xs text-uppercase tracking-widest font-bold">
                                          No matching scripts found
                                       </div>
                                    )}
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="p-8 bg-indigo-600/5 border border-indigo-500/10 rounded-[2.5rem] space-y-6">
                        <div className="flex items-center gap-3">
                           <Bell className="w-6 h-6 text-amber-500" />
                           <h4 className="text-xs font-black text-amber-500 uppercase tracking-[0.2em]">Incident Orchestration Policy</h4>
                        </div>
                        <div className="grid grid-cols-3 gap-8">
                           <div className="space-y-3">
                              <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Alert Channels</label>
                              <div className="flex gap-2">
                                 {[
                                    { id: 'slack', icon: MessageSquare },
                                    { id: 'email', icon: Mail },
                                    { id: 'jira', icon: Target }
                                 ].map(chan => (
                                    <button
                                       key={chan.id}
                                       onClick={() => toggleAlertChannel(chan.id)}
                                       className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${form.alertConfig?.channels.includes(chan.id as any) ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-700 hover:text-gray-700 dark:hover:text-gray-400'}`}
                                    >
                                       <chan.icon className="w-5 h-5" />
                                    </button>
                                 ))}
                              </div>
                           </div>

                           <div className="space-y-3">
                              <label className="text-[10px] font-black text-gray-500 font-bold uppercase tracking-widest transition-colors">Failure Threshold</label>
                              <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-950 px-5 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 transition-colors">
                                 <input
                                    type="range" min="1" max="10"
                                    value={form.alertConfig?.failureThreshold}
                                    onChange={e => setForm({ ...form, alertConfig: { ...form.alertConfig!, failureThreshold: parseInt(e.target.value) } })}
                                    className="flex-1 accent-indigo-500"
                                 />
                                 <span className="text-sm font-black text-gray-900 dark:text-white w-8 transition-colors">{form.alertConfig?.failureThreshold}</span>
                              </div>
                           </div>

                           <div className="space-y-3">
                              <label className="text-[10px] font-black text-gray-500 font-bold uppercase tracking-widest transition-colors">Policy Strictness</label>
                              <button
                                 onClick={() => setForm({ ...form, alertConfig: { ...form.alertConfig!, criticalOnly: !form.alertConfig?.criticalOnly } })}
                                 className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl border transition-all ${form.alertConfig?.criticalOnly ? 'bg-amber-600/10 border-amber-500/20 text-amber-500 font-bold' : 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800 text-gray-500 font-medium'}`}
                              >
                                 <span className="text-[10px] uppercase">Critical Failures Only</span>
                                 {form.alertConfig?.criticalOnly ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                              </button>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="p-8 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/20 flex justify-end gap-3 transition-colors">
                     <button
                        onClick={() => setShowModal(false)}
                        className="px-10 py-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest"
                     >
                        Cancel
                     </button>
                     <button
                        onClick={handleSave}
                        className="px-14 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest shadow-xl shadow-indigo-600/30 flex items-center gap-2"
                     >
                        <CheckCircle2 className="w-4 h-4" />
                        {editingId ? 'Save Orchestration' : 'Initialize Autonomous Loop'}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default SchedulerView;
