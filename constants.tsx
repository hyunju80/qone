
import { ScriptStatus, TestScript, Persona, ActionLibraryItem, ScriptOrigin, Project, User, ProjectAccess, TestHistory, TestSchedule, DataType, Device, CustomerAccount, ApprovalTask } from './types';

export const MOCK_CUSTOMER: CustomerAccount = {
  id: 'cust_abc_123',
  companyName: 'NexGen Fintech Solutions',
  businessNumber: '123-45-67890',
  plan: 'Pro',
  billingEmail: 'billing@nexgen.io',
  adminEmail: 'admin@qone.ai',
  createdAt: '2023-01-01',
  usage: {
    aiTokens: { current: 45000, max: 100000 },
    testRuns: { current: 1240, max: 5000 },
    scriptStorage: { current: 85, max: 200 },
    deviceHours: { current: 320, max: 1000 }
  }
};

export const MOCK_ALL_CUSTOMERS: CustomerAccount[] = [
  MOCK_CUSTOMER,
  {
    id: 'cust_xyz_789',
    companyName: 'Global E-Commerce Group',
    businessNumber: '987-65-43210',
    plan: 'Enterprise',
    billingEmail: 'ops@global-ecommerce.com',
    adminEmail: 'jason@global-ecommerce.com',
    createdAt: '2023-06-12',
    usage: {
      aiTokens: { current: 89000, max: 500000 },
      testRuns: { current: 4200, max: 10000 },
      scriptStorage: { current: 142, max: 1000 },
      deviceHours: { current: 1200, max: 5000 }
    }
  },
  {
    id: 'cust_mno_456',
    companyName: 'BlueSky Logistics',
    businessNumber: '555-44-33333',
    plan: 'Free',
    billingEmail: 'contact@bluesky.io',
    adminEmail: 'bluesky_admin@bluesky.io',
    createdAt: '2023-10-05',
    usage: {
      aiTokens: { current: 800, max: 1000 },
      testRuns: { current: 45, max: 50 },
      scriptStorage: { current: 4, max: 10 },
      deviceHours: { current: 8, max: 20 }
    }
  }
];

export const MOCK_USERS: User[] = [
  { id: 'su1', customerAccountId: 'qone_internal', name: 'Master Operator', email: 'super_admin@qone.ai', password: 'password12', role: 'Admin', isSaaSSuperAdmin: true, isActive: true },
  { id: 'u0', customerAccountId: 'cust_abc_123', name: 'Admin User', email: 'admin@qone.ai', password: 'password12', role: 'Admin', isActive: true },
  { id: 'u1', customerAccountId: 'cust_abc_123', name: 'James Kim', email: 'james@nexgen.io', password: 'password12', role: 'Admin', isActive: true },
  { id: 'u2', customerAccountId: 'cust_abc_123', name: 'Sarah Lee', email: 'sarah@nexgen.io', password: 'password12', role: 'Manager', isActive: true },
  { id: 'u3', customerAccountId: 'cust_abc_123', name: 'Kevin Park', email: 'kevin@nexgen.io', password: 'password12', role: 'QA Engineer', isActive: true }
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj1',
    customerAccountId: 'cust_abc_123',
    name: 'Fintech Alpha',
    description: 'Banking and payment processing workspace.',
    domain: 'Fintech',
    createdAt: '2023-01-15',
    targetDevices: ['PC-Web', 'Mobile-Web'],
    environments: {
      Development: 'https://dev.alpha-fintech.io',
      Staging: 'https://stg.alpha-fintech.io',
      Production: 'https://alpha-fintech.io'
    },
    objectRepo: [
      { id: 'el1', name: 'LoginButton', selector: '#auth_submit', description: 'Primary submit button on login' },
      { id: 'el2', name: 'AccountBalance', selector: '.balance-display', description: 'Dashboard balance indicator' }
    ]
  },
  {
    id: 'proj2',
    customerAccountId: 'cust_abc_123',
    name: 'E-Shop Beta',
    description: 'Retail platform with complex cart logic.',
    domain: 'E-commerce',
    createdAt: '2023-03-22',
    targetDevices: ['Mobile-App'],
    mobileConfig: {
      androidPackage: 'com.nexgen.eshop.beta',
      iosBundleId: 'io.nexgen.eshop.beta',
      appVersion: '2.4.1'
    },
    environments: {
      Development: 'https://dev-shop.internal',
      Staging: 'https://stg-shop.internal',
      Production: 'https://shop.nexgen.io'
    },
    objectRepo: []
  },
  {
    id: 'proj_global_1',
    customerAccountId: 'cust_xyz_789',
    name: 'Global Mall v1',
    description: 'Main flagship e-commerce platform.',
    domain: 'E-commerce',
    createdAt: '2023-07-01',
    targetDevices: ['PC-Web'],
    environments: { Development: '', Staging: '', Production: '' },
    objectRepo: []
  }
];

