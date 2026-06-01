export type TripStatus =
    | 'available'
    | 'claimed'
    | 'picking'
    | 'loaded'
    | 'transit'
    | 'arrived'
    | 'completed'
    | 'cancelled'
    | 'failed'
    | 'returning';

// Pool hiển thị ORDER (không phải từng shipment riêng lẻ).
// Driver nhận cả order, hệ thống tự kích hoạt từng leg theo thứ tự.
export type TripPoolItem = {
    order_id: number;
    cargo_name: string | null;
    order_notes: string | null;
    payment_type: string | null;
    pickup_address: string;          // điểm lấy hàng của leg đầu tiên
    delivery_address: string;        // điểm giao của leg cuối cùng
    total_cargo_weight_kg: string | null;
    total_estimated_price: string | null;
    total_legs: number;              // tổng số chuyến trong order
    created_at: string;
    vehicle_group_id: number;
    vehicle_group_name: string;
    max_load_weight_kg: string | null;
};

export type ActiveTrip = {
    id: number;
    order_id: number;
    shipment_index: number;
    pickup_address: string;
    delivery_address: string;
    cargo_weight_kg: string | null;
    estimated_price: string | null;
    actual_price: string | null;
    status: TripStatus;
    notes: string | null;
    version: number;
    claimed_at: string | null;
    picking_at: string | null;
    loaded_at: string | null;
    transit_at: string | null;
    arrived_at: string | null;
    completed_at: string | null;
    cargo_name: string | null;
    order_notes: string | null;
    order_payment_type: string | null;
    is_final_shipment: boolean;
    max_shipment_index: number;
};

export type TripPoolResponse = {
    trips: TripPoolItem[];
};

export type ActiveTripResponse = {
    trip: ActiveTrip | null;
};

export type ClaimTripResponse = {
    message: string;
    trip: ActiveTrip;
};

export type UpdateStatusResponse = {
    message: string;
    trip: ActiveTrip;
};

export type CompleteTripResponse = {
    message: string;
    trip: ActiveTrip;
};

export type CancelDeliveryResponse = {
    message: string;
    trip: ActiveTrip;
};

export type ReleaseTripResponse = {
    message: string;
    order_id: number;
    released: boolean;
};

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
    available: 'Chờ nhận',
    claimed: 'Đã nhận',
    picking: 'Đang lấy hàng',
    loaded: 'Đã lấy hàng',
    transit: 'Đang vận chuyển',
    arrived: 'Đã đến nơi',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
    failed: 'Giao thất bại',
    returning: 'Đang hoàn hàng',
};

export type NextAction = {
    label: string;
    nextStatus: TripStatus;
    tone: 'primary' | 'secondary' | 'danger';
};

export const NEXT_ACTIONS: Partial<Record<TripStatus, NextAction>> = {
    claimed:   { label: 'Bắt đầu lấy hàng',     nextStatus: 'picking',   tone: 'primary'   },
    picking:   { label: 'Xác nhận đã lấy hàng',  nextStatus: 'loaded',    tone: 'primary'   },
    loaded:    { label: 'Bắt đầu vận chuyển',     nextStatus: 'transit',   tone: 'primary'   },
    transit:   { label: 'Xác nhận đã đến',        nextStatus: 'arrived',   tone: 'primary'   },
    failed:    { label: 'Bắt đầu hoàn hàng',      nextStatus: 'returning', tone: 'secondary' },
    returning: { label: 'Hoàn thành hoàn hàng',   nextStatus: 'completed', tone: 'secondary' },
};
