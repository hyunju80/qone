
import api from './client';

export interface ExplorationStep {
    step_number: number;
    matching_score: number;
    score_breakdown: {
        Goal_Alignment: number;
        Page_Relevance: number;
        Action_Confidence: number;
    };
    thought: string;
    action_type: string;
    action_target: string;
    action_value: string;
    description: string;
    status: string;
    expectation?: string;
    observation?: string;
}

export interface SaveRequest {
    session_id: string;
    project_id: string;
    url: string;
    goal: string;
    persona_id?: string;
    persona_name?: string;
    history: ExplorationStep[];
    final_status: 'passed' | 'failed';
}

export const explorationApi = {
    start: async (url: string) => {
        const response = await api.post<{ session_id: string, state: any }>('/exploration/start', { url });
        return response.data;
    },

    step: async (sessionId: string, goal: string, history: ExplorationStep[], username?: string, password?: string) => {
        const payload = {
            session_id: sessionId,
            goal,
            history,
            username,
            password
        };
        const response = await api.post<ExplorationStep>('/exploration/step', payload);
        return response.data;
    },

    stop: async (sessionId: string) => {
        await api.post('/exploration/stop', { session_id: sessionId });
    },

    save: async (payload: SaveRequest) => {
        return await api.post('/exploration/save', payload);
    }
};
