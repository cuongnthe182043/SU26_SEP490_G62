/**
 * Vòng đời kết nối WebSocket thông báo — tách hẳn khỏi React để test được.
 *
 * Bối cảnh: backend chạy trên Cloud Run với `timeoutSeconds = 300`. WebSocket bị coi
 * là một request dài nên **mọi kết nối đều bị cắt ở đúng ~301 giây** (đã xác nhận
 * trong log production: 12 lần đứt mỗi giờ, đều tăm tắp). Đứt và nối lại là trạng
 * thái bình thường của app này, không phải ngoại lệ — nên phần nối lại phải chắc:
 *
 *   • Một phiên chỉ được có ĐÚNG một socket. Trước đây ref chỉ được gán sau `await`
 *     lấy token, nên hai lời gọi connect() sát nhau đều lọt qua cửa kiểm tra và mở
 *     hai socket; socket thừa không ai đóng, vẫn nhận message → thông báo hiện 2 lần.
 *   • Mở lại phải báo `isReconnect` để tầng trên đi lấy phần dữ liệu đã lỡ trong lúc
 *     đứt. Không có bước này thì thông báo sinh ra giữa hai lần nối coi như mất hẳn.
 *   • Phải tự phát hiện "chết giả": tài xế chạy xe qua vùng lõm sóng thì đường truyền
 *     chết nhưng `readyState` vẫn là OPEN và `onclose` không bao giờ nổ.
 */

/** Phần API của WebSocket mà module này dùng — cho phép test cắm socket giả. */
export type SocketLike = {
    readyState: number;
    send(data: string): void;
    close(): void;
    onopen: (() => void) | null;
    onmessage: ((event: { data: string }) => void) | null;
    onclose: (() => void) | null;
    onerror: (() => void) | null;
};

export type NotificationSocketOptions = {
    /** URL ws:// hoặc wss:// đã sẵn sàng, chưa gắn token. Ném lỗi nếu cấu hình sai. */
    getUrl: () => string;
    /** Lấy access token còn hạn. WS handshake bị từ chối 401 là đứt luôn, không có cơ hội thử lại như HTTP. */
    getToken: () => Promise<string | null>;
    onOpen: (info: { isReconnect: boolean }) => void;
    onMessage: (payload: unknown) => void;
    /**
     * Báo mỗi lần trạng thái kết nối đổi. Dùng để biết realtime có thực sự đang sống
     * hay không — trình xử lý push đọc cờ này để khỏi hiện banner trùng với toast.
     */
    onStatusChange?: (connected: boolean) => void;
    pingIntervalMs?: number;
    pongTimeoutMs?: number;
    maxBackoffMs?: number;
    socketFactory?: (url: string) => SocketLike;
    random?: () => number;
};

const WS_OPEN = 1;

