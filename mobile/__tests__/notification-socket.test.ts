/**
 * notification-socket — vòng đời kết nối realtime.
 *
 * Bốn lỗi thật đã quan sát được trên production (Cloud Run, log 09/08/2026) mà bộ
 * test này khoá lại:
 *
 *  1. Mở 2 socket song song cho cùng một phiên — log cho thấy mỗi chu kỳ có đúng 2
 *     kết nối từ cùng một IP, cách nhau 0.17s. Hệ quả: mỗi thông báo hiện 2 lần.
 *  2. Nối lại xong không đồng bộ lại dữ liệu — Cloud Run cắt WS ở đúng 301s, tạo
 *     cửa sổ mù vài giây mỗi 5 phút, và app không bao giờ đi lấy lại phần đã lỡ.
 *  3. Socket "chết giả": mạng đứt nhưng readyState vẫn OPEN nên không bao giờ nối lại.
 *  4. Có mạng trở lại nhưng phải chờ hết backoff mới nối.
 */
import { createNotificationSocket, type SocketLike } from '@/lib/notification-socket';

const OPEN = 1;
const CLOSED = 3;

class FakeSocket implements SocketLike {
    static instances: FakeSocket[] = [];

    readyState = 0;
    sent: string[] = [];
    closeCalls = 0;

    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(public url: string) {
        FakeSocket.instances.push(this);
    }

    send(data: string) { this.sent.push(data); }

    close() {
        this.closeCalls += 1;
        if (this.readyState === CLOSED) return;
        this.readyState = CLOSED;
        this.onclose?.();
    }

    // ── điều khiển từ test ──
    open() { this.readyState = OPEN; this.onopen?.(); }
    receive(payload: unknown) { this.onmessage?.({ data: JSON.stringify(payload) }); }
    dropSilently() { this.readyState = OPEN; }   // mạng chết nhưng socket vẫn tưởng OPEN
}

/** Đẩy hết microtask đang chờ (connect() có await getToken()). */
const flush = async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

const setup = (over: Partial<Parameters<typeof createNotificationSocket>[0]> = {}) => {
    const onOpen = jest.fn();
    const onMessage = jest.fn();
    const socket = createNotificationSocket({
        getUrl: () => 'wss://be.example.com/ws/notifications',
        getToken: async () => 'tok-1',
        onOpen,
        onMessage,
        pingIntervalMs: 20_000,
        pongTimeoutMs: 45_000,
        socketFactory: (url) => new FakeSocket(url),
        random: () => 0.5,
        ...over,
    });
    return { socket, onOpen, onMessage };
};

