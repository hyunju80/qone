
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { authApi } from './api/auth';
import { projectsApi } from './api/projects';
import { testApi } from './api/test';
import { customersApi } from './api/customers';
import { usersApi } from './api/users';
import { personaApi } from './api/persona';
// import { schedulesApi } from './api/schedules'; // Removed direct usage
import { schedulesApi } from './api/schedules'; // We might still use it for initial load? Yes. 
// Actually, App.tsx DOES need it to fetch the list on load (useEffect). 
// But NOT for handleCreate/Update/Delete. 
// So keep the import. // Added import
import { deviceFarmApi } from './api/deviceFarm';
import Sidebar from './components/Sidebar';
import MainConsole from './components/MainConsole';
import AssetLibrary from './components/AssetLibrary';
import PersonaManager from './components/PersonaManager';
import ScenarioGenerator from './components/ScenarioGenerator';
import TestGenerator from './components/TestGenerator';
import AIGeneratorView from './components/AIGeneratorView'; // Imported
import HistoryView from './components/HistoryView';
import Settings from './components/Settings';
import PipelineWatcher from './components/PipelineWatcher';
import SchedulerView from './components/SchedulerView';
import ReportDashboard from './components/ReportDashboard';
import DeviceFarm from './components/DeviceFarm';
import CustomerHub from './components/CustomerHub';
import WorkspaceSelection from './components/WorkspaceSelection';
import AiExploration from './components/AiExploration'; // Added
import StepRunnerView from './components/StepRunnerView'; // Added
import DesignCenter from './components/DesignCenter/DesignCenter'; // Added
import Logo from './components/Logo';
import { ViewMode, TestScript, ScriptStatus, ScriptOrigin, User, Project, Persona, TestHistory, Message, TestSchedule, Device, ApprovalTask, TargetDevice, CustomerAccount, SubscriptionPlan, Scenario } from './types';
import { MOCK_SCRIPTS, MOCK_USERS, MOCK_PROJECTS, PERSONAS as MOCK_PERSONAS, MOCK_HISTORY, MOCK_SCHEDULES, MOCK_DEVICES, MOCK_TASKS, MOCK_ALL_CUSTOMERS } from './constants';
// Added missing ArrowRight import from lucide-react
import { ChevronRight, Globe, User as UserIcon, LogOut, LogIn, Plus, X, Laptop, Smartphone, Monitor, ShieldCheck, Building2, Activity, Users, ArrowLeft, ArrowRight, Mail, Calendar, Zap, Layout, FolderKanban, Lock, Eye, EyeOff, AlertCircle, Save, Key, Edit2, Check, BellRing, Send, FileText, Settings as SettingsIcon, CreditCard, BarChart3, PieChart, TrendingUp, CheckCircle2, Info, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

// Scenario Generator 전용 인터페이스
interface FeatureSummary {
  name: string;
  description: string;
  flows: string[];
}

import { ThemeProvider, useTheme } from './src/context/ThemeContext';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Zap className="w-5 h-5 fill-yellow-400 text-yellow-400" /> : <Zap className="w-5 h-5" />}
    </button>
  );
};

