import { apiClient } from '@/lib/api-client';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type ChatbotAskResponse = {
    answer: string;
    sql?: string[];
    docs?: string[];
};

export const chatbotService = {
    getStatus: () => apiClient.get<{ enabled: boolean }>('/api/chatbot/status'),

    ask: (question: string, history: ChatMessage[] = []) =>
        apiClient.post<ChatbotAskResponse>('/api/chatbot/ask', { question, history }),
};
