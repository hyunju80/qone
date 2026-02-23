
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
   Smartphone, Monitor, Tablet, Search, Filter,
   CheckCircle2, AlertCircle, Clock, MoreVertical,
   Cpu, Database, Maximize2, X, RefreshCw,
   Link2, Trash2, LayoutGrid, List, Smartphone as MobileIcon,
   Monitor as PCIcon, Apple, Laptop, HardDrive, Info, LogOut,
   Terminal, Play, Pause, Trash, Download, Wifi, Activity
} from 'lucide-react';
import { Device, DeviceOS, DeviceStatus } from '../types';

interface DeviceFarmProps {
   devices: Device[];
   onUpdateDevice?: (device: Device) => void;
}

interface DeviceLog {
   timestamp: string;
   level: 'INFO' | 'DEBUG' | 'ERROR' | 'SYSTEM';
   tag: string;
   message: string;
}

const DeviceFarm: React.FC<DeviceFarmProps> = ({ devices, onUpdateDevice }) => {
   const [searchTerm, setSearchTerm] = useState('');
   const [osFilter, setOsFilter] = useState<'All' | DeviceOS>('All');
   const [statusFilter, setStatusFilter] = useState<'All' | DeviceStatus>('All');
   const [platformFilter, setPlatformFilter] = useState<'All' | 'Web' | 'Mobile App'>('All');
   const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

   // Log Viewer State
   const [viewingLogsDevice, setViewingLogsDevice] = useState<Device | null>(null);
   const [deviceLogs, setDeviceLogs] = useState<DeviceLog[]>([]);
   const [isLogStreaming, setIsLogStreaming] = useState(true);
   const logEndRef = useRef<HTMLDivElement>(null);

   const filteredDevices = useMemo(() => {
      return devices.filter(dev => {
         const matchesSearch = dev.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
            dev.model.toLowerCase().includes(searchTerm.toLowerCase());
         const matchesOS = osFilter === 'All' || dev.os === osFilter;
         const matchesStatus = statusFilter === 'All' || dev.status === statusFilter;
         const matchesPlatform = platformFilter === 'All' ||
            (platformFilter === 'Web' && (dev.os === 'Windows' || dev.os === 'macOS')) ||
            (platformFilter === 'Mobile App' && (dev.os === 'Android' || dev.os === 'iOS'));
         return matchesSearch && matchesOS && matchesStatus && matchesPlatform;
      });
   }, [devices, searchTerm, osFilter, statusFilter, platformFilter]);

   // Sync log viewer device state if it changes in global state
   useEffect(() => {
      if (viewingLogsDevice) {
         const updated = devices.find(d => d.id === viewingLogsDevice.id);
         if (updated && updated.status !== viewingLogsDevice.status) {
            setViewingLogsDevice(updated);
         }
      }
   }, [devices, viewingLogsDevice]);

   // Mock Log Streamer Logic
   useEffect(() => {
      if (!viewingLogsDevice || !isLogStreaming) return;

      const interval = setInterval(() => {
         const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + Math.floor(Math.random() * 999).toString().padStart(3, '0');

         let pool: string[] = [];
         let levels: DeviceLog['level'][] = ['INFO'];
         let tag = viewingLogsDevice.os === 'Android' ? 'ADB' : viewingLogsDevice.os === 'iOS' ? 'WDA' : 'WDB';

         // 1. 상태별 메세지 풀 정의
         if (viewingLogsDevice.status === 'In-Use') {
            const inUseMsgs = {
               Android: [
                  "ActivityManager: Start proc com.qone.app for activity .MainActivity",
                  "ViewRootImpl@7a1b[MainActivity]: Relayout returned: old=[0,0][1440,3088] new=[0,0][1440,3088]",
                  "InputMethodManager: Starting input: t=android.widget.EditText{42a1b22}",
                  "BufferQueueProducer: [com.qone.app] setMaxDequeuedBufferCount: 3",
                  "Choreographer: Skipped 2 frames! App doing too much work on main thread."
               ],
               iOS: [
                  "SpringBoard: [io.qone.internal] Received request to activate app",
                  "WDA: Executing findElement with strategy: CSS, selector: .login-btn",
                  "UIKit: [View] Lifecycle: viewDidLoad (io.qone.internal.MainView)",
                  "BackBoard: [Touch] Received multi-touch event at coordinate (120, 452)",
                  "assertiond: Updating process assertion for visibility state"
               ],
               Desktop: [
                  "WebDriver: Creating session for Chrome v124.0 (Official Build)",
                  "DevTools: Navigating to https://alpha-fintech.io/dashboard",
                  "System: CPU Usage spiked to 42% during DOM rendering",
                  "Renderer: Painting frame 1240 - Memory footprint: 142MB",
                  "Network: GET /api/v1/user/profile 200 OK (124ms)"
               ]
            };
            pool = (viewingLogsDevice.os === 'Android' || viewingLogsDevice.os === 'iOS')
               ? (viewingLogsDevice.os === 'Android' ? inUseMsgs.Android : inUseMsgs.iOS)
               : inUseMsgs.Desktop;
            levels = ['INFO', 'DEBUG', 'DEBUG', 'DEBUG', 'ERROR'];
         }
         else if (viewingLogsDevice.status === 'Available') {
            pool = [
               "Heartbeat: System node reporting healthy status",
               "BatteryService: Charge level: 94%, Temperature: 28.4C",
               "Maintenance: Background cleanup of temporary cache complete",
               "Network: Connection stable (Ping: 14ms)",
               "Hypervisor: Standby mode active. Waiting for orchestration request...",
               "System: Disk integrity check 100% complete"
            ];
            levels = ['INFO', 'DEBUG', 'SYSTEM'];
            tag = 'SYS';
         }
         else if (viewingLogsDevice.status === 'Offline') {
            pool = [
               "ConnectionManager: Lost connection to node. Retrying in 5s...",
               "Hypervisor: Hardware unreachable via network bridge",
               "Handshake: Timeout while waiting for secure socket initialization",
               "Maintenance: Node assigned to manual technician audit",
               "System: Process terminated unexpectedly (Exit code: 1)"
            ];
            levels = ['ERROR', 'SYSTEM'];
            tag = 'ERR';
         }

         const newLog: DeviceLog = {
            timestamp,
            level: levels[Math.floor(Math.random() * levels.length)],
            tag: tag,
            message: pool[Math.floor(Math.random() * pool.length)]
         };

         setDeviceLogs(prev => [...prev.slice(-100), newLog]);
      }, viewingLogsDevice.status === 'In-Use' ? 600 : 1500); // 실행 중일 때 로그가 더 빠르게 찍힘

      return () => clearInterval(interval);
   }, [viewingLogsDevice, isLogStreaming]);

   useEffect(() => {
      if (logEndRef.current) {
         logEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
   }, [deviceLogs]);

   const getOSIcon = (os: DeviceOS) => {
      switch (os) {
         case 'Android': return <Smartphone className="w-4 h-4 text-green-600 dark:text-green-500" />;
         case 'iOS': return <Apple className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
         case 'Windows': return <Laptop className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
         case 'macOS': return <Apple className="w-4 h-4 text-gray-900 dark:text-white" />;
         default: return <Smartphone className="w-4 h-4" />;
      }
   };

   const getStatusColor = (status: DeviceStatus) => {
      switch (status) {
         case 'Available': return 'bg-green-500';
         case 'In-Use': return 'bg-blue-500';
         case 'Offline': return 'bg-red-500';
         default: return 'bg-gray-500';
      }
   };

   const getStatusText = (status: DeviceStatus) => {
      switch (status) {
         case 'Available': return 'text-green-600 dark:text-green-500';
         case 'In-Use': return 'text-blue-600 dark:text-blue-500';
         case 'Offline': return 'text-red-600 dark:text-red-500';
         default: return 'text-gray-600 dark:text-gray-500';
      }
   };

   const getLogLevelColor = (level: string) => {
      switch (level) {
         case 'INFO': return 'text-indigo-400';
         case 'ERROR': return 'text-red-500 font-black';
         case 'SYSTEM': return 'text-green-500';
         default: return 'text-gray-500';
      }
   };

   const handleDisconnect = (dev: Device) => {
      if (onUpdateDevice) {
         onUpdateDevice({ ...dev, status: 'Offline', currentProject: undefined });
      }
   };

   const handleReconnect = (dev: Device) => {
      if (onUpdateDevice) {
         onUpdateDevice({ ...dev, status: 'Available' });
      }
   };

   return (
      <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar relative bg-gray-50 dark:bg-[#0c0e12] transition-colors">
         {/* Header */}
         <div className="mb-8">
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter mb-2 transition-colors">Device Farm Monitoring</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-widest transition-colors">Real-time infrastructure orchestration & hardware health.</p>
         </div>

         {/* Filter Bar */}
         <div className="flex flex-col lg:flex-row gap-4 mb-8">
            <div className="relative flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
               <input
                  type="text"
                  placeholder="Search by Alias or Model..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-gray-900 dark:text-white transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600 shadow-sm dark:shadow-none"
               />
            </div>

            <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 gap-1 overflow-x-auto no-scrollbar transition-colors">
               {['All', 'Web', 'Mobile App'].map(p => (
                  <button
                     key={p}
                     onClick={() => setPlatformFilter(p as any)}
                     className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${platformFilter === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                     {p}
                  </button>
               ))}
            </div>

            <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 gap-1 overflow-x-auto no-scrollbar transition-colors">
               {['All', 'Android', 'iOS', 'Windows', 'macOS'].map(os => (
                  <button
                     key={os}
                     onClick={() => setOsFilter(os as any)}
                     className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${osFilter === os ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                     {os}
                  </button>
               ))}
            </div>

            <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 gap-1 transition-colors">
               {['All', 'Available', 'In-Use', 'Offline'].map(st => (
                  <button
                     key={st}
                     onClick={() => setStatusFilter(st as any)}
                     className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${statusFilter === st ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                     {st}
                  </button>
               ))}
            </div>
         </div>

         {/* Device Grid */}
         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
            {filteredDevices.map(dev => (
               <div key={dev.id} className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-6 hover:border-indigo-500/30 transition-all group flex flex-col relative overflow-hidden shadow-sm dark:shadow-none">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-3xl rounded-full" />

                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-6 relative z-10">
                     <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 text-indigo-500 dark:text-indigo-400 group-hover:scale-105 transition-transform`}>
                           {dev.os === 'Windows' || dev.os === 'macOS' ? <PCIcon className="w-6 h-6" /> : <MobileIcon className="w-6 h-6" />}
                        </div>
                        <div>
                           <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight tracking-tight transition-colors">{dev.alias}</h3>
                           <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest border border-gray-200 dark:border-gray-800 px-1.5 py-0.5 rounded transition-colors">{dev.protocol}</span>
                           </div>
                        </div>
                     </div>
                     <button className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"><MoreVertical className="w-5 h-5" /></button>
                  </div>

                  {/* Model & OS Info */}
                  <div className="flex items-center gap-4 mb-6 relative z-10">
                     <div className="flex-1 bg-gray-50 dark:bg-[#0c0e12] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                           {getOSIcon(dev.os)}
                           <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest transition-colors">{dev.os}</span>
                        </div>
                        <div className="text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors">{dev.model}</div>
                     </div>
                     <div className="w-24 flex flex-col items-center justify-center p-3 bg-gray-50 dark:bg-[#0c0e12] rounded-2xl border border-gray-100 dark:border-gray-800 relative group/status transition-colors">
                        <div className={`w-3 h-3 rounded-full mb-1 ${getStatusColor(dev.status)} shadow-[0_0_10px_rgba(0,0,0,0.5)] ${dev.status === 'In-Use' ? 'animate-pulse' : ''}`} />
                        <span className={`text-[9px] font-black uppercase tracking-tighter ${getStatusText(dev.status)}`}>{dev.status}</span>
                     </div>
                  </div>

                  {/* In-Use Overlay (Small notification if currently testing) */}
                  {dev.status === 'In-Use' && (
                     <div className="mb-4 px-4 py-2 bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 rounded-xl flex items-center gap-2 relative z-10 animate-in fade-in zoom-in-95 transition-colors">
                        <RefreshCw className="w-3 h-3 text-blue-500 dark:text-blue-400 animate-spin" />
                        <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">Running: <span className="font-black underline">{dev.currentProject}</span></span>
                     </div>
                  )}

                  {/* Specs Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-8 relative z-10">
                     <div className="flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-gray-400 dark:text-gray-600 transition-colors" />
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate transition-colors">{dev.specs.cpu}</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-gray-400 dark:text-gray-600 transition-colors" />
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 transition-colors">{dev.specs.ram}</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <Maximize2 className="w-3.5 h-3.5 text-gray-400 dark:text-gray-600 transition-colors" />
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 transition-colors">{dev.specs.resolution}</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <HardDrive className="w-3.5 h-3.5 text-gray-400 dark:text-gray-600 transition-colors" />
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 transition-colors">{dev.specs.osVersion}</span>
                     </div>
                  </div>

                  {/* Quick Actions Footer */}
                  <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 relative z-10 transition-colors">
                     <button
                        onClick={() => setSelectedDevice(dev)}
                        className="flex-1 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 text-[9px] font-black uppercase tracking-widest py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 transition-all flex items-center justify-center gap-2"
                     >
                        <Info className="w-3 h-3" /> Details
                     </button>
                     <button
                        onClick={() => {
                           setDeviceLogs([]);
                           setViewingLogsDevice(dev);
                           setIsLogStreaming(true);
                        }}
                        className={`flex-1 hover:bg-indigo-600 hover:text-white text-[9px] font-black uppercase tracking-widest py-2.5 rounded-xl border transition-all flex items-center justify-center gap-2 ${viewingLogsDevice?.id === dev.id ? 'bg-indigo-600 text-white' : 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-800'}`}
                     >
                        <Terminal className="w-3 h-3" /> Logs
                     </button>
                     {dev.status !== 'Offline' ? (
                        <button
                           onClick={() => handleDisconnect(dev)}
                           className="p-2.5 bg-red-50 dark:bg-red-600/10 hover:bg-red-600 hover:text-white text-red-500 rounded-xl border border-red-200 dark:border-red-500/20 transition-all"
                           title="Force Disconnect"
                        >
                           <LogOut className="w-3.5 h-3.5" />
                        </button>
                     ) : (
                        <button
                           onClick={() => handleReconnect(dev)}
                           className="p-2.5 bg-green-50 dark:bg-green-600/10 hover:bg-green-600 hover:text-white text-green-500 rounded-xl border border-green-200 dark:border-green-500/20 transition-all"
                           title="Reconnect Node"
                        >
                           <Play className="w-3.5 h-3.5" />
                        </button>
                     )}
                  </div>
               </div>
            ))}
         </div>

         {/* Device Detail Modal */}
         {selectedDevice && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 animate-in fade-in duration-300">
               <div className="absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-md transition-colors" onClick={() => setSelectedDevice(null)} />
               <div className="relative w-full max-w-2xl bg-white dark:bg-[#0f1115] border border-gray-200 dark:border-gray-800 rounded-[3rem] shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200 transition-colors">
                  <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 flex items-center justify-between transition-colors">
                     <div className="flex items-center gap-4">
                        <div className="p-4 bg-indigo-600 rounded-[1.5rem] text-white">
                           <Smartphone className="w-8 h-8" />
                        </div>
                        <div>
                           <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight transition-colors">{selectedDevice.alias}</h3>
                           <div className="flex items-center gap-2 mt-1">
                              <span className={`w-2 h-2 rounded-full ${getStatusColor(selectedDevice.status)}`} />
                              <span className={`text-[10px] font-black uppercase tracking-widest ${getStatusText(selectedDevice.status)}`}>{selectedDevice.status}</span>
                           </div>
                        </div>
                     </div>
                     <button onClick={() => setSelectedDevice(null)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl text-gray-500 transition-colors border border-gray-200 dark:border-gray-800">
                        <X className="w-6 h-6" />
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                     <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 bg-gray-50 dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl transition-colors">
                           <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase tracking-widest mb-4 transition-colors">Manufacturer & Model</div>
                           <div className="text-lg font-bold text-gray-900 dark:text-white mb-1 transition-colors">{selectedDevice.model}</div>
                           <div className="text-xs text-indigo-500 dark:text-indigo-400 font-bold transition-colors">{selectedDevice.os} Environment</div>
                        </div>
                        <div className="p-6 bg-gray-50 dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl transition-colors">
                           <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase tracking-widest mb-4 transition-colors">Protocol Handshake</div>
                           <div className="text-lg font-bold text-gray-900 dark:text-white mb-1 transition-colors">{selectedDevice.protocol}</div>
                           <div className="text-xs text-gray-400 dark:text-gray-500 transition-colors">ID: {selectedDevice.id.toUpperCase()}</div>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <div className="text-[10px] font-black text-gray-500 dark:text-gray-600 uppercase tracking-widest transition-colors">Hardware Specifications</div>
                        <div className="bg-gray-50 dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden transition-colors">
                           <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-800 transition-colors">
                              <div className="p-6 border-b border-gray-200 dark:border-gray-800 transition-colors">
                                 <div className="text-[9px] font-black text-gray-500 dark:text-gray-600 uppercase mb-1 transition-colors">Central Processor (CPU)</div>
                                 <div className="text-sm font-bold text-gray-700 dark:text-gray-200 transition-colors">{selectedDevice.specs.cpu}</div>
                              </div>
                              <div className="p-6 border-b border-gray-200 dark:border-gray-800 transition-colors">
                                 <div className="text-[9px] font-black text-gray-500 dark:text-gray-600 uppercase mb-1 transition-colors">Volatile Memory (RAM)</div>
                                 <div className="text-sm font-bold text-gray-700 dark:text-gray-200 transition-colors">{selectedDevice.specs.ram}</div>
                              </div>
                              <div className="p-6">
                                 <div className="text-[9px] font-black text-gray-500 dark:text-gray-600 uppercase mb-1 transition-colors">Display Resolution</div>
                                 <div className="text-sm font-bold text-gray-700 dark:text-gray-200 transition-colors">{selectedDevice.specs.resolution}</div>
                              </div>
                              <div className="p-6">
                                 <div className="text-[9px] font-black text-gray-500 dark:text-gray-600 uppercase mb-1 transition-colors">OS Build Version</div>
                                 <div className="text-sm font-bold text-gray-700 dark:text-gray-200 transition-colors">{selectedDevice.specs.osVersion}</div>
                              </div>
                           </div>
                        </div>
                     </div>

                     {selectedDevice.status === 'In-Use' && (
                        <div className="p-8 bg-blue-50 dark:bg-blue-600/5 border border-blue-200 dark:border-blue-500/20 rounded-[2rem] transition-colors">
                           <div className="flex items-center gap-3 mb-4">
                              <RefreshCw className="w-5 h-5 text-blue-500 dark:text-blue-400 animate-spin" />
                              <span className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest transition-colors">Active Execution Context</span>
                           </div>
                           <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2 transition-colors">{selectedDevice.currentProject}</h4>
                           <p className="text-sm text-gray-500 leading-relaxed italic">"This hardware is currently allocated for automated regression testing within the specified project workspace."</p>
                        </div>
                     )}
                  </div>

                  <div className="p-8 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/20 flex justify-end gap-3 transition-colors">
                     <button className="flex items-center gap-2 px-8 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest">
                        <Trash2 className="w-4 h-4" /> Purge Cache
                     </button>
                     <button
                        onClick={() => setSelectedDevice(null)}
                        className="px-12 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest shadow-xl shadow-indigo-600/30"
                     >
                        Close Dashboard
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* LOG VIEWER OVERLAY */}
         {viewingLogsDevice && (
            <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 flex flex-col">
               {/* Top Navigation */}
               <div className="p-6 border-b border-gray-800 bg-[#0c0e12]/80 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                     <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 rounded-xl">
                           <Terminal className="w-5 h-5 text-white" />
                        </div>
                        <div>
                           <h3 className="text-sm font-black text-white uppercase tracking-widest">Autonomous Terminal Audit</h3>
                           <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                              Handshake: {viewingLogsDevice.protocol} » {viewingLogsDevice.alias}
                              <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${getStatusText(viewingLogsDevice.status)} bg-white/5`}>{viewingLogsDevice.status}</span>
                           </p>
                        </div>
                     </div>

                     {/* Real-time Hardware HUD */}
                     <div className="hidden md:flex items-center gap-6 px-6 border-l border-gray-800 ml-4">
                        <div className="flex items-center gap-2">
                           <Wifi className={`w-3.5 h-3.5 ${viewingLogsDevice.status === 'Offline' ? 'text-gray-700' : 'text-green-500'}`} />
                           <div className="flex flex-col">
                              <span className="text-[8px] font-black text-gray-600 uppercase">Latency</span>
                              <span className="text-[10px] font-bold text-gray-300 mono">{viewingLogsDevice.status === 'Offline' ? '--' : '14ms'}</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <Activity className={`w-3.5 h-3.5 ${viewingLogsDevice.status === 'Offline' ? 'text-gray-700' : 'text-indigo-400'}`} />
                           <div className="flex flex-col">
                              <span className="text-[8px] font-black text-gray-600 uppercase">Packet Loss</span>
                              <span className="text-[10px] font-bold text-gray-300 mono">{viewingLogsDevice.status === 'Offline' ? '100%' : '0.02%'}</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center gap-3">
                     <button
                        onClick={() => setIsLogStreaming(!isLogStreaming)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${isLogStreaming ? 'bg-amber-600/10 text-amber-500 border border-amber-500/20' : 'bg-green-600/10 text-green-500 border border-green-500/20'}`}
                     >
                        {isLogStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {isLogStreaming ? 'Pause Stream' : 'Resume Audit'}
                     </button>
                     <button
                        onClick={() => setDeviceLogs([])}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 border border-gray-800 hover:bg-red-900/20 hover:border-red-500/30 text-gray-500 hover:text-red-500 rounded-xl text-[10px] font-black uppercase transition-all"
                     >
                        <Trash className="w-3.5 h-3.5" /> Clear Buffer
                     </button>
                     <button className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-gray-500 hover:text-white transition-all">
                        <Download className="w-4 h-4" />
                     </button>
                     <div className="w-px h-8 bg-gray-800 mx-2" />
                     <button
                        onClick={() => {
                           setViewingLogsDevice(null);
                           setIsLogStreaming(false);
                        }}
                        className="p-3 bg-gray-900 hover:bg-gray-800 rounded-xl text-gray-500 transition-colors border border-gray-800"
                     >
                        <X className="w-6 h-6" />
                     </button>
                  </div>
               </div>

               {/* Console Area */}
               <div className="flex-1 overflow-y-auto p-8 font-mono text-[12px] bg-black relative custom-scrollbar">
                  {/* Scanline Effect Overlay */}
                  <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-10" style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 3px 100%' }} />

                  <div className="relative z-0 space-y-1">
                     <div className="flex gap-4 mb-4 pb-4 border-b border-gray-900 text-gray-600 font-bold uppercase text-[10px]">
                        <span className="w-24">TIMESTAMP</span>
                        <span className="w-16">LEVEL</span>
                        <span className="w-12">TAG</span>
                        <span>MESSAGE DISPATCH</span>
                     </div>

                     {deviceLogs.map((log, i) => (
                        <div key={i} className="flex gap-4 group hover:bg-white/[0.02] transition-colors py-0.5">
                           <span className="w-24 text-gray-700 shrink-0 select-none">{log.timestamp}</span>
                           <span className={`w-16 shrink-0 ${getLogLevelColor(log.level)}`}>[{log.level}]</span>
                           <span className={`w-12 font-black shrink-0 ${log.level === 'ERROR' ? 'text-red-900' : 'text-indigo-900'}`}>{log.tag}</span>
                           <span className={`group-hover:text-gray-200 transition-colors leading-relaxed ${log.level === 'ERROR' ? 'text-red-400' : log.level === 'SYSTEM' ? 'text-green-400/80 italic' : 'text-gray-400'}`}>
                              {log.message}
                           </span>
                        </div>
                     ))}

                     {isLogStreaming && (
                        <div className="flex gap-4 py-2 animate-pulse">
                           <span className="w-24 text-indigo-900">_</span>
                           <span className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                              {viewingLogsDevice.status === 'Offline' ? 'SEARCHING FOR NODE RE-ENTRY...' : 'WAITING FOR NEXT TELEMETRY PACKET...'}
                           </span>
                        </div>
                     )}

                     <div ref={logEndRef} />
                  </div>
               </div>

               {/* Bottom Bar Metrics */}
               <div className="p-4 border-t border-gray-900 bg-[#0c0e12] flex items-center justify-between text-[9px] font-black uppercase text-gray-700 tracking-widest">
                  <div className="flex gap-6">
                     <span>Engine: ORACLE_HYPERVISOR_V2</span>
                     <span>Buffer: {deviceLogs.length}/100 Packets</span>
                  </div>
                  <div className="flex gap-6">
                     <span className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${viewingLogsDevice.status === 'Offline' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                        {viewingLogsDevice.protocol} {viewingLogsDevice.status === 'Offline' ? 'DISCONNECTED' : 'SECURE'}
                     </span>
                     <span>Identity Hash: {viewingLogsDevice.id.slice(0, 12)}</span>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default DeviceFarm;
