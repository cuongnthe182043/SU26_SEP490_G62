import { useState } from 'react';
import { useAuthSession } from '@/providers/auth-provider';
import { useConfirm } from '@/providers/ui-provider';

export function useLogout() {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const { showConfirm } = useConfirm();
    const { signOut } = useAuthSession();

    const logout = async () => {
        setIsLoggingOut(true);
        try {
            await signOut();
        } finally {
            setIsLoggingOut(false);
        }
    };

    const confirmLogout = async () => {
        const ok = await showConfirm({
            title: 'Đăng xuất',
            message: 'Bạn có chắc muốn đăng xuất khỏi tài khoản?',
            confirmLabel: 'Đăng xuất',
            cancelLabel: 'Hủy',
            danger: true,
        });
        if (ok) logout();
    };

    return { confirmLogout, isLoggingOut };
}
