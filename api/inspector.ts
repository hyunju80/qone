import client from './client';

export const inspectorApi = {
    getScreenshot: async (platform: string = 'APP') => {
        const response = await client.get(`/inspector/screenshot?platform=${platform}`);
        return response.data;
    },
    getSource: async (platform: string = 'APP') => {
        const response = await client.get(`/inspector/source?platform=${platform}`);
        return response.data;
    },
    identify: async (x: number, y: number, displayWidth: number, displayHeight: number, platform: string = 'APP') => {
        const response = await client.post('/inspector/identify', {
            x,
            y,
            display_width: displayWidth,
            display_height: displayHeight,
            platform
        });
        return response.data;
    },
    performAction: async (step: any) => {
        const response = await client.post('/inspector/action', step);
        return response.data;
    },
    getDevices: async () => {
        const response = await client.get('/inspector/devices');
        return response.data;
    },
    connect: async (deviceId: string, projectId: string, platform: string = 'Android') => {
        const response = await client.post('/inspector/connect', { device_id: deviceId, project_id: projectId, platform });
        return response.data;
    },
    connectWeb: async (url: string) => {
        const response = await client.post('/inspector/web/connect', { url });
        return response.data;
    },
    getContexts: async () => {
        const response = await client.get('/inspector/contexts');
        return response.data;
    },
    switchContext: async (contextName: string) => {
        const response = await client.post('/inspector/switch-context', { context_name: contextName });
        return response.data;
    },
    scroll: async (deltaY: number, platform: string = 'APP') => {
        const response = await client.post('/inspector/scroll', { delta_y: deltaY, platform });
        return response.data;
    },
    disconnect: async () => {
        const response = await client.post('/inspector/disconnect');
        return response.data;
    }
};
