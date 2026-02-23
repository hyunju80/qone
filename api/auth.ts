import api from './client';
import { User } from '../types';

export const authApi = {
    login: async (email: string, password: string) => {
        const params = new URLSearchParams();
        params.append('username', email);
        params.append('password', password);

        const response = await api.post<{ access_token: string, token_type: string }>('/login/access-token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data;
    },

    me: async () => {
        const response = await api.get<any>('/users/me');
        const data = response.data;
        const user = {
            id: data.id,
            email: data.email,
            name: data.name,
            role: data.role,
            isSaaSSuperAdmin: data.is_saas_super_admin === true,
            customerAccountId: data.customer_account_id,
            isActive: data.is_active // Also mapping isActive just in case
        } as User;
        // console.log("Auth User:", JSON.stringify(user, null, 2));
        return user;
    }
};
