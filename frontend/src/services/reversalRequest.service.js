import { apiRequest } from "./apiClient";

const BASE = "/api/reversal-requests";

// Yêu cầu hoàn tác tầng 2 — dùng chung cho Manager (màn duyệt) và các vai khác (gửi
// yêu cầu). Đặt ở services/ chung thay vì trong pages/Manager vì cả hai phía đều gọi.
export const reversalRequestService = {
  // Loại thao tác nào thực sự xin hoàn tác được — server là nguồn sự thật, tránh việc
  // giao diện dựng sẵn một danh sách rồi lệch với backend sau mỗi lần thêm/bớt.
  getKinds: () => apiRequest(`${BASE}/kinds`),

  listPending: () => apiRequest(`${BASE}/pending`),
  listMine: () => apiRequest(`${BASE}/mine`),

  create: ({ kind, entityId, reason }) =>
    apiRequest(BASE, { method: "POST", body: { kind, entity_id: entityId, reason } }),

  approve: (id, note) =>
    apiRequest(`${BASE}/${id}/approve`, { method: "PATCH", body: { note: note || undefined } }),

  reject: (id, note) =>
    apiRequest(`${BASE}/${id}/reject`, { method: "PATCH", body: { note } }),

  cancelOwn: (id) => apiRequest(`${BASE}/${id}`, { method: "DELETE" }),
};
