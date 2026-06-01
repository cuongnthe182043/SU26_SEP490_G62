import { apiClient } from '@/lib/api-client';
import type {
    ActiveTripResponse,
    ClaimTripResponse,
    CompleteTripResponse,
    TripPoolResponse,
    TripStatus,
    UpdateStatusResponse,
} from '@/types/trip';

export const tripService = {
    getPool: () => apiClient.get<TripPoolResponse>('/api/trips/pool'),

    getActiveTrip: () => apiClient.get<ActiveTripResponse>('/api/trips/active'),

    claim: (tripId: number) =>
        apiClient.post<ClaimTripResponse>(`/api/trips/${tripId}/claim`, {}),

    updateStatus: (tripId: number, status: TripStatus) =>
        apiClient.patch<UpdateStatusResponse>(`/api/trips/${tripId}/status`, { status }),

    completeWithProof: (tripId: number, formData: FormData) =>
        apiClient.postForm<CompleteTripResponse>(`/api/trips/${tripId}/complete`, formData),

    completeNoProof: (tripId: number) =>
        apiClient.postForm<CompleteTripResponse>(`/api/trips/${tripId}/complete`, new FormData()),
};
