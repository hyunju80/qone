export enum ViewMode {
  CONSOLE = 'console',
  PIPELINE = 'pipeline',
  AI_GENERATOR = 'ai_generator', // Integrated Generator (Scenario + Test)
  AI_EXPLORATION = 'ai_exploration', // AI Autonomous Exploration (Experimental)
  SCENARIO_GENERATOR = 'scenario_generator', // Deprecated in UI, kept for compatibility if needed
  GENERATOR = 'generator', // Test Generator (Script) - Deprecated in UI
  STEP_RUNNER = 'step_runner', // Step Execution (Block Coding)
  LIBRARY = 'library',
  HISTORY = 'history',
  PERSONAS = 'personas',
  SETTINGS = 'settings',
  SCHEDULES = 'schedules',
  REPORTS = 'reports',
  DEVICE_FARM = 'device_farm',
  CMS = 'cms', // Customer Management System (Super Admin)
  DESIGN_CENTER = 'design_center' // Asset Management
}

export type UserRole = 'Super Admin' | 'Admin' | 'Manager' | 'QA Engineer' | 'Viewer';

// ... (existing code) ...

export interface StepAsset {
  id: string;
  projectId: string; // Assuming backend returns this
  name: string;
  description: string;
  platform: 'WEB' | 'APP';
  steps: TestStep[];
  createdAt?: string;
  updatedAt?: string;
  // New fields for card parity
  isFavorite?: boolean;
  isActive?: boolean;
  successRate?: number;
  runCount?: number;
}

export interface TestObject {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  selector_type: string;
  value: string;
  platform: 'WEB' | 'APP' | 'COMMON';
  is_active: boolean;
  usage_count: number;
  last_verified_at?: string;
}

export interface TestAction {
  id: string;
  projectId?: string | null; // Global if null
  name: string;
  description?: string;
  category: string;
  code_content: string;
  parameters: { name: string; type: string; required: boolean; description: string }[];
  platform: 'WEB' | 'APP' | 'COMMON';
  is_active: boolean;
}

export interface TestDataset {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  data: { key: string; value: string; type: string; description?: string }[];
  platform: 'WEB' | 'APP' | 'COMMON';
  classification: 'VALID' | 'INVALID' | 'SECURITY' | 'EDGE_CASE';
  is_active: boolean;
  generation_source: 'MANUAL' | 'LLM';
}

export interface User {
  id: string;
  customerAccountId: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  isSaaSSuperAdmin?: boolean;
  isActive: boolean;
}

export type SubscriptionPlan = 'Free' | 'Pro' | 'Enterprise';

export interface UsageStats {
  aiTokens: { current: number; max: number };
  testRuns: { current: number; max: number };
  scriptStorage: { current: number; max: number };
  deviceHours: { current: number; max: number };
}

export interface CustomerAccount {
  id: string;
  companyName: string;
  businessNumber: string;
  plan: SubscriptionPlan;
  billingEmail: string;
  adminEmail: string;
  usage: UsageStats;
  createdAt: string;
}

export type TargetDevice = 'PC-Web' | 'Mobile-Web' | 'Mobile-App';
export type ProjectEnvironment = 'Development' | 'Staging' | 'Production';
export type TestEngine = 'Playwright' | 'Appium';

export interface ObjectElement {
  id: string;
  name: string;
  selector: string;
  description: string;
}

export interface ProjectMobileConfig {
  androidPackage?: string;
  iosBundleId?: string;
  appVersion?: string;
}

export interface Project {
  id: string;
  customerAccountId: string;
  name: string;
  description: string;
  domain: string;
  createdAt: string;
  targetDevices: TargetDevice[];
  environments: Record<ProjectEnvironment, string>;
  targetUrl?: string;
  appId?: string;
  objectRepo: ObjectElement[];
  mobileConfig?: ProjectMobileConfig;
}

export interface ProjectAccess {
  userId: string;
  projectId: string;
  accessRole: UserRole;
}

export interface PipelineStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  timestamp: string;
  description: string;
  details?: string[];
}

export interface ApprovalTask {
  id: string;
  type: 'SELF_HEALING' | 'NEW_SCENARIO' | 'BUG_REPORT';
  title: string;
  description: string;
  scriptId?: string;
  originalCode?: string;
  proposedCode?: string;
  severity?: 'High' | 'Medium' | 'Low';
  diffSummary?: string;
  createdAt: string;
}

export enum ScriptStatus {
  CERTIFIED = 'CERTIFIED',
  PENDING = 'PENDING'
}

export enum ScriptOrigin {
  MANUAL = 'MANUAL',
  AI = 'AI',
  AI_EXPLORATION = 'AI_EXPLORATION',
  STEP = 'STEP'
}

