import api from './client';
import { TestScript, Scenario, TestHistory, TestSchedule } from '../types';

// Helper to map snake_case backend response to camelCase frontend interface
const mapScript = (s: any): TestScript => {
    console.log(`[testApi] Mapping script ${s.id}: run_count=${s.run_count}, success_rate=${s.success_rate}`);
    return {
        ...s,
        projectId: s.project_id || s.projectId,
        runCount: s.run_count !== undefined ? s.run_count : s.runCount,
        successRate: s.success_rate !== undefined ? s.success_rate : s.successRate,
        isActive: s.is_active !== undefined ? s.is_active : s.isActive,
        isFavorite: s.is_favorite !== undefined ? s.is_favorite : s.isFavorite,
        lastRun: s.last_run || s.lastRun,
        // Ensure persona relation is preserved if returned
        persona: s.persona
    };
};

// Helper to map snake_case scenario to camelCase
const mapScenario = (s: any): Scenario => ({
    ...s,
    projectId: s.project_id || s.projectId,
    isApproved: s.is_approved !== undefined ? s.is_approved : s.isApproved,
    personaId: s.persona_id || s.personaId,
    testCases: s.test_cases || s.testCases || [],
    goldenScriptId: s.golden_script_id || s.goldenScriptId
});

// Helper to map snake_case history to camelCase
const mapHistory = (h: any): TestHistory => ({
    ...h,
    projectId: h.project_id || h.projectId,
    scriptId: h.script_id || h.scriptId,
    scriptName: h.script_name || h.scriptName,
    runDate: h.run_date || h.runDate,
    personaName: h.persona_name || h.personaName,
    failureReason: h.failure_reason || h.failureReason,
    aiSummary: h.ai_summary || h.aiSummary,
    deploymentVersion: h.deployment_version || h.deploymentVersion,
    commitHash: h.commit_hash || h.commitHash,
    scheduleId: h.schedule_id || h.scheduleId,
    scheduleName: h.schedule_name || h.scheduleName,
    scriptOrigin: h.script_origin || h.scriptOrigin
});

export const testApi = {
    // Scripts
    getScripts: async (projectId: string) => {
        const response = await api.get<any[]>('/scripts/', {
            params: {
                project_id: projectId,
                _t: Date.now()
            }
        });
        return response.data.map(mapScript);
    },
    createScript: async (data: any) => {
        const response = await api.post<any>('/scripts/', data);
        return mapScript(response.data);
    },
    updateScript: async (id: string, data: any) => {
        const response = await api.put<any>(`/scripts/${id}`, data);
        return mapScript(response.data);
    },
    generateScript: async (data: { scenarios: any[]; persona: any; projectContext?: string; projectId?: string }) => {
        const response = await api.post<{ code: string; tags: string[] }>('/scripts/generate', data);
        return response.data;
    },
    dryRun: async (data: any) => {
        const response = await api.post<{ run_id: string }>('/run/dry-run', data);
        return response.data;
    },
    runActiveSteps: async (data: any) => {
        const response = await api.post<{ run_id: string }>('/run/active-steps', data);
        return response.data;
    },
    generateData: async (scenarios: any[], dataTypes: string[], count: number = 2) => {
        const response = await api.post<{ data: any[] }>('/ai/generate-data', { scenarios, data_types: dataTypes, count });
        return response.data;
    },

    // Scenarios
    getScenarios: async (projectId: string) => {
        const response = await api.get<any[]>('/scenarios/', {
            params: {
                project_id: projectId,
                _t: Date.now()
            }
        });
        return response.data.map(mapScenario);
    },
    createScenario: async (data: any) => {
        const response = await api.post<any>('/scenarios/', data);
        return mapScenario(response.data);
    },

    // History
    getHistory: async (projectId: string) => {
        const response = await api.get<any[]>('/history/', {
            params: {
                project_id: projectId,
                _t: Date.now()
            }
        });
        return response.data.map(mapHistory);
    },
    createHistory: async (data: any) => {
        const response = await api.post<TestHistory>('/history/', data);
        return response.data;
    },

    // Schedules
    getSchedules: async (projectId: string) => {
        const response = await api.get<TestSchedule[]>('/schedules/', { params: { project_id: projectId } });
        return response.data;
    }
};
