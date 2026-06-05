import { useState } from 'react';

import { ERROR_MESSAGES } from '@/constants/error-messages';
import { ApiError } from '@/lib/api-error';
import { tripService } from '@/services/trip-service';
import type { ActiveTrip } from '@/types/trip';

type ClaimResult =
  | { ok: true; trip: ActiveTrip }
  | { ok: false; message: string; alreadyClaimed: boolean; sameOrder?: boolean };

export function useClaimTrip() {
  const [isLoading, setIsLoading] = useState(false);

  // shipmentId — ID của shipment cụ thể cần nhận (không phải order_id)
  const claim = async (shipmentId: number): Promise<ClaimResult> => {
    setIsLoading(true);

    try {
      const { trip } = await tripService.claim(shipmentId);
      return { ok: true, trip };
    } catch (error) {
      const is409 = error instanceof ApiError && error.status === 409;
      const msg   = error instanceof Error ? error.message : ERROR_MESSAGES.claimFailed;
      const sameOrder = is409 && msg.includes('đơn hàng này');

      return {
        ok: false,
        message: is409 ? msg : msg,
        alreadyClaimed: is409 && !sameOrder,
        sameOrder,
      };
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, claim };
}
