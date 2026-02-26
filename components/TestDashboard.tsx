import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
    Activity, CheckCircle2,
    XCircle, AlertTriangle, ChevronRight, ArrowUpRight,
    Search, Filter, X, ChevronDown
} from 'lucide-react';
import { TestHistory, Project } from '../types';

interface TestDashboardProps {
    history: TestHistory[];
    activeProject: Project;
    onViewDetail: (history: TestHistory) => void;
}

const TestDashboard: React.FC<TestDashboardProps> = ({ history, activeProject, onViewDetail }) => {
    const [selectedDayRuns, setSelectedDayRuns] = useState<{ date: string; scriptName: string; runs: TestHistory[] } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [originFilter, setOriginFilter] = useState<string>('all');
    const [showOriginDropdown, setShowOriginDropdown] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Identify the monthly window (last 30 calendar days)
    const allDates = useMemo(() => {
        const dates: string[] = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dates.push(`${year}-${month}-${day}`);
        }
        return dates;
    }, []);

    // Filter history for the last 30 days
    const monthlyHistory = useMemo(() => {
        const startDate = new Date(allDates[0]);
        return history.filter(h => new Date(h.runDate) >= startDate);
    }, [history, allDates]);

    // Extract unique origins for filter - Fix: use scriptOrigin
    const availableOrigins = useMemo(() => {
        const origins = new Set<string>();
        monthlyHistory.forEach(h => {
            if (h.scriptOrigin) origins.add(h.scriptOrigin);
        });
        return Array.from(origins).sort();
    }, [monthlyHistory]);

    // Process history data for the dashboard (30-day view)
    const dashboardData = useMemo(() => {
        const scriptMap: Record<string, TestHistory[]> = {};

        // Filter based on search and origin before grouping - Fix: use scriptOrigin
        const filteredHistory = monthlyHistory.filter(h => {
            const matchesSearch = h.scriptName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesOrigin = originFilter === 'all' || h.scriptOrigin === originFilter;
            return matchesSearch && matchesOrigin;
        });

        filteredHistory.forEach(h => {
            if (!scriptMap[h.scriptName]) {
                scriptMap[h.scriptName] = [];
            }
            scriptMap[h.scriptName].push(h);
        });

        return Object.entries(scriptMap).map(([name, runs]) => {
            const sortedAllRuns = [...runs].sort((a, b) => new Date(b.runDate).getTime() - new Date(a.runDate).getTime());

            const dateMap: Record<string, TestHistory[]> = {};
            sortedAllRuns.forEach(r => {
                const rd = new Date(r.runDate);
                const year = rd.getFullYear();
                const month = String(rd.getMonth() + 1).padStart(2, '0');
                const day = String(rd.getDate()).padStart(2, '0');
                const dateKey = `${year}-${month}-${day}`;
                if (!dateMap[dateKey]) dateMap[dateKey] = [];
                dateMap[dateKey].push(r);
            });

            const dailyResults = allDates.map(date => {
                const dayRuns = dateMap[date] || [];
                if (dayRuns.length === 0) {
                    return { date, status: 'none', runs: [], count: 0, failRate: 0 };
                }
                const failedRuns = dayRuns.filter(r => r.status === 'failed').length;
                const totalRuns = dayRuns.length;
                const failRate = (failedRuns / totalRuns) * 100;

                let status = 'passed';
                if (failedRuns === totalRuns) status = 'failed';
                else if (failedRuns > 0) status = 'partial';

                return { date, status, runs: dayRuns, count: totalRuns, failRate };
            });

            const total = runs.length;
            const passedCount = runs.filter(r => r.status === 'passed').length;
            const successRate = total > 0 ? Math.round((passedCount / total) * 100) : 0;

            return {
                name,
                scriptOrigin: sortedAllRuns[0].scriptOrigin, // Fix: Use scriptOrigin
                scriptId: sortedAllRuns[0].scriptId,
                total,
                successRate,
                dailyResults,
                latestStatus: sortedAllRuns[0].status
            };
        }).sort((a, b) => b.total - a.total);
    }, [monthlyHistory, allDates, searchTerm, originFilter]);

    // Identify high-risk unstable assets (partial failures present, sorted by lowest success rate)
    const highRiskAssets = useMemo(() => {
        return [...dashboardData]
            .filter(script => script.successRate > 0 && script.successRate < 100 && script.total > 0)
            .sort((a, b) => a.successRate - b.successRate)
            .slice(0, 5);
    }, [dashboardData]);

    // Auto-scroll to Today (right) on mount or filter change
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
        }
    }, [dashboardData]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowOriginDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getStatusColors = (status: string, failRate: number = 0) => {
        switch (status) {
            case 'passed': return 'bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500 hover:text-white';
            case 'failed': return 'bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500 hover:text-white';
            case 'partial': {
                if (failRate <= 30) return 'bg-amber-500/5 text-amber-500 border-amber-500/10 hover:bg-amber-400 hover:text-white';
                if (failRate <= 70) return 'bg-amber-500/20 text-amber-600 border-amber-500/30 hover:bg-amber-500 hover:text-white';
                return 'bg-amber-600/40 text-amber-700 border-amber-600/50 hover:bg-amber-700 hover:text-white';
            }
            case 'none': return 'bg-gray-50 dark:bg-gray-800/40 text-gray-300 dark:text-gray-700 border-transparent cursor-default opacity-40';
            default: return 'bg-gray-100 dark:bg-gray-800 text-gray-400';
        }
    };

    const getOriginStyles = (origin: any = '') => {
        const originStr = typeof origin === 'string' ? origin.toUpperCase() : String(origin).toUpperCase();
        switch (originStr) {
            case 'AI': return 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20';
            case 'MANUAL': return 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20';
            case 'AI_EXPLORATION': return 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-500/20';
            default: return 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-100 dark:border-gray-800';
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Custom Styles for Scrollbar */}
            <style>{`
                .thin-scrollbar::-webkit-scrollbar {
                    height: 5px;
                }
                .thin-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .thin-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 20px;
                }
                .dark .thin-scrollbar::-webkit-scrollbar-thumb {
                    background: #334155;
                }
                .thin-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>

            {/* Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-[#16191f] p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <Activity className="w-24 h-24" />
                    </div>
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-4">Active Assets (Month)</span>
                    <div className="text-3xl font-black text-gray-900 dark:text-white">{dashboardData.length}</div>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">Scripts matching filters</p>
                </div>
                <div className="bg-white dark:bg-[#16191f] p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-20 group-hover:scale-110 transition-transform duration-500">
                        <CheckCircle2 className="w-24 h-24 text-green-500/20" />
                    </div>
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-4">Avg. Success Rate (Month)</span>
                    <div className="text-3xl font-black text-gray-900 dark:text-white">
                        {dashboardData.length > 0 ? Math.round(dashboardData.reduce((acc, curr) => acc + curr.successRate, 0) / dashboardData.length) : 0}%
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">Filtered performance</p>
                </div>
                <div className="bg-white dark:bg-[#16191f] p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <ArrowUpRight className="w-24 h-24" />
                    </div>
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-4">Total Executions (Month)</span>
                    <div className="text-3xl font-black text-gray-900 dark:text-white">{monthlyHistory.length}</div>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">Total recorded in 30 days</p>
                </div>
            </div>

            {/* Visual Status Grid - 3 Column Layout */}
            <div className="bg-white dark:bg-[#16191f] border border-gray-100 dark:border-gray-800 rounded-[2.5rem] overflow-hidden shadow-xl dark:shadow-none">
                {/* Header with Search and Filter */}
                <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20 relative z-50">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white">
                                Script Stability Board
                            </h3>
                            {allDates.length > 0 && (
                                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-[10px] font-bold rounded-full uppercase tracking-tighter whitespace-nowrap">
                                    {new Date(allDates[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(allDates[29]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            {/* Search Input */}
                            <div className="relative group/search">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within/search:text-indigo-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search scripts..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-8 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-[11px] font-black uppercase tracking-tight text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-[240px] placeholder:text-gray-400 placeholder:font-bold"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Custom Origin Filter Dropdown */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setShowOriginDropdown(!showOriginDropdown)}
                                    className={`flex items-center gap-2.5 px-5 py-2.5 bg-white dark:bg-gray-900 border transition-all rounded-xl text-[10px] font-black uppercase tracking-widest ${showOriginDropdown || originFilter !== 'all'
                                        ? 'border-indigo-500 text-indigo-600 dark:text-white shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                        : 'border-gray-100 dark:border-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                >
                                    <Filter className={`w-3.5 h-3.5 ${originFilter !== 'all' ? 'text-indigo-500' : ''}`} />
                                    <span>{originFilter === 'all' ? 'All Origins' : originFilter}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showOriginDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showOriginDropdown && (
                                    <div className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-[#16191f] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl z-[60] p-2 overflow-hidden animate-in fade-in slide-in-from-top-2 transition-all">
                                        <button
                                            onClick={() => { setOriginFilter('all'); setShowOriginDropdown(false); }}
                                            className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${originFilter === 'all'
                                                ? 'bg-indigo-600 text-white'
                                                : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'
                                                }`}
                                        >
                                            All Origins
                                        </button>
                                        {availableOrigins.map(origin => (
                                            <button
                                                key={origin}
                                                onClick={() => { setOriginFilter(origin); setShowOriginDropdown(false); }}
                                                className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${originFilter === origin
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'
                                                    }`}
                                            >
                                                {origin}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Legend */}
                            <div className="flex items-center gap-4 ml-4">
                                <div className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400">
                                    <div className="w-3 h-3 rounded-full bg-green-500" /> Success
                                </div>
                                <div className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400">
                                    <div className="w-3 h-3 rounded-full bg-amber-500" /> Partial
                                </div>
                                <div className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400">
                                    <div className="w-3 h-3 rounded-full bg-red-500" /> Failed
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {dashboardData.length > 0 ? (
                    <div className="flex w-full overflow-hidden">
                        {/* 1. Fixed Left Column: Script Names */}
                        <div className="w-[300px] shrink-0 border-r border-gray-50 dark:border-gray-800/50 bg-white dark:bg-[#16191f] z-20 pt-8 px-8 flex flex-col">
                            {/* Standardized Header Placeholder */}
                            <div className="h-[26px] mb-6 shrink-0" />

                            <div className="space-y-4">
                                {dashboardData.map((script) => (
                                    <div key={script.name} className="h-10 flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-1 min-w-0">
                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${script.latestStatus === 'passed' ? 'bg-green-500' : 'bg-red-500'}`} />
                                            <div className="text-xs font-black text-gray-900 dark:text-white truncate uppercase tracking-tight flex-1" title={script.name}>{script.name}</div>
                                            {script.scriptOrigin && (
                                                <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase border shrink-0 ${getOriginStyles(script.scriptOrigin)}`}>
                                                    {script.scriptOrigin}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${script.successRate > 90 ? 'bg-green-500' : script.successRate > 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                    style={{ width: `${script.successRate}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-black text-gray-400 w-8 shrink-0">{script.successRate}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="h-8 shrink-0" /> {/* Bottom spacing for scrollbar parity */}
                        </div>

                        {/* 2. Scrollable Middle Column: Heatmap */}
                        <div
                            ref={scrollContainerRef}
                            className="flex-1 overflow-x-auto thin-scrollbar pt-8"
                        >
                            <div className="min-w-fit px-4">
                                {/* Date Headers - Flex items-end to standardize bottom alignment */}
                                <div className="flex items-end gap-1.5 mb-6 h-[26px]">
                                    {allDates.map((date, idx) => (
                                        <div key={date} className="w-7 text-center shrink-0">
                                            <span className={`text-[9px] font-black uppercase tracking-tighter ${idx === 29 ? 'text-indigo-600 dark:text-indigo-400 font-bold underline decoration-2 underline-offset-4' : 'text-gray-400'}`}>
                                                {idx === 29 ? 'Today' : (idx === 0 || date.split('-')[2] === '01') ? `${new Date(date).toLocaleString('en-US', { month: 'short' })} ${date.split('-')[2]}` : date.split('-')[2]}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Heatmap Rows */}
                                <div className="space-y-4">
                                    {dashboardData.map((script) => (
                                        <div key={script.name} className="h-10 flex items-center gap-1.5">
                                            {script.dailyResults.map((day) => (
                                                <button
                                                    key={day.date}
                                                    onClick={() => {
                                                        if (day.status !== 'none') {
                                                            if (day.count > 1) {
                                                                setSelectedDayRuns({ date: day.date, scriptName: script.name, runs: day.runs });
                                                            } else {
                                                                onViewDetail(day.runs[0]);
                                                            }
                                                        }
                                                    }}
                                                    disabled={day.status === 'none'}
                                                    className={`w-7 h-7 rounded-sm transition-all flex items-center justify-center relative group/run shrink-0 ${getStatusColors(day.status, day.failRate)} ${day.status !== 'none' ? 'hover:scale-110 hover:ring-2 hover:ring-indigo-500/20 active:scale-95 z-10' : 'border border-gray-100 dark:border-gray-800 opacity-20 shadow-inner'
                                                        }`}
                                                >
                                                    {day.status === 'passed' ? <CheckCircle2 className="w-3 h-3" /> :
                                                        day.status === 'failed' ? <XCircle className="w-3 h-3" /> :
                                                            day.status === 'partial' ? <AlertTriangle className="w-3 h-3" /> :
                                                                <div className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600 opacity-30" />}

                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-[#0c0e12] text-white text-[9px] font-bold rounded-lg opacity-0 group-hover/run:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-gray-800">
                                                        <div className="flex items-center justify-between gap-4 mb-1">
                                                            <span>{day.date}</span>
                                                            {day.status !== 'none' && (
                                                                <span className="opacity-50 tracking-tighter">{day.count} {day.count === 1 ? 'run' : 'runs'}</span>
                                                            )}
                                                        </div>
                                                        {day.status === 'none' && <div className="text-gray-500 text-[8px] italic">No activity</div>}
                                                        {day.status === 'partial' && (
                                                            <div className="text-amber-400 text-[8px] uppercase tracking-widest mb-1">{Math.round(day.failRate)}% Fail Rate</div>
                                                        )}
                                                        {day.status !== 'passed' && day.status !== 'none' && day.runs.find(r => r.status === 'failed')?.failureReason && (
                                                            <div className="mt-1 text-red-400 text-[8px] italic max-w-[150px] truncate">{day.runs.find(r => r.status === 'failed')?.failureReason}</div>
                                                        )}
                                                        {day.count > 1 && (
                                                            <div className="mt-1 text-indigo-400 text-[7px] uppercase tracking-tighter border-t border-gray-800 pt-1">Click to view all {day.count} runs</div>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                                <div className="h-8 shrink-0" /> {/* Bottom spacing for scrollbar parity */}
                            </div>
                        </div>

                        {/* 3. Fixed Right Column: Navigation Arrows */}
                        <div className="w-[80px] shrink-0 border-l border-gray-50 dark:border-gray-800/50 bg-white dark:bg-[#16191f] z-20 pt-8 px-6 flex flex-col items-center">
                            {/* Standardized Header Placeholder */}
                            <div className="h-[26px] mb-6 shrink-0" />

                            <div className="space-y-4">
                                {dashboardData.map((script) => (
                                    <div key={script.name} className="h-10 flex items-center justify-center">
                                        <div className="group/nav relative">
                                            <button
                                                onClick={() => {
                                                    const lastDayWithRuns = [...script.dailyResults].reverse().find(d => d.status !== 'none');
                                                    onViewDetail(lastDayWithRuns?.runs[0] || script.dailyResults[0].runs[0]);
                                                }}
                                                disabled={script.total === 0}
                                                className={`w-8 h-8 rounded-xl border transition-all flex items-center justify-center ${script.total === 0
                                                    ? 'bg-gray-50 dark:bg-gray-800/50 text-gray-200 dark:text-gray-700 cursor-not-allowed opacity-50'
                                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-indigo-600 hover:text-white hover:scale-110 active:scale-95'
                                                    }`}
                                            >
                                                <ArrowUpRight className="w-3.5 h-3.5" />
                                            </button>
                                            {script.total > 0 && (
                                                <div className="absolute right-0 bottom-full mb-2 px-3 py-1.5 bg-gray-900 text-white text-[8px] font-black rounded-lg opacity-0 group-hover/nav:opacity-100 transition-opacity whitespace-nowrap z-40 border border-gray-800 uppercase tracking-widest shadow-xl">
                                                    View Latest Report
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="h-8 shrink-0" /> {/* Bottom spacing for scrollbar parity */}
                        </div>
                    </div>
                ) : (
                    <div className="py-32 text-center bg-gray-50/30 dark:bg-gray-900/10">
                        <Activity className="w-12 h-12 text-gray-200 dark:text-gray-800 mx-auto mb-4" />
                        <p className="text-gray-400 dark:text-gray-600 text-xs font-black uppercase tracking-widest">No matching tests found</p>
                        {(searchTerm || originFilter !== 'all') && (
                            <button
                                onClick={() => { setSearchTerm(''); setOriginFilter('all'); }}
                                className="mt-4 text-[10px] font-black text-indigo-500 uppercase tracking-tighter hover:underline"
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Insights Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Critical Failure Hotspots (30 Day Focus) */}
                <div className="bg-white dark:bg-[#16191f] p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none select-none">
                        <AlertTriangle className="w-32 h-32" />
                    </div>
                    <h3 className="text-md font-black text-gray-900 dark:text-white mb-6 uppercase tracking-widest flex items-center gap-2">
                        Critical Failure Hotspots (30 Days)
                    </h3>
                    <div className="space-y-4">
                        {dashboardData.filter(s => s.successRate < 70).slice(0, 3).map(script => (
                            <div key={script.name} className="flex items-center justify-between p-4 bg-red-50/50 dark:bg-red-500/5 rounded-2xl border border-red-100 dark:border-red-500/10">
                                <div className="min-w-0">
                                    <div className="text-xs font-black text-gray-900 dark:text-white truncate mb-1">{script.name}</div>
                                    <div className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-widest">{100 - script.successRate}% Failure Probability</div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const allRuns = script.dailyResults.flatMap(d => d.runs);
                                        const failedRuns = allRuns.filter(r => r.status === 'failed');
                                        const latestFailed = failedRuns.sort((a, b) => new Date(b.runDate).getTime() - new Date(a.runDate).getTime())[0];

                                        if (latestFailed) {
                                            onViewDetail(latestFailed);
                                        } else if (allRuns.length > 0) {
                                            const latestOverall = allRuns.sort((a, b) => new Date(b.runDate).getTime() - new Date(a.runDate).getTime())[0];
                                            onViewDetail(latestOverall);
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-red-600 text-white text-[9px] font-black rounded-lg uppercase shadow-lg shadow-red-600/20 hover:bg-red-500 transition-colors relative z-10"
                                >
                                    Analyze
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* High-Risk Unstable Assets (Lowest Stability) */}
                <div className="bg-white dark:bg-[#16191f] p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <h3 className="text-md font-black text-gray-900 dark:text-white mb-6 uppercase tracking-widest flex items-center gap-2">
                        High-Risk Unstable Assets
                    </h3>
                    <div className="space-y-4">
                        {highRiskAssets.length > 0 ? (
                            highRiskAssets.map(script => (
                                <div
                                    key={script.name}
                                    className="flex items-center gap-4 group cursor-pointer"
                                    onClick={() => {
                                        const allRuns = script.dailyResults.flatMap(d => d.runs);
                                        setSelectedDayRuns({
                                            date: 'Analysis (Last 30 Days)',
                                            scriptName: script.name,
                                            runs: allRuns
                                        });
                                    }}
                                >
                                    <div className={`p-2 rounded-xl border shrink-0 ${script.successRate < 50 ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                        <AlertTriangle className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 border-b border-gray-50 dark:border-gray-800/50 pb-3 flex-1">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <div className="text-xs font-black text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate uppercase tracking-tight">{script.name}</div>
                                            <div className="text-[10px] font-black text-red-500 uppercase tracking-tighter">{100 - script.successRate}% Failure Rate</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-red-500 transition-all duration-1000"
                                                    style={{ width: `${100 - script.successRate}%` }}
                                                />
                                            </div>
                                            <div className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">{script.total} runs</div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 text-center">
                                <Activity className="w-8 h-8 text-gray-100 dark:text-gray-800 mx-auto mb-3" />
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No unstable assets detected</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Daily Runs Modal */}
            {selectedDayRuns && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-8 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDayRuns(null)} />
                    <div className="relative w-full max-w-lg bg-white dark:bg-[#0f1115] border border-gray-200 dark:border-gray-800 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden max-h-[70vh]">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">{selectedDayRuns.date}</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{selectedDayRuns.scriptName}</p>
                            </div>
                            <button onClick={() => setSelectedDayRuns(null)} className="p-2 text-gray-400 hover:text-gray-600">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <div className="space-y-3">
                                {[...selectedDayRuns.runs].sort((a, b) => {
                                    if (a.status === 'failed' && b.status !== 'failed') return -1;
                                    if (a.status !== 'failed' && b.status === 'failed') return 1;
                                    return new Date(b.runDate).getTime() - new Date(a.runDate).getTime();
                                }).map((run) => (
                                    <div
                                        key={run.id}
                                        onClick={() => {
                                            onViewDetail(run);
                                            setSelectedDayRuns(null);
                                        }}
                                        className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 hover:border-indigo-500/30 hover:bg-white dark:hover:bg-gray-800/80 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-1.5 rounded-lg ${run.status === 'passed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                    {run.status === 'passed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                </div>
                                                <div className="text-[11px] font-black text-gray-900 dark:text-white">
                                                    {new Date(run.runDate).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })} {new Date(run.runDate).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </div>
                                            </div>
                                            <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                                        </div>
                                        {run.failureReason && (
                                            <div className="text-[10px] text-red-500 font-medium bg-red-500/5 border border-red-500/10 rounded-lg p-2 mt-2 italic">
                                                {run.failureReason}
                                            </div>
                                        )}
                                        <div className="mt-2 flex items-center gap-3 text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                                            <span>Duration: {run.duration}</span>
                                            {run.trigger && <span>Trigger: {run.trigger}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TestDashboard;
