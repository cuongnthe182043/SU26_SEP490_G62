import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { profileService } from '@/services/profile-service';
import type { UserProfile } from '@/types/profile';

type State = {
    profile: UserProfile | null;
    isLoading: boolean;
    error: string | null;
};

export function useProfile() {
    const [state, setState] = useState<State>({ profile: null, isLoading: true, error: null });

    const fetch = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: s.profile === null, error: null }));
        try {
            const { profile } = await profileService.getMyProfile();
            setState({ profile, isLoading: false, error: null });
        } catch (err) {
            setState((s) => ({ ...s, isLoading: false, error: err instanceof Error ? err.message : 'Lỗi tải hồ sơ' }));
        }
    }, []);

    // Re-fetch mỗi khi màn hình được focus (navigate back, chuyển tab...)
    useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

    return { ...state, refresh: fetch };
}
