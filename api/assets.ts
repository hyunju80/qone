import api from './client';
import { TestObject, TestAction, TestDataset } from '../types';

export const assetsApi = {
    // --- Objects ---
    getObjects: async (projectId: string) => {
        const response = await api.get<TestObject[]>('/assets/objects', { params: { project_id: projectId } });
        return response.data;
    },
    createObject: async (data: Partial<TestObject>) => {
        const response = await api.post<TestObject>('/assets/objects', data);
        return response.data;
    },
    updateObject: async (id: string, data: Partial<TestObject>) => {
        const response = await api.put<TestObject>(`/assets/objects/${id}`, data);
        return response.data;
    },

    // --- Actions ---
    getActions: async (projectId?: string) => {
        const params = projectId ? { project_id: projectId } : {};
        const response = await api.get<TestAction[]>('/assets/actions', { params });
        return response.data; // Backend returns List[TestActionResponse]
    },
    createAction: async (data: Partial<TestAction>) => {
        const response = await api.post<TestAction>('/assets/actions', data);
        return response.data;
    },
    updateAction: async (id: string, data: Partial<TestAction>) => {
        const response = await api.put<TestAction>(`/assets/actions/${id}`, data);
        return response.data;
    },

    // --- Data ---
    getDatasets: async (projectId: string) => {
        const response = await api.get<TestDataset[]>('/assets/data', { params: { project_id: projectId } });
        return response.data;
    },
    createDataset: async (data: Partial<TestDataset>) => {
        const response = await api.post<TestDataset>('/assets/data', data);
        return response.data;
    },
    updateDataset: async (id: string, data: Partial<TestDataset>) => {
        const response = await api.put<TestDataset>(`/assets/data/${id}`, data);
        return response.data;
    }
};
