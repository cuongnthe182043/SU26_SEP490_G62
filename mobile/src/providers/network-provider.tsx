import NetInfo from '@react-native-community/netinfo';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Theo dõi trạng thái mạng của thiết bị.
 *
 * Vì sao cần: tài xế làm việc ngoài đường, mất sóng là chuyện thường. Trước đây app
 * không hề biết mình đang offline — tài bấm gửi, chờ, rồi nhận lỗi và mất luôn dữ
 * liệu vừa nhập (tệ nhất là mất ảnh vừa chụp ở hiện trường, không quay lại chụp được).
 *
 * Phân biệt hai mức:
 *   isConnected           — có nối vào wifi/4G không
 *   isInternetReachable   — nối rồi nhưng có ra được Internet không (wifi quán cà phê
 *                           chưa đăng nhập, 3G có vạch nhưng không truyền được dữ liệu)
 * Chỉ coi là ONLINE khi cả hai đều ổn. isInternetReachable có thể là null lúc chưa
 * kiểm tra xong — khi đó tin theo isConnected để không báo offline oan.
 */

type NetworkState = {
    online: boolean;
    /** Vừa mới có mạng trở lại — dùng để tự tải lại dữ liệu */
    reconnectedAt: number;
    connectionType: string | null;
};

const NetworkContext = createContext<NetworkState>({
    online: true,
    reconnectedAt: 0,
    connectionType: null,
});

export function NetworkProvider({ children }: { children: ReactNode }) {
    const [online, setOnline] = useState(true);
    const [connectionType, setLoaiKetNoi] = useState<string | null>(null);
    const [reconnectedAt, setVuaOnlineLai] = useState(0);
    const wasOnline = useRef(true);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            const isOnline = Boolean(state.isConnected)
                && state.isInternetReachable !== false;

            setLoaiKetNoi(state.type ?? null);
            setOnline(isOnline);

            // Chuyển từ mất mạng → có mạng: phát tín hiệu để màn hình tự tải lại
            if (isOnline && !wasOnline.current) setVuaOnlineLai((n) => n + 1);
            wasOnline.current = isOnline;
        });

        // Lấy trạng thái ngay lúc mở app, không đợi sự kiện đầu tiên
        NetInfo.fetch().then((state) => {
            const isOnline = Boolean(state.isConnected) && state.isInternetReachable !== false;
            setOnline(isOnline);
            setLoaiKetNoi(state.type ?? null);
            wasOnline.current = isOnline;
        }).catch(() => {});

        return () => unsubscribe();
    }, []);

    return (
        <NetworkContext.Provider value={{ online, reconnectedAt, connectionType }}>
            {children}
        </NetworkContext.Provider>
    );
}

export const useNetwork = () => useContext(NetworkContext);

/** Tiện dùng khi chỉ cần biết có mạng hay không */
export const useOnline = () => useContext(NetworkContext).online;
