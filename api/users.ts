import api from './client';
import { User, RolePermission } from '../types';

export const usersApi = {
    getAll: async () => {
        const response = await api.get<any[]>('/users/');
        return response.data.map(u => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            customerAccountId: u.customer_account_id
        } as User));
    },

    getByProject: async (projectId: string) => {
        const response = await api.get<any[]>(`/projects/${projectId}/users`);
        return response.data.map(u => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            customerAccountId: u.customer_account_id
        } as User));
    },

    inviteToProject: async (projectId: string, data: { name: string; email: string; role: string }) => {
        const response = await api.post(`/projects/${projectId}/invite`, data);
        return response.data;
    },

    update: async (userId: string, data: Partial<User>) => {
        const response = await api.put<User>(`/users/${userId}`, data);
        return response.data;
    },

    delete: async (userId: string) => {
        await api.delete(`/users/${userId}`);
    },

    updatePassword: async (current: string, newPass: string) => {
        const response = await api.put<User>(`/users/me/password`, {
            current_password: current,
            new_password: newPass
        });
        return response.data;
    },

    getPermissions: async () => {
        const response = await api.get<any[]>('/users/permissions');
        return response.data.map(p => ({
            id: p.id,
            category: p.category,
            feature: p.feature,
            adminAllowed: p.admin_allowed,
            managerAllowed: p.manager_allowed,
            qaEngineerAllowed: p.qa_engineer_allowed,
            viewerAllowed: p.viewer_allowed
        } as RolePermission));
    },

    updatePermission: async (id: string, data: any) => {
        const response = await api.put(`/users/permissions/${id}`, data);
        return response.data;
    }
};