beforeEach(() => {
    FakeSocket.instances = [];
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

describe('notification-socket — chống mở trùng kết nối', () => {
    it('gọi connect() hai lần liên tiếp chỉ được mở MỘT socket', async () => {
        const { socket } = setup();

        // Đây chính là tình huống thật: effect auth và effect AppState cùng gọi connect()
        // trong một nhịp render. Cả hai đều rơi vào await getToken() trước khi kịp gán ref.
        void socket.connect();
        void socket.connect();
        await flush();

        expect(FakeSocket.instances).toHaveLength(1);
    });

    it('connect() khi đang mở sẵn thì không mở thêm socket', async () => {
        const { socket } = setup();
        void socket.connect();
        await flush();
        FakeSocket.instances[0].open();

        void socket.connect();
        await flush();

        expect(FakeSocket.instances).toHaveLength(1);
    });

    it('gắn token vào query string của URL', async () => {
        const { socket } = setup({ getToken: async () => 'abc123' });
        void socket.connect();
        await flush();

        expect(FakeSocket.instances[0].url).toContain('token=abc123');
    });

    it('không có token thì không mở socket', async () => {
        const { socket } = setup({ getToken: async () => null });
        void socket.connect();
        await flush();

        expect(FakeSocket.instances).toHaveLength(0);
    });
});

describe('notification-socket — đồng bộ lại sau khi nối lại', () => {
    it('lần mở đầu tiên báo isReconnect = false', async () => {
        const { socket, onOpen } = setup();
        void socket.connect();
        await flush();
        FakeSocket.instances[0].open();

        expect(onOpen).toHaveBeenCalledWith({ isReconnect: false });
    });

    it('mở lại sau khi bị cắt phải báo isReconnect = true để provider gọi refresh', async () => {
        const { socket, onOpen } = setup();
        void socket.connect();
        await flush();
        FakeSocket.instances[0].open();
        onOpen.mockClear();

        // Cloud Run cắt kết nối ở 301s
        FakeSocket.instances[0].close();
        await jest.advanceTimersByTimeAsync(2_000);
        await flush();
        FakeSocket.instances[1].open();

        expect(onOpen).toHaveBeenCalledWith({ isReconnect: true });
    });

    it('chuyển tiếp message nhận được ra onMessage', async () => {
        const { socket, onMessage } = setup();
        void socket.connect();
        await flush();
        FakeSocket.instances[0].open();

        FakeSocket.instances[0].receive({ type: 'notification.created', notification: { id: 9 } });

        expect(onMessage).toHaveBeenCalledWith({ type: 'notification.created', notification: { id: 9 } });
    });

    it('không làm sập khi server gửi message hỏng', async () => {
        const { socket, onMessage } = setup();
        void socket.connect();
        await flush();
        const s = FakeSocket.instances[0];
        s.open();

        expect(() => s.onmessage?.({ data: '{khong-phai-json' })).not.toThrow();
        expect(onMessage).not.toHaveBeenCalled();
    });
});

describe('notification-socket — phát hiện socket chết giả', () => {
    it('gửi ping định kỳ khi kết nối đang mở', async () => {
        const { socket } = setup();
        void socket.connect();
        await flush();
        const s = FakeSocket.instances[0];
        s.open();

        await jest.advanceTimersByTimeAsync(20_000);

        expect(s.sent).toContain(JSON.stringify({ type: 'ping' }));
    });

    it('quá hạn không có tín hiệu nào từ server thì ép đóng và nối lại', async () => {
        const { socket } = setup();
        void socket.connect();
        await flush();
        const s = FakeSocket.instances[0];
        s.open();

        // Mạng chết âm thầm: readyState vẫn OPEN, onclose không bao giờ nổ.
        s.dropSilently();
        await jest.advanceTimersByTimeAsync(60_000);
        await flush();

        expect(s.closeCalls).toBeGreaterThan(0);
        expect(FakeSocket.instances.length).toBeGreaterThan(1);
    });

    it('còn nhận được tín hiệu từ server thì giữ nguyên kết nối', async () => {
        const { socket } = setup();
        void socket.connect();
        await flush();
        const s = FakeSocket.instances[0];
        s.open();

        // Server trả pong đều đặn suốt 60s
        for (let i = 0; i < 3; i += 1) {
            await jest.advanceTimersByTimeAsync(20_000);
            s.receive({ type: 'pong' });
        }
        await flush();

        expect(s.closeCalls).toBe(0);
        expect(FakeSocket.instances).toHaveLength(1);
    });
});

describe('notification-socket — báo trạng thái kết nối', () => {
    it('bật true khi mở, tắt false khi đứt', async () => {
        const onStatusChange = jest.fn();
        const { socket } = setup({ onStatusChange });

        void socket.connect();
        await flush();
        FakeSocket.instances[0].open();
        expect(onStatusChange).toHaveBeenLastCalledWith(true);

        FakeSocket.instances[0].close();
        expect(onStatusChange).toHaveBeenLastCalledWith(false);
    });

    it('không bắn lặp khi trạng thái không đổi', async () => {
        const onStatusChange = jest.fn();
        const { socket } = setup({ onStatusChange });

        void socket.connect();
        await flush();
        FakeSocket.instances[0].open();
        FakeSocket.instances[0].receive({ type: 'pong' });

        expect(onStatusChange).toHaveBeenCalledTimes(1);
    });

    it('close() đưa trạng thái về false', async () => {
        const onStatusChange = jest.fn();
        const { socket } = setup({ onStatusChange });

        void socket.connect();
        await flush();
        FakeSocket.instances[0].open();
        socket.close();

        expect(onStatusChange).toHaveBeenLastCalledWith(false);
    });
});

describe('notification-socket — nối lại', () => {
    it('backoff tăng dần và bị chặn trần', async () => {
        const { socket } = setup({ getToken: async () => null, maxBackoffMs: 30_000 });

        expect(socket.backoffForAttempt(1)).toBeLessThan(socket.backoffForAttempt(3));
        expect(socket.backoffForAttempt(50)).toBeLessThanOrEqual(30_000);
    });

    it('có mạng trở lại thì nối ngay, không chờ hết backoff', async () => {
        const { socket } = setup();
        void socket.connect();
        await flush();
        FakeSocket.instances[0].open();
        FakeSocket.instances[0].close();      // rớt → hẹn giờ nối lại

        socket.handleNetworkOnline();          // NetInfo báo có mạng
        await flush();

        expect(FakeSocket.instances).toHaveLength(2);
    });

    it('close() dừng hẳn, không tự nối lại nữa', async () => {
        const { socket } = setup();
        void socket.connect();
        await flush();
        FakeSocket.instances[0].open();

        socket.close();
        await jest.advanceTimersByTimeAsync(120_000);
        await flush();

        expect(FakeSocket.instances).toHaveLength(1);
    });

    it('close() rồi thì handleNetworkOnline() cũng không mở lại', async () => {
        const { socket } = setup();
        void socket.connect();
        await flush();
        FakeSocket.instances[0].open();

        socket.close();
        socket.handleNetworkOnline();
        await flush();

        expect(FakeSocket.instances).toHaveLength(1);
    });

    it('getUrl() lỗi cấu hình thì dừng, không quay vòng vô hạn', async () => {
        const { socket } = setup({
            getUrl: () => { throw new Error('EXPO_PUBLIC_API_URL is not configured.'); },
        });

        void socket.connect();
        await jest.advanceTimersByTimeAsync(120_000);
        await flush();

        expect(FakeSocket.instances).toHaveLength(0);
    });
});
