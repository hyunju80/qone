import React, { useState, useEffect } from 'react';
import { Users, Building2, Plus, Search, MoreVertical, CreditCard, Activity } from 'lucide-react';
import { CustomerAccount, SubscriptionPlan } from '../types';

interface CustomerDashboardProps {
    onSelectCustomer: (customer: CustomerAccount) => void;
}

const MOCK_CUSTOMERS: CustomerAccount[] = [
    {
        id: 'cust_skt',
        companyName: 'SKT',
        businessNumber: '123-45-00002',
        plan: 'Enterprise',
        billingEmail: 'billing@skt.ai',
        adminEmail: 'admin@skt.ai',
        usage: { aiTokens: { current: 15000, max: 1000000 }, testRuns: { current: 120, max: 50000 }, scriptStorage: { current: 10, max: 2000 }, deviceHours: { current: 5, max: 10000 } },
        createdAt: '2026-01-20'
    }
];

const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ onSelectCustomer }) => {
    const [customers, setCustomers] = useState<CustomerAccount[]>(MOCK_CUSTOMERS);
    const [searchTerm, setSearchTerm] = useState('');

    // In a real app, fetch customers from API
    // useEffect(() => { api.getCustomers().then(setCustomers) }, []);

    return (
        <div className="flex-1 bg-[#0f1115] p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-8">
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2">Customer Management</h1>
                        <p className="text-gray-400">Manage customer accounts and subscriptions</p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
                        <Plus className="w-4 h-4" />
                        <span>New Customer</span>
                    </button>
                </header>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-[#16191f] p-5 rounded-xl border border-gray-800">
                        <div className="flex items-center gap-3 mb-2">
                            <Building2 className="w-5 h-5 text-indigo-400" />
                            <span className="text-sm font-medium text-gray-400">Total Customers</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{customers.length}</p>
                    </div>
                    {/* Add more stats as needed */}
                </div>

                {/* List */}
                <div className="bg-[#16191f] rounded-xl border border-gray-800 overflow-hidden">
                    <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search customers..."
                                className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase font-medium">
                            <tr>
                                <th className="px-6 py-3">Company</th>
                                <th className="px-6 py-3">Plan</th>
                                <th className="px-6 py-3">Usage (Tokens)</th>
                                <th className="px-6 py-3">Admin</th>
                                <th className="px-6 py-3">Joined</th>
                                <th className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {customers.map(cust => (
                                <tr key={cust.id} className="hover:bg-indigo-500/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold">
                                                {cust.companyName.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-white">{cust.companyName}</div>
                                                <div className="text-xs text-gray-500">{cust.businessNumber}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${cust.plan === 'Enterprise' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                                            }`}>
                                            {cust.plan}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="w-24">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-gray-400">{Math.round(cust.usage.aiTokens.current / 1000)}k</span>
                                                <span className="text-gray-600">{Math.round(cust.usage.aiTokens.max / 1000)}k</span>
                                            </div>
                                            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500"
                                                    style={{ width: `${(cust.usage.aiTokens.current / cust.usage.aiTokens.max) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-300">{cust.adminEmail}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{cust.createdAt}</td>
                                    <td className="px-6 py-4">
                                        <button className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CustomerDashboard;
