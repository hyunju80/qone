import api from './client';
import { Message } from '../types';

export interface ChatResponse {
    text?: string;
    function_call?: {
        name: string;
        args: any;
    };
    report_data?: any;
    error?: string;
}

export const aiApi = {
    chat: async (messages: Message[], context?: string): Promise<ChatResponse> => {
        const payload = {
            messages: messages.map(m => ({
                role: m.role,
                content: m.content
            })),
            context
        };
        const response = await api.post<ChatResponse>('/ai/chat', payload);
        return response.data;
    }
};
