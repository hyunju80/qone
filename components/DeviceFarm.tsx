
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
import { deviceFarmApi } from '../api/deviceFarm';

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
   const [osFilter, setOsFilter] = useState<'All' | 'AOS' | 'iOS'>('All');
   const [statusFilter, setStatusFilter] = useState<'All' | DeviceStatus>('All');
   // Log Viewer State
   const [viewingLogsDevice, setViewingLogsDevice] = useState<Device | null>(null);
   const [deviceLogs, setDeviceLogs] = useState<DeviceLog[]>([]);
   const [isLogStreaming, setIsLogStreaming] = useState(true);
   const logEndRef = useRef<HTMLDivElement>(null);

   const filteredDevices = useMemo(() => {
      return devices.filter(dev => {
         // Filter out Offline devices entirely as requested
         if (dev.status === 'Offline') return false;

         const matchesSearch = dev.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
            dev.model.toLowerCase().includes(searchTerm.toLowerCase());

         const matchesOS = osFilter === 'All' ||
            (osFilter === 'AOS' && dev.os === 'Android') ||
            (osFilter === 'iOS' && dev.os === 'iOS');

         const matchesStatus = statusFilter === 'All' || dev.status === statusFilter;

         return matchesSearch && matchesOS && matchesStatus;
      });
   }, [devices, searchTerm, osFilter, statusFilter]);

   // Sync log viewer device state if it changes in global state
   useEffect(() => {
      if (viewingLogsDevice) {
         const updated = devices.find(d => d.id === viewingLogsDevice.id);
         if (updated && updated.status !== viewingLogsDevice.status) {
            setViewingLogsDevice(updated);
         }
      }
   }, [devices, viewingLogsDevice]);

   // Real WebSocket Log Streamer Logic
   const wsRef = useRef<WebSocket | null>(null);

   useEffect(() => {
      if (!viewingLogsDevice || !isLogStreaming) {
         if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
         }
         return;
      }

      // If viewing a real device, connect to the WebSocket endpoint
      if (viewingLogsDevice.protocol === 'ADB') {
         const wsUrl = deviceFarmApi.getLogStreamUrl(viewingLogsDevice.id);
         const ws = new WebSocket(wsUrl);
         wsRef.current = ws;

         ws.onmessage = (event) => {
            try {
               const newLog: DeviceLog = JSON.parse(event.data);
               setDeviceLogs(prev => {
                  const updated = [...prev, newLog];
                  // Keep only last 500 logs to prevent memory bloat
                  if (updated.length > 500) return updated.slice(updated.length - 500);
                  return updated;
               });
            } catch (err) {
               console.error("Failed to parse log message", err);
            }
         };

         ws.onerror = (err) => {
            console.error("Log WebSocket error:", err);
            setDeviceLogs(prev => [...prev, {
               timestamp: new Date().toLocaleTimeString(),
               level: 'SYSTEM',
               tag: 'SYS',
               message: 'Disconnected from log stream.'
            }]);
         };

         return () => {
            ws.close();
            wsRef.current = null;
         };
      } else {
         // Fallback mock logic for non-ADB or demo purposes
         const interval = setInterval(() => {
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + Math.floor(Math.random() * 999).toString().padStart(3, '0');
            const newLog: DeviceLog = {
               timestamp,
               level: 'INFO',
               tag: 'MOCK',
               message: 'Simulated log packet for offline/non-ADB device.'
            };
            setDeviceLogs(prev => [...prev.slice(-100), newLog]);
         }, 1500);
         return () => clearInterval(interval);
      }
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
               {['All', 'AOS', 'iOS'].map(os => (
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
               {['All', 'Available', 'In-Use'].map(st => (
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
                  <div className="flex justify-between items-start mb-6 relative z-10 gap-4">
                     <div className="flex items-center gap-4 min-w-0">
                        <div className={`p-4 rounded-2xl bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 text-indigo-500 dark:text-indigo-400 group-hover:scale-105 transition-transform shrink-0 shadow-sm`}>
                           {dev.os === 'Windows' || dev.os === 'macOS' ? <PCIcon className="w-7 h-7" /> : <MobileIcon className="w-7 h-7" />}
                        </div>
                        <div className="min-w-0">
                           <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight tracking-tight transition-colors truncate" title={dev.alias}>{dev.alias}</h3>
                           <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-black text-indigo-500 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded shadow-sm uppercase shrink-0">{dev.protocol}</span>
                              <div className="flex items-center gap-1.5 py-1 px-2 bg-gray-50 dark:bg-black/20 rounded-lg border border-gray-100 dark:border-gray-800/50">
                                 <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-tighter">UDID</span>
                                 <span className="text-[11px] font-mono font-black text-gray-800 dark:text-gray-200 tracking-normal select-all">{dev.id}</span>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center gap-4 mb-6 relative z-10">
                     <div className="flex-1 bg-gray-50 dark:bg-[#0c0e12] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                           <div className="flex items-center gap-2">
                              {getOSIcon(dev.os)}
                              <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">{dev.os} 15</span>
                           </div>
                           <Wifi className="w-3.5 h-3.5 text-green-500" />
                        </div>
                        <div className="text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors truncate">
                           <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-tighter mr-2">Model</span>
                           {dev.model}
                        </div>
                     </div>
                     <div className="w-24 flex flex-col items-center justify-center p-3 bg-gray-50 dark:bg-[#0c0e12] rounded-2xl border border-gray-100 dark:border-gray-800 relative group/status">
                        <div className={`w-3 h-3 rounded-full mb-1 ${getStatusColor(dev.status)} ${dev.status === 'In-Use' ? 'animate-pulse' : ''} shadow-sm`} />
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
                  <div className="grid grid-cols-2 gap-2 mb-6 relative z-10">
                     <div className="flex items-center gap-1.5">
                        <Cpu className="w-3 h-3 text-indigo-500/70" />
                        <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium truncate">{dev.specs.cpu}</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <Database className="w-3 h-3 text-indigo-500/70" />
                        <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">{dev.specs.ram}</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <Maximize2 className="w-3 h-3 text-indigo-500/70" />
                        <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">{dev.specs.resolution}</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <HardDrive className="w-3 h-3 text-indigo-500/70" />
                        <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">{dev.specs.osVersion}</span>
                     </div>
                  </div>

                  {/* Quick Actions Footer */}
                  <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 relative z-10 transition-colors">

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
