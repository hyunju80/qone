import api from './client';
import { Project } from '../types';

export const projectsApi = {
    getAll: async () => {
        const response = await api.get<any[]>('/projects/');
        return response.data.map(p => ({
            id: p.id,
            customerAccountId: p.customer_account_id,
            name: p.name,
            description: p.description,
            domain: p.domain,
            createdAt: p.created_at,
            targetDevices: p.target_devices || [],
            environments: p.environments || {},
            objectRepo: p.object_repo || [],
            mobileConfig: p.mobile_config || {}
        } as Project));
    },

    create: async (data: { name: string; description?: string; domain?: string; targetDevices?: string[] }) => {
        const payload = {
            name: data.name,
            description: data.description,
            domain: data.domain,
            target_devices: data.targetDevices
        };
        const response = await api.post<any>('/projects/', payload);
        const p = response.data;
        return {
            id: p.id,
            customerAccountId: p.customer_account_id,
            name: p.name,
            description: p.description,
            domain: p.domain,
            createdAt: p.created_at,
            targetDevices: p.target_devices || [],
            environments: p.environments || {},
            objectRepo: p.object_repo || [],
            mobileConfig: p.mobile_config || {}
        } as Project;
    },

    update: async (projectId: string, data: Partial<Project>) => {
        const payload: any = {};
        if (data.name) payload.name = data.name;
        if (data.description) payload.description = data.description;
        if (data.domain) payload.domain = data.domain;
        if (data.targetDevices) payload.target_devices = data.targetDevices;
        if (data.environments) payload.environments = data.environments;
        if (data.objectRepo) payload.object_repo = data.objectRepo;
        if (data.mobileConfig) payload.mobile_config = data.mobileConfig;

        const response = await api.put<any>(`/projects/${projectId}`, payload);
        const p = response.data;
        return {
            id: p.id,
            customerAccountId: p.customer_account_id,
            name: p.name,
            description: p.description,
            domain: p.domain,
            createdAt: p.created_at,
            targetDevices: p.target_devices || [],
            environments: p.environments || {},
            objectRepo: p.object_repo || [],
            mobileConfig: p.mobile_config || {}
        } as Project;
    }
};
