import React, { useState, useEffect } from 'react';
import { Play, Plus, Trash2, Command, Save, PlayCircle, Upload, FileSpreadsheet, FolderPlus, X, AlertTriangle, PanelLeftClose, PanelLeftOpen, Search as SearchIcon, MousePointer2, Video, VideoOff, Target, RefreshCw, FileText, Zap, CheckCircle2, Info, Activity, Globe, Code2, ChevronRight } from 'lucide-react';
import { Project, TestObject, TestAction } from '../types';
import * as XLSX from 'xlsx';
import api from '../api/client';
import { assetsApi } from '../api/assets';
import { testApi } from '../api/test';
import { inspectorApi } from '../api/inspector';
import StepAssetList from './StepAssetList';
import ObjectRegistrationModal from '@/components/ObjectRegistrationModal';
import LiveExecutionModal from './LiveExecutionModal';

interface StepRunnerViewProps {
    activeProject: Project;
}

interface TestStep {
    id: string;
    action: string;
    selectorType: string;
    selectorValue: string;
    option?: string;
    // Extended fields for App Mode
    stepName?: string;
    description?: string;
    mandatory?: boolean;
    skipOnError?: boolean;
    screenshot?: boolean;
    sleep?: number;
    // Legacy Import Support
    visible_if_type?: string;
    visible_if?: string;
    true_jump_no?: number;
    false_jump_no?: number;
    platform?: string;
}

