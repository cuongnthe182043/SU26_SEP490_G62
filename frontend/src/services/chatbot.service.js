import { apiRequest } from "./apiClient";

export const chatbotService = {
  // Trả { enabled: boolean } — FE ẩn widget nếu backend chưa cấu hình API key.
  getStatus: () => apiRequest("/api/chatbot/status"),

  // history: [{ role: 'user'|'assistant', content }] các lượt trước (đã cắt bớt).
  ask: (question, history = []) =>
    apiRequest("/api/chatbot/ask", {
      method: "POST",
      body: { question, history },
    }),
};
