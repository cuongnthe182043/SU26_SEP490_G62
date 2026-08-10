/**
 * Cờ toàn cục: kênh realtime (WebSocket) có đang thực sự sống không.
 *
 * Cần một biến cấp module vì `Notifications.setNotificationHandler` chạy NGOÀI cây
 * React — nó không đọc được state của NotificationsProvider. Trình xử lý push dựa vào
 * cờ này để quyết định có hiện banner hay không:
 *
 *   app đang mở + realtime sống  → WS đã hiện toast rồi, hiện banner nữa là trùng
 *   mọi trường hợp còn lại       → phải hiện banner, nếu không tài xế mất thông báo
 */
let connected = false;

export const setRealtimeConnected = (value: boolean) => { connected = value; };

export const isRealtimeConnected = () => connected;
