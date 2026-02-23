import { Persona } from '../types';

const API_URL = 'http://localhost:8001/api/v1';

export const personaApi = {
    getPersonas: async (projectId: string): Promise<Persona[]> => {
        console.log(`[PersonaAPI] Fetching personas for project: ${projectId}`);
        const response = await fetch(`${API_URL}/personas/?project_id=${projectId}&include_global=true`);
        console.log(`[PersonaAPI] Response status: ${response.status}`);
        if (!response.ok) {
            console.error('[PersonaAPI] Fetch failed');
            throw new Error('Failed to fetch personas');
        }

        // Convert snake_case from backend to camelCase for frontend
        const data = await response.json();
        console.log('[PersonaAPI] Raw Data:', data);
        return data.map((p: any) => ({
            ...p,
            skillLevel: p.skill_level,
            advancedLogic: p.advanced_logic,
            projectId: p.project_id || 'global',
            isActive: p.is_active // Map backend is_active to frontend isActive
        }));
    },

    createPersona: async (persona: Partial<Persona>): Promise<Persona> => {
        // Map camelCase to snake_case for backend
        const payload = {
            ...persona,
            skill_level: persona.skillLevel,
            advanced_logic: persona.advancedLogic,
            project_id: persona.projectId === 'global' ? 'global' : persona.projectId, // explicit check
            is_active: persona.isActive // Map frontend isActive to backend is_active
        };

        const response = await fetch(`${API_URL}/personas/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Failed to create persona');

        // Map back response
        const p = await response.json();
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

        const response = await fetch(`${API_URL}/personas/${persona.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Failed to update persona');

        const p = await response.json();
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
        const response = await fetch(`${API_URL}/personas/${personaId}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete persona');
    }
};
