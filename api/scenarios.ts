import { Scenario } from '../types';
import api from './client';

export interface FeatureFlow {
    name: string;
    description: string;
    flows: string[];
}

export interface AnalyzeUrlResponse {
    scenarios: BackendScenario[];
    dom_context?: string;
}

export interface BackendTestCase {
    id?: string;
    title: string;
    preCondition: string;
    inputData: string;
    steps: string[];
    expectedResult: string;
    status?: string;
    selectors?: Record<string, string>;
}

export interface BackendScenario {
    id?: string;
    project_id?: string;
    title: string;
    description: string;
    testCases: BackendTestCase[];
    persona_id?: string;
    is_approved?: boolean;
    created_at?: string;
    tags?: string[];
}

export interface GenerateScenariosRequest {
    features: FeatureFlow[];
    persona: { name: string, goal: string };
    additional_context?: string;
    dom_context?: string;
}

export interface GenerateScenariosResponse {
    scenarios: BackendScenario[];
}

export const scenariosApi = {
    analyzeUrl: async (url: string, prompt?: string, signal?: AbortSignal): Promise<AnalyzeUrlResponse> => {
        const response = await api.post<AnalyzeUrlResponse>('/scenarios/analyze-url', { url, prompt }, { signal });
        return response.data;
    },
    analyzeUpload: async (files: { name: string, type: string, data: string }[], prompt?: string, signal?: AbortSignal): Promise<AnalyzeUrlResponse> => {
        const response = await api.post<AnalyzeUrlResponse>('/scenarios/analyze-upload', { files, prompt }, { signal });
        return response.data;
    },
    generateScenarios: async (data: GenerateScenariosRequest): Promise<GenerateScenariosResponse> => {
        const response = await api.post<GenerateScenariosResponse>('/scenarios/generate-scenarios', data);
        return response.data;
    },
    // New Persistence Methods
    getAll: async (projectId: string, pendingAsset: boolean = false): Promise<Scenario[]> => {
        const response = await api.get<any[]>('/scenarios/', { params: { project_id: projectId, pending_asset: pendingAsset } });
        return response.data.map(s => ({
            id: s.id,
            projectId: s.project_id,
            title: s.title,
            description: s.description,
            testCases: s.testCases,
            personaId: s.persona_id,
            isApproved: s.is_approved,
            createdAt: s.created_at,
            tags: s.tags,
            goldenScriptId: s.golden_script_id
        }));
    },
    create: async (data: any): Promise<Scenario> => {
        const response = await api.post<any>('/scenarios/', data);
        return {
            id: response.data.id,
            projectId: response.data.project_id,
            title: response.data.title,
            description: response.data.description,
            testCases: response.data.testCases,
            personaId: response.data.persona_id,
            isApproved: response.data.is_approved,
            createdAt: response.data.created_at,
            tags: response.data.tags
        };
    },
    update: async (id: string, data: { golden_script_id?: string, is_approved?: boolean }): Promise<void> => {
        await api.put(`/scenarios/${id}`, data);
    }
};
