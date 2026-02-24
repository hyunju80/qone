import axios from 'axios';
import { Device, DeviceOS, DeviceStatus } from '../types';

const API_BASE_URL = '/api/v1/device-farm';

export const deviceFarmApi = {
    /**
     * Fetch the list of connected devices from the backend API.
     */
    getDevices: async (): Promise<Device[]> => {
        const response = await axios.get(`${API_BASE_URL}/devices`);
        return response.data;
    },

    /**
     * Construct the WebSocket URL for streaming device logs.
     * @param deviceId The UDID of the device
     * @returns WebSocket URL string
     */
    getLogStreamUrl: (deviceId: string): string => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        // Adjust port for local dev vs prod as needed. If using default Vite proxy, this might act strange,
        // so we can hardcode the backend URL for dev if needed, or rely on proxying wss.
        return `${protocol}//${host}/api/v1/device-farm/logs/${deviceId}`;
    }
};