const AppContent: React.FC = () => {
  const { theme } = useTheme();
  // ... rest of App logic ...

  // Auth & Project State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.CONSOLE);

  // App Data
  const [scripts, setScripts] = useState<TestScript[]>([]);
  const [history, setHistory] = useState<TestHistory[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [schedules, setSchedules] = useState<TestSchedule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [approvalTasks, setApprovalTasks] = useState<ApprovalTask[]>(MOCK_TASKS);
  const [approvedScenarios, setApprovedScenarios] = useState<Scenario[]>([]);

  // Scenario Generator Persistence State
  const [draftFeatures, setDraftFeatures] = useState<FeatureSummary[]>([]);
  const [draftScenarios, setDraftScenarios] = useState<Scenario[]>([]);
  const [lastEditingScenarioId, setLastEditingScenarioId] = useState<string | null>(null);

  // Navigation State
  const [librarySearchTerm, setLibrarySearchTerm] = useState<string>('');

  // UI State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Global Alert State
  const [alertState, setAlertState] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({ isOpen: false, title: '', message: '', type: 'info' });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertState({ isOpen: true, title, message, type });
  };

  // Helper to get consistent View Titles
  const getViewTitle = (view: ViewMode) => {
    switch (view) {
      case ViewMode.CONSOLE: return 'Main Console';
      case ViewMode.PIPELINE: return 'Pipeline Watcher';
      case ViewMode.SCHEDULES: return 'Test Scheduler';
      case ViewMode.DEVICE_FARM: return 'Device Farm';
      case ViewMode.SCENARIO_GENERATOR: return 'Scenario Generator';
      case ViewMode.AI_GENERATOR: return 'AI Generator';
      case ViewMode.AI_EXPLORATION: return 'AI QA Agent';
      case ViewMode.GENERATOR: return 'Test Generator';
      case ViewMode.LIBRARY: return 'Asset Library';
      case ViewMode.PERSONAS: return 'Persona Management';
      case ViewMode.HISTORY: return 'Test History';
      case ViewMode.REPORTS: return 'Analytics & Reports';
      case ViewMode.STEP_RUNNER: return 'Step Flow';
      case ViewMode.DESIGN_CENTER: return 'Design Center';
      case ViewMode.SETTINGS: return 'Setting';
      default: return view.replace('_', ' ');
    }
  };


  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAccount | null>(null);
  const [isBypassingToWorkspaces, setIsBypassingToWorkspaces] = useState(false);
  const [viewingCustomerDetailId, setViewingCustomerDetailId] = useState<string | null>(null);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState<Partial<CustomerAccount>>({ companyName: '', businessNumber: '', plan: 'Pro', billingEmail: '', adminEmail: '' });

  const [focusedDiscoveryId, setFocusedDiscoveryId] = useState<string | null>(null);
  // Dictionary to store chat history per project: Record<ProjectID, Message[]>
  const [consoleMessagesMap, setConsoleMessagesMap] = useState<Record<string, Message[]>>({});

  // Helper to get current project's messages
  const currentConsoleMessages = useMemo(() => {
    if (!activeProject) return [];
    return consoleMessagesMap[activeProject.id] || [];
  }, [consoleMessagesMap, activeProject]);

  // Helper to update current project's messages (Mimics setConsoleMessages signature)
  const handleConsoleMessagesChange = (
    newMessagesOrUpdater: Message[] | ((prev: Message[]) => Message[])
  ) => {
    if (!activeProject) return;

    setConsoleMessagesMap(prevMap => {
      const currentMsgs = prevMap[activeProject.id] || [];
      const newMsgs = typeof newMessagesOrUpdater === 'function'
        ? newMessagesOrUpdater(currentMsgs)
        : newMessagesOrUpdater;

      return {
        ...prevMap,
        [activeProject.id]: newMsgs
      };
    });
  };

  // Sidebar State (Moved to top level to fix Hook rules)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const filteredScripts = useMemo(() => scripts.filter(s => s.projectId === activeProject?.id), [scripts, activeProject]);
  const filteredHistory = useMemo(() => history.filter(h => h.projectId === activeProject?.id), [history, activeProject]);
  const filteredSchedules = useMemo(() => schedules.filter(s => s.projectId === activeProject?.id), [schedules, activeProject]);
  const filteredApprovedScenarios = useMemo(() => approvedScenarios.filter(s => s.projectId === activeProject?.id), [approvedScenarios, activeProject]);

  const availableProjects = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.isSaaSSuperAdmin) return projects;
    return projects.filter(p => p.customerAccountId === currentUser.customerAccountId);
  }, [currentUser, projects]);

  const detailCustomer = useMemo(() => customers.find(c => c.id === viewingCustomerDetailId), [customers, viewingCustomerDetailId]);

  useEffect(() => {
    const initAuth = async () => {
      if (localStorage.getItem('access_token')) {
        try {
          const user = await authApi.me();
          setCurrentUser(user);

          console.log("App initAuth User:", user);
          if (user.isSaaSSuperAdmin) {
            console.log("Redirecting to CMS");
            const custs = await customersApi.getAll();
            setCustomers(custs);
            // Super Admin needs projects too for the Hub details
            const projs = await projectsApi.getAll();
            setProjects(projs);
            setCurrentView(ViewMode.CMS);
          } else {
            const projs = await projectsApi.getAll();
            setProjects(projs);
            setCurrentView(ViewMode.CONSOLE);
          }
        } catch (e) {
          localStorage.removeItem('access_token');
        }
      }
    };
    initAuth();

    // Fetch Device Farm occasionally
    const fetchDevices = async () => {
      try {
        const dvs = await deviceFarmApi.getDevices();
        setDevices(dvs);
      } catch (err) {
        console.error("Failed to load device farm:", err);
      }
    };
    fetchDevices();
    const deviceInterval = setInterval(fetchDevices, 3000); // refresh every 3s
    return () => clearInterval(deviceInterval);
  }, []);

  const handleLogin = async () => {
    try {
      const { access_token } = await authApi.login(loginEmail, loginPassword);
      localStorage.setItem('access_token', access_token);

      const user = await authApi.me();
      setCurrentUser(user);
      console.log("login:", user);

      if (user.isSaaSSuperAdmin) {
        const custs = await customersApi.getAll();
        setCustomers(custs);
        const projs = await projectsApi.getAll();
        setProjects(projs);
        setCurrentView(ViewMode.CMS);
      } else {
        const projs = await projectsApi.getAll();
        setProjects(projs);
        setCurrentView(ViewMode.CONSOLE); // Or project selector
      }

      setLoginError(null);
    } catch (e) {
      setLoginError("이메일 또는 비밀번호가 일치하지 않습니다.");
    }
  };

  // Clear projects when bypass is turned off
  useEffect(() => {
    if (!isBypassingToWorkspaces && currentUser?.isSaaSSuperAdmin) {
      // logic if needed
    }
  }, [isBypassingToWorkspaces]);

  // Fetch users for the current account/project context
  useEffect(() => {
    if (activeProject) {
      // Fetch users specific to the active project
      usersApi.getByProject(activeProject.id).then(u => {
        console.log("Fetched users for project:", u);
        setUsers(u);
      }).catch(err => {
        console.error("Failed to fetch project users:", err);
        setUsers([]);
      });
    } else if (currentUser && !currentUser.isSaaSSuperAdmin) {
      // Fallback for dashboard/no-project view if needed
      usersApi.getAll().then(setUsers).catch(console.error);
    }
  }, [currentUser, activeProject]);

  // Load project resources whenever activeProject changes
  // Load project resources whenever activeProject changes
  useEffect(() => {
    if (activeProject) {
      const fetchResources = async () => {
        const results = await Promise.allSettled([
          testApi.getScripts(activeProject.id),
          testApi.getScenarios(activeProject.id),
          testApi.getHistory(activeProject.id),
          schedulesApi.list(activeProject.id),
          personaApi.getPersonas(activeProject.id)
        ]);

        const [scriptsRes, scenariosRes, historyRes, schedulesRes, personasRes] = results;

        // Scripts
        if (scriptsRes.status === 'fulfilled') {
          setScripts(scriptsRes.value || []);
        } else {
          console.error("[App] Failed to load scripts:", scriptsRes.reason);
        }

        // Scenarios
        if (scenariosRes.status === 'fulfilled') {
          setApprovedScenarios(scenariosRes.value.filter(s => s.isApproved));
        } else {
          console.error("[App] Failed to load scenarios:", scenariosRes.reason);
        }

        // History
        if (historyRes.status === 'fulfilled') {
          setHistory(historyRes.value || []);
        } else {
          console.error("[App] Failed to load history:", historyRes.reason);
        }

        // Schedules
        if (schedulesRes.status === 'fulfilled') {
          setSchedules(schedulesRes.value || []);
        } else {
          console.error("[App] Failed to load schedules:", schedulesRes.reason);
        }

        // Personas
        if (personasRes.status === 'fulfilled') {
          console.log("[App] Loaded Personas:", personasRes.value);
          setPersonas(personasRes.value || []);
        } else {
          console.error("[App] Failed to load personas:", personasRes.reason);
        }
      };

      fetchResources();
    }
  }, [activeProject]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setCurrentUser(null);
    setActiveProject(null);
    setIsBypassingToWorkspaces(false);
    setSelectedCustomer(null);
    setCustomers([]);
    setProjects([]);
    // Reset other states
    setDraftFeatures([]);
  };

  const handleSelectProject = (proj: Project) => {
    setActiveProject(proj);
    setDraftFeatures([]);
    setDraftScenarios([]);
    setLastEditingScenarioId(null);
    setCurrentView(ViewMode.CONSOLE);
    setShowProfileModal(false);
  };

  const handleCreateCustomer = async (form: Partial<CustomerAccount>) => {
    if (!form.companyName) return;
    try {
      const newCust = await customersApi.create(form);
      setCustomers(prev => [...prev, newCust]);
    } catch (e) {
      showAlert("Error", "Failed to create customer", 'error');
    }
  };

  const handleCreateProject = async (data: any) => {
    if (!data.name || !currentUser) return;
    try {
      const newProj = await projectsApi.create({
        name: data.name,
        description: data.description,
        domain: data.domain,
        targetDevices: data.targetDevices || ['PC-Web']
      });
      setProjects(prev => [...prev, newProj]);
    } catch (e) {
      showAlert("Error", "Failed to create project", 'error');
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentUser) return;

    // Frontend validation
    if (passwordForm.new.length < 8) {
      setPasswordError("비밀번호는 최소 8자 이상이어야 합니다.");
      return;
    }
    const hasLetters = /[a-zA-Z]/.test(passwordForm.new);
    const hasNumbers = /[0-9]/.test(passwordForm.new);
    if (!hasLetters || !hasNumbers) {
      setPasswordError("비밀번호는 영문과 숫자를 모두 포함해야 합니다.");
      return;
    }

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    try {
      await usersApi.updatePassword(passwordForm.current, passwordForm.new);
      // Backend handles hashing. Local state doesn't need password updated (it's not used).
      // But we can update local currentUser if we really want, though backend doesn't return password.
      setPasswordForm({ current: '', new: '', confirm: '' });
      setPasswordError(null);
      setShowProfileModal(false);
      showAlert("Success", "비밀번호가 변경되었습니다.", 'success');
    } catch (e: any) {
      // Handle API errors (e.g., incorrect password)
      if (e.response && e.response.status === 400 && e.response.data.detail === "Incorrect current password") {
        setPasswordError("현재 비밀번호가 일치하지 않습니다.");
      } else {
        setPasswordError("비밀번호 변경에 실패했습니다. 다시 시도해주세요.");
        console.error("Password update failed:", e);
      }
    }
  };

  const handleApproveScenario = (scenario: Scenario) => {
    // When a scenario is approved (saved to DB by Generator), we just add it to list or re-fetch
    setApprovedScenarios(prev => [...prev, scenario]);
    setDraftScenarios(prev => prev.filter(s => s.id !== scenario.id));
    setCurrentView(ViewMode.GENERATOR);
  };

  const handleRegisterManualScript = async (script: TestScript) => {
    if (!activeProject) return;
    try {
      const payload = {
        name: script.name,
        description: script.description,
        project_id: activeProject.id,
        code: script.code,
        engine: script.engine || 'Playwright',
        tags: script.tags,
        dataset: script.dataset,
        is_active: script.isActive,
        // Manual scripts default to CERTIFIED usually, or implementation dependant.
        // Backend default is DRAFT probably, but let's see.
        status: ScriptStatus.CERTIFIED
      };

      const newScript = await testApi.createScript(payload);
      setScripts(prev => [newScript, ...prev]);
      showAlert("Success", "Manual Script registered successfully.", 'success');
    } catch (e) {
      console.error("Failed to register manual script", e);
      showAlert("Error", "Failed to save script.", 'error');
    }
  };

  const handleUpdateScript = async (script: TestScript) => {
    try {
      // transform if needed, but testApi.updateScript usually takes partial
      // We need to ensure snake_case fields are sent if backend expects them
      const payload = {
        name: script.name,
        description: script.description,
        code: script.code,
        engine: script.engine,
        tags: script.tags,
        dataset: script.dataset,
        is_active: script.isActive,
        is_favorite: script.isFavorite
      };

      const updated = await testApi.updateScript(script.id, payload);
      setScripts(prev => prev.map(s => s.id === script.id ? updated : s));
      showAlert("Success", "Script updated successfully.", 'success');
    } catch (e) {
      console.error("Failed to update script", e);
      showAlert("Error", "Failed to update script.", 'error');
    }
  };

  const handleCreateSchedule = (schedule: TestSchedule) => {
    setSchedules(prev => [...prev, schedule]);
  };

  const handleUpdateSchedule = (schedule: TestSchedule) => {
    setSchedules(prev => prev.map(s => s.id === schedule.id ? schedule : s));
  };

  const handleDeleteSchedule = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const handleCreatePersona = async (persona: Persona) => {
    try {
      const newPersona = await personaApi.createPersona(persona);
      setPersonas(prev => [...prev, newPersona]);
      showAlert("Success", "Persona created successfully", "success");
    } catch (e) {
      console.error("Failed to create persona", e);
      showAlert("Error", "Failed to create persona", "error");
    }
  };

  const handleUpdatePersona = async (persona: Persona) => {
    try {
      const updated = await personaApi.updatePersona(persona);
      setPersonas(prev => prev.map(p => p.id === persona.id ? updated : p));
    } catch (e) {
      console.error("Failed to update persona", e);
      showAlert("Error", "Failed to update persona", "error");
    }
  };

  const renderView = () => {
    if (!activeProject) return null;
    switch (currentView) {
      case ViewMode.CONSOLE:
        return <MainConsole activeProject={activeProject} assets={filteredScripts} history={filteredHistory} schedules={filteredSchedules} messages={currentConsoleMessages} onMessagesChange={handleConsoleMessagesChange} onRecordHistory={(h) => setHistory(prev => [h, ...prev])} onAddSchedule={(s) => setSchedules(prev => [...prev, s])} />;
      case ViewMode.AI_EXPLORATION: // Added
        return <AiExploration
          activeProject={activeProject}
          personas={personas.filter(p => (p.projectId === activeProject.id || p.projectId === 'global' || !p.projectId) && p.isActive)}
          onHistoryUpdate={() => {
            testApi.getHistory(activeProject.id).then(setHistory);
          }}
        />;
      case ViewMode.STEP_RUNNER:
        return <StepRunnerView activeProject={activeProject} />;
      case ViewMode.SCENARIO_GENERATOR:
        return <ScenarioGenerator activeProject={activeProject} personas={personas.filter(p => (p.projectId === activeProject.id || p.projectId === 'global' || !p.projectId) && p.isActive)} onApproveScenario={handleApproveScenario} focusedTaskId={focusedDiscoveryId} onClearFocus={() => setFocusedDiscoveryId(null)} persistedFeatures={draftFeatures} onUpdatePersistedFeatures={setDraftFeatures} persistedScenarios={draftScenarios} onUpdatePersistedScenarios={setDraftScenarios} persistedEditingId={lastEditingScenarioId} onUpdatePersistedEditingId={setLastEditingScenarioId} />;
      case ViewMode.AI_GENERATOR:
        return (
          <AIGeneratorView
            activeProject={activeProject}
            personas={personas}
            onApproveScenario={handleApproveScenario}
            onRegisterScript={handleRegisterManualScript}
            onAlert={showAlert}
            // State Props
            focusedTaskId={focusedDiscoveryId}
            onClearFocus={() => setFocusedDiscoveryId(null)}
            draftFeatures={draftFeatures}
            onUpdateDraftFeatures={setDraftFeatures}
            draftScenarios={draftScenarios}
            onUpdateDraftScenarios={setDraftScenarios}
            lastEditingScenarioId={lastEditingScenarioId}
            onUpdateLastEditingScenarioId={setLastEditingScenarioId}
          />
        );
      case ViewMode.GENERATOR:
        return <TestGenerator
          activeProject={activeProject}
          onCertify={async (s, sourceIds) => {
            try {
              // 1. Create Script (Asset)
              const scriptData = {
                ...s,
                project_id: activeProject.id,
                status: ScriptStatus.CERTIFIED,
                run_count: 0,
                success_rate: 100,
                is_active: true,
                persona_id: s.persona?.id,
                id: undefined // Backend generates ID
              };
              const newScript = await testApi.createScript(scriptData);

              // 2. Link Scenarios to this Asset
              // @ts-ignore
              const scenariosClient = await import('./api/scenarios').then(m => m.scenariosApi);
              await Promise.all(sourceIds.map(id => scenariosClient.update(id, { golden_script_id: newScript.id })));

              setScripts(prev => [newScript, ...prev]);
              // View will refresh locally
              setCurrentView(ViewMode.LIBRARY);
            } catch (e) {
              console.error("Failed to certify asset", e);
              showAlert("Certification Error", "Failed to save golden asset.", "error");
            }
          }}
          personas={personas.filter(p => p.projectId === activeProject.id || p.projectId === 'global' || !p.projectId)}
        />;
      case ViewMode.LIBRARY:
        return <AssetLibrary
          scripts={filteredScripts}
          activeProjectId={activeProject.id}
          personas={personas.filter(p => p.projectId === activeProject.id || p.projectId === 'global' || !p.projectId)}
          onRecordHistory={(h) => setHistory(prev => [h, ...prev])}
          onRefresh={() => {
            if (activeProject) {
              testApi.getScripts(activeProject.id).then(setScripts);
              testApi.getHistory(activeProject.id).then(setHistory).catch(err => {
                if (err.response?.status === 401) {
                  showAlert("Session Expired", "Please log in again to view execution results.", "error");
                }
              });
            }
          }}
          onAlert={showAlert}
          initialSearchTerm={librarySearchTerm}
        />;
      case ViewMode.HISTORY:
        return <HistoryView
          history={filteredHistory}
          activeProject={activeProject}
          onRefresh={() => {
            if (activeProject) {
              testApi.getHistory(activeProject.id)
                .then(setHistory)
                .catch(err => {
                  console.error("Failed to fetch history:", err);
                  if (err.response?.status === 401) {
                    showAlert("Authentication Required", "Your session has expired. Please refresh or re-login.", "error");
                  }
                });
            }
          }}
          onNavigateToLibrary={(scriptId) => {
            setLibrarySearchTerm(scriptId);
            setCurrentView(ViewMode.LIBRARY);
          }}
        />;
      case ViewMode.PIPELINE:
        return <PipelineWatcher activeProject={activeProject} scripts={filteredScripts} tasks={approvalTasks} onUpdateTasks={setApprovalTasks} onUpdateScript={(s) => setScripts(prev => prev.map(old => old.id === s.id ? s : old))} onAddScript={(s) => setScripts(prev => [s, ...prev])} onReviewInGenerator={(id) => { setFocusedDiscoveryId(id); setCurrentView(ViewMode.AI_GENERATOR); }} />;
      case ViewMode.SCHEDULES:
        return <SchedulerView schedules={filteredSchedules} scripts={filteredScripts} activeProject={activeProject} onAddSchedule={handleCreateSchedule} onUpdateSchedule={handleUpdateSchedule} onDeleteSchedule={handleDeleteSchedule} onAlert={showAlert} />;
      case ViewMode.DEVICE_FARM:
        return <DeviceFarm devices={devices} onUpdateDevice={(d) => setDevices(prev => prev.map(old => old.id === d.id ? d : old))} />;
      case ViewMode.PERSONAS:
        return <PersonaManager personas={personas.filter(p => (
          p.projectId === activeProject.id ||
          p.projectId === 'global' ||
          !p.projectId // Include null/undefined as global
        ))} activeProjectId={activeProject.id} onAddPersona={handleCreatePersona} onUpdatePersona={handleUpdatePersona} />;
      case ViewMode.SETTINGS:
        return <Settings
          user={currentUser!}
          activeProject={activeProject}
          projects={projects}
          users={users}
          access={[]}
          onUpdateProjects={(updatedProjects) => {
            setProjects(updatedProjects);
            // Sync activeProject if it was modified
            if (activeProject) {
              const currentUpdated = updatedProjects.find(p => p.id === activeProject.id);
              if (currentUpdated) {
                setActiveProject(currentUpdated);
              }
            }
          }}
          onUpdateUsers={setUsers}
          onUpdateAccess={() => { }}
          onAlert={showAlert}
        />;
      case ViewMode.REPORTS:
        return <ReportDashboard history={filteredHistory} scripts={filteredScripts} activeProject={activeProject} />;
      case ViewMode.DESIGN_CENTER:
        return (
          <DesignCenter
            activeProject={activeProject}
            user={currentUser!}
            personas={personas}
            onAddPersona={handleCreatePersona}
            onUpdatePersona={handleUpdatePersona}
            onAlert={showAlert}
          />
        );
      case ViewMode.CMS:
        return (
          <CustomerHub
            customers={customers}
            projects={projects}
            currentUser={currentUser}
            onSelectCustomer={(cust) => { setSelectedCustomer(cust); setIsBypassingToWorkspaces(true); }}
            onLogout={handleLogout}
            onCreateCustomer={handleCreateCustomer}
          />
        );
      default:
        return null;
    }
  };

  // Login View
  if (!currentUser) return (
    <div className="h-screen w-full bg-gray-50 dark:bg-[#0c0e12] flex items-center justify-center p-6 transition-colors duration-300">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center mb-10">
          <Logo className="w-20 h-20 mb-6 drop-shadow-xl dark:drop-shadow-[0_0_20px_rgba(59,153,212,0.3)] transition-all" />
          <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-white mb-2 transition-colors">Q-ONE</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest text-center">Autonomous QA Agent</p>
        </div>
        <div className="bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-2xl transition-colors duration-300">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 transition-colors">Master Login</h2>
          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-600 transition-colors" />
                <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-3 pl-12 pr-4 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" placeholder="Enter your email" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-600 transition-colors" />
                <input type={showPassword ? "text" : "password"} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full bg-gray-50 dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-3 pl-12 pr-12 text-sm text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" placeholder="Enter password" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-500 dark:text-gray-600 dark:hover:text-indigo-400 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {loginError && <div className="flex items-center gap-2 text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2 rounded-lg animate-in shake duration-300">
              <AlertCircle className="w-4 h-4" />
              <span className="text-[11px] font-bold">{loginError}</span>
            </div>}
            <button onClick={handleLogin} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2">
              <LogIn className="w-4 h-4" /> Sign In
            </button>
          </div>
          <p className="text-[9px] text-gray-500 dark:text-gray-600 mt-6 italic text-center px-1 transition-colors">* Hint: admin@qone.ai / password12</p>
        </div>
      </div>
    </div>
  );

  if (activeProject || (currentUser.isSaaSSuperAdmin && isBypassingToWorkspaces && activeProject)) {
    // Continue to Main App View below
  } else if (currentUser.isSaaSSuperAdmin && !isBypassingToWorkspaces) {
    return (
      <CustomerHub
        customers={customers}
        projects={projects}
        currentUser={currentUser}
        onSelectCustomer={(cust) => { setSelectedCustomer(cust); setIsBypassingToWorkspaces(true); }}
        onLogout={handleLogout}
        onCreateCustomer={handleCreateCustomer}
      />
    );
  } else {
    // Logic: If not Super Admin (or Super Admin bypassing), AND no active project -> Workspace Selection
    return (
      <WorkspaceSelection
        currentUser={currentUser}
        projects={projects}
        selectedCustomer={selectedCustomer}
        onSelectProject={handleSelectProject}
        onLogout={handleLogout}
        onAddProject={handleCreateProject}
        onBackToHub={currentUser.isSaaSSuperAdmin ? () => setIsBypassingToWorkspaces(false) : undefined}
      />
    );
  }



  // Main App View
  return (
    <div className="flex h-screen bg-white dark:bg-[#0f1115] text-gray-900 dark:text-gray-200 overflow-hidden transition-colors duration-300">
      {isSidebarOpen && (
        <Sidebar
          activeView={currentView}
          onViewChange={(view) => {
            // Reset Library Search when explicitly navigating via Menu
            if (view === ViewMode.LIBRARY) {
              setLibrarySearchTerm('');
            }

            // Auto-refresh data when entering views that display stats/history
            if (activeProject && [ViewMode.LIBRARY, ViewMode.HISTORY, ViewMode.REPORTS].includes(view as ViewMode)) {
              console.log(`[App] Auto-refreshing data for view: ${view}`);
              testApi.getScripts(activeProject.id).then(setScripts).catch(console.error);
              testApi.getHistory(activeProject.id).then(setHistory).catch(console.error);
            }

            setCurrentView(view);
          }}
          onSwitchProject={() => { setActiveProject(null); setIsBypassingToWorkspaces(false); }}
          scripts={filteredScripts}
          userRole={currentUser.role}
        />
      )}
      <main className="flex-1 relative flex flex-col min-w-0 bg-gray-50 dark:bg-transparent transition-colors duration-300">
        <header className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 bg-white/80 dark:bg-[#0f1115]/80 backdrop-blur-md z-10 transition-all">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-all"
              title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            >
              {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-2" />
            <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-200">{getViewTitle(currentView)}</h1>
            <span className="px-3 py-1 rounded-full text-[10px] bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 border uppercase font-bold tracking-widest">Project: {activeProject.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button onClick={() => setShowProfileModal(true)} className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-1.5 rounded-2xl hover:border-indigo-500 transition-all group shadow-sm dark:shadow-none">
              <div className="text-right flex flex-col"><span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none mb-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{currentUser.name}</span><span className="text-[8px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none">{currentUser.role}</span></div>
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700 group-hover:bg-gray-700 transition-all"><UserIcon className="w-4 h-4 text-gray-400 group-hover:text-white" /></div>
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">{renderView()}</div>
      </main>

      {/* Integrated Profile & Security Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-colors">
          <div className="relative w-full max-w-md bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 transition-colors">
            <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/20"><UserIcon className="w-6 h-6" /></div>
                <div><h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight transition-colors">Agent Profile</h3><p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest transition-colors">Identity & Security Control</p></div>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl text-gray-500 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-8">
              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800 transition-colors">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-600/10 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xl transition-colors">{currentUser.name.charAt(0)}</div>
                <div className="flex flex-col"><span className="text-sm font-bold text-gray-900 dark:text-white transition-colors">{currentUser.name}</span><span className="text-[10px] text-gray-500 dark:text-gray-400 transition-colors">{currentUser.email}</span></div>
                <div className="ml-auto px-2 py-1 bg-indigo-50 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 text-[8px] font-black uppercase rounded border border-indigo-200 dark:border-indigo-500/20 transition-colors">{currentUser.role}</div>
              </div>
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800 transition-colors">
                <div className="flex items-center gap-2 mb-2"><Key className="w-4 h-4 text-indigo-500 dark:text-indigo-400 transition-colors" /><h4 className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest transition-colors">Change Secret Key</h4></div>
                <div className="space-y-3">
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 dark:text-gray-600 transition-colors" />
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordForm.current}
                      onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
                      className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 pl-10 pr-10 text-xs text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors shadow-sm dark:shadow-none"
                      placeholder="Current Password"
                    />
                    <button onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-600 dark:text-gray-600 dark:hover:text-indigo-400 transition-colors">
                      {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 dark:text-gray-600 transition-colors" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.new}
                      onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
                      className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 pl-10 pr-10 text-xs text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors shadow-sm dark:shadow-none"
                      placeholder="New Secret Key (Min 8 chars, letters+numbers)"
                    />
                    <button onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-600 dark:text-gray-600 dark:hover:text-indigo-400 transition-colors">
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Check className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 dark:text-gray-600 transition-colors" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordForm.confirm}
                      onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                      className="w-full bg-white dark:bg-[#0c0e12] border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 pl-10 pr-10 text-xs text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-colors shadow-sm dark:shadow-none"
                      placeholder="Confirm Secret Key"
                    />
                    <button onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-600 dark:text-gray-600 dark:hover:text-indigo-400 transition-colors">
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {passwordError && <p className="text-[10px] text-red-500 font-bold uppercase italic px-1">{passwordError}</p>}
                <button onClick={handleUpdatePassword} className="w-full py-3 bg-gray-100 hover:bg-indigo-600 dark:bg-gray-900 text-gray-600 hover:text-white dark:text-gray-400 border border-gray-200 hover:border-indigo-500 dark:border-gray-800 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm dark:shadow-none">Update Credentials</button>
              </div>
              <button onClick={handleLogout} className="w-full py-4 bg-red-50 hover:bg-red-600 dark:bg-red-600/10 text-red-600 hover:text-white dark:text-red-500 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border border-red-100 hover:border-red-500 dark:border-transparent shadow-sm dark:shadow-none"><LogOut className="w-4 h-4" /> Finalize Session (Logout)</button>
            </div>
          </div>
        </div>
      )}

      {/* Global Alert Modal */}
      {alertState.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-8 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200 transition-colors">
          <div className="relative w-full max-w-sm bg-white dark:bg-[#16191f] border border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 transition-colors">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className={`p-4 rounded-full border mb-2 transition-colors ${alertState.type === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/20' : alertState.type === 'success' ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-500 border-green-200 dark:border-green-500/20' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20'}`}>
                {alertState.type === 'error' ? <AlertCircle className="w-8 h-8" /> : alertState.type === 'success' ? <CheckCircle2 className="w-8 h-8" /> : <Info className="w-8 h-8" />}
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2 transition-colors">{alertState.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm transition-colors">{alertState.message}</p>
              </div>
              <button
                onClick={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-900 dark:text-white rounded-xl text-xs font-black uppercase transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};



const App = () => (
  <ThemeProvider>
    <AppContent />
  </ThemeProvider>
);

export default App;
