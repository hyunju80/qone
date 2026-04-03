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
    platform?: string;
    target?: string;
    created_at?: string;
    tags?: string[];
    category?: string;
}

export interface GenerateScenariosRequest {
    features: FeatureFlow[];
    persona: { name: string, goal: string };
    additional_context?: string;
    dom_context?: string;
    project_id?: string;
}

export interface GenerateScenariosResponse {
    scenarios: BackendScenario[];
}

export interface KnowledgeHierarchyItem {
    name: string;
    level: string;
    item_ids: string[];
    children: KnowledgeHierarchyItem[];
}

export const scenariosApi = {
    analyzeUrl: async (url: string, prompt?: string, projectId?: string, personaId?: string, signal?: AbortSignal): Promise<AnalyzeUrlResponse> => {
        const response = await api.post<AnalyzeUrlResponse>('/scenarios/analyze-url', { url, prompt, project_id: projectId, persona_id: personaId }, { signal });
        return response.data;
    },
    analyzeUpload: async (files: { name: string, type: string, data: string }[], prompt?: string, projectId?: string, personaId?: string, signal?: AbortSignal): Promise<AnalyzeUrlResponse> => {
        const response = await api.post<AnalyzeUrlResponse>('/scenarios/analyze-upload', { files, prompt, project_id: projectId, persona_id: personaId }, { signal });
        return response.data;
    },
    analyzeKnowledge: async (itemIds: string[], projectId: string, prompt?: string, personaId?: string, signal?: AbortSignal): Promise<AnalyzeUrlResponse> => {
        const response = await api.post<AnalyzeUrlResponse>('/scenarios/analyze-knowledge', { item_ids: itemIds, project_id: projectId, prompt, persona_id: personaId }, { signal });
        return response.data;
    },
    generateScenarios: async (data: GenerateScenariosRequest): Promise<GenerateScenariosResponse> => {
        const response = await api.post<GenerateScenariosResponse>('/scenarios/generate-scenarios', data);
        return response.data;
    },
    // New Map-Based Generation Methods
    mapActionFlow: async (url: string, maxDepth: number = 1, excludeSelectors?: string[], includeSelector?: string, contentSelector?: string): Promise<{ status: string, map: any }> => {
        const response = await api.post<{ status: string, map: any }>('/scenarios/map-action-flow', {
            url,
            max_depth: maxDepth,
            exclude_selectors: excludeSelectors,
            include_selector: includeSelector,
            content_selector: contentSelector
        });
        return response.data;
    },
    generateFromMap: async (actionMap: any, prompt?: string, projectId?: string, personaId?: string): Promise<AnalyzeUrlResponse> => {
        const response = await api.post<AnalyzeUrlResponse>('/scenarios/generate-from-map', { action_map: actionMap, prompt, project_id: projectId, persona_id: personaId });
        return response.data;
    },

    // Map Persistence (Moved to Knowledge Repository)
    saveActionMap: async (payload: { project_id: string, url: string, title: string, map_json: any }) => {
        const response = await api.post('/knowledge/maps', payload);
        return response.data;
    },
    listActionMaps: async (projectId: string) => {
        const response = await api.get(`/knowledge/maps/${projectId}`);
        return response.data;
    },
    deleteActionMap: async (mapId: string) => {
        const response = await api.delete(`/knowledge/maps/${mapId}`);
        return response.data;
    },
    updateActionMap: async (mapId: string, payload: { title?: string, map_json?: any }) => {
        const response = await api.put(`/knowledge/maps/${mapId}`, payload);
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
            testCases: s.testCases || s.test_cases || [],
            personaId: s.persona_id,
            isApproved: s.is_approved,
            platform: s.platform,
            target: s.target,
            createdAt: s.created_at,
            tags: s.tags,
            category: s.category,
            goldenScriptId: s.golden_script_id,
            persona: s.persona ? {
                ...s.persona,
                projectId: s.persona.project_id,
                skillLevel: s.persona.skill_level,
                advancedLogic: s.persona.advanced_logic,
                isActive: s.persona.is_active
            } : undefined
        }));
    },
    create: async (data: any): Promise<Scenario> => {
        const response = await api.post<any>('/scenarios/', data);
        return {
            id: response.data.id,
            projectId: response.data.project_id,
            title: response.data.title,
            description: response.data.description,
            testCases: response.data.testCases || response.data.test_cases || [],
            personaId: response.data.persona_id,
            isApproved: response.data.is_approved,
            platform: response.data.platform,
            target: response.data.target,
            createdAt: response.data.created_at,
            tags: response.data.tags,
            category: response.data.category
        };
    },
    update: async (id: string, data: {
        golden_script_id?: string,
        is_approved?: boolean,
        try_count?: number,
        enable_ai_test?: boolean,
        category?: string,
        title?: string,
        description?: string,
        tags?: string[]
    }): Promise<void> => {
        await api.put(`/scenarios/${id}`, data);
    },

    // Knowledge Documents (RAG)
    getHierarchy: async (projectId: string): Promise<KnowledgeHierarchyItem[]> => {
        const response = await api.get(`/knowledge/hierarchy/${projectId}`);
        return response.data;
    },
    getDocuments: async (projectId: string) => {
        const response = await api.get(`/knowledge/documents/${projectId}`);
        return response.data;
    },
    uploadDocument: async (formData: FormData) => {
        const response = await api.post('/knowledge/documents', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },
    deleteDocument: async (docId: string) => {
        const response = await api.delete(`/knowledge/documents/${docId}`);
        return response.data;
    },
    getDocumentItems: async (docId: string) => {
        const response = await api.get(`/knowledge/documents/${docId}/items`);
        return response.data;
    },
    analyzeHybrid: async (payload: {
        item_ids: string[],
        map_ids: string[],
        files: { name: string, type: string, data: string }[],
        prompt: string,
        project_id: string,
        persona_id: string,
        strategies: string[]
    }, signal?: AbortSignal): Promise<AnalyzeUrlResponse> => {
        const response = await api.post<AnalyzeUrlResponse>('/scenarios/analyze-hybrid', payload, { signal });
        return response.data;
    }
};
