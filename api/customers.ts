import api from './client';
import { CustomerAccount } from '../types';

export const customersApi = {
    getAll: async () => {
        const response = await api.get<any[]>('/customers/');
        return response.data.map(c => ({
            id: c.id,
            companyName: c.company_name,
            businessNumber: c.business_number,
            plan: c.plan,
            billingEmail: c.billing_email,
            adminEmail: c.admin_email,
            usage: c.usage || {
                aiTokens: { current: 0, max: 0 },
                testRuns: { current: 0, max: 0 },
                scriptStorage: { current: 0, max: 0 },
                deviceHours: { current: 0, max: 0 }
            },
            createdAt: c.created_at
        })) as CustomerAccount[];
    },

    create: async (data: Partial<CustomerAccount>) => {
        const payload = {
            company_name: data.companyName,
            business_number: data.businessNumber,
            plan: data.plan,
            billing_email: data.billingEmail,
            admin_email: data.adminEmail,
            usage: data.usage
        };
        const response = await api.post<any>('/customers/', payload);
        return {
            id: response.data.id,
            companyName: response.data.company_name,
            businessNumber: response.data.business_number,
            plan: response.data.plan,
            billingEmail: response.data.billing_email,
            adminEmail: response.data.admin_email,
            usage: response.data.usage,
            createdAt: response.data.created_at
        } as CustomerAccount;
    }
};
