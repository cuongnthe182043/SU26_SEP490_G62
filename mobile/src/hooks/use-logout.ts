import { useRef, useState } from 'react';
import { useAuthSession } from '@/providers/auth-provider';
import { useConfirm } from '@/providers/ui-provider';

export function useLogout() {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const { showConfirm } = useConfirm();
    const { signOut } = useAuthSession();

    // Cổng ĐỒNG BỘ, đặt trước mọi await. `isLoggingOut` không thay được việc này: nó chỉ
    // bật SAU khi hộp thoại đã trả lời, nên suốt lúc hộp đang mở thì nút "Đăng xuất" vẫn
    // đang bật. Mở hộp lại là việc bất đồng bộ (setState → render → nền mờ mới che màn),
    // nên hai lần chạm sát nhau đều lọt qua trước khi có gì chặn lại, và xếp HAI hộp vào
    // hàng đợi: hộp đầu đăng xuất xong, hộp thứ hai trồi lên trên màn đăng nhập.
    const dangHoiRef = useRef(false);

    const logout = async () => {
        setIsLoggingOut(true);
        try {
            await signOut();
        } finally {
            setIsLoggingOut(false);
        }
    };

    const confirmLogout = async () => {
        if (dangHoiRef.current) return;
        dangHoiRef.current = true;
        try {
            const ok = await showConfirm({
                title: 'Đăng xuất',
                message: 'Bạn có chắc muốn đăng xuất khỏi tài khoản?',
                confirmLabel: 'Đăng xuất',
                cancelLabel: 'Hủy',
                danger: true,
            });
            if (ok) await logout();
        } finally {
            dangHoiRef.current = false;
        }
    };

    return { confirmLogout, isLoggingOut };
}
