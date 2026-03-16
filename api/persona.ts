import { Persona } from '../types';
import api from './client';

export const personaApi = {
    getPersonas: async (projectId: string): Promise<Persona[]> => {
        console.log(`[PersonaAPI] Fetching personas for project: ${projectId}`);
        const response = await api.get<any[]>('/personas/', {
            params: {
                project_id: projectId,
                include_global: true
            }
        });

        const data = response.data;
        console.log('[PersonaAPI] Raw Data:', data);

        return data.map((p: any) => ({
            ...p,
            skillLevel: p.skill_level,
            advancedLogic: p.advanced_logic,
            projectId: p.project_id || 'global',
            isActive: p.is_active
        }));
    },

    createPersona: async (persona: Partial<Persona>): Promise<Persona> => {
        const payload = {
            ...persona,
            skill_level: persona.skillLevel,
            advanced_logic: persona.advancedLogic,
            project_id: persona.projectId === 'global' ? 'global' : persona.projectId,
            is_active: persona.isActive
        };

        const response = await api.post<any>('/personas/', payload);
        const p = response.data;

        return {
            ...p,
            skillLevel: p.skill_level,
            advancedLogic: p.advanced_logic,
            projectId: p.project_id || 'global',
            isActive: p.is_active
        };
    },

    updatePersona: async (persona: Persona): Promise<Persona> => {
        const payload = {
            ...persona,
            skill_level: persona.skillLevel,
            advanced_logic: persona.advancedLogic,
            project_id: persona.projectId === 'global' ? 'global' : persona.projectId,
            is_active: persona.isActive
        };

        console.log("[PersonaAPI] Updating persona payload:", payload);
        const response = await api.put<any>(`/personas/${persona.id}`, payload);
        const p = response.data;

        console.log("[PersonaAPI] Update response:", p);
        return {
            ...p,
            skillLevel: p.skill_level,
            advancedLogic: p.advanced_logic,
            projectId: p.project_id || 'global',
            isActive: p.is_active
        };
    },

    deletePersona: async (personaId: string): Promise<void> => {
        await api.delete(`/personas/${personaId}`);
    }
};