export function createNotificationSocket(options: NotificationSocketOptions) {
    const {
        getUrl,
        getToken,
        onOpen,
        onMessage,
        onStatusChange = () => {},
        // Ping 20s/lần, coi là chết nếu 45s không nghe thấy gì từ server → phát hiện
        // đứt trong vòng ~1 phút, thừa nhanh so với chu kỳ 5 phút của Cloud Run.
        pingIntervalMs = 20_000,
        pongTimeoutMs = 45_000,
        maxBackoffMs = 30_000,
        socketFactory = (url: string) => new WebSocket(url) as unknown as SocketLike,
        random = Math.random,
    } = options;

    let socket: SocketLike | null = null;
    let connecting = false;          // gác cổng ĐỒNG BỘ, đặt trước mọi await
    let stopped = true;              // true = đã chủ động ngắt, không tự nối lại
    let fatal = false;               // cấu hình sai — nối lại bao nhiêu lần cũng vô ích
    let hasConnectedOnce = false;
    let attempt = 0;
    let lastSignalAt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let connected = false;

    /** Chỉ bắn khi trạng thái thực sự đổi, tránh gọi lại thừa mỗi lần nối lại. */
    const setConnected = (next: boolean) => {
        if (connected === next) return;
        connected = next;
        onStatusChange(next);
    };

    const clearReconnectTimer = () => {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = null;
    };

    const stopWatchdog = () => {
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = null;
    };

    /** Gỡ hết handler rồi mới đóng — socket cũ tuyệt đối không được kích hoạt luồng nối lại. */
    const detach = (ws: SocketLike | null) => {
        if (!ws) return;
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        try { ws.close(); } catch { /* socket đã chết sẵn */ }
    };

    const backoffForAttempt = (n: number) => {
        const base = Math.min(maxBackoffMs, 1000 * 2 ** Math.max(0, n - 1));
        const jitter = 0.8 + random() * 0.4;   // ±20% để nhiều máy không nối lại cùng một nhịp
        return Math.min(maxBackoffMs, Math.round(base * jitter));
    };

    const scheduleReconnect = () => {
        if (stopped || fatal || reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            void connect();
        }, backoffForAttempt(attempt));
    };

    /**
     * Đường truyền chết nhưng socket chưa biết. Đóng thẳng tay và nối lại NGAY —
     * vừa nãy còn chạy tốt nên không có lý do gì phải chờ hết backoff.
     */
    const forceReconnect = () => {
        stopWatchdog();
        setConnected(false);
        const dead = socket;
        socket = null;
        detach(dead);
        attempt = 0;
        void connect();
    };

    const startWatchdog = () => {
        stopWatchdog();
        lastSignalAt = Date.now();
        pingTimer = setInterval(() => {
            if (!socket) return;
            if (Date.now() - lastSignalAt > pongTimeoutMs) {
                forceReconnect();
                return;
            }
            try {
                socket.send(JSON.stringify({ type: 'ping' }));
            } catch {
                forceReconnect();
            }
        }, pingIntervalMs);
    };

    const connect = async (): Promise<void> => {
        stopped = false;
        if (fatal || connecting) return;
        // readyState 0 = CONNECTING, 1 = OPEN → đã có socket dùng được rồi
        if (socket && socket.readyState <= WS_OPEN) return;

        connecting = true;
        clearReconnectTimer();
        try {
            let base: string;
            try {
                base = getUrl();
            } catch {
                fatal = true;   // thiếu/sai EXPO_PUBLIC_API_URL — thử lại vô ích, chỉ tốn pin
                return;
            }

            const token = await getToken();
            if (stopped) return;            // close() xảy ra trong lúc chờ token
            if (!token) {
                attempt += 1;
                scheduleReconnect();
                return;
            }

            const separator = base.includes('?') ? '&' : '?';
            const ws = socketFactory(`${base}${separator}token=${encodeURIComponent(token)}`);
            socket = ws;

            ws.onopen = () => {
                if (socket !== ws) return;
                attempt = 0;
                startWatchdog();
                setConnected(true);
                const isReconnect = hasConnectedOnce;
                hasConnectedOnce = true;
                onOpen({ isReconnect });
            };

            ws.onmessage = (event) => {
                if (socket !== ws) return;
                // Bất kỳ byte nào từ server cũng chứng minh đường truyền còn sống.
                lastSignalAt = Date.now();
                let payload: unknown;
                try {
                    payload = JSON.parse(String(event.data));
                } catch {
                    return;   // message hỏng không được phép làm sập kết nối
                }
                if ((payload as { type?: string })?.type === 'pong') return;
                onMessage(payload);
            };

            ws.onclose = () => {
                if (socket !== ws) return;   // socket cũ đã bị thay thế, mặc kệ
                socket = null;
                stopWatchdog();
                setConnected(false);
                if (stopped) return;
                attempt += 1;
                scheduleReconnect();
            };

            ws.onerror = () => {
                try { ws.close(); } catch { /* ignore */ }
            };
        } finally {
            connecting = false;
        }
    };

    /** Ngắt hẳn: dùng khi đăng xuất hoặc app xuống nền. */
    const close = () => {
        stopped = true;
        clearReconnectTimer();
        stopWatchdog();
        setConnected(false);
        const dead = socket;
        socket = null;
        detach(dead);
    };

    /** NetInfo báo có mạng trở lại — nối ngay thay vì ngồi chờ hết backoff. */
    const handleNetworkOnline = () => {
        if (stopped || fatal) return;
        clearReconnectTimer();
        attempt = 0;
        void connect();
    };

    return {
        connect,
        close,
        handleNetworkOnline,
        backoffForAttempt,
        isOpen: () => socket?.readyState === WS_OPEN,
    };
}
