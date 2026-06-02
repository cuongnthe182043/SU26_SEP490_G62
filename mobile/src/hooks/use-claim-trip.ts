import { useState } from 'react';

import { ERROR_MESSAGES } from '@/constants/error-messages';
import { ApiError } from '@/lib/api-error';
import { tripService } from '@/services/trip-service';
import type { ActiveTrip } from '@/types/trip';

type ClaimResult =
  | { ok: true; trip: ActiveTrip }
  | { ok: false; message: string; alreadyClaimed: boolean };

export function useClaimTrip() {
  const [isLoading, setIsLoading] = useState(false);

  const claim = async (orderId: number): Promise<ClaimResult> => {
    setIsLoading(true);

    try {
      const { trip } = await tripService.claim(orderId);
      return { ok: true, trip };
    } catch (error) {
      const alreadyClaimed = error instanceof ApiError && error.status === 409;
      const message = alreadyClaimed
        ? ERROR_MESSAGES.tripAlreadyClaimed
        : error instanceof Error
          ? error.message
          : ERROR_MESSAGES.claimFailed;

      return { ok: false, message, alreadyClaimed };
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, claim };
}
