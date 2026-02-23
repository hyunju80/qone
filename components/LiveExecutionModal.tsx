import React, { useEffect, useState, useRef } from 'react';
import { X, Tv, Terminal, Activity, Monitor } from 'lucide-react';

interface LiveExecutionModalProps {
    runId: string;
    onClose: () => void;
    onComplete?: (status: 'success' | 'error', logs?: string) => void;
}

const LiveExecutionModal: React.FC<LiveExecutionModalProps> = ({ runId, onClose, onComplete }) => {
    const [logs, setLogs] = useState<string>('');
    const [screenSrc, setScreenSrc] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('Connecting...');
    const [resultStatus, setResultStatus] = useState<'success' | 'error' | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const logRef = useRef<HTMLPreElement>(null);
    const logsContentRef = useRef<string>(''); // Ref to track latest logs for callback

    useEffect(() => {
        // Determine WS URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Assume backend is always on 8001 for this dev setup, or match window.location.hostname
        const hostname = window.location.hostname;
        const wsUrl = `${protocol}//${hostname}:8001/api/v1/run/ws/${runId}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setStatus('Connected (Live)');
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'log') {
                    const newLogChunk = msg.data;
                    setLogs(prev => prev + newLogChunk);
                    logsContentRef.current += newLogChunk; // Update ref

                    // Auto-scroll
                    if (logRef.current) {
                        logRef.current.scrollTop = logRef.current.scrollHeight;
                    }
                } else if (msg.type === 'screen') {
                    setScreenSrc(`data:image/jpeg;base64,${msg.data}`);
                } else if (msg.type === 'status') {
                    const finalStatus = msg.data as 'success' | 'error';
                    setResultStatus(finalStatus);
                    setStatus(finalStatus === 'success' ? 'Execution Passed' : 'Execution Failed');
                    if (onComplete) onComplete(finalStatus, logsContentRef.current);
                }
            } catch (e) {
                console.error("WS Parse Error", e);
            }
        };

        ws.onclose = (e) => {
            setStatus(`Disconnected (Code: ${e.code})`);
        };

        ws.onerror = (e) => {
            setStatus('Connection Error');
        };

        return () => {
            ws.close();
        };
    }, [runId]);

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-8 transition-colors">
            <div className="bg-white dark:bg-[#111318] w-full max-w-6xl h-[85vh] rounded-[2rem] border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 transition-colors">

                {/* Header */}
                <div className="px-8 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-black/40 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center text-red-500 animate-pulse">
                            <Tv className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight transition-colors">Live Test Execution</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <div className={`w-2 h-2 rounded-full ${status.includes('Connected') ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-widest transition-colors">{status}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content Grid */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Left: Screen Stream */}
                    <div className="flex-[3] bg-gray-100 dark:bg-black relative flex items-center justify-center border-r border-gray-200 dark:border-gray-800 transition-colors">
                        {screenSrc ? (
                            <img src={screenSrc} className="max-w-full max-h-full object-contain shadow-2xl" alt="Live Stream" />
                        ) : (
                            <div className="flex flex-col items-center gap-4 opacity-30">
                                <Monitor className="w-16 h-16 text-gray-400 dark:text-gray-500 transition-colors" />
                                <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500 transition-colors">Waiting for Video Signal...</p>
                            </div>
                        )}

                        {/* Overlay Badge */}
                        <div className="absolute top-6 left-6 flex flex-col gap-2">
                            <div className="bg-red-600 text-white px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-lg">
                                <Activity className="w-3 h-3 animate-bounce" /> LIVE
                            </div>
                            <div className="bg-black/80 text-gray-400 px-3 py-1 rounded text-[9px] font-mono border border-white/10 backdrop-blur-md">
                                Run ID: {runId.substring(0, 8)}...
                            </div>
                        </div>
                    </div>

                    {/* Right: Console Logs */}
                    <div className="flex-[2] bg-white dark:bg-[#0c0e12] flex flex-col min-w-[350px] transition-colors">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-2 transition-colors">
                            <Terminal className="w-4 h-4 text-gray-400 dark:text-gray-500 transition-colors" />
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest transition-colors">Execution Terminal</span>
                        </div>
                        <pre
                            ref={logRef}
                            className="flex-1 p-6 overflow-y-auto font-mono text-xs text-gray-700 dark:text-green-400/90 leading-relaxed whitespace-pre-wrap srollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 scrollbar-track-transparent transition-colors"
                        >
                            {logs || "Initializing Environment...\nWaiting for Pytest output..."}
                        </pre>

                        {/* Footer Actions (Success/Error) */}
                        {resultStatus && (
                            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex justify-end animate-in fade-in slide-in-from-bottom-2 transition-colors">
                                <button
                                    onClick={onClose}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-indigo-600/20"
                                >
                                    Close & Return
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveExecutionModal;
