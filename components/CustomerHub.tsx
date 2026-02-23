import React, { useState } from 'react';
import { ShieldCheck, Plus, LogOut, Building2, BarChart3, ChevronRight, Zap, Activity, Smartphone, Layout, ArrowRight, X } from 'lucide-react';
import { CustomerAccount, SubscriptionPlan, Project } from '../types';

interface CustomerHubProps {
    customers: CustomerAccount[];
    projects: Project[];
    currentUser: any; // User type
    onSelectCustomer: (customer: CustomerAccount) => void;
    onLogout: () => void;
    onCreateCustomer: (form: Partial<CustomerAccount>) => void;
}

const CustomerHub: React.FC<CustomerHubProps> = ({ customers, projects, currentUser, onSelectCustomer, onLogout, onCreateCustomer }) => {
    const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
    const [newCustomerForm, setNewCustomerForm] = useState<Partial<CustomerAccount>>({ companyName: '', businessNumber: '', plan: 'Pro', billingEmail: '', adminEmail: '' });
    const [viewingCustomerDetailId, setViewingCustomerDetailId] = useState<string | null>(null);

    const detailCustomer = customers.find(c => c.id === viewingCustomerDetailId);

    const handleCreateSubmit = () => {
        onCreateCustomer(newCustomerForm);
        setShowNewCustomerModal(false);
        setNewCustomerForm({ companyName: '', businessNumber: '', plan: 'Pro', billingEmail: '', adminEmail: '' });
    };

    return (
        <div className="h-screen w-full bg-[#0c0e12] flex flex-col items-center p-8 overflow-y-auto custom-scrollbar relative">
            <div className="w-full max-w-6xl animate-in zoom-in-95 duration-500 pb-20">
                <header className="flex justify-between items-end mb-12">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <ShieldCheck className="w-6 h-6 text-indigo-400" />
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Master SaaS Operator</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tighter italic">Customer Hub</h1>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setShowNewCustomerModal(true)}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-xs font-black uppercase px-6 py-2 rounded-xl shadow-lg shadow-indigo-600/20"
                        >
                            <Plus className="w-4 h-4" /> Add New Customer
                        </button>
                        <button onClick={onLogout} className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase"><LogOut className="w-4 h-4" /> Logout session</button>
                    </div>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {customers.map(cust => (
                        <div key={cust.id} className="group bg-[#16191f] border border-gray-800 hover:border-indigo-500/50 rounded-[2.5rem] p-8 text-left transition-all hover:shadow-2xl hover:shadow-indigo-600/10 flex flex-col h-[340px] relative overflow-hidden">
                            <div className={`absolute top-0 left-0 w-full h-1.5 ${cust.plan === 'Enterprise' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                            <div className="flex justify-between items-start mb-6">
                                <div onClick={() => onSelectCustomer(cust)} className="w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform cursor-pointer"><Building2 className="w-6 h-6" /></div>
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${cust.plan === 'Enterprise' ? 'bg-emerald-600/10 text-emerald-500' : 'bg-indigo-600/10 text-indigo-400'}`}>{cust.plan} Plan</span>
                            </div>
                            <div className="flex-1 cursor-pointer" onClick={() => onSelectCustomer(cust)}>
                                <h3 className="text-2xl font-black text-white mb-2 tracking-tight truncate">{cust.companyName}</h3>
                                <p className="text-xs text-gray-500 mb-4 font-bold uppercase tracking-widest">{cust.businessNumber}</p>
                            </div>
                            <div className="mt-6 pt-4 border-t border-gray-800/50 flex justify-between items-center">
                                <button
                                    onClick={() => setViewingCustomerDetailId(cust.id)}
                                    className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase flex items-center gap-1.5"
                                >
                                    <BarChart3 className="w-3.5 h-3.5" /> Intelligence
                                </button>
                                <button
                                    onClick={() => onSelectCustomer(cust)}
                                    className="flex items-center gap-1.5 text-[10px] font-black text-gray-600 hover:text-white uppercase transition-colors"
                                >
                                    Manage Workspaces <ChevronRight className="w-4 h-4 text-indigo-500" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* New Customer Modal */}
            {showNewCustomerModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md">
                    <div className="relative w-full max-w-lg bg-[#16191f] border border-gray-800 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-indigo-600 rounded-2xl text-white"><Building2 className="w-6 h-6" /></div>
                            <div><h3 className="text-xl font-black text-white uppercase tracking-tight">Onboard Customer</h3><p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Provision a new multi-tenant instance</p></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-10">
                            <div className="col-span-2 space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Company Name</label><input type="text" value={newCustomerForm.companyName} onChange={e => setNewCustomerForm({ ...newCustomerForm, companyName: e.target.value })} className="w-full bg-[#0c0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" placeholder="e.g., NexGen Solutions" /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Business Number</label><input type="text" value={newCustomerForm.businessNumber} onChange={e => setNewCustomerForm({ ...newCustomerForm, businessNumber: e.target.value })} className="w-full bg-[#0c0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white outline-none" placeholder="123-45-67890" /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Subscription Plan</label><select value={newCustomerForm.plan} onChange={e => setNewCustomerForm({ ...newCustomerForm, plan: e.target.value as SubscriptionPlan })} className="w-full bg-[#0c0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400 outline-none"><option value="Free">Free</option><option value="Pro">Pro</option><option value="Enterprise">Enterprise</option></select></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Admin Email</label><input type="email" value={newCustomerForm.adminEmail} onChange={e => setNewCustomerForm({ ...newCustomerForm, adminEmail: e.target.value })} className="w-full bg-[#0c0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white outline-none" placeholder="admin@company.com" /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Billing Email</label><input type="email" value={newCustomerForm.billingEmail} onChange={e => setNewCustomerForm({ ...newCustomerForm, billingEmail: e.target.value })} className="w-full bg-[#0c0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white outline-none" placeholder="finance@company.com" /></div>
                        </div>
                        <div className="flex justify-end gap-3"><button onClick={() => setShowNewCustomerModal(false)} className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Cancel</button><button onClick={handleCreateSubmit} disabled={!newCustomerForm.companyName} className="px-10 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-indigo-600/20">Provision Account</button></div>
                    </div>
                </div>
            )}

            {/* Customer Detail (Intelligence) Modal */}
            {detailCustomer && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md">
                    <div className="relative w-full max-w-4xl bg-[#16191f] border border-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
                        <div className="p-8 border-b border-gray-800 bg-gray-900/30 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-600 rounded-2xl text-white"><BarChart3 className="w-8 h-8" /></div>
                                <div>
                                    <h3 className="text-2xl font-black text-white tracking-tight uppercase tracking-widest italic">{detailCustomer.companyName}</h3>
                                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">Global Intelligence Monitor</p>
                                </div>
                            </div>
                            <button onClick={() => setViewingCustomerDetailId(null)} className="p-2 hover:bg-gray-800 rounded-xl text-gray-500 transition-colors"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="bg-[#0c0e12] border border-gray-800 rounded-3xl p-6">
                                    <div className="text-[9px] font-black text-gray-500 uppercase mb-4 flex items-center gap-2"><Zap className="w-3 h-3 text-indigo-400" /> AI Tokens</div>
                                    <div className="text-2xl font-black text-white">{detailCustomer.usage.aiTokens.current.toLocaleString()}</div>
                                    <div className="mt-2 w-full h-1 bg-gray-900 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${(detailCustomer.usage.aiTokens.current / detailCustomer.usage.aiTokens.max) * 100}%` }} /></div>
                                </div>
                                <div className="bg-[#0c0e12] border border-gray-800 rounded-3xl p-6">
                                    <div className="text-[9px] font-black text-gray-500 uppercase mb-4 flex items-center gap-2"><Activity className="w-3 h-3 text-green-400" /> Test Runs</div>
                                    <div className="text-2xl font-black text-white">{detailCustomer.usage.testRuns.current.toLocaleString()}</div>
                                    <div className="mt-2 w-full h-1 bg-gray-900 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${(detailCustomer.usage.testRuns.current / detailCustomer.usage.testRuns.max) * 100}%` }} /></div>
                                </div>
                                <div className="bg-[#0c0e12] border border-gray-800 rounded-3xl p-6">
                                    <div className="text-[9px] font-black text-gray-500 uppercase mb-4 flex items-center gap-2"><Smartphone className="w-3.5 h-3.5 text-blue-400" /> Device Hours</div>
                                    <div className="text-2xl font-black text-white">{detailCustomer.usage.deviceHours.current.toLocaleString()}h</div>
                                    <div className="mt-2 w-full h-1 bg-gray-900 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${(detailCustomer.usage.deviceHours.current / detailCustomer.usage.deviceHours.max) * 100}%` }} /></div>
                                </div>
                                <div className="bg-[#0c0e12] border border-gray-800 rounded-3xl p-6 flex flex-col justify-center items-center">
                                    <div className="text-[9px] font-black text-emerald-400 uppercase mb-2 tracking-widest">Active Plan</div>
                                    <div className="text-xl font-black text-white uppercase tracking-tighter italic">{detailCustomer.plan}</div>
                                </div>
                            </div>
                            <div className="bg-gray-950 border border-gray-800 rounded-[2.5rem] overflow-hidden">
                                <div className="p-6 border-b border-gray-800 bg-gray-900/40 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Workspace Allocations</span>
                                    <span className="text-[10px] font-black text-indigo-400 uppercase">{projects.filter(p => p.customerAccountId === detailCustomer.id).length} Nodes Detected</span>
                                </div>
                                <div className="p-6 grid grid-cols-2 gap-4">
                                    {projects.filter(p => p.customerAccountId === detailCustomer.id).map(p => (
                                        <div key={p.id} className="p-4 bg-[#16191f] border border-gray-800 rounded-2xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-indigo-600/10 rounded-xl text-indigo-400"><Layout className="w-4 h-4" /></div>
                                                <span className="text-sm font-bold text-gray-200">{p.name}</span>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-gray-700" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-8 border-t border-gray-800 bg-gray-950/40 flex justify-end gap-3">
                            <button onClick={() => { onSelectCustomer(detailCustomer); setViewingCustomerDetailId(null); }} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest shadow-xl flex items-center gap-2">Enter Customer Workspaces <ArrowRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerHub;