export const MOCK_ACCESS: ProjectAccess[] = [
  { userId: 'u1', projectId: 'proj1', accessRole: 'Admin' },
  { userId: 'u1', projectId: 'proj2', accessRole: 'Admin' },
  { userId: 'u2', projectId: 'proj1', accessRole: 'Manager' }
];

export const PERSONAS: Persona[] = [
  {
    id: 'p1',
    projectId: 'global',
    name: 'Standard User',
    description: 'Typical customer journey simulation.',
    traits: ['Patient', 'Careful'],
    skillLevel: 'Intermediate',
    speed: 'Moderate',
    goal: 'Navigate to checkout successfully',
    isActive: true,
    advancedLogic: []
  },
  {
    id: 'p2',
    projectId: 'global',
    name: 'Impulsive Buyer',
    description: 'Bypasses tutorials, clicks fast, ignores tooltips.',
    traits: ['Fast', 'Impatience'],
    skillLevel: 'Expert',
    speed: 'Fast',
    goal: 'Complete purchase in minimum clicks',
    isActive: true,
    advancedLogic: ['Skip all banners']
  }
];

export const MOCK_SCRIPTS: TestScript[] = [
  {
    id: '1',
    projectId: 'proj1',
    name: 'Login Regression',
    description: 'Verifies standard login path and MFA session persistence.',
    status: ScriptStatus.CERTIFIED,
    lastRun: '2023-11-02 10:00',
    runCount: 45,
    successRate: 94,
    code: 'test("login", async ({page}) => { ... })',
    origin: ScriptOrigin.MANUAL,
    isActive: true,
    persona: PERSONAS[0],
    tags: ['Auth', 'Core'],
    dataset: [
      { id: 'd1', field: 'USER_ID', value: 'tester_alpha', type: DataType.VALID, description: 'Default testing account' },
      { id: 'd2', field: 'PASSWORD', value: 'P@ssword123!', type: DataType.VALID, description: 'Standard secure password' }
    ]
  },
  {
    id: '2',
    projectId: 'proj1',
    name: 'Balance Inquiry API',
    description: 'Validates real-time balance updates after transaction.',
    status: ScriptStatus.CERTIFIED,
    lastRun: '2023-11-01 23:45',
    runCount: 128,
    successRate: 98,
    code: 'test("balance", async ({request}) => { ... })',
    origin: ScriptOrigin.AI,
    isActive: true,
    persona: PERSONAS[1],
    tags: ['API', 'Financial'],
    dataset: []
  }
];

export const MOCK_HISTORY: TestHistory[] = [
  {
    id: 'h_sch_01',
    scriptId: '1',
    scriptName: 'Login Regression',
    runDate: '2023-11-02 00:00',
    status: 'passed',
    duration: '14.2s',
    personaName: 'Standard User',
    trigger: 'scheduled',
    scheduleName: 'Daily Core Regression',
    scheduleId: 'sch_01',
    aiSummary: "Midnight batch execution completed successfully.",
    logs: []
  }
];

export const MOCK_TASKS: ApprovalTask[] = [
  {
    id: 'task1',
    type: 'SELF_HEALING',
    title: 'UI Change Detected: Login Button',
    description: 'Login button ID changed from #submit_btn to #auth_submit. AI generated a fix.',
    scriptId: '1',
    originalCode: `await page.click('#submit_btn');`,
    proposedCode: `await page.click('#auth_submit');`,
    diffSummary: 'Selector update in login flow',
    createdAt: '2 mins ago'
  }
];

export const MOCK_SCHEDULES: TestSchedule[] = [
  {
    id: 'sch_01',
    projectId: 'proj1',
    name: 'Daily Core Regression',
    scriptIds: ['1'],
    cronExpression: '0 0 * * *',
    frequencyLabel: 'Every Midnight',
    lastRun: '2023-11-02 00:00',
    nextRun: '2023-11-03 00:00',
    isActive: true,
    alertConfig: {
      channels: ['slack', 'email', 'jira'],
      criticalOnly: true,
      failureThreshold: 1
    },
    priority: 'Critical'
  }
];

export const ACTION_LIBRARY: ActionLibraryItem[] = [
  {
    id: 'lib1',
    projectId: 'global',
    name: 'Qone.ui.clickSafe',
    category: 'Common',
    description: 'Performs a click action with built-in retry logic.',
    parameters: [
      { name: 'selector', type: 'string', required: true, description: 'CSS or Playwright selector' }
    ],
    example: "await Qone.ui.clickSafe('button#submit');",
    usageCount: 1240,
    isPrioritized: true,
    isGlobal: true
  }
];

export const MOCK_DEVICES: Device[] = [
  {
    id: 'dev1',
    alias: 'QA-Android-01',
    protocol: 'ADB',
    os: 'Android',
    model: 'Samsung Galaxy S23 Ultra',
    status: 'Available',
    specs: { osVersion: '14.0', resolution: '1440x3088', ram: '12GB', cpu: 'S23' }
  }
];
