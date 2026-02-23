import React, { useState, useEffect } from 'react';
import {
  Monitor, Smartphone, Maximize2, RefreshCcw, Power, Layout,
  Database, MousePointer2, Search, Loader2, CheckCircle,
  AlertCircle, Battery, Wifi, Signal, ChevronLeft, Home, Menu,
  Cpu, Zap, ShieldCheck, Activity
} from 'lucide-react';
import { TargetDevice } from '../types';

interface LiveViewProps {
  status?: 'idle' | 'running' | 'success' | 'error';
  currentStepIndex?: number;
  availableDevices?: TargetDevice[];
  screenSrc?: string | null;
}

const LiveView: React.FC<LiveViewProps> = ({
  status = 'idle',
  currentStepIndex = 0,
  availableDevices = ['PC-Web', 'Mobile-Web'] as TargetDevice[],
  screenSrc = null
}) => {
  const [isPowerOn, setIsPowerOn] = useState(true);
  const [activeDevice, setActiveDevice] = useState<TargetDevice>(availableDevices[0] || 'PC-Web');

  const steps = [
    { name: 'navigating_to_endpoint', detail: 'URL resolution & handshake...' },
    { name: 'interaction_input_auth', detail: 'Injecting synthetic credentials...' },
    { name: 'validation_state_check', detail: 'Verifying DOM state & headers...' },
    { name: 'confirmation_sequence', detail: 'Finalizing transaction logic...' }
  ];

  const getStatusColor = (device: TargetDevice) => {
    if (status === 'running' && activeDevice === device) return 'text-yellow-500';
    if (status === 'success' && activeDevice === device) return 'text-green-500';
    return 'text-green-500/40';
  };

  const renderStandbyScreen = () => (
    <div className="flex-1 bg-gray-50 dark:bg-[#0c0e12] flex flex-col items-center justify-center p-8 relative overflow-hidden animate-in fade-in duration-700 transition-colors">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-indigo-600/5 dark:bg-indigo-600/5 border border-indigo-500/20 rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(99,102,241,0.1)]">
          <Cpu className="w-10 h-10 text-indigo-500/40 animate-pulse" />
        </div>
        <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-500 uppercase tracking-[0.4em] mb-2 transition-colors">Oracle Node Standby</h4>
        <p className="text-[14px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-tighter mb-8 transition-colors">Waiting for Execution Request...</p>

        <div className="flex gap-4 items-center opacity-30">
          <div className="flex flex-col items-center">
            <div className="w-1 h-8 bg-indigo-500/20 rounded-full mb-1" />
            <span className="text-[8px] font-black text-gray-500 dark:text-gray-700 uppercase transition-colors">CPU</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-1 h-12 bg-indigo-500/40 rounded-full mb-1" />
            <span className="text-[8px] font-black text-gray-500 dark:text-gray-700 uppercase transition-colors">MEM</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-1 h-6 bg-indigo-500/20 rounded-full mb-1" />
            <span className="text-[8px] font-black text-gray-500 dark:text-gray-700 uppercase transition-colors">NET</span>
          </div>
        </div>
      </div>

      {/* Scanning Line Animation */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-indigo-500/5 to-transparent animate-[scan_4s_linear_infinite] pointer-events-none" />

      <style>{`
          @keyframes scan {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(200%); }
          }
       `}</style>
    </div>
  );

  const renderContent = () => {
    // Early return for idle state ensures that status is narrowed to 'running' | 'success' | 'error' below.
    if (status === 'idle') return renderStandbyScreen();

    // If real screen source is available, show it
    if (screenSrc) {
      return (
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
          <img src={screenSrc} className="w-full h-full object-contain" alt="Live Stream" />

          {/* Status Badge Overlay */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <div className="bg-red-600/90 backdrop-blur text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest inline-flex items-center gap-1 shadow-lg">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 bg-gray-100 dark:bg-[#1a1d23] p-4 relative overflow-hidden select-none flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500 transition-colors">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-600/30 border-t-indigo-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Wifi className="w-6 h-6 text-indigo-500 animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-1 transition-colors">Connecting to Node</h3>
            <p className="text-[10px] text-gray-500 font-mono">Initializing Video Stream for Run...</p>
          </div>
        </div>
      </div>
    );
  };

  const renderMobileFrame = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-[300px] aspect-[9/19] bg-[#0c0e12] border-[10px] border-[#2d3039] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">
        {/* Bezel details: Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#2d3039] rounded-b-[1.5rem] z-50 flex items-center justify-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-black/40" />
          <div className="w-10 h-1 bg-black/20 rounded-full" />
        </div>

        {/* Status Bar */}
        <div className="h-8 shrink-0 flex items-center justify-between px-8 pt-2">
          <span className="text-[9px] font-bold text-gray-400">09:41</span>
          <div className="flex items-center gap-1.5 text-gray-500">
            <Signal className="w-2.5 h-2.5" />
            <Wifi className="w-2.5 h-2.5" />
            <Battery className="w-3 h-3 rotate-180" />
          </div>
        </div>

        {/* Mobile Browser/App Header */}
        {activeDevice === 'Mobile-Web' && status !== 'idle' && !screenSrc && (
          <div className="h-10 bg-[#1a1d23] border-b border-gray-800 flex items-center px-4 gap-2">
            <div className="flex-1 bg-black/40 rounded-lg h-6 text-[8px] text-gray-500 flex items-center px-3 border border-white/5 truncate">
              <Search className="w-2.5 h-2.5 mr-2 opacity-30" />
              qone.ai/automation/hub
            </div>
            <Menu className="w-3 h-3 text-gray-600" />
          </div>
        )}

        {/* Content */}
        {renderContent()}

        {/* Home Indicator */}
        <div className="h-6 shrink-0 flex items-center justify-center pb-2">
          <div className="w-24 h-1 bg-gray-800 rounded-full" />
        </div>
      </div>
    </div>
  );

  const renderPCFrame = () => (
    <div className="flex-1 p-4 flex flex-col overflow-hidden">
      <div className="flex-1 bg-[#0c0e12] border border-gray-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in duration-500">
        {/* Browser header */}
        {status !== 'idle' && !screenSrc && (
          <div className="h-10 bg-gray-800 flex items-center px-4 gap-4 border-b border-gray-700 shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 bg-black/40 rounded-lg h-6 text-[10px] text-gray-400 flex items-center px-4 border border-white/5">
              <Search className="w-2.5 h-2.5 mr-3 opacity-50" />
              https://qone.ai/automation/workspace_01
            </div>
            <Maximize2 className="w-3 h-3 text-gray-600" />
          </div>
        )}
        {renderContent()}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0c0e12] overflow-hidden transition-colors duration-300">
      {/* Device Station: Station for switching multiple device views */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              Universal Device Station — <span className={status === 'idle' ? 'text-gray-400 dark:text-gray-600' : 'text-indigo-600 dark:text-indigo-400'}>{status.toUpperCase()}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsPowerOn(!isPowerOn)}
              className={`p-1.5 rounded transition-colors ${isPowerOn ? 'text-red-500 hover:bg-red-500/10' : 'text-green-500 hover:bg-green-500/10'}`}
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex bg-white dark:bg-[#16191f] p-1 rounded-2xl border border-gray-200 dark:border-gray-800 gap-1 overflow-x-auto custom-scrollbar no-scrollbar transition-colors">
          {availableDevices.map(device => (
            <button
              key={device}
              onClick={() => setActiveDevice(device)}
              className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl transition-all flex items-center justify-between group relative overflow-hidden ${activeDevice === device ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
            >
              <div className="flex items-center gap-2 relative z-10">
                {device.includes('PC') ? <Monitor className={`w-3.5 h-3.5 ${activeDevice === device ? 'text-white' : 'text-gray-500 dark:text-gray-500'}`} /> : <Smartphone className={`w-3.5 h-3.5 ${activeDevice === device ? 'text-white' : 'text-gray-500 dark:text-gray-500'}`} />}
                <span className={`text-[9px] font-black uppercase tracking-tighter ${activeDevice === device ? 'text-white' : 'text-gray-500 dark:text-gray-500'}`}>{device}</span>
              </div>
              <div className={`w-1.5 h-1.5 rounded-full relative z-10 bg-current ${getStatusColor(device)} ${status === 'running' && activeDevice === device ? 'animate-pulse' : ''}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative">
        {isPowerOn ? (
          <>
            {activeDevice === 'PC-Web' ? renderPCFrame() : renderMobileFrame()}

            {/* AI HUD: Global HUD for current interaction */}
            {status !== 'idle' && (
              <div className="absolute bottom-6 left-6 right-6 bg-gray-950/90 border border-white/10 rounded-2xl p-4 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 animate-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center text-[9px] text-gray-500 uppercase font-black mb-2 tracking-widest">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <ActivityIcon className="w-3 h-3" /> Agent Oracle Telemetry
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5"><Wifi className="w-2.5 h-2.5" /> 124ms</span>
                    <span className={`${status === 'success' ? 'text-green-500' : 'text-indigo-400'}`}>
                      {status === 'success' ? 'Validation Complete' : `Active Step ${currentStepIndex + 1}`}
                    </span>
                  </div>
                </div>
                <div className="text-[12px] mono text-blue-200 flex items-center gap-3">
                  <span className="text-gray-700 font-black">»</span>
                  {steps[currentStepIndex]?.detail || 'Ready for stream...'}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-900 rounded-3xl m-8 transition-colors">
            <Power className="w-16 h-16 text-gray-300 dark:text-gray-900 mb-6 transition-colors" />
            <p className="text-gray-400 dark:text-gray-700 text-xs font-black uppercase tracking-widest transition-colors">Station Suspended</p>
            <button onClick={() => setIsPowerOn(true)} className="mt-6 px-8 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase transition-all">Wake Up Instance</button>
          </div>
        )}
      </div>
    </div>
  );
};

// Internal icon helpers
const ActivityIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
);

export default LiveView;