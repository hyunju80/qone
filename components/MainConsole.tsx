import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Send, Bot, Sparkles, Play, PlaySquare, Terminal, Activity, Loader2, RefreshCw,
  AlertCircle, CheckCircle2, FileText, Download, BookOpen, Table as TableIcon,
  CalendarClock, Eye, Search, Compass, Zap, Hash, List, BarChart3, Clock, Key, Circle,
  ShieldCheck, Bell, ChevronRight, MessageSquare, ClipboardCheck,
  TrendingUp, PieChart, Info, ArrowUpRight, Check, X, Filter, Settings as SettingsIcon
} from 'lucide-react';
import { ViewMode, Message, Project, TestScript, TestHistory, TestSchedule } from '../types';
import { testApi } from '../api/test';
import { deviceFarmApi } from '../api/deviceFarm';
import { useTheme } from '../src/context/ThemeContext';
import ReactMarkdown from 'react-markdown';
import { createPortal } from 'react-dom';
import JiraSyncModal from './JiraSyncModal';
import HealingAnalysisModal from './HealingAnalysisModal';

interface MainConsoleProps {
  activeProject: Project;
  assets: TestScript[];
  history: TestHistory[];
  schedules: TestSchedule[];
  messages: Message[];
  onMessagesChange: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;
  onAlert: (title: string, msg: string, type?: 'success' | 'error' | 'info') => void;
  onViewChange: (view: ViewMode, tab?: string, scenarioId?: string, category?: string) => void;
}

interface MissionStep {
  id: string;
  label: string;
  agent: 'testing' | 'defect' | 'reporting' | 'orchestrator';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'aborted';
  logs?: string[];
  timestamp: string;
}

interface ApprovalItem {
  id: string;
  type: 'GENERATOR' | 'HEALING' | 'JIRA';
  title: string;
  description: string;
  timestamp: string;
  urgency: 'low' | 'medium' | 'high';
}

