import React, { useMemo } from 'react';
import {
  Terminal,
  Library,
  History,
  Users,
  Settings,
  Zap,
  Sparkles,
  LayoutGrid,
  Activity,
  CalendarClock,
  BarChart3,
  Smartphone,
  ShieldCheck,
  TrendingUp,
  ClipboardList,
  Bot, // Added
  PlaySquare // Added
} from 'lucide-react';
import { ViewMode, TestScript, ScriptStatus, UserRole, Project } from '../types';
import Logo from './Logo';

interface SidebarProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onSwitchProject?: () => void;
  scripts: TestScript[];
  userRole: UserRole | string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange, onSwitchProject, scripts, userRole }) => {
  const navItems = [
    { id: ViewMode.CONSOLE, label: 'Main Console', icon: Terminal },
    { id: ViewMode.DESIGN_CENTER, label: 'Design Center', icon: LayoutGrid },
    { id: ViewMode.STEP_RUNNER, label: 'Step Flow', icon: PlaySquare },
    { id: ViewMode.AI_EXPLORATION, label: 'AI QA Agent', icon: Bot },
    { id: ViewMode.AI_GENERATOR, label: 'AI Generator', icon: Sparkles },
    { id: ViewMode.LIBRARY, label: 'Asset Library', icon: Library },
    { id: ViewMode.SCHEDULES, label: 'Test Scheduler', icon: CalendarClock },
    { id: ViewMode.PIPELINE, label: 'Pipeline Watcher', icon: Activity },
    { id: ViewMode.HISTORY, label: 'Test History', icon: History },
    { id: ViewMode.REPORTS, label: 'Analytics & Reports', icon: BarChart3 },
    { id: ViewMode.DEVICE_FARM, label: 'Device Farm', icon: Smartphone },
  ];

  const goldenStats = useMemo(() => {
    const goldenScripts = scripts.filter(s => s.status === ScriptStatus.CERTIFIED);
    const totalGolden = goldenScripts.length;

    // 평균 성공률 계산 (상태바 연동용)
    const avgSuccess = totalGolden > 0
      ? Math.round(goldenScripts.reduce((acc, curr) => acc + curr.successRate, 0) / totalGolden)
      : 0;

    // 이번 주 생성된 것으로 간주되는 데이터 시뮬레이션
    const thisWeek = scripts.filter(s => s.status === ScriptStatus.CERTIFIED && s.runCount < 5).length;

    return { total: totalGolden, weekly: thisWeek, health: avgSuccess };
  }, [scripts]);

  // 관리자성 권한 체크 (Admin, Manager만 설정 접근 가능)
  // userRole usually comes from backend as 'Admin', 'Manager', 'QA Engineer'
  const canAccessSettings = userRole === 'Admin' || userRole === 'Manager';

  return (
    <div className="w-64 h-full bg-white dark:bg-[#16191f] border-r border-gray-200 dark:border-gray-800 flex flex-col transition-colors duration-300">
      <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
        <div className="flex items-center gap-3 mb-10">
          <Logo className="w-10 h-10 shadow-lg shadow-black/5 dark:shadow-black/50" />
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tight text-gray-900 dark:text-white">Q-ONE</span>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-500 font-bold uppercase tracking-widest">Autonomous QA</span>
          </div>
        </div>

        <nav className="space-y-1 mb-8">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${activeView === item.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                }`}
            >
              <item.icon className={`w-4 h-4 ${activeView === item.id ? 'text-white' : ''}`} />
              {item.label}
              {item.id === ViewMode.PIPELINE && (
                <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              )}
            </button>
          ))}
        </nav>

        {/* Stats Fleet Card */}
        <div className="mt-8 p-5 bg-gray-50 dark:bg-[#0c0e12] border border-indigo-100 dark:border-indigo-500/20 rounded-2xl relative overflow-hidden group transition-colors">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <ShieldCheck className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="relative z-10">
            <div className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Zap className="w-3 h-3 fill-indigo-600 dark:fill-indigo-400" /> Golden Asset Fleet
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col">
                <span className="text-3xl font-black text-yellow-500 dark:text-yellow-400 leading-none drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]">{goldenStats.total}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase mt-1">Total Assets</span>
              </div>
              <div className="flex flex-col items-end">
                <div className="px-2 py-0.5 bg-green-50 dark:bg-green-600/10 border border-green-200 dark:border-green-500/20 rounded text-[10px] font-black text-green-600 dark:text-green-500 flex items-center gap-1">
                  <TrendingUp className="w-2.5 h-2.5" /> + {goldenStats.weekly}
                </div>
                <span className="text-[8px] text-gray-600 font-bold uppercase mt-1">This Week</span>
              </div>
            </div>

            <div className="mt-5 space-y-1.5">
              <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                <span className="text-gray-500">Stability Score</span>
                <span className="text-emerald-500 dark:text-emerald-400">{goldenStats.health}%</span>
              </div>
              <div className="w-full h-1 bg-gray-200 dark:bg-gray-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)] transition-all duration-1000"
                  style={{ width: `${goldenStats.health}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto p-6 space-y-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#16191f] transition-colors">
        <button
          onClick={onSwitchProject}
          className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-widest hover:text-gray-900 dark:hover:text-white hover:border-indigo-500 transition-all"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          Switch Workspace
        </button>

        {canAccessSettings && (
          <button
            onClick={() => onViewChange(ViewMode.SETTINGS)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeView === ViewMode.SETTINGS
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
              }`}
          >
            <Settings className="w-4 h-4" />
            Admin Settings
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
