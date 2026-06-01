import { useState } from 'react';
import { router } from 'expo-router';
import { tokenStorage } from '@/services/token-storage';
import { useConfirm } from '@/providers/ui-provider';

export function useLogout() {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const { showConfirm } = useConfirm();

    const logout = async () => {
        setIsLoggingOut(true);
        try {
            await tokenStorage.removeToken();
        } finally {
            setIsLoggingOut(false);
            router.replace('/login');
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