const MainConsole: React.FC<MainConsoleProps> = ({
  activeProject,
  assets,
  history,
  schedules,
  messages,
  onMessagesChange,
  onAlert,
  onViewChange
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [thoughtLog, setThoughtLog] = useState<string>('Ready for mission command...');
  const [drawerItem, setDrawerItem] = useState<ApprovalItem | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingInsight, setIsLoadingInsight] = useState(true);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [latestInsight, setLatestInsight] = useState<any>(null);
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
  const [selectedJiraItem, setSelectedJiraItem] = useState<TestHistory | null>(null);
  const [selectedHealingItem, setSelectedHealingItem] = useState<TestHistory | null>(null);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);
  const [missionSteps, setMissionSteps] = useState<MissionStep[]>([]);
  const [isAborted, setIsAborted] = useState(false);
  const [missionGoal, setMissionGoal] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  // Synchronously calculate filtered defects from props for immediate render (Removes 21 -> 13 jump)
  const propDefectsCount = useMemo(() => {
    if (!history || !assets) return 0;
    const latestMap = new Map<string, string>();
    // Assume history is sorted (newest first) or we find the latest status
    history.forEach(h => {
      const scriptId = h.scriptId || (h as any).script_id;
      if (scriptId && !latestMap.has(scriptId)) {
        latestMap.set(scriptId, h.status);
      }
    });
    return Array.from(latestMap.entries()).filter(([id, status]) => {
      if (status !== 'failed') return false;
      const script = assets.find(s => s.id === id);
      return script ? script.isActive : true;
    }).length;
  }, [history, assets]);

  const [filteredActiveDefectsCount, setFilteredActiveDefectsCount] = useState(propDefectsCount);
  const [isFilteringDefects, setIsFilteringDefects] = useState(true);
  const [isInitialSyncComplete, setIsInitialSyncComplete] = useState(false);

  // Re-sync state when props-based calculation changes
  useEffect(() => {
    setFilteredActiveDefectsCount(propDefectsCount);
  }, [propDefectsCount]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const missionIdRef = useRef<number>(0);

  const fetchData = async () => {
    if (!activeProject?.id) return;

    // 1. Fetch Summary Data (Quality Intelligence)
    setIsLoadingSummary(true);
    testApi.getHistorySummary(activeProject.id).then(summary => {
      setSummaryData(summary);
      setIsLoadingSummary(false);
    }).catch(() => setIsLoadingSummary(false));

    // 2. Fetch Latest Insight
    setIsLoadingInsight(true);
    testApi.getLatestInsight(activeProject.id).then(insight => {
      setLatestInsight(insight);
      setIsLoadingInsight(false);
    }).catch(() => setIsLoadingInsight(false));

    // 3. Fetch Data for Decision Center (Approvals)
    setIsLoadingApprovals(true);

    const fetchApprovals = async () => {
      try {
        const [scenarios, pendingHeals, historyRes] = await Promise.all([
          testApi.getScenarios(activeProject.id),
          testApi.getPendingHealing(activeProject.id),
          testApi.getHistory(activeProject.id)
        ]);

        const mapped: ApprovalItem[] = [];

        // 1. Pending Scenarios
        scenarios.filter((s: any) => !s.is_approved).forEach((s: any) => {
          mapped.push({
            id: s.id || '',
            type: 'GENERATOR',
            title: `Scenario Draft: ${s.title}`,
            description: s.description || `${s.testCases?.length || 0} cases generated.`,
            timestamp: s.created_at ? new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'New',
            urgency: 'medium'
          });
        });

        // 2. Pending Healing
        pendingHeals
          .filter((h: any) => {
            const script = assets.find(a => a.id === h.scriptId);
            return script ? script.isActive : true;
          })
          .forEach((h: any) => {
            mapped.push({
              id: h.id || '',
              type: 'HEALING',
              title: `Healing Needed: ${h.scriptName}`,
              description: `Failure detected. Self-healing is enabled for this asset.`,
              timestamp: h.runDate ? new Date(h.runDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
              urgency: 'high'
            });
          });

        // 3. Current Defects (Jira) - Using the same API as HistoryView for consistency
        const activeDefectsFromApi = await testApi.getActiveDefects(activeProject.id);

        const currentDefects = activeDefectsFromApi
          .filter((h: any) => !h.jira_id)
          .filter((h: any) => {
            const scriptId = h.scriptId || h.script_id;
            const script = assets.find(a => a.id === scriptId);
            return script ? script.isActive : true;
          });

        currentDefects.forEach((h: any) => {
          mapped.push({
            id: h.id || '',
            type: 'JIRA',
            title: `Defect Sync: ${h.scriptName}`,
            description: h.failureReason || 'Critical failure. Ready to sync with Jira.',
            timestamp: h.runDate ? new Date(h.runDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            urgency: 'high'
          });
        });

        // 4. Calculate Unified Active Defects Count (Synchronized with UI Filtering)
        const allFilteredDefects = activeDefectsFromApi
          .filter((h: any) => {
            const scriptId = h.scriptId || h.script_id;
            const script = assets.find(a => a.id === scriptId);
            return script ? script.isActive : true;
          });
        setFilteredActiveDefectsCount(allFilteredDefects.length);
        setIsFilteringDefects(false);
        setIsInitialSyncComplete(true);

        // 4. Calculate Scenario Verification Count (Autonomous Testing Repository)
        const pVerification = scenarios.filter((s: any) => (s.is_approved || s.isApproved) && (!s.golden_script_id && !s.goldenScriptId)).length;
        setPendingVerificationCount(pVerification);

        setApprovals(mapped);
      } catch (e) {
        setIsFilteringDefects(false);
        setIsInitialSyncComplete(true);
        console.error("Error fetching approvals", e);
      } finally {
        setIsLoadingApprovals(false);
      }
    };
    fetchApprovals();
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeProject.id]);

  const [agents] = useState({
    testing: { label: 'Testing', status: 'idle', color: 'indigo' },
    defect: { label: 'Defect', status: 'idle', color: 'amber' },
    reporting: { label: 'Reporting', status: 'idle', color: 'emerald' }
  });

  // Helper: Search for similar asset
  const searchSimilarAsset = (query: string, scriptList: TestScript[]) => {
    console.log(`[Agent] Searching similar asset for: "${query}"`);
    const lowerQuery = query.toLowerCase();

    // 1. Extract potential keywords (remove common filler words)
    const keywords = lowerQuery.split(' ').filter(w => w.length > 1 && !['진행하고', '재시도한', '결과', '요약해줘', '수행해줘', '해주고', '테스트', '진행해줘'].includes(w));
    console.log(`[Agent] Extracted keywords:`, keywords);

    // 2. Score each script
    const scoredScripts = scriptList.map(s => {
      let score = 0;
      const lowerName = s.name.toLowerCase();

      // Exact match gets highest score
      if (keywords.some(k => lowerName.includes(k))) score += 10;
      // Match count
      keywords.forEach(k => { if (lowerName.includes(k)) score += 5; });
      // Priority for [Verified] or more runs
      if (s.name.includes('[Verified]')) score += 5;
      if (s.runCount > 10) score += 2;

      return { script: s, score };
    }).sort((a, b) => b.score - a.score);

    const bestMatch = scoredScripts[0]?.score > 0 ? scoredScripts[0].script : scriptList[0];
    console.log(`[Agent] Best match identified: "${bestMatch?.name}" (Score: ${scoredScripts[0]?.score || 0})`);
    return bestMatch;
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isProcessing) return;

    // Mission ID for cancellation tracking
    const currentMissionId = ++missionIdRef.current;

    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: textToSend };
    onMessagesChange(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);
    setIsAborted(false);
    setMissionGoal(textToSend);
    setThoughtLog('Orchestrator is analyzing the goal...');

    // Reset mission steps for a new command
    setIsSidebarVisible(true);
    setMissionSteps([]);

    try {
      const aiApi = await import('../api/ai').then(m => m.aiApi);
      const [scriptList, summary] = await Promise.all([
        testApi.getScripts(activeProject.id),
        testApi.getHistorySummary(activeProject.id)
      ]);

      const context = `
        Current Project: ${activeProject.name}
        Total Assets: ${scriptList.length}
        Available Tests: ${scriptList.map(s => `"${s.name}" (ID: ${s.id})`).join(', ')}
        Active Defects: ${summary.active_defects}
      `;

      const response = await aiApi.chat([...messages, userMsg], context);
      const text = response.text || "";
      const lowerResp = text.toLowerCase();
      const lowerInput = textToSend.toLowerCase();

      // 1. Intelligent Mission Planning
      const steps: MissionStep[] = [];
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const wantsAnalysis = lowerInput.includes('보고서') || lowerInput.includes('분석') || lowerInput.includes('리포트') || lowerInput.includes('요약');
      const periodicalLabel = lowerInput.includes('주간') ? 'Weekly' : lowerInput.includes('월간') ? 'Monthly' : (lowerInput.includes('일간') || lowerInput.includes('일일')) ? 'Daily' : '';
      const sequentialIntent = lowerInput.includes('후') || lowerInput.includes('다음') || lowerInput.includes('하고') || lowerInput.includes('이후') || lowerInput.includes('then');

      // Case B: Defect Handling (Only if explicitly requested)
      const wantsRetry = lowerInput.includes('재시도') || lowerInput.includes('retry') || lowerInput.includes('다시') || lowerInput.includes('재실행');
      const wantsHealing = lowerInput.includes('힐링') || lowerInput.includes('healing') || lowerInput.includes('복구');
      const wantsJiraSync = (lowerInput.includes('지라') || lowerInput.includes('jira')) && (lowerInput.includes('등록') || lowerInput.includes('sync') || lowerInput.includes('동기화'));

      const wantsBulkFailedRetry = lowerInput.includes('실패') && wantsRetry;
      const wantsHealingPostRetry = wantsHealing && wantsRetry && sequentialIntent;

      // Case A: Testing Execution
      const isPureRetry = lowerInput.includes('재실행') || lowerInput.includes('다시 실행') || lowerInput.includes('재시도');
      const userWantsTest = (lowerInput.includes('테스트') || lowerInput.includes('실행') || lowerInput.includes('시행') || lowerInput.includes('run') || lowerInput.includes('test')) && (!wantsAnalysis || sequentialIntent) && !isPureRetry;
      const aiSuggestedTest = (lowerResp.includes('test') || lowerResp.includes('run') || lowerResp.includes('시행')) && (!wantsAnalysis || sequentialIntent);

      // Strict Policy: If healing or jira sync is primary goal, only add test step if explicitly requested by user (not just inferred run)
      const isFunctionalMission = wantsHealing || wantsJiraSync;
      const shouldRunTest = userWantsTest || (aiSuggestedTest && !isFunctionalMission && !wantsRetry);

      if (shouldRunTest) {
        const targetAsset = searchSimilarAsset(textToSend, assets);
        steps.push({
          id: 'step_1',
          label: `Testing: Run ${targetAsset.name}`,
          agent: 'testing',
          status: 'pending',
          timestamp,
          logs: [`Target Asset Identified: ${targetAsset.name}`, `Searching for compatible environments...`]
        });
      }

      if (wantsRetry && !wantsHealingPostRetry && !wantsBulkFailedRetry) {
        steps.push({
          id: 'step_retry',
          label: 'Defect: Retry Failed Iterations',
          agent: 'defect',
          status: 'pending',
          timestamp,
          logs: ['Filtering failed components from latest run...', 'Initiating retry sequence...']
        });
      }

      if (wantsHealing) {
        steps.push({
          id: 'step_healing',
          label: 'Defect: Autonomous Self-Healing',
          agent: 'defect',
          status: 'pending',
          timestamp,
          logs: ['Scanning Decision Center for pending healing tasks...', 'Identifying failed assets with AI-Healing enabled...']
        });

        if (wantsHealingPostRetry) {
          steps.push({
            id: 'step_retry_after_healing',
            label: 'Testing: Re-run Healed Assets Only',
            agent: 'testing',
            status: 'pending',
            timestamp,
            logs: ['Waiting for healing outcomes in THIS mission...', 'Preparing pinpoint retry batch...']
          });
        }

        steps.push({
          id: 'step_report_healing',
          label: 'Reporting: Recovery Quality Summary',
          agent: 'reporting',
          status: 'pending',
          timestamp,
          logs: ['Calculating recovery success rate...', 'Generating maintenance insight...']
        });
      }

      if (wantsBulkFailedRetry && !wantsHealingPostRetry) {
        steps.push({
          id: 'step_bulk_retry_failures',
          label: 'Testing: Bulk Re-run Active Defects',
          agent: 'testing',
          status: 'pending',
          timestamp,
          logs: ['Fetching overall project failure telemetry...', 'Dispatching bulk re-run sequence...']
        });
      }

      if (wantsJiraSync) {
        steps.push({
          id: 'step_jira_sync',
          label: 'Defect: Bulk Jira Issue Registration',
          agent: 'defect',
          status: 'pending',
          timestamp,
          logs: ['Scanning Decision Center for pending defects...', 'Preparing Jira synchronization batch...']
        });
      }

      // Case C: Reporting Summary (Only if not already added by Case B)
      const alreadyHasReport = steps.some(s => s.agent === 'reporting');

      if (wantsAnalysis && periodicalLabel) {
        steps.push({
          id: 'step_report_periodical',
          label: `Reporting: Generate ${periodicalLabel} Intelligence Report`,
          agent: 'reporting',
          status: 'pending',
          timestamp,
          logs: [`Target Period: ${periodicalLabel}`, 'Aggregating cross-platform telemetry...', 'Synthesizing executive summary...']
        });
      } else {
        const aiSuggestedReport = (lowerResp.includes('report') || lowerResp.includes('리포트') || lowerResp.includes('요약')) && !alreadyHasReport;

        if (aiSuggestedReport || (wantsAnalysis && !alreadyHasReport)) {
          // Only trigger AI-suggested report if NOT a functional mission (unless user explicitly asked for summary/report)
          if (!isFunctionalMission || wantsAnalysis) {
            steps.push({
              id: 'step_report',
              label: 'Reporting: Quality Insight Summary',
              agent: 'reporting',
              status: 'pending',
              timestamp,
              logs: ['Pending test completion for insightful summary...', 'Analyzing latest execution outcomes...']
            });
          }
        }
      }

      // 2. Initialize Workflow
      if (steps.length > 0) {
        setMissionSteps(steps);
        setThoughtLog(`Mission plan established: ${steps.length} actions coordinated.`);

        let currentIdx = 0;
        let lastRunId: string | null = null;
        let lastScriptId: string | null = null;
        let healedCount = 0;
        let failedCount = 0;
        let currentMissionHealedIds: string[] = []; // Target ONLY items healed in THIS execution

        const processNext = async () => {
          if (missionIdRef.current !== currentMissionId) return;

          if (currentIdx >= steps.length) {
            setIsProcessing(false);
            setThoughtLog('Mission accomplished. All actions verified.');
            setActiveAgent(null);
            return;
          }

          const stepIdx = currentIdx; // CRITICAL: Capture index for async updates
          const currentStep = steps[stepIdx];

          if (isAborted) {
            setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, status: 'aborted' } : s));
            setIsProcessing(false);
            setActiveAgent(null);
            return;
          }

          setActiveAgent(currentStep.agent);
          setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, status: 'processing' } : s));

          if (missionIdRef.current !== currentMissionId) return;

          try {
            if (currentStep.agent === 'testing') {
              if (currentStep.id === 'step_retry_after_healing' || currentStep.id === 'step_bulk_retry_failures') {
                let targetIds: string[] = [];

                if (currentStep.id === 'step_retry_after_healing') {
                  targetIds = [...currentMissionHealedIds];
                } else {
                  // Bulk retry of all active defects
                  const historyRes = await testApi.getHistory(activeProject.id);
                  const latestHistoryMap = new Map<string, any>();
                  historyRes.forEach((h: any) => {
                    if (h.script_id && !latestHistoryMap.has(h.script_id)) {
                      latestHistoryMap.set(h.script_id, h);
                    }
                  });
                  targetIds = Array.from(latestHistoryMap.values())
                    .filter((h: any) => h.status === 'failed')
                    .map((h: any) => h.id || (h as any)._id);
                }

                if (targetIds.length === 0) {
                  setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                    ...s,
                    logs: [...(s.logs || []), `No applicable assets discovered for re-run. Proceeding...`]
                  } : s));
                } else {
                  setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                    ...s,
                    logs: [...(s.logs || []), `Launching verification batch for ${targetIds.length} assets...`]
                  } : s));

                  for (let k = 0; k < targetIds.length; k++) {
                    if (isAborted) break;
                    const hId = targetIds[k];

                    setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                      ...s,
                      logs: [...(s.logs || []), `[Batch ${k + 1}/${targetIds.length}] Re-dispatched (ID: ${hId})`]
                    } : s));

                    try {
                      const runRes = await testApi.retryTest(hId);
                      const currentRunId = runRes.run_id;

                      // Polling for THIS specific retry item
                      let itemDone = false;
                      let itemRetries = 0;
                      while (!itemDone && itemRetries < 300) {
                        if (isAborted || missionIdRef.current !== currentMissionId) break;
                        await new Promise(r => setTimeout(r, 2000));
                        const statusRes = await testApi.getRunStatus(currentRunId);
                        if (statusRes.status !== 'running') {
                          itemDone = true;
                          const resultMsg = statusRes.status === 'success' ? 'PASSED' : 'FAILED';
                          setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                            ...s,
                            logs: [...(s.logs || []), `[Batch ${k + 1}] Complete: ${resultMsg}`]
                          } : s));
                        }
                        itemRetries++;
                      }
                    } catch (retryErr: any) {
                      setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                        ...s,
                        logs: [...(s.logs || []), `[Batch ${k + 1}] Dispatch error: ${retryErr.message || 'Network unreachable'}`]
                      } : s));
                    }
                  }
                }
              } else {
                const asset = searchSimilarAsset(textToSend, assets);
                lastScriptId = asset.id;
                const devices = await deviceFarmApi.getDevices();
                const targetDevice = devices.find(d => d.status === 'Available') || devices[0];
                const deviceId = targetDevice?.id || null;

                const commonProps = {
                  project_id: activeProject.id,
                  script_id: asset.id,
                  script_name: asset.name,
                  persona_name: 'Avery Agent',
                  trigger: 'agent_mission',
                  dataset: asset.dataset || [],
                  try_count: asset.try_count || 1,
                  enable_ai_test: asset.enable_ai_test || false
                };

                let runRes;
                if (asset.steps && asset.steps.length > 0) {
                  runRes = await testApi.runActiveSteps({
                    ...commonProps,
                    steps: asset.steps,
                    platform: asset.platform || 'WEB',
                    device_id: deviceId,
                    capture_screenshots: asset.captureScreenshots || false
                  });
                } else {
                  runRes = await testApi.dryRun({
                    ...commonProps,
                    code: asset.code || ""
                  });
                }

                lastRunId = runRes.run_id;
                setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                  ...s,
                  logs: [
                    ...(s.logs || []),
                    `Execution dispatched (ID: ${lastRunId})`,
                    `Awaiting completion in Avery's monitoring node...`
                  ]
                } : s));

                // --- POLLING FOR COMPLETION ---
                let isDone = false;
                let retryCount = 0;
                while (!isDone && retryCount < 300) { // Max 10 mins (2s intervals)
                  if (isAborted || missionIdRef.current !== currentMissionId) break;
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  if (missionIdRef.current !== currentMissionId) return;
                  const statusRes = await testApi.getRunStatus(lastRunId);
                  if (statusRes.status !== 'running') {
                    isDone = true;
                    const finalLog = statusRes.status === 'success'
                      ? `[DISPATCH] Test Successful (Exit Code: 0)`
                      : `[DISPATCH] Test Finished (Status: ${statusRes.status}, Code: ${statusRes.exit_code})`;
                    setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, logs: [...(s.logs || []), finalLog] } : s));
                    break;
                  }
                  retryCount++;
                }
              }
            } else if (currentStep.agent === 'defect') {
              setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, logs: [...(s.logs || []), `Accessing Decision Center repositories...`] } : s));

              if (currentStep.id === 'step_jira_sync') {
                const historyRes = await testApi.getHistory(activeProject.id);

                const latestHistoryMap = new Map<string, any>();
                historyRes.forEach((h: any) => {
                  if (h.script_id && !latestHistoryMap.has(h.script_id)) {
                    latestHistoryMap.set(h.script_id, h);
                  }
                });

                const pendingJira = Array.from(latestHistoryMap.values())
                  .filter((h: any) => h.status === 'failed' && !h.jira_id);

                if (pendingJira.length === 0) {
                  setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                    ...s,
                    logs: [...(s.logs || []), `No pending defects found for Jira registration. All issues are synchronized.`]
                  } : s));
                } else {
                  setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                    ...s,
                    logs: [...(s.logs || []), `Found ${pendingJira.length} failed assets requiring Jira synchronization.`]
                  } : s));

                  let jiraSuccess = 0;
                  let jiraFail = 0;

                  for (let k = 0; k < pendingJira.length; k++) {
                    if (isAborted) break;
                    const item = pendingJira[k];
                    setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                      ...s,
                      logs: [...(s.logs || []), `[Sync ${k + 1}/${pendingJira.length}] Syncing defect: ${item.scriptName}...`]
                    } : s));

                    try {
                      const result = await testApi.assignJira(item.id || (item as any)._id);
                      jiraSuccess++;
                      setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                        ...s,
                        logs: [...(s.logs || []), `[Sync ${k + 1}] Successfully registered Jira ID: ${result.jira_id}`]
                      } : s));
                    } catch (err: any) {
                      jiraFail++;
                      setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                        ...s,
                        logs: [...(s.logs || []), `[Sync ${k + 1}] Registration failed for ${item.scriptName}.`]
                      } : s));
                    }
                  }

                  setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                    ...s,
                    logs: [
                      ...(s.logs || []),
                      `--- JIRA SYNC SUMMARY ---`,
                      `Total Defects Processed: ${pendingJira.length}`,
                      `Successfully Registered: ${jiraSuccess}`,
                      `Synchronization Failures: ${jiraFail}`,
                      `-------------------------`
                    ]
                  } : s));
                }
              } else {
                const pending = await testApi.getPendingHealing(activeProject.id);

                if (pending.length === 0) {
                  setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                    ...s,
                    logs: [...(s.logs || []), `No pending healing tasks found. Assets are currently stable.`]
                  } : s));
                } else {
                  setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                    ...s,
                    logs: [...(s.logs || []), `Found ${pending.length} assets requiring autonomous recovery.`]
                  } : s));

                  // Sequential processing as requested
                  for (let j = 0; j < pending.length; j++) {
                    if (isAborted) break;
                    const item = pending[j];
                    setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                      ...s,
                      logs: [...(s.logs || []), `[Recovery ${j + 1}/${pending.length}] Initiating AI-Healing for: ${item.scriptName}...`]
                    } : s));

                    try {
                      const healRes = await testApi.selfHealTest(item.id || item.scriptId);
                      const logId = healRes.log_id;

                      // Poll healing status
                      let healingDone = false;
                      let healRetries = 0;
                      while (!healingDone && healRetries < 180) { // Max 6 mins
                        if (isAborted || missionIdRef.current !== currentMissionId) break;
                        await new Promise(res => setTimeout(res, 2000));
                        if (missionIdRef.current !== currentMissionId) return;

                        try {
                          const statusRes = await testApi.getHealingStatus(logId);

                          if (statusRes.status !== 'started') {
                            healingDone = true;
                            if (statusRes.status === 'success') {
                              healedCount++;
                              currentMissionHealedIds.push(item.id || (item as any)._id);
                            }
                            else failedCount++;

                            const statusMsg = statusRes.status === 'success' ? 'SUCCESS' : 'FAILED';
                            setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                              ...s,
                              logs: [...(s.logs || []), `[Recovery ${j + 1}] ${item.scriptName}: ${statusMsg}`]
                            } : s));
                          }
                        } catch (statusErr: any) {
                          // If 404, the log entry is just not created yet in DB. Don't fail, just wait.
                          console.log(`[Avery] Healing log ${logId} not yet available (404). retrying...`);
                        }
                        healRetries++;
                      }
                    } catch (healErr: any) {
                      failedCount++;
                      setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                        ...s,
                        logs: [...(s.logs || []), `[Recovery ${j + 1}] Error: ${healErr.message || 'Node unreachable'}`]
                      } : s));
                    }
                  }
                  setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, logs: [...(s.logs || []), `Autonomous recovery sequence finalized.`] } : s));
                }
              }
            } else if (currentStep.agent === 'reporting') {
              if (currentStep.id === 'step_report_periodical') {
                const periodicalLabel = currentStep.label.includes('Weekly') ? 'Last 7 Days' : currentStep.label.includes('Monthly') ? 'Last 30 Days' : 'Last 24 Hours';
                setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, logs: [...(s.logs || []), `Aggregating ${periodicalLabel} performance telemetry...`] } : s));

                // 1. Filter Data for the Period (Logic mirrored from ReportDashboard)
                const now = new Date();
                const filteredHistory = history.filter(h => {
                  const runDate = new Date(h.runDate);
                  if (periodicalLabel === 'Last 24 Hours') return (now.getTime() - runDate.getTime()) <= 24 * 60 * 60 * 1000;
                  if (periodicalLabel === 'Last 7 Days') return (now.getTime() - runDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
                  if (periodicalLabel === 'Last 30 Days') return (now.getTime() - runDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
                  return true;
                });

                // 2. Aggregate Stats
                const totalRuns = filteredHistory.length;
                const passedRuns = filteredHistory.filter(h => h.status === 'passed').length;
                const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

                const topFailures = filteredHistory
                  .filter(h => h.status === 'failed')
                  .slice(0, 5)
                  .map(h => ({
                    asset: h.scriptName || (h as any).ai_summary || 'Unknown Asset',
                    reason: h.failureReason,
                    date: h.runDate
                  }));

                const diagnosis = {
                  ui: filteredHistory.filter(h => (h.failureReason || '').toLowerCase().includes('ui') || (h.failureReason || '').toLowerCase().includes('selector') || (h.failureReason || '').toLowerCase().includes('element')).length,
                  network: filteredHistory.filter(h => (h.failureReason || '').toLowerCase().includes('api') || (h.failureReason || '').toLowerCase().includes('network') || (h.failureReason || '').toLowerCase().includes('timeout')).length,
                  logic: filteredHistory.filter(h => h.status === 'failed' && !(['ui', 'api', 'network', 'selector', 'timeout'].some(k => (h.failureReason || '').toLowerCase().includes(k)))).length
                };

                const goldenSummary = {
                  exploration: assets.filter(s => (s.origin === 'AI_EXPLORATION' || s.origin === 'AI')).slice(0, 5).map(s => s.name),
                  generator: [],
                  manual: assets.filter(s => (s.origin === 'STEP' || !s.origin || s.origin === 'MANUAL')).slice(0, 5).map(s => s.name),
                  step: []
                };

                // 3. Call AI Analysis API
                setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, logs: [...(s.logs || []), `Requesting Executive Intelligence analysis...`] } : s));

                const reportPayload = {
                  project_name: activeProject.name,
                  period: periodicalLabel,
                  stats: { totalRuns, passRate, diagnosis, topFailures, goldenSummary }
                };

                try {
                  const analyzeRes = await testApi.analyzeReport(reportPayload);
                  const markdown = analyzeRes.report_markdown;

                  // 4. Save to Project Insight
                  setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, logs: [...(s.logs || []), `Assetizing report to Saved Insights repository...`] } : s));

                  const newInsight = await testApi.saveInsight(activeProject.id, {
                    title: `Executive ${periodicalLabel} Report - ${new Date().toLocaleDateString()}`,
                    content_markdown: markdown,
                    insight_type: 'EXECUTIVE_SUMMARY'
                  });

                  setLatestInsight(newInsight);

                  setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                    ...s,
                    logs: [...(s.logs || []), `--- REPORT SUMMARY ---`, `Total Executes: ${totalRuns}`, `Success Rate: ${passRate}%`, `--------------------`, `Mission complete. [VIEW_REPORT:${newInsight.id || newInsight._id}:${newInsight.title}]`]
                  } : s));
                } catch (apiErr: any) {
                  throw new Error(`Report Generation Failed: ${apiErr.message}`);
                }
              } else {
                // --- GENUINE RESULT SUMMARY (Default Mission) ---
                setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, logs: [...(s.logs || []), `Analyzing latest execution outcomes...`] } : s));

                let summaryLogs = [];
                if (healedCount > 0 || failedCount > 0) {
                  summaryLogs.push(`--- Self-Healing Summary ---`);
                  summaryLogs.push(`Total Assets Processed: ${healedCount + failedCount}`);
                  summaryLogs.push(`Successfully Restored: ${healedCount}`);
                  summaryLogs.push(`Failed to Recover: ${failedCount}`);
                  summaryLogs.push(`---------------------------`);
                }

                const historyList = await testApi.getHistory(activeProject.id);
                // Find the exact entry matching our run_id. ONLY IF run_id exists for this mission.
                const latestEntry = lastRunId
                  ? (historyList.find(h => h.runId === lastRunId) || historyList[0])
                  : null;

                if (latestEntry) {
                  const resultHeader = `Result: ${latestEntry.status?.toUpperCase() || 'UNKNOWN'}`;
                  const summaryText = latestEntry.aiSummary || latestEntry.failureReason || 'Initial summary gathering...';
                  const failureAnalysis = latestEntry.failureAnalysis
                    ? (typeof latestEntry.failureAnalysis === 'string'
                      ? `Analysis: ${latestEntry.failureAnalysis}`
                      : `Analysis: ${JSON.stringify(latestEntry.failureAnalysis)}`)
                    : '';

                  summaryLogs.push(`Mission Target: ${latestEntry.scriptName || 'Unknown Script'}`);
                  summaryLogs.push(resultHeader);
                  summaryLogs.push(`Summary: ${summaryText}`);
                  if (failureAnalysis) summaryLogs.push(failureAnalysis);
                }

                if (summaryLogs.length === 0) {
                  summaryLogs.push("Mission complete, but no specific results found in Avery node.");
                }

                setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
                  ...s,
                  logs: [...(s.logs || []), ...summaryLogs, `Report ready in Analytics & Reports dashboard.`]
                } : s));
              }
            }

            setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, status: 'completed' } : s));

            // UX pacing: Wait for the completed UI state to settle before next step
            await new Promise(resolve => setTimeout(resolve, 500));
            currentIdx++;
            processNext();
          } catch (err: any) {
            console.error(`[Avery Error] Mission step ${stepIdx + 1} failed:`, err);
            setMissionSteps(prev => prev.map((s, i) => i === stepIdx ? {
              ...s,
              status: 'failed',
              logs: [...(s.logs || []), `[CRITICAL ERROR] Avery Mission Node: ${err.message || 'Timeout/Network Failure'}`]
            } : s));
            setIsProcessing(false);
            setThoughtLog(`Mission halted at step ${stepIdx + 1}`);
          }
        };

        processNext();
      } else {
        setThoughtLog('Mission plan coordinated.');
        setIsProcessing(false);
      }

      onMessagesChange(prev => [...prev, { id: `ai_${Date.now()}`, role: 'assistant', content: text || "Mission planned. Initiating sequential execution..." } as Message]);
    } catch (e) {
      setThoughtLog('Orchestration failure.');
      setIsProcessing(false);
    }
  };


  const bgClass = isDark ? 'bg-[#0c0e12]' : 'bg-[#f8faff]';
  const textClass = isDark ? 'text-gray-100' : 'text-gray-900';
  const subTextClass = isDark ? 'text-gray-500' : 'text-gray-400';
  const cardBgClass = isDark ? 'bg-white/[0.02] border-white/5 backdrop-blur-sm shadow-2xl' : 'bg-white border-gray-100 shadow-sm';
  const inputBgClass = isDark ? 'bg-gray-900/50' : 'bg-white';
  const borderClass = isDark ? 'border-white/5' : 'border-gray-100';

  return (
    <div className={`flex h-full w-full ${bgClass} ${textClass} overflow-hidden font-sans relative transition-colors duration-500`}>
      <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-tr from-[#0c0e12] via-[#11141d] to-[#0c0e12]' : 'bg-gradient-to-tr from-[#f8faff] via-[#ffffff] to-[#f8faff]'} pointer-events-none`} />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="flex-1 flex flex-col z-10 overflow-y-auto overflow-x-hidden no-scrollbar">

        <header className="flex items-center justify-between px-10 py-8 relative">
          {/* Top-Left Active Defects indicator */}
          <div
            onClick={() => onViewChange(ViewMode.HISTORY, 'defects')}
            className={`absolute left-10 top-8 flex items-center gap-3 px-5 py-2.5 ${cardBgClass} rounded-2xl border ${borderClass} cursor-pointer hover:border-rose-500/30 transition-all group shadow-sm z-50`}
          >
            <div className="relative">
              <ShieldCheck className="w-5 h-5 text-rose-500" />
              {filteredActiveDefectsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
              )}
            </div>
            <div className="flex flex-col">
              <span className={`text-[9px] font-black ${subTextClass} uppercase tracking-widest leading-none mb-1`}>Active Defects</span>
              <span className={`text-base font-black ${textClass} leading-tight`}>{filteredActiveDefectsCount}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-rose-500 ml-1 transition-all" />
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-8 pr-12">
            {/* Top-Right Active Agent indicator - Now on the left of circles */}
            <div className={`transition-all duration-500 flex items-center gap-3 px-4 py-2 rounded-2xl border ${activeAgent ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'} 
              ${activeAgent === 'testing' ? (isDark ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-indigo-50 border-indigo-100') :
                activeAgent === 'defect' ? (isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-100') :
                  (isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-100')} overflow-hidden`}>
              <div className="relative">
                <Bot className={`w-5 h-5 
                  ${activeAgent === 'testing' ? (isDark ? 'text-indigo-400' : 'text-indigo-600') :
                    activeAgent === 'defect' ? (isDark ? 'text-amber-400' : 'text-amber-600') :
                      (isDark ? 'text-emerald-400' : 'text-emerald-600')} 
                  ${isProcessing ? 'animate-bounce' : ''}`} />
                <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full animate-ping 
                  ${activeAgent === 'testing' ? 'bg-indigo-500' :
                    activeAgent === 'defect' ? 'bg-amber-500' :
                      'bg-emerald-500'}`} />
              </div>
              <div className="flex flex-col">
                <span className={`text-[9px] font-black uppercase tracking-widest 
                  ${activeAgent === 'testing' ? (isDark ? 'text-indigo-400' : 'text-indigo-600') :
                    activeAgent === 'defect' ? (isDark ? 'text-amber-400' : 'text-amber-600') :
                      (isDark ? 'text-emerald-400' : 'text-emerald-600')}`}>Agent Active</span>
                <span className={`text-[11px] font-bold ${isDark ? 'text-white' : 'text-gray-900'} capitalize`}>{activeAgent} Agent</span>
              </div>
            </div>

            <div className="w-[1px] h-8 bg-gray-100 dark:bg-white/5 mx-1" />

            {/* Agents List - Now on the right side of the pop-up */}
            <div className="flex items-center gap-10">
              {[agents.testing, agents.defect, agents.reporting].map(a => (
                <div key={a.label} className="flex flex-col items-center gap-2 group cursor-pointer">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center relative transition-all duration-700 ${activeAgent === a.label.toLowerCase() ? 'scale-110 shadow-[0_0_30px_rgba(79,70,229,0.3)]' : 'opacity-70 group-hover:opacity-100'}`}>
                    <div className={`absolute inset-0 rounded-full border-2 border-${a.color}-500/20 ${activeAgent === a.label.toLowerCase() ? 'animate-ping' : ''}`} />
                    <div className={`w-full h-full rounded-full ${isDark ? `bg-${a.color}-500/10 border-${a.color}-500/30` : `bg-${a.color}-50 border-${a.color}-100`} border backdrop-blur-md flex items-center justify-center transition-colors`}>
                      {a.label === 'Testing' ? <Bot className={`w-5 h-5 text-${a.color}-500`} /> :
                        a.label === 'Defect' ? <ShieldCheck className={`w-5 h-5 text-${a.color}-500`} /> :
                          <BarChart3 className={`w-5 h-5 text-${a.color}-500`} />}
                    </div>
                    {activeAgent === a.label.toLowerCase() && (
                      <div className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-${a.color}-500 shadow-[0_0_8px_rgb(99,102,241)]`} />
                    )}
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${subTextClass} group-hover:${isDark ? 'text-gray-300' : 'text-gray-600'} transition-colors`}>{a.label}</span>
                </div>
              ))}
            </div>
          </div>
        </header>

        <section className={`flex-1 flex flex-row gap-8 w-full overflow-hidden transition-all duration-700`}>
          {/* LEFT: Dashboard & Input Area */}
          <div className={`flex-1 flex flex-col items-center justify-start px-10 overflow-y-auto no-scrollbar transition-all duration-700`}>
            <div className="flex-[0.2] h-0" />
            <div className={`max-w-4xl mx-auto w-full pt-4 pb-12 flex flex-col items-center`}>
              <div className="w-full mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
                <h1 className={`text-2xl font-black tracking-tight text-center ${textClass} mb-6 transition-colors`}>
                  What is the goal for <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">today?</span>
                </h1>
                <div className="relative max-w-2xl mx-auto group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-[32px] blur opacity-10 group-focus-within:opacity-30 transition-opacity duration-500" />
                  <div className={`relative flex items-center ${inputBgClass} backdrop-blur-2xl border ${borderClass} rounded-[28px] p-2 transition-all shadow-2xl duration-500`}>
                    <div className="pl-6 pr-4 opacity-50 flex items-center">
                      {isProcessing ? <Loader2 className="w-6 h-6 animate-spin text-indigo-500" /> : <Zap className="w-6 h-6 text-indigo-400" />}
                    </div>
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="e.g. '글로벌 여행 테스트 진행 후 일간 분석 보고서 작성해줘'"
                      className={`flex-1 bg-transparent py-5 text-lg font-bold outline-none placeholder:text-gray-500/30 ${textClass} transition-colors`}
                    />
                    {isProcessing ? (
                      <button onClick={() => { setIsProcessing(false); setIsAborted(true); setThoughtLog('Mission aborted.'); }} className="px-6 py-4 bg-red-600/20 text-red-500 border border-red-500/30 rounded-[24px] text-[10px] font-black uppercase tracking-widest ml-2 hover:bg-red-600/30 transition-all">Stop</button>
                    ) : (
                      <button onClick={() => handleSend()} className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[24px] shadow-lg shadow-indigo-600/20 active:scale-95 ml-2"><ArrowUpRight className="w-6 h-6" /></button>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-6">
                    <span className={`text-[10px] font-black ${isDark ? 'text-gray-600' : 'text-gray-400'} uppercase tracking-widest`}>Orchestrator Thought:</span>
                    <p className={`text-[11px] font-black tracking-[0.05em] ${isProcessing ? 'text-indigo-500' : (isDark ? 'text-gray-500' : 'text-gray-400')}`}>{thoughtLog}</p>
                  </div>
                </div>
              </div>

              {/* Dashboard Grid */}
              <div className="w-full grid grid-cols-2 gap-8 mt-9 items-stretch">
                {/* Decision Center */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-2 pb-3 mb-4 border-b border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-indigo-500" />
                      <span className={`text-[11px] font-black ${subTextClass} uppercase tracking-[0.2em]`}>Decision Center</span>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full`}>{approvals.length} Pending</span>
                  </div>
                  <div className="flex flex-col gap-2 h-full max-h-[285px] overflow-y-auto pr-2 custom-scrollbar">
                    {isLoadingApprovals && approvals.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center opacity-30 py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : approvals.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center opacity-20 border-2 border-dashed border-gray-500/20 rounded-[28px] py-20">
                        <CheckCircle2 className="w-10 h-10 mb-2" />
                        <span className="text-[10px] font-bold">Clear Sky - No pending decisions</span>
                      </div>
                    ) : (
                      approvals.map(app => {
                        const themeMap: any = {
                          HEALING: { text: 'text-indigo-500', bg: 'bg-indigo-600', hoverBg: 'hover:bg-indigo-600', softBg: 'hover:bg-indigo-500/[0.05]', darkSoftBg: 'hover:bg-indigo-500/10', stick: 'bg-indigo-500', btnBg: 'bg-indigo-500/10' },
                          JIRA: { text: 'text-amber-500', bg: 'bg-amber-600', hoverBg: 'hover:bg-amber-600', softBg: 'hover:bg-amber-500/[0.05]', darkSoftBg: 'hover:bg-amber-500/10', stick: 'bg-amber-500', btnBg: 'bg-amber-500/10' },
                          GENERATOR: { text: 'text-violet-500', bg: 'bg-violet-600', hoverBg: 'hover:bg-violet-600', softBg: 'hover:bg-violet-500/[0.05]', darkSoftBg: 'hover:bg-violet-500/10', stick: 'bg-violet-500', btnBg: 'bg-violet-500/10' }
                        };
                        const t = themeMap[app.type] || themeMap.HEALING;

                        const handleAction = async (e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (app.type === 'GENERATOR') {
                            setDrawerItem(app);
                          } else {
                            setIsFetchingDetail(true);
                            try {
                              const detail = await testApi.getHistoryDetail(app.id);
                              if (app.type === 'JIRA') {
                                setSelectedJiraItem(detail);
                              } else {
                                setSelectedHealingItem(detail);
                              }
                            } catch (e) {
                              onAlert('Error', 'Failed to fetch detail information.', 'error');
                            } finally {
                              setIsFetchingDetail(false);
                            }
                          }
                        };

                        return (
                          <div
                            key={`${app.type}-${app.id}`}
                            onClick={handleAction}
                            className={`p-4 ${cardBgClass} ${isDark ? t.darkSoftBg : t.softBg} cursor-pointer group flex items-center justify-between rounded-[28px] shrink-0 transition-all active:scale-[0.99]`}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={`w-1 h-8 rounded-full ${app.urgency === 'high' ? t.stick : 'bg-gray-500'}`} />
                              <div className="min-w-0">
                                <span className={`text-[8px] font-black ${t.text} uppercase tracking-widest mb-0.5 block`}>{app.type}</span>
                                <h3 className="text-xs font-black truncate">{app.title}</h3>
                                <p className={`text-[10px] font-bold ${subTextClass} truncate`}>{app.description}</p>
                              </div>
                            </div>
                            <button
                              onClick={handleAction}
                              disabled={isFetchingDetail}
                              className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-2xl 
                                ${isDark ? 'bg-white/5' : t.btnBg} ${t.text} 
                                hover:${t.bg} hover:text-white hover:shadow-lg transition-all 
                                hover:scale-110 active:scale-90 disabled:opacity-50 disabled:scale-100 group/btn`}
                            >
                              {isFetchingDetail && (app.type === 'JIRA' || app.type === 'HEALING') ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Quality Intelligence */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-2 pb-3 mb-4 border-b border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-emerald-500" />
                      <span className={`text-[11px] font-black ${subTextClass} uppercase tracking-[0.2em]`}>Quality Intelligence</span>
                    </div>
                    <span className="text-[9px] font-black text-emerald-500 uppercase px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">Optimized</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 h-full">
                    {/* Card 1: Golden Asset Fleet */}
                    {isLoadingSummary && !summaryData ? (
                      <div className={`col-span-2 py-20 flex items-center justify-center opacity-30 ${cardBgClass} rounded-[28px]`}><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : (
                      <>
                        <div
                          onClick={() => onViewChange(ViewMode.LIBRARY)}
                          className={`p-6 ${cardBgClass} bg-gradient-to-br from-indigo-600/10 to-transparent flex flex-col justify-between rounded-[28px] min-h-[140px] group border ${isDark ? 'border-white/5' : 'border-gray-100'} hover:border-indigo-500/30 cursor-pointer transition-all shadow-sm`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                <Zap className="w-3 h-3 fill-indigo-500" /> Asset Fleet
                              </div>
                              <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[8px] font-black text-emerald-500 flex items-center gap-1">
                                <TrendingUp className="w-2 h-2" /> +{summaryData?.weekly_growth || 0}
                              </div>
                            </div>
                            <p className={`text-3xl font-black ${textClass} tracking-tighter leading-none mb-1 transition-colors uppercase`}>{summaryData?.total_assets || 0}</p>
                            <span className={`text-[9px] font-black ${subTextClass} uppercase tracking-widest block opacity-70`}>Total Validated Assets</span>
                          </div>

                          <div className="mt-4 space-y-1.5">
                            <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-widest">
                              <span className={subTextClass}>Stability Score</span>
                              <span className="text-emerald-500">
                                {summaryData?.total_assets ? Math.round(((summaryData.total_assets - filteredActiveDefectsCount) / summaryData.total_assets) * 100) : 100}%
                              </span>
                            </div>
                            <div className={`w-full h-1 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                              <div
                                className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                style={{ width: `${!summaryData?.total_assets ? 100 : ((summaryData.total_assets - filteredActiveDefectsCount) / summaryData.total_assets) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Card 2: Scenario Verification */}
                        <div
                          onClick={() => onViewChange(ViewMode.AI_GENERATOR, 'verification')}
                          className={`p-6 ${cardBgClass} bg-gradient-to-br from-violet-600/10 to-transparent flex flex-col justify-between rounded-[28px] min-h-[140px] group border ${isDark ? 'border-white/5' : 'border-gray-100'} hover:border-violet-500/30 cursor-pointer transition-all shadow-sm`}
                        >
                          <div>
                            <div className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Sparkles className="w-3 h-3 fill-violet-500" /> Scenario Repository
                            </div>
                            <p className={`text-3xl font-black ${textClass} tracking-tighter leading-none mb-1 transition-colors uppercase`}>{pendingVerificationCount}</p>
                            <span className={`text-[9px] font-black ${subTextClass} uppercase tracking-widest block opacity-70`}>Pending Verification</span>
                          </div>

                          <div className="flex items-center justify-between mt-4">
                            <div className="flex -space-x-2">
                              {[0, 1, 2].map(i => (
                                <div key={i} className={`w-5 h-5 rounded-full border-2 ${isDark ? 'border-[#11141d] bg-gray-800' : 'border-white bg-gray-100'} flex items-center justify-center`}>
                                  <Zap className="w-2.5 h-2.5 text-violet-500" />
                                </div>
                              ))}
                            </div>
                            <span className="text-[8px] font-black text-violet-500 underline uppercase tracking-widest">Verify Now</span>
                          </div>
                        </div>
                      </>
                    )}
                    <div onClick={() => latestInsight && setShowInsightModal(true)} className={`col-span-2 p-5 ${cardBgClass} flex items-center justify-between group cursor-pointer border hover:border-indigo-500/30 rounded-[28px] relative`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:text-emerald-500`}>
                          {isLoadingInsight ? <Loader2 className="w-5 h-5 animate-spin opacity-30" /> : <FileText className="w-6 h-6" />}
                        </div>
                        <div>
                          <span className={`text-[9px] font-black ${subTextClass} uppercase tracking-widest block mb-0.5`}>Latest Insight</span>
                          <h4 className="text-[14px] font-black tracking-tight">{latestInsight?.title || 'No insights available'}</h4>
                          <span
                            onClick={(e) => { e.stopPropagation(); onViewChange(ViewMode.REPORTS, 'saved'); }}
                            className="text-[10px] bg-transparent text-gray-400 hover:text-emerald-500 mt-1.5 inline-flex items-center gap-1 font-bold transition-colors cursor-pointer"
                          >
                            View All Reports <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                      <button className="p-3 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Mission Control Sidebar (Execution Log Timeline Style) */}
          {missionSteps.length > 0 && isSidebarVisible && (
            <div className={`w-[500px] h-full ${isDark ? 'bg-black/60 border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.6)]' : 'bg-white/95 border-l border-gray-200 shadow-[-10px_0_40px_rgba(0,0,0,0.08)]'} backdrop-blur-3xl overflow-y-auto animate-in slide-in-from-right duration-700 p-8 flex flex-col custom-scrollbar relative z-20`}>
              {/* Edge Glow effect */}
              <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-indigo-500/40 to-transparent pointer-events-none" />

              {/* Sidebar Header with Close Button */}
              <div className={`flex items-center justify-between mb-5 pb-6 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
                    <Activity className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Mission Control</span>
                    <span className={`text-[12px] font-black ${isDark ? 'text-gray-100' : 'text-gray-900'} uppercase tracking-[0.1em]`}>Logistics Console</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Active</span>
                  </div>
                  <button
                    onClick={() => setIsSidebarVisible(false)}
                    className={`p-2 rounded-xl border ${isDark ? 'border-white/10 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-100'} text-gray-500 transition-all hover:scale-105 active:scale-95`}
                    title="Hide Mission Control"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mission Goal Context */}
              <div className={`${isDark ? 'bg-indigo-500/15 border-indigo-500/40 ring-1 ring-white/10' : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-200 shadow-md'} border rounded-[1.5rem] p-5 mb-10`}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-[0.3em]">Primary Objective</span>
                </div>
                <p className={`text-[15px] font-black ${isDark ? 'text-white' : 'text-gray-950'} leading-relaxed`}>
                  "{missionGoal}"
                </p>
              </div>

              <div className="flex items-center justify-between px-2 mb-4">
                <span className="text-[10px] font-black ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-widest">Execution Timeline</span>
                <span className="text-[9px] font-bold text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 shadow-sm">
                  {missionSteps.filter(s => s.status === 'completed').length} / {missionSteps.length} Steps
                </span>
              </div>

              {/* Timeline Flow Container */}
              <div className="relative pl-4 space-y-10">
                {/* Vertical Background Line */}
                <div className={`absolute left-[29px] top-4 bottom-4 w-[2px] ${isDark ? 'bg-white/10' : 'bg-gray-200'} z-0`} />

                {missionSteps.map((step, idx) => (
                  <div key={step.id} className="relative z-10 group">
                    <div className="flex items-start gap-6">
                      {/* Timeline Node (Dot) */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 z-0 shadow-xl transition-all duration-500
                        ${step.status === 'processing' ? 'bg-indigo-600 border-indigo-100 text-white animate-pulse ring-4 ring-indigo-500/20 scale-110' :
                          step.status === 'completed' ? 'bg-emerald-500 border-emerald-100 text-white shadow-emerald-500/20' :
                            isDark ? 'bg-gray-700 border-gray-600 text-gray-400' : 'bg-gray-300 border-gray-400 text-gray-500'}`}>
                        {step.status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                          step.status === 'completed' ? <Check className="w-4 h-4" /> :
                            <Circle className={`w-2 h-2 fill-current ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />}
                      </div>

                      {/* Step Card Content */}
                      <div className={`flex-1 p-6 rounded-[2.5rem] border transition-all duration-500 group-hover:translate-x-1
                        ${step.status === 'processing' ? (isDark ? 'bg-indigo-500/20 border-indigo-500/60 shadow-2xl' : 'bg-indigo-50/80 border-indigo-300 shadow-xl') :
                          (isDark ? 'bg-white/5 border-white/5 opacity-80' : 'bg-white border-gray-200 opacity-90 shadow-sm')}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${step.status === 'processing' ? 'text-indigo-500' : 'text-gray-500'}`}>
                              {step.agent}
                            </span>
                            <span className="text-[9px] font-bold text-gray-500 font-mono">{step.timestamp}</span>
                          </div>
                          <h4 className={`text-[15px] font-black ${step.status === 'processing' ? (isDark ? 'text-white' : 'text-indigo-950') : (isDark ? 'text-gray-200' : 'text-gray-900')} transition-colors mb-3`}>
                            {step.label}
                          </h4>

                          {step.logs && step.logs.length > 0 && (
                            <div className="mt-4 space-y-3">
                              {step.logs.map((log, lIdx) => {
                                const reportActionMatch = log.match(/\[VIEW_REPORT:(.*?):(.*?)\]/);
                                return (
                                  <div key={lIdx} className="flex flex-col items-start gap-2 w-full">
                                    {!reportActionMatch && (
                                      <p className={`text-[11px] ${isDark ? 'text-gray-100' : 'text-gray-800'} font-bold leading-relaxed flex items-start gap-2`}>
                                        <span className="text-indigo-500 mt-1 opacity-80 shrink-0">›</span>
                                        <span>{log}</span>
                                      </p>
                                    )}
                                    {reportActionMatch && (
                                      <div
                                        onClick={async () => {
                                          const [_, reportId] = reportActionMatch;
                                          const insight = await testApi.getInsight(activeProject.id, reportId);
                                          if (insight) {
                                            setLatestInsight(insight);
                                            setShowInsightModal(true);
                                          }
                                        }}
                                        className="flex items-center gap-2 py-2 text-indigo-600 dark:text-indigo-400 text-[11px] font-black hover:underline cursor-pointer group/link transition-all"
                                      >
                                        <FileText className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        <span>View Generated Insight Report</span>
                                        <ChevronRight className="w-3 h-3 translate-x-0 group-hover:translate-x-1 transition-transform" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </section>




        {/* FOOTER: Quick Links */}
        <footer className={`px-10 py-4 border-t ${borderClass} flex items-center justify-center gap-12 transition-colors shrink-0`}>
          {[
            { label: 'Test Agent', icon: Sparkles, hoverClass: 'group-hover:text-indigo-500', view: ViewMode.AI_EXPLORATION },
            { label: 'Test Step Flow', icon: List, hoverClass: 'group-hover:text-sky-500', view: ViewMode.STEP_RUNNER },
            { label: 'Test Result', icon: BarChart3, hoverClass: 'group-hover:text-lime-500', view: ViewMode.HISTORY, tab: 'dashboard' },
            { label: 'Test Schedule', icon: CalendarClock, hoverClass: 'group-hover:text-teal-500', view: ViewMode.SCHEDULES },
            { label: 'Knowledge Base', icon: BookOpen, hoverClass: 'group-hover:text-amber-500', view: ViewMode.KNOWLEDGE_REPO }
          ].map(l => (
            <button
              key={l.label}
              onClick={() => onViewChange(l.view as ViewMode, l.tab)}
              className="flex items-center gap-2 group hover:scale-105 transition-all active:scale-95"
            >
              <l.icon className={`w-3.5 h-3.5 ${isDark ? 'text-gray-600 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-700'} transition-colors ${l.hoverClass}`} />
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-gray-600 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-700'} transition-colors`}>{l.label}</span>
            </button>
          ))}
        </footer>
      </div>

      {showInsightModal && latestInsight && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 sm:p-12 animate-in fade-in duration-300 print:p-0 print:static print:block print:bg-white">
          <style>
            {`
                @media print {
                   #root { display: none !important; }
                   body { background: white !important; overflow: visible !important; height: auto !important; }
                   html, body { width: 100%; margin: 0; padding: 0; }
                   h1, h2, h3, p, li { page-break-inside: avoid; }
                   a { text-decoration: none; color: black; }
                }
             `}
          </style>

          <div className="absolute inset-0 bg-black/50 dark:bg-black/90 backdrop-blur-xl print:hidden transition-colors" onClick={() => setShowInsightModal(false)} />
          <div className="relative w-full max-w-5xl h-full max-h-[90vh] bg-[#fdfdfd] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 text-gray-900 border-[12px] border-gray-200/50 dark:border-white/10 print:border-none print:shadow-none print:w-full print:max-w-none print:h-auto print:max-h-none print:rounded-none print:overflow-visible transition-colors">
            <button onClick={() => setShowInsightModal(false)} className="absolute top-8 right-8 p-3 bg-gray-900 text-white rounded-2xl z-[200] hover:bg-gray-800 transition-colors print:hidden"><X className="w-4 h-4" /></button>
            <div className="flex-1 overflow-auto p-12 custom-scrollbar print:overflow-visible print:h-auto print:p-0">
              <div className="flex items-center justify-between mb-8 print:hidden">
                <h1 className="text-3xl font-black text-gray-900">Executive Intelligence Report</h1>
                <div className="flex gap-3">
                  <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/20">
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              </div>

              <div className="prose prose-lg max-w-none text-gray-700 bg-white p-10 rounded-xl border border-gray-200 shadow-sm print:shadow-none print:border-none print:p-0 print:prose-sm">
                <div className="hidden print:block mb-8 border-b-2 border-indigo-600 pb-4">
                  <h1 className="text-3xl font-black text-gray-900">Executive QA Intelligence Report</h1>
                  <p className="text-gray-500 mt-2 text-sm">Generated by Q-ONE AI Engine • {activeProject.name}</p>
                </div>
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => <h1 className="text-2xl font-black text-indigo-900 mb-6 border-b pb-4 border-indigo-100 print:text-xl print:mb-4" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4 flex items-center gap-2 before:content-[''] before:w-1.5 before:h-6 before:bg-indigo-500 before:rounded-full before:mr-2 print:page-break-after-avoid print:text-lg" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-lg font-bold text-gray-800 mt-6 mb-3 print:page-break-after-avoid print:text-base" {...props} />,
                    strong: ({ node, ...props }) => <span className="font-extrabold text-indigo-700 bg-indigo-50 px-1 rounded print:bg-transparent print:text-black print:font-bold" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-2 mb-6 text-sm" {...props} />,
                    li: ({ node, ...props }) => <li className="text-gray-700 leading-relaxed pl-1" {...props} />
                  }}
                >
                  {latestInsight.content_markdown || "> **No valid content available.**"}
                </ReactMarkdown>
              </div>

              <div className="mt-12 pt-8 border-t border-gray-200 flex justify-between text-xs text-gray-400 font-mono print:fixed print:bottom-4 print:left-8 print:right-8">
                <span>Generated by Q-ONE AI Engine</span>
                <span>{latestInsight.created_at ? new Date(latestInsight.created_at).toLocaleString() : new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {drawerItem && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerItem(null)} />
          <div className={`relative w-[500px] h-full ${isDark ? 'bg-[#11141d]' : 'bg-white'} border-l ${borderClass} shadow-2xl animate-in slide-in-from-right p-12 flex flex-col`}>
            <div className="flex justify-between mb-12">
              <span className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.3em]">Decision Review</span>
              <button onClick={() => setDrawerItem(null)}><X className="w-8 h-8 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-10 custom-scrollbar pr-2">
              <div>
                <h2 className="text-3xl font-black mb-4">{drawerItem.title}</h2>
                <div className={`p-6 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${borderClass} mb-6`}>
                  <p className="text-sm leading-relaxed opacity-80">{drawerItem.description}</p>
                </div>

                {drawerItem.type === 'HEALING' || drawerItem.type === 'JIRA' ? (
                  <button
                    onClick={async () => {
                      setIsFetchingDetail(true);
                      try {
                        const detail = await testApi.getHistoryDetail(drawerItem.id);
                        if (drawerItem.type === 'JIRA') {
                          setSelectedJiraItem(detail);
                        } else {
                          setSelectedHealingItem(detail);
                        }
                        setDrawerItem(null);
                      } catch (e) {
                        onAlert('Error', 'Failed to fetch detail information.', 'error');
                      } finally {
                        setIsFetchingDetail(false);
                      }
                    }}
                    disabled={isFetchingDetail}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2"
                  >
                    {isFetchingDetail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    Review Detailed {drawerItem.type === 'JIRA' ? 'Defect' : 'Analysis'}
                  </button>
                ) : (
                  <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">AI Suggestion</span>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-400 font-medium leading-relaxed">
                      This scenario has been generated based on your requirements. Review the steps and approve to register it as a gold standard test asset.
                    </p>
                  </div>
                )}
              </div>
            </div>
            {drawerItem.type === 'GENERATOR' && (
              <div className="pt-12 flex gap-4">
                <button onClick={async () => {
                  if (!drawerItem) return;
                  try {
                    const scenariosApi = await import('../api/scenarios').then(m => m.scenariosApi);
                    await scenariosApi.update(drawerItem.id, { is_approved: true });
                    onAlert('Success', 'Scenario has been approved and registered as an asset.', 'success');
                    setApprovals(prev => prev.filter(a => a.id !== drawerItem.id));
                    setDrawerItem(null);
                    fetchData();
                  } catch (e) {
                    onAlert('Error', 'Failed to process the requested action.', 'error');
                  }
                }} className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[24px] font-black uppercase text-xs transition-all shadow-xl shadow-indigo-600/30">Approve & Execute</button>
                <button onClick={() => setDrawerItem(null)} className="px-10 py-5 bg-white/5 text-gray-400 rounded-[24px] font-black uppercase text-xs">Dismiss</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Decision Specialized Modals */}
      {selectedJiraItem && (
        <JiraSyncModal
          targetItem={selectedJiraItem}
          onClose={() => setSelectedJiraItem(null)}
          onSuccess={() => {
            onAlert('Success', 'Defect ticket has been synced with Jira.', 'success');
            setApprovals(prev => prev.filter(a => a.id !== selectedJiraItem.id));
            fetchData();
          }}
        />
      )}

      {selectedHealingItem && (
        <HealingAnalysisModal
          targetItem={selectedHealingItem}
          onClose={() => setSelectedHealingItem(null)}
          onSuccess={() => {
            onAlert('Mission Hand-off', 'Self-healing process started. Check progress in Defect Management.', 'success');
            setApprovals(prev => prev.filter(a => a.id !== selectedHealingItem.id));
            fetchData();
          }}
        />
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.2); border-radius: 10px; }
        .animate-shimmer { animation: shimmer 2s infinite; }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </div>
  );
};

export default MainConsole;