export enum DataType {
  VALID = 'VALID',
  INVALID = 'INVALID',
  SECURITY = 'SECURITY',
  EDGE_CASE = 'EDGE_CASE'
}

export interface Persona {
  id: string;
  projectId: string;
  name: string;
  description: string;
  traits: string[];
  skillLevel: 'Novice' | 'Intermediate' | 'Expert';
  speed: 'Slow' | 'Moderate' | 'Fast';
  goal: string;
  isActive: boolean;
  advancedLogic: string[];
}

export interface TestDataRow {
  id: string;
  field: string;
  value: string;
  type: DataType;
  description: string;
}

// 시나리오 기반 관리를 위한 인터페이스
export interface Scenario {
  id: string;
  projectId: string;
  title: string;
  description: string;
  testCases: TestCase[];
  personaId?: string;
  createdAt: string;
  isApproved: boolean;
  tags?: string[];
  goldenScriptId?: string;
}

export interface TestCase {
  id: string;
  title: string;
  description: string;
  status: string;
  preCondition: string;   // 신규: 사전 조건
  inputData: string;      // 신규: 입력 데이터
  steps: string[];        // 기존: 수행 절차
  expectedResult: string; // 기존: 기대 결과
}

export interface TestScript {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: ScriptStatus;
  lastRun: string;
  runCount: number;
  successRate: number;
  code: string;
  origin: ScriptOrigin;
  tags?: string[];
  isFavorite?: boolean;
  isActive: boolean;
  persona?: Persona;
  dataset?: TestDataRow[];
  engine?: TestEngine;
  steps?: TestStep[];
  platform?: 'WEB' | 'APP';
}

export interface LogEntry {
  msg: string;
  type: 'info' | 'success' | 'error' | 'cmd';
}

export type ExecutionTrigger = 'manual' | 'pipeline' | 'scheduled' | 'ai_exploration';

export interface TestHistory {
  id: string;
  projectId?: string;
  scriptId: string;
  scriptName: string;
  runDate: string;
  status: 'passed' | 'failed';
  duration: string;
  personaName: string;
  trigger: ExecutionTrigger;
  failureReason?: string;
  aiSummary?: string;
  logs: LogEntry[];
  step_results?: any[]; // Universal step results
  deploymentVersion?: string;
  commitHash?: string;
  scheduleId?: string;
  scheduleName?: string;
  scriptOrigin?: ScriptOrigin | string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'script' | 'report';
  reportData?: {
    summary: string;
    metrics?: { label: string; value: string | number }[];
    table?: { headers: string[]; rows: string[][] };
  };
}

export interface ActionParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ActionLibraryItem {
  id: string;
  projectId: string;
  name: string;
  category: string;
  description: string;
  parameters: ActionParameter[];
  example: string;
  usageCount: number;
  isPrioritized: boolean;
  isGlobal: boolean;
}

export interface Incident {
  id: string;
  timestamp: string;
  scriptName: string;
  channel: 'slack' | 'email' | 'jira' | 'teams';
  summary: string;
  details: string;
}

export type TriggerStrategy = 'SCHEDULE' | 'DEPLOYMENT' | 'BOTH';

export interface TestSchedule {
  id: string;
  projectId: string;
  name: string;
  scriptIds: string[];
  cronExpression: string;
  frequencyLabel: string;
  lastRun: string;
  nextRun: string;
  isActive: boolean;
  alertConfig: {
    channels: ('slack' | 'email' | 'jira' | 'teams')[];
    criticalOnly: boolean;
    failureThreshold: number;
  };
  priority: 'Critical' | 'High' | 'Normal';
  triggerStrategy?: TriggerStrategy;
  incidentHistory?: Incident[];
}

export type DeviceOS = 'Android' | 'iOS' | 'Windows' | 'macOS';
export type DeviceStatus = 'Available' | 'In-Use' | 'Offline';

export interface Device {
  id: string;
  alias: string;
  protocol: 'ADB' | 'WDA' | 'WebDriver';
  os: DeviceOS;
  model: string;
  status: DeviceStatus;
  specs: {
    osVersion: string;
    resolution: string;
    ram: string;
    cpu: string;
  };
  currentProject?: string;
}

export interface TestStep {
  id: string;
  action: string;
  selectorType: string;
  selectorValue: string;
  option?: string;
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
}

export interface StepAsset {
  id: string;
  projectId: string; // Assuming backend returns this
  name: string;
  description: string;
  platform: 'WEB' | 'APP';
  steps: TestStep[];
  createdAt?: string;
  updatedAt?: string;
  // New fields for card parity
  isFavorite?: boolean;
  isActive?: boolean;
  successRate?: number;
  runCount?: number;
}