const StepRunnerView: React.FC<StepRunnerViewProps> = ({ activeProject }) => {
    const [activeTab, setActiveTab] = useState<'WEB' | 'APP'>('WEB');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [assetName, setAssetName] = useState('');
    const [assetDescription, setAssetDescription] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(0); // To reload list after save
    const [viewingAsset, setViewingAsset] = useState<any>(null); // For detail view
    const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Object Registration State
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [pendingObjectData, setPendingObjectData] = useState({ name: '', selectorType: 'XPATH', selectorValue: '', platform: 'WEB' as 'WEB' | 'APP' });

    const handleInspectorClick = async (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isInspectorOpen || !screenshot) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x_rel = e.clientX - rect.left;
        const y_rel = e.clientY - rect.top;

        // Scale to device logical resolution (from Appium)
        const x = Math.round((x_rel / rect.width) * hardwareResolution.width);
        const y = Math.round((y_rel / rect.height) * hardwareResolution.height);

        try {
            // NOTE: Backend identify API expects raw display-relative coordinates (x_rel, y_rel) 
            // and the current display size (rect.width, rect.height).
            // It maps them to the appropriate XML/DOM space internally.
            const res = await inspectorApi.identify(x_rel, y_rel, rect.width, rect.height, activeTab);
            if (res.success) {
                setHighlightBounds(res.bounds);
                setLastIdentifiedElement(res);

                if (res.line_number) {
                    setCurrentLine(res.line_number);
                    setTimeout(() => scrollToLine(res.line_number), 100);
                }

                if (inspectionTarget !== null) {
                    // Update specific step (Selective Re-Inspection)
                    updateStep(inspectionTarget, {
                        selectorType: activeTab === 'WEB' ? res.selector_type.toLowerCase() : res.selector_type.toUpperCase(),
                        selectorValue: res.selector_value
                    });
                    setInspectionTarget(null);
                    setNotification({ type: 'success', message: 'Step updated successfully' });
                } else if (appInspectorMode === 'RECORD' || appInspectorMode === 'NAVIGATE') {
                    // Create step data for action
                    let newStep: TestStep | null = null;

                    if (recordMode === 'CLICK') {
                        newStep = {
                            id: String(steps.length + stagedSteps.length + 1),
                            stepName: `Click: ${res.name}`,
                            description: `Recorded click on ${res.name}`,
                            action: 'click',
                            selectorType: activeTab === 'WEB' ? res.selector_type.toLowerCase() : res.selector_type.toUpperCase(),
                            selectorValue: res.selector_value,
                            mandatory: true,
                            screenshot: true,
                            sleep: 1,
                            platform: activeTab
                        };
                    } else if (recordMode === 'TAP') {
                        newStep = {
                            id: String(steps.length + stagedSteps.length + 1),
                            stepName: `Tap: (${x}, ${y})`,
                            description: `Recorded coordinate tap at (${x}, ${y})`,
                            action: 'tap',
                            option: `${x},${y}`,
                            selectorType: 'xpath',
                            selectorValue: '//body',
                            mandatory: true,
                            screenshot: true,
                            sleep: 1,
                            platform: activeTab
                        };
                    } else if (recordMode === 'SWIPE') {
                        if (!swipeStart) {
                            setSwipeStart({ x, y });
                            setNotification({ type: 'info', message: 'Swipe Start recorded. Click Swipe End point.' });
                            return; // Wait for second click
                        } else {
                            newStep = {
                                id: String(steps.length + stagedSteps.length + 1),
                                stepName: `Swipe Action`,
                                description: `Recorded swipe from (${swipeStart.x}, ${swipeStart.y}) to (${x}, ${y})`,
                                action: 'swipe',
                                option: `${swipeStart.x},${swipeStart.y},${x},${y},800`,
                                selectorType: 'xpath',
                                selectorValue: '//body',
                                mandatory: true,
                                screenshot: true,
                                sleep: 1,
                                platform: activeTab
                            };
                            setSwipeStart(null);
                        }
                    } else if (recordMode === 'INPUT') {
                        setInspectorInputPendingRes(res);
                        setInspectorInputText('');
                        setShowInspectorInputModal(true);
                        return; // Handle in modal
                    }

                    if (newStep) {
                        if (appInspectorMode === 'RECORD') {
                            setPendingStep(newStep);
                        } else if (appInspectorMode === 'NAVIGATE') {
                            // In non-recording mode, just perform action to navigate
                            const resAct = await inspectorApi.performAction(newStep);
                            if (!resAct.success && isInspectorOpen) {
                                setNotification({ type: 'error', message: `Action failed: ${resAct.error}` });
                            }
                            setTimeout(refreshScreenshot, 1000);
                        }
                    }
                } else if (appInspectorMode === 'INSPECT') {
                    // Suggest Registration if not in library
                    const exists = availableObjects.some(obj => obj.value === res.selector_value);
                    if (!exists) {
                        setPendingObjectData({
                            name: res.name.toLowerCase().replace(/\s+/g, '_'),
                            selectorType: activeTab === 'WEB' ? res.selector_type.toLowerCase() : res.selector_type.toUpperCase(),
                            selectorValue: res.selector_value,
                            platform: activeTab
                        });
                        setIsRegisterModalOpen(true);
                    } else {
                        setNotification({ type: 'info', message: 'Element already exists in Object Repository.' });
                    }
                }
            }
        } catch (err) {
            console.error("Identification failed", err);
        }
    };

    // Test Objects & Actions Integration
    const [availableObjects, setAvailableObjects] = useState<TestObject[]>([]);
    const [availableActions, setAvailableActions] = useState<TestAction[]>([]);

    useEffect(() => {
        if (activeProject?.id) {
            assetsApi.getObjects(activeProject.id, activeTab)
                .then(setAvailableObjects)
                .catch(err => console.error("Failed to load test objects", err));

            assetsApi.getActions(activeProject.id, activeTab)
                .then(setAvailableActions)
                .catch(err => console.error("Failed to load test actions", err));
        }
    }, [activeProject?.id, activeTab]);

    // Notification & Confirmation States
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
    const [confirmation, setConfirmation] = useState<{ message: string, detail?: string, onConfirm: () => void, confirmText: string } | null>(null);

    // Separate state for each context
    const [webSteps, setWebSteps] = useState<TestStep[]>([
        { id: '1', action: 'find', selectorType: 'id', selectorValue: '', option: '' }
    ]);
    const [appSteps, setAppSteps] = useState<TestStep[]>([
        { id: '1', action: 'find', selectorType: 'xpath', selectorValue: '', option: '' }
    ]);

    // Inspector & Recording State
    const [isInspectorOpen, setIsInspectorOpen] = useState(false);
    const [appInspectorMode, setAppInspectorMode] = useState<'NAVIGATE' | 'RECORD' | 'INSPECT'>('NAVIGATE');
    const [isRecording, setIsRecording] = useState(false);
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [inspectionTarget, setInspectionTarget] = useState<number | null>(null); // Index of step being re-inspected
    const [lastRecordingStep, setLastRecordingStep] = useState<string | null>(null);
    const [isRefreshingScreenshot, setIsRefreshingScreenshot] = useState(false);
    const [availableDevices, setAvailableDevices] = useState<any[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [targetUrl, setTargetUrl] = useState<string>('');
    const [xmlSource, setXmlSource] = useState<string>('');
    const [stagedSteps, setStagedSteps] = useState<any[]>([]);
    const [inspectorTab, setInspectorTab] = useState<'VIEW' | 'SOURCE'>('VIEW');
    const [recordMode, setRecordMode] = useState<'CLICK' | 'TAP' | 'SWIPE' | 'INPUT'>('CLICK');
    const [swipeStart, setSwipeStart] = useState<{ x: number, y: number } | null>(null);
    const [highlightBounds, setHighlightBounds] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
    const [lastIdentifiedElement, setLastIdentifiedElement] = useState<any>(null);
    const [hardwareResolution, setHardwareResolution] = useState<{ width: number, height: number }>({ width: 1080, height: 1920 });
    const [pendingStep, setPendingStep] = useState<TestStep | null>(null);
    const [availableContexts, setAvailableContexts] = useState<string[]>([]);
    const [currentContext, setCurrentContext] = useState<string>('NATIVE_APP');
    const [xmlViewerRef] = useState<React.RefObject<HTMLDivElement>>(React.createRef());
    const [imageAspectRatio, setImageAspectRatio] = useState<number>(9 / 16);
    const [imageDimensions, setImageDimensions] = useState<{ width: number, height: number } | null>(null);
    const [currentLine, setCurrentLine] = useState<number | null>(null);

    // Custom Input Modal State for Inspector
    const [showInspectorInputModal, setShowInspectorInputModal] = useState(false);
    const [inspectorInputText, setInspectorInputText] = useState('');
    const [inspectorInputPendingRes, setInspectorInputPendingRes] = useState<any>(null);

    const handleInspectorInputConfirm = async () => {
        if (!inspectorInputPendingRes) return;

        const val = inspectorInputText;
        const res = inspectorInputPendingRes;

        const newStep: TestStep = {
            id: String(steps.length + stagedSteps.length + 1),
            stepName: `Input: ${val}`,
            description: `Recorded input on ${res.name}`,
            action: 'send_keys',
            option: val,
            selectorType: activeTab === 'WEB' ? res.selector_type.toLowerCase() : res.selector_type.toUpperCase(),
            selectorValue: res.selector_value,
            mandatory: true,
            screenshot: true,
            sleep: 1,
            platform: activeTab
        };

        if (isRecording) {
            setPendingStep(newStep);
        } else {
            const resAct = await inspectorApi.performAction(newStep);
            if (!resAct.success && isInspectorOpen) {
                setNotification({ type: 'error', message: `Action failed: ${resAct.error}` });
            }
            setTimeout(refreshScreenshot, 1500);
        }

        setShowInspectorInputModal(false);
        setInspectorInputPendingRes(null);
        setInspectorInputText('');
    };

    useEffect(() => {
        let interval: any;
        if (isInspectorOpen && activeTab === 'APP') {
            if (isConnected) {
                refreshScreenshot();
                interval = setInterval(refreshScreenshot, 5000);
            } else {
                fetchDevices();
            }
        }
        return () => clearInterval(interval);
    }, [isInspectorOpen, activeTab, isConnected]);

    // Safety cleanup: disconnect session on page refresh/close
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isConnected) {
                // Synchronous beacon or just fire and forget
                // client-side we can't await here easily, but we can try navigator.sendBeacon
                // Or just trust that the backend will timeout eventually, 
                // but for better UX we try to call it.
                inspectorApi.disconnect();
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isConnected]);

    const fetchDevices = async () => {
        try {
            const res = await inspectorApi.getDevices();
            if (res.success) {
                setAvailableDevices(res.devices);
                if (res.devices.length > 0 && !selectedDeviceId) {
                    setSelectedDeviceId(res.devices[0].id);
                }
            }
        } catch (err) {
            console.error("Failed to fetch devices", err);
        }
    };

    const handleConnect = async () => {
        if (!selectedDeviceId) return;
        setIsConnecting(true);
        try {
            const res = await inspectorApi.connect(selectedDeviceId, activeProject.id, 'Android');
            if (res.success) {
                setIsConnected(true);
                if (res.window_size) {
                    setHardwareResolution({ width: res.window_size.width, height: res.window_size.height });
                }
                setNotification({ type: 'success', message: "Hardware connected successfully!" });
                refreshScreenshot();
            } else {
                setNotification({ type: 'error', message: res.error || "Failed to connect to device." });
            }
        } catch (err) {
            console.error("Connection failed", err);
            setNotification({ type: 'error', message: "Failed to connect to device station." });
        } finally {
            setIsConnecting(false);
        }
    };

    const handleWebConnect = async () => {
        if (!targetUrl) return;
        setIsConnecting(true);
        try {
            const res = await inspectorApi.connectWeb(targetUrl);
            if (res.success) {
                setIsConnected(true);
                if (res.window_size) {
                    setHardwareResolution({ width: res.window_size.width, height: res.window_size.height });
                }
                setNotification({ type: 'success', message: "Browser connected successfully!" });
                refreshScreenshot();
            } else {
                setNotification({ type: 'error', message: res.error || "Failed to connect to browser." });
            }
        } catch (err) {
            console.error("Web connection failed", err);
            setNotification({ type: 'error', message: "Failed to initialize web session." });
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        setIsConnected(false);
        setScreenshot(null);
        setXmlSource('');
        setStagedSteps([]);
        setPendingStep(null);
        setHighlightBounds(null);
        setLastIdentifiedElement(null);
        setCurrentLine(null);

        try {
            await inspectorApi.disconnect();
        } catch (err) {
            console.error("Failed to disconnect", err);
        }
    };

    const toggleInspector = () => {
        if (isInspectorOpen) {
            handleDisconnect();
            setIsInspectorOpen(false);
        } else {
            setIsInspectorOpen(true);
        }
    };

    const scrollToLine = (lineNo: number) => {
        if (!xmlViewerRef.current) return;
        const container = xmlViewerRef.current;
        const pre = container.querySelector('pre');
        if (!pre) return;

        const lines = pre.innerText.split('\n');
        const lineHeight = pre.scrollHeight / lines.length;
        container.scrollTo({
            top: (lineNo - 1) * lineHeight - (container.clientHeight / 3),
            behavior: 'smooth'
        });
    };

    const handleSwitchContext = async (ctx: string) => {
        try {
            const res = await inspectorApi.switchContext(ctx);
            if (res.success) {
                setCurrentContext(ctx);
                setNotification({ type: 'success', message: `Switched to ${ctx}` });
                refreshScreenshot();
            } else {
                setNotification({ type: 'error', message: res.error });
            }
        } catch (err) {
            console.error("Context switch failed", err);
        }
    };

    const refreshScreenshot = async () => {
        if (isRefreshingScreenshot) return;
        setIsRefreshingScreenshot(true);
        try {
            const [scrRes, srcRes, ctxRes] = await Promise.all([
                inspectorApi.getScreenshot(activeTab),
                inspectorApi.getSource(activeTab),
                activeTab === 'APP' ? inspectorApi.getContexts() : Promise.resolve({ success: false })
            ]);

            if (scrRes.success) setScreenshot(scrRes.data);
            if (srcRes.success) {
                setXmlSource(srcRes.data);
                // Clear highlight on refresh as the UI state changed
                setHighlightBounds(null);
            }
            if (ctxRes.success) {
                setAvailableContexts(ctxRes.contexts);
                // Current context is usually the first one or we can assume it's set
            }
        } catch (err) {
            console.error("Screenshot/Source failed", err);
        } finally {
            setIsRefreshingScreenshot(false);
        }
    };

    const handleRecordToggle = async () => {
        if (isRecording) {
            // Stop recording
            setIsRecording(false);
            setLastRecordingStep(null);
            setNotification({ type: 'info', message: "Recording stopped." });
        } else {
            // Start recording
            setIsRecording(true);
            setIsInspectorOpen(true); // Ensure inspector is open when recording
            setNotification({ type: 'info', message: "Recording started. Click elements on the device screenshot to add steps." });
        }
    };

    const steps = activeTab === 'WEB' ? webSteps : appSteps;
    const setSteps = (newSteps: TestStep[]) => {
        if (activeTab === 'WEB') setWebSteps(newSteps);
        else setAppSteps(newSteps);
    };

    const addStep = () => {
        setSteps([
            ...steps,
            { id: (steps.length + 1).toString(), action: '', selectorType: 'id', selectorValue: '', option: '' }
        ]);
    };

    const removeStep = (index: number) => {
        const newSteps = steps.filter((_, i) => i !== index);
        setSteps(newSteps);
    };

    const updateStep = (index: number, updates: Partial<TestStep>) => {
        const newSteps = [...steps];
        newSteps[index] = { ...newSteps[index], ...updates };
        setSteps(newSteps);
    };

    const handleRun = async () => {
        if (steps.length === 0) {
            setNotification({ type: 'info', message: 'No steps to run.' });
            return;
        }

        try {
            // Filter out empty rows (though staging usually ensures valid steps)
            const validSteps = steps.filter(s => s.action);

            if (activeTab === 'APP') {
                const response = await api.post<{ run_id: string }>('/run/active-steps', {
                    steps: validSteps,
                    project_id: activeProject.id,
                    platform: 'APP'
                });
                setActiveRunId(response.data.run_id);
            } else {
                const response = await api.post<{ run_id: string }>('/run/active-steps', {
                    steps: validSteps,
                    project_id: activeProject.id,
                    platform: 'WEB'
                });
                setActiveRunId(response.data.run_id);
            }
        } catch (err: any) {
            console.error("Failed to start run", err);
            setNotification({ type: 'error', message: `Failed to start execution: ${err.message || 'Unknown error'}` });
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset file input value so same file can be selected again if needed
        e.target.value = '';

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
                let headerRowIndex = -1;
                let headers: string[] = [];

                for (let i = 0; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (row && row.some(cell => typeof cell === 'string' && (cell.includes('Step Name') || cell.includes('Step ID') || cell.includes('Action')))) {
                        headerRowIndex = i;
                        headers = row.map(cell => String(cell));
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    setNotification({ type: 'error', message: "Could not find a valid header row containing 'Step Name' or 'Step ID'." });
                    return;
                }

                const dataRows = rawData.slice(headerRowIndex + 1);
                const validDataRows = dataRows.filter(row => {
                    if (!row || !Array.isArray(row) || row.length === 0) return false;
                    return row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
                });

                const data = validDataRows.map(row => {
                    const obj: any = {};
                    headers.forEach((header, index) => {
                        obj[header] = row[index];
                    });
                    return obj;
                });

                const getValue = (row: any, ...keys: string[]) => {
                    const rowKeys = Object.keys(row);
                    for (const key of keys) {
                        if (row[key] !== undefined) return row[key];
                        const foundKey = rowKeys.find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
                        if (foundKey && row[foundKey] !== undefined) return row[foundKey];
                        const distinctKey = rowKeys.find(k => k.replace(/[_\s]/g, '').toLowerCase() === key.replace(/[_\s]/g, '').toLowerCase());
                        if (distinctKey && row[distinctKey] !== undefined) return row[distinctKey];
                    }
                    return undefined;
                };

                const importedSteps: TestStep[] = data.map((row: any, idx: number) => ({
                    id: getValue(row, 'No.', 'no', 'id') ? String(getValue(row, 'No.', 'no', 'id')) : (idx + 1).toString(),
                    stepName: getValue(row, 'Step Name', 'StepName', 'step_name') || '',
                    description: getValue(row, 'Step Description', 'StepDescription', 'step_description', 'Description') || '',
                    action: getValue(row, 'action', 'Action') || 'find',
                    selectorType: getValue(row, 'Locator_by', 'LocatorBy', 'locator_by', 'locator type') || '',
                    selectorValue: getValue(row, 'Locator_value', 'LocatorValue', 'locator_value', 'locator') || '',
                    option: getValue(row, 'input_text', 'Input', 'option') ? String(getValue(row, 'input_text', 'Input', 'option')) : '',
                    mandatory: getValue(row, 'mandatory', 'Mandatory') === 'Y',
                    skipOnError: getValue(row, 'skip_on_error', 'SkipOnError', 'skip_error') === 'Y',
                    screenshot: getValue(row, 'screenshot', 'Screenshot') === 'Y',
                    sleep: typeof getValue(row, 'sleep', 'Sleep') === 'number' ? getValue(row, 'sleep', 'Sleep') : 0,
                    visible_if_type: getValue(row, 'visible_if_type', 'visibleIfType', 'Visible If Type') || '',
                    visible_if: getValue(row, 'visible_if', 'visibleIf', 'Visible If') || '',
                    true_jump_no: !isNaN(parseInt(getValue(row, 'true_jump_no', 'trueJumpNo', 'T-Jump', 'true_jump'))) ? parseInt(getValue(row, 'true_jump_no', 'trueJumpNo', 'T-Jump', 'true_jump')) : undefined,
                    false_jump_no: !isNaN(parseInt(getValue(row, 'false_jump_no', 'falseJumpNo', 'F-Jump', 'false_jump'))) ? parseInt(getValue(row, 'false_jump_no', 'falseJumpNo', 'F-Jump', 'false_jump')) : undefined,
                }));

                if (activeTab === 'APP') {
                    setAppSteps(importedSteps);
                } else {
                    setWebSteps(importedSteps);
                }
                setNotification({ type: 'success', message: `Successfully imported ${importedSteps.length} steps.` });
            } catch (err) {
                console.error("Import Error:", err);
                setNotification({ type: 'error', message: "Failed to parse Excel file. Please check the format." });
            }
        };
        reader.readAsBinaryString(file);
    };

    const getPayload = () => ({
        name: assetName,
        description: assetDescription,
        platform: activeTab,
        origin: 'STEP',
        project_id: activeProject.id,
        code: '',
        engine: activeTab === 'APP' ? 'Appium' : 'Playwright',
        status: 'CERTIFIED',
        steps: steps.map((s, idx) => ({
            step_number: idx + 1,
            action: s.action || '',
            selector_type: s.selectorType,
            selector_value: s.selectorValue,
            option: s.option || '',
            step_name: s.stepName,
            description: s.description,
            mandatory: s.mandatory || false,
            skip_on_error: s.skipOnError || false,
            screenshot: s.screenshot || false,
            sleep: s.sleep || 0,
            visible_if_type: s.visible_if_type,
            visible_if: s.visible_if,
            true_jump_no: s.true_jump_no,
            false_jump_no: s.false_jump_no
        }))
    });

    const handleSaveClick = () => {
        if (activeAssetId) {
            // Modify Mode
            setConfirmation({
                message: "Do you want to modify the current asset?",
                detail: "This will overwrite the existing saved steps.",
                confirmText: "Save (Update)",
                onConfirm: handleUpdateAsset
            });
        } else {
            // New Save Mode
            setShowSaveModal(true);
        }
    };

    const handleUpdateAsset = async () => {
        try {
            const payload = getPayload();
            // Reuse name/desc from state if possible, or they might be empty if we didn't store them on load.
            // But payload must have name. If we loaded data, we should have populated assetName.
            // If assetName is empty (edge case), we might want to ask user, but let's assume it's set on load.

            await api.put(`/scripts/${activeAssetId}`, payload);

            resetAfterSave();
            setNotification({ type: 'success', message: "Asset updated successfully!" });
            setConfirmation(null);
        } catch (error) {
            console.error("Update failed", error);
            setNotification({ type: 'error', message: "Failed to update asset." });
        }
    };

    const handleCreateAsset = async () => {
        if (!assetName) {
            setNotification({ type: 'error', message: "Please enter a name for this step asset." });
            return;
        }

        try {
            const payload = getPayload();
            await api.post(`/scripts/?project_id=${activeProject.id}`, payload);

            setShowSaveModal(false);
            resetAfterSave();
            setNotification({ type: 'success', message: "Asset saved successfully!" });
        } catch (error) {
            console.error("Save failed", error);
            setNotification({ type: 'error', message: "Failed to save steps." });
        }
    };

    const resetAfterSave = () => {
        // Clear screen
        const emptyStep = { id: '1', action: '', selectorType: 'id', selectorValue: '', option: '' };
        if (activeTab === 'APP') setAppSteps([emptyStep]);
        else setWebSteps([emptyStep]);
        setActiveAssetId(null);
        setAssetName('');
        setAssetDescription('');
        setRefreshTrigger(prev => prev + 1);
    };

    const handleLoadAsset = async (assetId: string) => {
        try {
            const response = await api.get(`/scripts/${assetId}`);
            const asset = response.data;

            // Map DB steps back to UI steps
            const loadedSteps: TestStep[] = asset.steps.map((s: any) => ({
                id: String(s.step_number),
                action: s.action,
                selectorType: s.selector_type,
                selectorValue: s.selector_value,
                option: s.option,
                stepName: s.step_name,
                description: s.description,
                mandatory: s.mandatory,
                skipOnError: s.skip_on_error,
                screenshot: s.screenshot,
                sleep: s.sleep,
                visible_if_type: s.visible_if_type,
                visible_if: s.visible_if,
                true_jump_no: s.true_jump_no,
                false_jump_no: s.false_jump_no
            }));

            if (asset.platform === 'APP') {
                setAppSteps(loadedSteps);
                setActiveTab('APP');
            } else {
                setWebSteps(loadedSteps);
                setActiveTab('WEB');
            }
            setActiveAssetId(asset.id);
            // Load metadata for potential update
            setAssetName(asset.name);
            setAssetDescription(asset.description || '');

        } catch (err) {
            console.error("Load failed", err);
            setNotification({ type: 'error', message: "Failed to load asset." });
        }
    };

    const handleClear = () => {
        setConfirmation({
            message: "Start a new session?",
            detail: "Unsaved steps will be lost.",
            confirmText: "Clear & New",
            onConfirm: () => {
                const emptyStep = { id: '1', action: '', selectorType: 'id', selectorValue: '', option: '' };
                if (activeTab === 'APP') setAppSteps([emptyStep]);
                else setWebSteps([emptyStep]);
                setActiveAssetId(null);
                setAssetName('');
                setAssetDescription('');
                setConfirmation(null);
            }
        });
    };

    return (
        <div className="flex h-full bg-gray-50 dark:bg-[#0f1115] text-gray-900 dark:text-gray-200 transition-colors duration-300">

            {/* Sidebar: Step Asset List */}
            {isSidebarOpen && (
                <StepAssetList
                    project={activeProject}
                    activeTab={activeTab}
                    onSelectAsset={handleLoadAsset}
                    refreshTrigger={refreshTrigger}
                    setConfirmation={setConfirmation}
                />
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full min-w-0">
                {/* Top Tabs & Actions */}
                <div className="flex items-center justify-between px-8 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#16191f] transition-colors">
                    {/* Tabs */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                            title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
                        >
                            {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
                        </button>
                        <div className="flex">
                            <button
                                onClick={() => setActiveTab('WEB')}
                                className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'WEB' ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                Web Browser
                            </button>
                            <button
                                onClick={() => setActiveTab('APP')}
                                className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'APP' ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                Mobile App
                            </button>
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex gap-3 py-2 items-center">
                        <button
                            onClick={handleClear}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-xl text-xs font-bold transition-all"
                            title="New Session"
                        >
                            <FolderPlus className="w-4 h-4" /> New
                        </button>
                        {activeTab === 'APP' && (
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                                    <Upload className="w-4 h-4" /> Import Excel
                                </button>
                            </div>
                        )}
                        <button
                            onClick={toggleInspector}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isInspectorOpen ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                            title="Toggle Inspector"
                        >
                            <MousePointer2 className="w-4 h-4" /> Inspector
                        </button>
                        <button
                            onClick={handleSaveClick}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-gray-500 dark:text-gray-400"
                        >
                            <Save className="w-4 h-4" /> Save
                        </button>
                        <button
                            onClick={handleRun}
                            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all"
                        >
                            <PlayCircle className="w-4 h-4" /> Run {activeTab}
                        </button>
                    </div>
                </div>


                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className={`mx-auto ${activeTab === 'APP' ? 'max-w-full' : 'max-w-6xl'}`}>
                        <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-2xl transition-colors">
                            {/* Table Header */}
                            {activeTab === 'WEB' ? (
                                // Web Mode Header (Matched to App Mode)
                                <div className="grid grid-cols-[50px_1fr_100px_2.5fr_100px_200px_50px] gap-4 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest items-center transition-colors">
                                    <div className="text-center">No.</div>
                                    <div>Step Name / Desc</div>
                                    <div>Action</div>
                                    <div>Locator (Type/Value)</div>
                                    <div>Input/Opt</div>
                                    <div>Controls (Sleep/Skip/Scr/Mnd)</div>
                                    <div className="text-center">Del</div>
                                </div>
                            ) : (
                                // App Mode Extended Header
                                <div className="grid grid-cols-[50px_1fr_100px_2.5fr_100px_180px_180px_50px] gap-4 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest items-center transition-colors">
                                    <div className="text-center">No.</div>
                                    <div>Step Name / Desc</div>
                                    <div>Action</div>
                                    <div>Locator (Type/Value)</div>
                                    <div>Input/Opt</div>
                                    <div>Controls (Sleep/Skip/Scr/Mnd)</div>
                                    <div>Branch/Logic</div>
                                    <div className="text-center">Del</div>
                                </div>
                            )}

                            {/* Table Steps */}
                            <div className="divide-y divide-gray-200 dark:divide-gray-800/50">
                                {steps.length > 0 ? steps.map((step, index) => (
                                    activeTab === 'WEB' ? (
                                        // WEB ROW
                                        // WEB ROW (Unified Layout)
                                        <div key={index} className="grid grid-cols-[50px_1fr_100px_2.5fr_100px_200px_50px] gap-4 px-6 py-4 items-start hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                            <div className="text-center font-mono text-gray-500 dark:text-gray-400 text-xs pt-2">{index + 1}</div>
                                            <div className="flex flex-col gap-1">
                                                <input type="text" value={step.stepName || ''} onChange={(e) => updateStep(index, { stepName: e.target.value })} className="w-full bg-transparent border-b border-gray-200 dark:border-gray-800 focus:border-indigo-500 text-xs font-bold text-gray-900 dark:text-white outline-none pb-1 transition-colors" placeholder="Step Name" />
                                                <textarea value={step.description || ''} onChange={(e) => updateStep(index, { description: e.target.value })} className="w-full bg-white dark:bg-[#0c0e12]/50 text-[10px] text-gray-600 dark:text-gray-500 focus:text-gray-900 dark:focus:text-gray-300 outline-none resize-none h-8 rounded p-1 transition-colors border border-transparent focus:border-gray-200 dark:focus:border-gray-800" placeholder="Description" />
                                            </div>
                                            <div>
                                                <select
                                                    value={step.action}
                                                    onChange={(e) => updateStep(index, { action: e.target.value })}
                                                    className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded px-2 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase text-center focus:border-indigo-500 outline-none transition-colors"
                                                >
                                                    <option value="">Select</option>
                                                    {availableActions.map(act => (
                                                        <option key={act.id} value={act.name}>{act.name}</option>
                                                    ))}
                                                    {/* Legacy Support */}
                                                    {step.action && !availableActions.some(a => a.name === step.action) && (
                                                        <option value={step.action}>{step.action} (Legacy)</option>
                                                    )}
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <select
                                                    value={step.selectorType}
                                                    onChange={(e) => updateStep(index, { selectorType: e.target.value })}
                                                    className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded px-2 py-1 text-[10px] text-gray-900 dark:text-gray-300 text-center focus:border-indigo-500 outline-none transition-colors"
                                                >
                                                    <option value="id">ID</option>
                                                    <option value="xpath">XPath</option>
                                                    <option value="css">CSS</option>
                                                    <option value="text">Text</option>
                                                    <option value="name">Name</option>
                                                    <option value="class">Class</option>
                                                </select>
                                                <div className="relative">
                                                    <input
                                                        list={`objects-${index}`}
                                                        type="text"
                                                        value={step.selectorValue}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            const updates: Partial<TestStep> = { selectorValue: val };

                                                            // Auto-fill logic
                                                            const matched = availableObjects.find(o => o.value === val);
                                                            if (matched) {
                                                                updates.selectorType = matched.selector_type.toLowerCase();
                                                                if (!step.description) {
                                                                    updates.description = matched.name;
                                                                }
                                                                if (!step.stepName) {
                                                                    updates.stepName = matched.name;
                                                                }
                                                            }
                                                            updateStep(index, updates);
                                                        }}
                                                        className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 font-mono h-12 focus:border-indigo-500 outline-none resize-none transition-colors"
                                                        placeholder={step.selectorType === 'xpath' ? '//div[@id="..."]' : '#example'}
                                                    />
                                                    <datalist id={`objects-${index}`}>
                                                        {availableObjects.map(obj => (
                                                            <option key={obj.id} value={obj.value}>{obj.name} ({obj.selector_type})</option>
                                                        ))}
                                                    </datalist>
                                                </div>
                                            </div>
                                            <div>
                                                <input
                                                    type="text"
                                                    value={step.option || ''}
                                                    onChange={(e) => updateStep(index, { option: e.target.value })}
                                                    className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded px-2 py-1.5 text-xs text-blue-600 dark:text-blue-300 text-center focus:border-indigo-500 outline-none transition-colors"
                                                    placeholder="Val/Opt"
                                                />
                                            </div>

                                            {/* Controls Grid */}
                                            <div className="grid grid-cols-2 gap-2 text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                                                <label className="flex items-center gap-1 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"><input type="checkbox" checked={step.mandatory} onChange={(e) => updateStep(index, { mandatory: e.target.checked })} className="accent-red-500" /> Mandatory</label>
                                                <label className="flex items-center gap-1 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"><input type="checkbox" checked={step.skipOnError} onChange={(e) => updateStep(index, { skipOnError: e.target.checked })} className="accent-yellow-500" /> SkipErr</label>
                                                <label className="flex items-center gap-1 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"><input type="checkbox" checked={step.screenshot} onChange={(e) => updateStep(index, { screenshot: e.target.checked })} className="accent-blue-500" /> Screen</label>
                                                <div className="flex items-center gap-1"><span className="text-gray-600">Sleep:</span><input type="number" value={step.sleep} onChange={(e) => updateStep(index, { sleep: parseFloat(e.target.value) })} className="w-8 bg-transparent border-b border-gray-200 dark:border-gray-700 text-center text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors" />s</div>
                                            </div>

                                            <div className="col-span-1 flex justify-center pt-2">
                                                <button onClick={() => removeStep(index)} className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    ) : (
                                        // APP ROW (Extended)
                                        <div key={index} className="grid grid-cols-[50px_1fr_100px_2.5fr_100px_180px_180px_50px] gap-4 px-6 py-4 items-start hover:bg-white/5 transition-colors group">
                                            <div className="text-center font-mono text-gray-500 dark:text-gray-400 text-xs pt-2">{index + 1}</div>
                                            <div className="flex flex-col gap-1">
                                                <input type="text" value={step.stepName || ''} onChange={(e) => updateStep(index, { stepName: e.target.value })} className="w-full bg-transparent border-b border-gray-200 dark:border-gray-800 focus:border-indigo-500 text-xs font-bold text-gray-900 dark:text-white outline-none pb-1 transition-colors" placeholder="Step Name" />
                                                <textarea value={step.description || ''} onChange={(e) => updateStep(index, { description: e.target.value })} className="w-full bg-gray-50 dark:bg-[#0c0e12]/50 text-[10px] text-gray-600 dark:text-gray-500 focus:text-gray-900 dark:focus:text-gray-300 outline-none resize-none h-8 rounded p-1 transition-colors" placeholder="Description" />
                                            </div>
                                            <div>
                                                <select
                                                    value={step.action}
                                                    onChange={(e) => updateStep(index, { action: e.target.value })}
                                                    className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded px-2 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase text-center focus:border-indigo-500 outline-none transition-colors"
                                                >
                                                    <option value="">Select</option>
                                                    {availableActions.map(act => (
                                                        <option key={act.id} value={act.name}>{act.name}</option>
                                                    ))}
                                                    {/* Legacy Support */}
                                                    {step.action && !availableActions.some(a => a.name === step.action) && (
                                                        <option value={step.action}>{step.action} (Legacy)</option>
                                                    )}
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <select
                                                    value={step.selectorType}
                                                    onChange={(e) => updateStep(index, { selectorType: e.target.value })}
                                                    className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded px-2 py-1 text-[10px] text-gray-900 dark:text-gray-300 text-center focus:border-indigo-500 outline-none transition-colors"
                                                >
                                                    <option value="">-</option>
                                                    <option value="XPATH">XPATH</option>
                                                    <option value="ACCESSIBILITY_ID">ACCESSIBILITY_ID</option>
                                                    <option value="ID">ID</option>
                                                    <option value="ANDROID_UIAUTOMATOR">ANDROID_UIAUTOMATOR</option>
                                                </select>
                                                <div className="relative">
                                                    <input
                                                        list={`objects-${index}`}
                                                        type="text"
                                                        value={step.selectorValue}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            const updates: Partial<TestStep> = { selectorValue: val };

                                                            // Auto-fill logic
                                                            const matched = availableObjects.find(o => o.value === val);
                                                            if (matched) {
                                                                updates.selectorType = matched.selector_type.toUpperCase();
                                                                if (!step.description) {
                                                                    updates.description = matched.name;
                                                                }
                                                                if (!step.stepName) {
                                                                    updates.stepName = matched.name;
                                                                }
                                                            }
                                                            updateStep(index, updates);
                                                        }}
                                                        className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 font-mono h-12 focus:border-indigo-500 outline-none resize-none transition-colors"
                                                        placeholder="Locator Value"
                                                    />
                                                    <datalist id={`objects-${index}`}>
                                                        {availableObjects.map(obj => (
                                                            <option key={obj.id} value={obj.value}>{obj.name} ({obj.selector_type})</option>
                                                        ))}
                                                    </datalist>
                                                </div>
                                            </div>
                                            <div>
                                                <input type="text" value={step.option || ''} onChange={(e) => updateStep(index, { option: e.target.value })} className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded px-2 py-1.5 text-xs text-blue-600 dark:text-blue-300 text-center focus:border-indigo-500 outline-none transition-colors" placeholder="Input/Option" />
                                            </div>

                                            {/* Controls Grid */}
                                            <div className="grid grid-cols-2 gap-2 text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                                                <label className="flex items-center gap-1 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"><input type="checkbox" checked={step.mandatory} onChange={(e) => updateStep(index, { mandatory: e.target.checked })} className="accent-red-500" /> Mandatory</label>
                                                <label className="flex items-center gap-1 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"><input type="checkbox" checked={step.skipOnError} onChange={(e) => updateStep(index, { skipOnError: e.target.checked })} className="accent-yellow-500" /> SkipErr</label>
                                                <label className="flex items-center gap-1 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"><input type="checkbox" checked={step.screenshot} onChange={(e) => updateStep(index, { screenshot: e.target.checked })} className="accent-blue-500" /> Screen</label>
                                                <div className="flex items-center gap-1"><span className="text-gray-600">Sleep:</span><input type="number" value={step.sleep} onChange={(e) => updateStep(index, { sleep: parseFloat(e.target.value) })} className="w-8 bg-transparent border-b border-gray-200 dark:border-gray-700 text-center text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors" />s</div>
                                            </div>

                                            {/* Legacy Logic Fields */}
                                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 ">
                                                <div className="flex flex-col gap-0.5 text-left">
                                                    <label className="text-[7px] font-black text-gray-400 uppercase tracking-widest ">Visible If Type</label>
                                                    <input type="text" value={step.visible_if_type || ''} onChange={(e) => updateStep(index, { visible_if_type: e.target.value })} className="bg-transparent border-b border-gray-100 dark:border-gray-800 text-[9px] focus:border-indigo-500 outline-none pb-0.5" placeholder="e.g. text" />
                                                </div>
                                                <div className="flex flex-col gap-0.5 text-left">
                                                    <label className="text-[7px] font-black text-gray-400 uppercase tracking-widest ">Visible If</label>
                                                    <input type="text" value={step.visible_if || ''} onChange={(e) => updateStep(index, { visible_if: e.target.value })} className="bg-transparent border-b border-gray-100 dark:border-gray-800 text-[9px] focus:border-indigo-500 outline-none pb-0.5" placeholder="Condition" />
                                                </div>
                                                <div className="flex flex-col gap-0.5 text-left">
                                                    <label className="text-[7px] font-black text-gray-400 uppercase tracking-widest ">T-Jump</label>
                                                    <input type="number" value={step.true_jump_no || ''} onChange={(e) => updateStep(index, { true_jump_no: parseInt(e.target.value) || undefined })} className="bg-transparent border-b border-gray-100 dark:border-gray-800 text-[9px] focus:border-indigo-500 outline-none pb-0.5" placeholder="Step #" />
                                                </div>
                                                <div className="flex flex-col gap-0.5 text-left">
                                                    <label className="text-[7px] font-black text-gray-400 uppercase tracking-widest ">F-Jump</label>
                                                    <input type="number" value={step.false_jump_no || ''} onChange={(e) => updateStep(index, { false_jump_no: parseInt(e.target.value) || undefined })} className="bg-transparent border-b border-gray-100 dark:border-gray-800 text-[9px] focus:border-indigo-500 outline-none pb-0.5" placeholder="Step #" />
                                                </div>
                                            </div>

                                            <div className="text-center pt-2">
                                                <button onClick={() => removeStep(index)} className="text-gray-600 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    )
                                )) : (
                                    <div className="p-10 text-center text-gray-600 text-xs italic">
                                        No steps defined for {activeTab === 'WEB' ? 'Web Browser' : 'Mobile App'}. Add a step or Import Excel.
                                    </div>
                                )}
                            </div>

                            {/* Footer (Add Button) */}
                            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-800 transition-colors">
                                <button
                                    onClick={addStep}
                                    className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-xl flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-all text-xs font-black uppercase tracking-widest"
                                >
                                    <Plus className="w-4 h-4" /> Add Next Step ({activeTab})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                {/* SLIDE-OUT INSPECTOR PANEL */}
                {isInspectorOpen && (
                    <div className="fixed inset-0 z-[100] flex justify-end">
                        <div
                            className="absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm transition-colors"
                            onClick={toggleInspector}
                        />
                        <div className="relative w-full max-w-[1200px] h-full bg-white dark:bg-[#16191f] shadow-2xl flex flex-col transition-all overflow-hidden animate-in slide-in-from-right duration-300">
                            {activeTab === 'APP' ? (
                                <>
                                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/10">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                                                <MousePointer2 className="w-4 h-4" />
                                            </div>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white">App Inspector</h3>
                                            {isConnected && (
                                                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">Session Active</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isConnected && (
                                                <>
                                                    {/* App Inspector Modes */}
                                                    <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl mr-2">
                                                        <button
                                                            onClick={() => setAppInspectorMode('NAVIGATE')}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${appInspectorMode === 'NAVIGATE' ? 'bg-white dark:bg-[#16191f] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                                        >
                                                            <MousePointer2 className="w-3.5 h-3.5" /> Navigate
                                                        </button>
                                                        <button
                                                            onClick={() => setAppInspectorMode('RECORD')}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${appInspectorMode === 'RECORD' ? 'bg-white dark:bg-[#16191f] text-red-600 dark:text-red-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                                        >
                                                            <Video className="w-3.5 h-3.5" /> Record
                                                        </button>
                                                        <button
                                                            onClick={() => setAppInspectorMode('INSPECT')}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${appInspectorMode === 'INSPECT' ? 'bg-white dark:bg-[#16191f] text-amber-600 dark:text-amber-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                                        >
                                                            <Target className="w-3.5 h-3.5" /> Inspect (Repo)
                                                        </button>
                                                    </div>

                                                    <div className="bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center gap-2 px-3 py-1">
                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Context</span>
                                                        <select
                                                            value={currentContext}
                                                            onChange={(e) => handleSwitchContext(e.target.value)}
                                                            className="bg-transparent text-[10px] font-bold text-gray-600 dark:text-gray-400 outline-none min-w-[100px]"
                                                        >
                                                            {availableContexts.length > 0 ? (
                                                                availableContexts.map(ctx => (
                                                                    <option key={ctx} value={ctx}>{ctx.replace('NATIVE_APP', 'NATIVE')}</option>
                                                                ))
                                                            ) : (
                                                                <option value="NATIVE_APP">NATIVE</option>
                                                            )}
                                                        </select>
                                                    </div>
                                                </>
                                            )}
                                            <button
                                                onClick={() => {
                                                    handleDisconnect();
                                                    setIsInspectorOpen(false);
                                                }}
                                                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-400"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-hidden p-6">
                                        {!isConnected ? (
                                            <div className="max-w-md mx-auto space-y-6 py-10">
                                                <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-4">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                                                            <RefreshCw className="w-4 h-4" />
                                                        </div>
                                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Device Discovery</h4>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Available Hardware</label>
                                                        <select
                                                            value={selectedDeviceId}
                                                            onChange={(e) => setSelectedDeviceId(e.target.value)}
                                                            className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                                                        >
                                                            {availableDevices.length > 0 ? (
                                                                availableDevices.map(dev => (
                                                                    <option key={dev.id} value={dev.id}>{dev.alias} ({dev.id})</option>
                                                                ))
                                                            ) : (
                                                                <option value="">No devices found</option>
                                                            )}
                                                        </select>
                                                        <button onClick={fetchDevices} className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:underline">Refresh List</button>
                                                    </div>
                                                    <button
                                                        onClick={handleConnect}
                                                        disabled={isConnecting || availableDevices.length === 0}
                                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        {isConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                                        Initialize Session
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex h-full gap-6">
                                                {/* Column 1: Screenshot & Recording Controls */}
                                                <div className="w-[280px] flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 h-full">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 shadow-sm">
                                                            <Activity className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-900 dark:text-white">Live Device</h4>
                                                            {appInspectorMode === 'RECORD' && (
                                                                <span className="bg-red-600/10 text-red-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest animate-pulse border border-red-500/20">Recording</span>
                                                            )}
                                                            {appInspectorMode === 'NAVIGATE' && (
                                                                <span className="bg-blue-600/10 text-blue-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-blue-500/20">Navigate</span>
                                                            )}
                                                            {appInspectorMode === 'INSPECT' && (
                                                                <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-amber-500/20">Inspect</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div
                                                        className="relative group/device bg-black rounded-[2rem] border-4 border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden ring-1 ring-gray-200 dark:ring-gray-800 flex-shrink-0"
                                                        style={{ aspectRatio: imageAspectRatio, width: '100%', height: 'auto' }}
                                                    >
                                                        {screenshot ? (
                                                            <div className="w-full h-full relative cursor-crosshair" onClick={handleInspectorClick}>
                                                                <img
                                                                    src={`data:image/png;base64,${screenshot}`}
                                                                    alt="Device"
                                                                    className="w-full h-full object-contain"
                                                                    onLoad={(e) => {
                                                                        const img = e.currentTarget;
                                                                        if (img.naturalWidth && img.naturalHeight) {
                                                                            setImageAspectRatio(img.naturalWidth / img.naturalHeight);
                                                                            setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                                                                        }
                                                                    }}
                                                                />

                                                                {/* Highlight Overlay */}
                                                                {highlightBounds && (
                                                                    <div
                                                                        className="absolute border-2 border-indigo-500 bg-indigo-500/20 rounded shadow-[0_0_20px_rgba(99,102,241,0.6)] pointer-events-none z-[60] transition-all duration-200"
                                                                        style={{
                                                                            left: `${(highlightBounds.x1 / (lastIdentifiedElement?.window_size?.width || hardwareResolution.width)) * 100}%`,
                                                                            top: `${(highlightBounds.y1 / (lastIdentifiedElement?.window_size?.height || hardwareResolution.height)) * 100}%`,
                                                                            width: `${((highlightBounds.x2 - highlightBounds.x1) / (lastIdentifiedElement?.window_size?.width || hardwareResolution.width)) * 100}%`,
                                                                            height: `${((highlightBounds.y2 - highlightBounds.y1) / (lastIdentifiedElement?.window_size?.height || hardwareResolution.height)) * 100}%`
                                                                        }}
                                                                    >
                                                                        <div className="absolute -top-6 left-0 bg-indigo-600 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter whitespace-nowrap shadow-lg">
                                                                            {lastIdentifiedElement?.name || 'Selected'}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {isRefreshingScreenshot && (
                                                                    <div className="absolute top-4 right-4 animate-spin text-white"><RefreshCw className="w-4 h-4 opacity-50" /></div>
                                                                )}

                                                            </div>
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-gray-500 italic text-[10px]">
                                                                <RefreshCw className="w-6 h-6 animate-spin opacity-20" />
                                                                Loading Screen...
                                                            </div>
                                                        )}
                                                    </div>

                                                    {appInspectorMode === 'RECORD' && (
                                                        <div className="p-4 bg-red-500/5 dark:bg-red-500/10 rounded-2xl border border-red-500/10 space-y-3 shrink-0">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-[9px] font-black uppercase tracking-widest text-red-500">Record Action Mode</h4>
                                                                <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {(['CLICK', 'TAP', 'SWIPE', 'INPUT'] as const).map(mode => (
                                                                    <button
                                                                        key={mode}
                                                                        onClick={() => {
                                                                            setRecordMode(mode);
                                                                            setSwipeStart(null);
                                                                        }}
                                                                        className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${recordMode === mode ? 'bg-red-500 text-white shadow-lg' : 'bg-white dark:bg-[#0c0e12] text-gray-500 border border-gray-100 dark:border-gray-800 hover:border-red-500/30'}`}
                                                                    >
                                                                        {mode}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar h-full pr-2">
                                                    <div className="flex items-center justify-between mb-4 px-1">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 shadow-sm">
                                                                <FileText className="w-4 h-4" />
                                                            </div>
                                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-900 dark:text-white">UI Hierarchy</h4>
                                                        </div>
                                                        <button onClick={refreshScreenshot} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all group" title="Refresh Source">
                                                            <RefreshCw className={`w-4 h-4 text-gray-400 group-hover:text-indigo-500 ${isRefreshingScreenshot ? 'animate-spin' : ''}`} />
                                                        </button>
                                                    </div>
                                                    <div
                                                        ref={xmlViewerRef}
                                                        className="flex-1 bg-[#0c0e12] rounded-[2rem] border border-gray-200 dark:border-gray-800 p-6 font-mono text-[11px] overflow-auto custom-scrollbar-dark shadow-2xl group"
                                                    >
                                                        {xmlSource ? (
                                                            <pre className="text-indigo-400/90 whitespace-pre leading-relaxed select-text">
                                                                {xmlSource.split('\n').map((line, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className={`${currentLine === idx + 1 ? 'bg-indigo-500/20 text-indigo-200 -mx-6 px-6' : ''}`}
                                                                    >
                                                                        {line}
                                                                    </div>
                                                                ))}
                                                            </pre>
                                                        ) : (
                                                            <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-3 italic">
                                                                <FileText className="w-12 h-12 opacity-10" />
                                                                <p>Retrieving page source...</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Column 3: Live Recorded Steps */}
                                                <div className="w-[300px] flex flex-col gap-4 overflow-y-auto custom-scrollbar h-full pr-2">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-500/10 shadow-sm">
                                                                <Zap className="w-4 h-4" />
                                                            </div>
                                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-900 dark:text-white">
                                                                {pendingStep ? "Action Confirmation" : "Staged Steps"}
                                                            </h4>
                                                        </div>
                                                        {!pendingStep && <span className="px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-full text-[10px] font-black tracking-widest border border-amber-500/20">{stagedSteps.length}</span>}
                                                    </div>

                                                    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800 p-4 space-y-3 custom-scrollbar">
                                                        {pendingStep ? (
                                                            <div className="space-y-4">
                                                                <div className="p-5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="px-2 py-1 bg-indigo-500 text-white rounded text-[8px] font-black uppercase tracking-widest">Pending Action</span>
                                                                        <span className="text-[10px] font-bold text-indigo-500">{pendingStep.action.toUpperCase()}</span>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        <div className="space-y-1">
                                                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Description</label>
                                                                            <input
                                                                                type="text"
                                                                                value={pendingStep.stepName || ''}
                                                                                onChange={(e) => setPendingStep({ ...pendingStep, stepName: e.target.value })}
                                                                                className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-[10px] font-bold outline-none focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Selector</label>
                                                                            <div className="text-[9px] text-gray-600 dark:text-gray-400 font-mono bg-gray-100 dark:bg-white/5 p-2 rounded-lg break-all">{pendingStep.selectorValue}</div>
                                                                        </div>
                                                                        {pendingStep.option && (
                                                                            <div className="space-y-1">
                                                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Value / Option</label>
                                                                                <div className="text-[10px] text-indigo-500 font-bold">{pendingStep.option}</div>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                                                        <button
                                                                            onClick={() => {
                                                                                setPendingStep(null);
                                                                                setHighlightBounds(null);
                                                                            }}
                                                                            className="py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            onClick={async () => {
                                                                                const resAct = await inspectorApi.performAction(pendingStep);
                                                                                if (resAct.success) {
                                                                                    setStagedSteps([...stagedSteps, pendingStep]);
                                                                                    setPendingStep(null);
                                                                                    setTimeout(refreshScreenshot, 1500);
                                                                                } else {
                                                                                    setNotification({ type: 'error', message: `Execution failed: ${resAct.error}` });
                                                                                }
                                                                            }}
                                                                            className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                                                                        >
                                                                            Confirm & Run
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                                                                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Warning</span>
                                                                    </div>
                                                                    <p className="text-[9px] text-amber-600/70 font-medium leading-relaxed">Confirming will execute this action on the real hardware device.</p>
                                                                </div>
                                                            </div>
                                                        ) : stagedSteps.length > 0 ? stagedSteps.map((s, i) => (
                                                            <div key={i} className="p-4 bg-white dark:bg-[#0c0e12] border border-gray-100 dark:border-gray-800 rounded-2xl flex flex-col gap-2 group relative shadow-sm hover:shadow-md transition-all">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{s.action}</span>
                                                                    <button onClick={() => setStagedSteps(stagedSteps.filter((_, idx) => idx !== i))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Selector</div>
                                                                    <div className="text-[10px] text-gray-700 dark:text-gray-300 font-mono break-all line-clamp-2 bg-gray-50 dark:bg-white/5 p-2 rounded-lg">{s.selectorValue}</div>
                                                                </div>
                                                                {s.option && (
                                                                    <div className="space-y-1">
                                                                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Value / Option</div>
                                                                        <div className="text-[10px] text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-500/10 p-2 rounded-lg">{s.option}</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )) : (
                                                            <div className="h-full flex flex-col items-center justify-center text-gray-400 italic text-[10px] gap-4 py-20 px-6 text-center">
                                                                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                                                                    <MousePointer2 className="w-8 h-8" />
                                                                </div>
                                                                <p className="font-medium">No steps recorded yet.<br />Interacting with the device will automatically stage steps here.</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {stagedSteps.length > 0 && (
                                                        <button
                                                            onClick={() => {
                                                                // Filter out the initial empty step if no action/selector is set
                                                                const currentSteps = steps;
                                                                const hasRealSteps = currentSteps.length > 1 || (currentSteps[0]?.action !== '' && currentSteps[0]?.selectorValue !== '');

                                                                const finalSteps = hasRealSteps ? [...currentSteps, ...stagedSteps] : [...stagedSteps];

                                                                // Re-index IDs to ensure continuity
                                                                const reindexedSteps = finalSteps.map((s, idx) => ({
                                                                    ...s,
                                                                    id: (idx + 1).toString()
                                                                }));

                                                                setSteps(reindexedSteps);
                                                                setStagedSteps([]);
                                                                setNotification({ type: 'success', message: `${stagedSteps.length} steps applied to scenario!` });
                                                            }}
                                                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" /> Apply {stagedSteps.length} Steps
                                                        </button>
                                                    )}
                                                    <div className="p-4 bg-indigo-50 dark:bg-indigo-500/5 rounded-2xl border border-indigo-100 dark:border-indigo-500/10">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Info className="w-3.5 h-3.5 text-indigo-500" />
                                                            <h4 className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Help</h4>
                                                        </div>
                                                        <p className="text-[9px] text-indigo-600/70 dark:text-indigo-400/60 leading-relaxed font-medium">
                                                            {isRecording ? "RECORDING ACTIVE: Every action is captured as a staged step." : "INTERACTIVE MODE: Explore UI hierarchy without recording."}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/10">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                                                <Globe className="w-4 h-4" />
                                            </div>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white">Web Inspector</h3>
                                            {isConnected && (
                                                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">Session Active</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isConnected && (
                                                <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl mr-2">
                                                    <button
                                                        onClick={() => setAppInspectorMode('NAVIGATE')}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${appInspectorMode === 'NAVIGATE' ? 'bg-white dark:bg-[#16191f] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                                    >
                                                        <MousePointer2 className="w-3.5 h-3.5" /> Navigate
                                                    </button>
                                                    <button
                                                        onClick={() => setAppInspectorMode('RECORD')}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${appInspectorMode === 'RECORD' ? 'bg-white dark:bg-[#16191f] text-red-600 dark:text-red-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                                    >
                                                        <Video className="w-3.5 h-3.5" /> Record
                                                    </button>
                                                    <button
                                                        onClick={() => setAppInspectorMode('INSPECT')}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${appInspectorMode === 'INSPECT' ? 'bg-white dark:bg-[#16191f] text-amber-600 dark:text-amber-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                                    >
                                                        <Target className="w-3.5 h-3.5" /> Inspect
                                                    </button>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => {
                                                    handleDisconnect();
                                                    setIsInspectorOpen(false);
                                                }}
                                                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-400"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-hidden p-6">
                                        {!isConnected ? (
                                            <div className="max-w-md mx-auto space-y-6 py-10">
                                                <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-4">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                                                            <Globe className="w-4 h-4" />
                                                        </div>
                                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Browser Configuration</h4>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Target URL</label>
                                                        <input
                                                            type="text"
                                                            value={targetUrl}
                                                            onChange={(e) => setTargetUrl(e.target.value)}
                                                            placeholder="https://example.com"
                                                            className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={handleWebConnect}
                                                        disabled={isConnecting || !targetUrl}
                                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        {isConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                                        Start Web Session
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex h-full gap-6">
                                                <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 h-full">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 shadow-sm">
                                                            <Activity className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-900 dark:text-white">Live Browser</h4>
                                                            {appInspectorMode === 'RECORD' && (
                                                                <span className="bg-red-600/10 text-red-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest animate-pulse border border-red-500/20">Recording</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div
                                                        className="relative group/device bg-white rounded-[1rem] border-2 border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden ring-1 ring-gray-200 dark:ring-gray-800 flex-shrink-0"
                                                        style={{ aspectRatio: imageAspectRatio, width: '100%', height: 'auto' }}
                                                    >
                                                        {screenshot ? (
                                                            <div className="w-full h-full relative cursor-crosshair" onClick={handleInspectorClick}>
                                                                <img
                                                                    src={`data:image/png;base64,${screenshot}`}
                                                                    alt="Browser"
                                                                    className="w-full h-full object-contain"
                                                                    onLoad={(e) => {
                                                                        const img = e.currentTarget;
                                                                        if (img.naturalWidth && img.naturalHeight) {
                                                                            setImageAspectRatio(img.naturalWidth / img.naturalHeight);
                                                                            setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                                                                        }
                                                                    }}
                                                                />
                                                                {highlightBounds && (
                                                                    <div
                                                                        className="absolute border-2 border-indigo-500 bg-indigo-500/20 rounded shadow-[0_0_20px_rgba(99,102,241,0.6)] pointer-events-none z-[60] transition-all duration-200"
                                                                        style={{
                                                                            left: `${(highlightBounds.x1 / (imageDimensions?.width || 1280)) * 100}%`,
                                                                            top: `${(highlightBounds.y1 / (imageDimensions?.height || 720)) * 100}%`,
                                                                            width: `${((highlightBounds.x2 - highlightBounds.x1) / (imageDimensions?.width || 1280)) * 100}%`,
                                                                            height: `${((highlightBounds.y2 - highlightBounds.y1) / (imageDimensions?.height || 720)) * 100}%`
                                                                        }}
                                                                    >
                                                                        <div className="absolute -top-6 left-0 bg-indigo-600 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter whitespace-nowrap shadow-lg">
                                                                            {lastIdentifiedElement?.name || 'Selected'}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {isRefreshingScreenshot && (
                                                                    <div className="absolute top-4 right-4 animate-spin text-indigo-500"><RefreshCw className="w-4 h-4" /></div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-gray-500 italic text-[10px]">
                                                                <RefreshCw className="w-6 h-6 animate-spin opacity-20" />
                                                                Loading Browser...
                                                            </div>
                                                        )}
                                                    </div>

                                                    {appInspectorMode === 'RECORD' && (
                                                        <div className="p-4 bg-red-500/5 dark:bg-red-500/10 rounded-2xl border border-red-500/10 space-y-3 shrink-0">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-[9px] font-black uppercase tracking-widest text-red-500">Record Action Mode</h4>
                                                                <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {(['CLICK', 'INPUT'] as const).map(mode => (
                                                                    <button
                                                                        key={mode}
                                                                        onClick={() => {
                                                                            setRecordMode(mode);
                                                                            setSwipeStart(null);
                                                                        }}
                                                                        className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${recordMode === mode ? 'bg-red-500 text-white shadow-lg' : 'bg-white dark:bg-[#0c0e12] text-gray-500 border border-gray-100 dark:border-gray-800 hover:border-red-500/30'}`}
                                                                    >
                                                                        {mode}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="w-[380px] shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar h-full pr-2">
                                                    <div className="flex items-center justify-between mb-4 px-1">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 shadow-sm">
                                                                <FileText className="w-4 h-4" />
                                                            </div>
                                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-900 dark:text-white">DOM Hierarchy</h4>
                                                        </div>
                                                        <button onClick={refreshScreenshot} disabled={isRefreshingScreenshot} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all group" title="Refresh Page">
                                                            <RefreshCw className={`w-4 h-4 text-gray-400 group-hover:text-indigo-500 ${isRefreshingScreenshot ? 'animate-spin' : ''}`} />
                                                        </button>
                                                    </div>
                                                    <div
                                                        ref={xmlViewerRef}
                                                        className="flex-1 bg-[#0c0e12] rounded-[2rem] border border-gray-200 dark:border-gray-800 p-6 font-mono text-[11px] overflow-auto custom-scrollbar-dark shadow-2xl group"
                                                    >
                                                        {xmlSource ? (
                                                            <pre className="text-indigo-400/90 whitespace-pre leading-relaxed select-text">
                                                                {xmlSource.split('\n').map((line, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className={`${currentLine === idx + 1 ? 'bg-indigo-500/20 text-indigo-200 -mx-6 px-6' : ''}`}
                                                                    >
                                                                        {line}
                                                                    </div>
                                                                ))}
                                                            </pre>
                                                        ) : (
                                                            <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-3 italic">
                                                                <FileText className="w-12 h-12 opacity-10" />
                                                                <p>Retrieving page source...</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="w-[300px] flex flex-col gap-4 overflow-y-auto custom-scrollbar h-full pr-2">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-500/10 shadow-sm">
                                                                <Zap className="w-4 h-4" />
                                                            </div>
                                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-900 dark:text-white">
                                                                {pendingStep ? "Confirmation" : "Staged Steps"}
                                                            </h4>
                                                        </div>
                                                        {!pendingStep && <span className="px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-full text-[10px] font-black tracking-widest border border-amber-500/20">{stagedSteps.length}</span>}
                                                    </div>

                                                    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800 p-4 space-y-3 custom-scrollbar">
                                                        {pendingStep ? (
                                                            <div className="space-y-4">
                                                                <div className="p-5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl space-y-4">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="px-2 py-1 bg-indigo-500 text-white rounded text-[8px] font-black uppercase tracking-widest">Pending Action</span>
                                                                        <span className="text-[10px] font-bold text-indigo-500">{pendingStep.action.toUpperCase()}</span>
                                                                    </div>
                                                                    <div className="space-y-3">
                                                                        <div className="space-y-1">
                                                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Description</label>
                                                                            <input
                                                                                type="text"
                                                                                value={pendingStep.stepName || ''}
                                                                                onChange={(e) => setPendingStep({ ...pendingStep, stepName: e.target.value })}
                                                                                className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-[10px] font-bold outline-none focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Selector</label>
                                                                            <div className="text-[9px] text-gray-600 dark:text-gray-400 font-mono bg-gray-100 dark:bg-white/5 p-2 rounded-lg break-all">{pendingStep.selectorValue}</div>
                                                                        </div>
                                                                        {pendingStep.option && (
                                                                            <div className="space-y-1">
                                                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Value</label>
                                                                                <div className="text-[10px] text-indigo-500 font-bold">{pendingStep.option}</div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                                                        <button onClick={() => { setPendingStep(null); setHighlightBounds(null); }} className="py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Cancel</button>
                                                                        <button
                                                                            onClick={async () => {
                                                                                const resAct = await inspectorApi.performAction(pendingStep);
                                                                                if (resAct.success) {
                                                                                    setStagedSteps([...stagedSteps, pendingStep]);
                                                                                    setPendingStep(null);
                                                                                    setTimeout(refreshScreenshot, 1500);
                                                                                } else {
                                                                                    setNotification({ type: 'error', message: `Execution failed: ${resAct.error}` });
                                                                                }
                                                                            }}
                                                                            className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/30 transition-all"
                                                                        >
                                                                            Confirm
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : stagedSteps.length > 0 ? (
                                                            stagedSteps.map((s, i) => (
                                                                <div key={i} className="p-4 bg-white dark:bg-[#0c0e12] border border-gray-100 dark:border-gray-800 rounded-2xl flex flex-col gap-2 group relative shadow-sm">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{s.action}</span>
                                                                        <button onClick={() => setStagedSteps(stagedSteps.filter((_, idx) => idx !== i))} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-all">
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-700 dark:text-gray-300 font-mono break-all line-clamp-2 bg-gray-50 dark:bg-white/5 p-2 rounded-lg">{s.selectorValue}</div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="h-full flex flex-col items-center justify-center text-gray-400 italic text-[10px] gap-4 py-20 px-6 text-center">
                                                                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                                                                    <Globe className="w-8 h-8" />
                                                                </div>
                                                                <p className="font-medium">Interact with the browser or DOM to record steps.</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {stagedSteps.length > 0 && (
                                                        <button
                                                            onClick={() => {
                                                                const currentSteps = webSteps;
                                                                const hasRealSteps = currentSteps.length > 1 || (currentSteps[0]?.action !== '' && currentSteps[0]?.selectorValue !== '');
                                                                let finalSteps;
                                                                if (!hasRealSteps) {
                                                                    const urlStep: TestStep = {
                                                                        id: '1',
                                                                        action: 'Navigate',
                                                                        selectorType: 'URL',
                                                                        selectorValue: targetUrl,
                                                                        stepName: `Open ${targetUrl}`,
                                                                        platform: 'WEB',
                                                                        option: targetUrl
                                                                    };
                                                                    finalSteps = [urlStep, ...stagedSteps];
                                                                } else {
                                                                    finalSteps = [...currentSteps, ...stagedSteps];
                                                                }
                                                                const reindexedSteps = finalSteps.map((s, idx) => ({ ...s, id: (idx + 1).toString() }));
                                                                setWebSteps(reindexedSteps);
                                                                setStagedSteps([]);
                                                                setIsInspectorOpen(false);
                                                                setNotification({ type: 'success', message: `Added ${stagedSteps.length} steps to scenario.` });
                                                            }}
                                                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" /> Apply {stagedSteps.length} Steps
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* EXECUTION MONITOR OVERLAY */}
                {
                    activeRunId && (
                        <LiveExecutionModal
                            runId={activeRunId}
                            onClose={() => setActiveRunId(null)}
                            onComplete={(status) => {
                                console.log(`Execution complete: ${status}`);
                                // Redundant alert removed per user request
                            }}
                        />
                    )
                }

                {/* Object Registration Modal */}
                <ObjectRegistrationModal
                    isOpen={isRegisterModalOpen}
                    onClose={() => setIsRegisterModalOpen(false)}
                    projectId={activeProject.id}
                    initialData={pendingObjectData}
                    onRegistered={(newObj) => {
                        setAvailableObjects([...availableObjects, newObj]);
                        setNotification({ type: 'success', message: `Registered object: ${newObj.name}` });
                    }}
                />

                {/* New Asset Save Modal */}
                {
                    showSaveModal && (
                        <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center transition-colors">
                            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl transition-colors">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white transition-colors">Save New Asset</h3>
                                    <button onClick={() => setShowSaveModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Asset Name</label>
                                        <input
                                            type="text"
                                            value={assetName}
                                            onChange={(e) => setAssetName(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-[#0f1115] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all font-bold"
                                            placeholder="e.g. Login Flow Test"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Description (Optional)</label>
                                        <textarea
                                            value={assetDescription}
                                            onChange={(e) => setAssetDescription(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-[#0f1115] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-300 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all resize-none h-24 text-sm"
                                            placeholder="Brief description of this test..."
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-8">
                                    <button
                                        onClick={() => setShowSaveModal(false)}
                                        className="flex-1 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreateAsset}
                                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20"
                                    >
                                        Save Steps
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Confirmation Modal */}
                {
                    confirmation && (
                        <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center transition-colors">
                            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl transition-colors">
                                <div className="flex justify-between items-top mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                                            <AlertTriangle className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white transition-colors">Confirmation</h3>
                                        </div>
                                    </div>
                                    <button onClick={() => setConfirmation(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                                </div>
                                <div className="mb-6">
                                    <p className="text-gray-900 dark:text-white font-bold mb-1 transition-colors">{confirmation.message}</p>
                                    {confirmation.detail && <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">{confirmation.detail}</p>}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setConfirmation(null)}
                                        className="flex-1 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmation.onConfirm}
                                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20"
                                    >
                                        {confirmation.confirmText}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Notification Modal (Success/Error/Info) */}
                {
                    notification && (
                        <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center transition-colors">
                            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl transition-colors">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className={`text-lg font-bold ${notification.type === 'success' ? 'text-emerald-500' :
                                        notification.type === 'error' ? 'text-red-500' : 'text-blue-500'
                                        }`}>
                                        {notification.type === 'success' ? 'Success' : notification.type === 'error' ? 'Error' : 'Info'}
                                    </h3>
                                    <button onClick={() => setNotification(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 whitespace-pre-wrap transition-colors">{notification.message}</p>
                                <button
                                    onClick={() => setNotification(null)}
                                    className="w-full py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-bold transition-all"
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    )
                }
                {/* Inspector Input Modal */}
                {
                    showInspectorInputModal && (
                        <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center transition-colors">
                            <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl transition-colors">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white transition-colors">Input Text</h3>
                                    <button onClick={() => setShowInspectorInputModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Text to find/input</label>
                                        <input
                                            type="text"
                                            value={inspectorInputText}
                                            onChange={(e) => setInspectorInputText(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-[#0f1115] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all font-bold"
                                            placeholder="Enter search text or values..."
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleInspectorInputConfirm();
                                                if (e.key === 'Escape') setShowInspectorInputModal(false);
                                            }}
                                        />
                                        <p className="mt-2 text-[10px] text-gray-500 font-medium">Recorded on: <span className="text-indigo-500 font-bold">{inspectorInputPendingRes?.name}</span></p>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-8">
                                    <button
                                        onClick={() => setShowInspectorInputModal(false)}
                                        className="flex-1 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleInspectorInputConfirm}
                                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>
        </div>
    );
};

export default StepRunnerView;