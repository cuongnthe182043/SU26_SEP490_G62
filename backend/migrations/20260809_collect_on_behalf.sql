-- Thu hộ (COD) — số tiền công ty thu hộ khách khi giao hàng, lưu theo CHUYẾN.
--
-- Vì sao đặt ở order_shipments chứ không phải debts:
--   Đa số chuyến import đã thu đủ cước về công ty nên KHÔNG phát sinh dòng debts nào
--   (insertDebtForShipment chỉ tạo nợ khi tài xế đang giữ tiền hoặc khách ghi nợ), mà
--   debts.total_amount lại có CHECK (> 0) nên cũng không tạo được dòng nợ cước 0đ để đựng
--   số thu hộ. Đặt trên chuyến thì mọi chuyến đều ghi được, không phụ thuộc có nợ hay không.
--
-- Thu hộ KHÔNG cấn trừ vào tiền khách nợ: đây là tiền của khách mà công ty đang giữ (chiều
-- ngược với công nợ cước), theo dõi song song. debts.total_amount giữ nguyên nghĩa cũ là
-- tiền cước khách còn nợ — không màn hình công nợ/tuổi nợ nào phải tính lại.
ALTER TABLE order_shipments
    ADD COLUMN IF NOT EXISTS collect_on_behalf_amount NUMERIC(12,2) NOT NULL DEFAULT 0
        CHECK (collect_on_behalf_amount >= 0);

COMMENT ON COLUMN order_shipments.collect_on_behalf_amount IS
    'Thu hộ (COD): tiền hàng công ty thu hộ khách khi giao chuyến này. Không phải doanh thu, không cấn vào công nợ cước.';

CREATE INDEX IF NOT EXISTS idx_order_shipments_collect_on_behalf
    ON order_shipments(order_id)
    WHERE collect_on_behalf_amount > 0;
