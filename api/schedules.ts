import api from './client';
import { TestSchedule } from '../types';

export const schedulesApi = {
    // List Schedules
    list: async (projectId: string): Promise<TestSchedule[]> => {
        const response = await api.get<any[]>('/schedules/', {
            params: { project_id: projectId } // Backend expects snake_case param
        });
        return response.data.map(transformResponse);
    },

    // Create Schedule
    create: async (schedule: any): Promise<TestSchedule> => {
        // Convert camelCase to snake_case for backend
        const payload = {
            project_id: schedule.projectId,
            name: schedule.name,
            script_ids: schedule.scriptIds,
            cron_expression: schedule.cronExpression,
            frequency_label: schedule.frequencyLabel,
            is_active: schedule.isActive,
            priority: schedule.priority,
            trigger_strategy: schedule.triggerStrategy,
            alert_config: schedule.alertConfig
        };
        const response = await api.post<any>('/schedules/', payload);
        return transformResponse(response.data);
    },

    // Update Schedule
    update: async (id: string, schedule: any): Promise<TestSchedule> => {
        // ... (payload prep omitted for brevity matching)
        // Convert camelCase to snake_case for backend
        const payload: any = {};
        if (schedule.projectId) payload.project_id = schedule.projectId;
        if (schedule.name) payload.name = schedule.name;
        if (schedule.scriptIds) payload.script_ids = schedule.scriptIds;
        if (schedule.cronExpression) payload.cron_expression = schedule.cronExpression;
        if (schedule.frequencyLabel) payload.frequency_label = schedule.frequencyLabel;
        if (schedule.isActive !== undefined) payload.is_active = schedule.isActive;
        if (schedule.priority) payload.priority = schedule.priority;
        if (schedule.triggerStrategy) payload.trigger_strategy = schedule.triggerStrategy;
        if (schedule.alertConfig) payload.alert_config = schedule.alertConfig;

        const response = await api.put<any>(`/schedules/${id}`, payload);
        return transformResponse(response.data);
    },

    // Delete Schedule
    delete: async (id: string): Promise<void> => {
        await api.delete(`/schedules/${id}`);
    }
};

// Helper: Transform API Response (snake_case) to Frontend (camelCase)
const transformResponse = (data: any): TestSchedule => {
    return {
        id: data.id,
        projectId: data.project_id,
        name: data.name,
        scriptIds: data.script_ids || [],
        cronExpression: data.cron_expression,
        frequencyLabel: data.frequency_label,
        isActive: data.is_active,
        priority: data.priority,
        triggerStrategy: data.trigger_strategy,
        alertConfig: data.alert_config || { channels: [], criticalOnly: false, failureThreshold: 1 },
        lastRun: data.last_run ? new Date(data.last_run).toLocaleString() : 'Never',
        nextRun: data.next_run ? new Date(data.next_run).toLocaleString() : '-',
        incidentHistory: data.incident_history || []
    };
};
