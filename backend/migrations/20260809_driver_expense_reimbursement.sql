-- Chi hoàn ứng cho tài xế NGAY, không phải đợi kỳ lương.
--
-- Trước đây khoản tài ứng tiền túi (chi hộ khách, xăng, sửa xe, bảo dưỡng) chỉ có hai
-- đường tất toán: cấn trừ vào nợ thu hộ (chỉ được khi cùng đơn có tiền mặt tài đang giữ)
-- hoặc chờ hoàn qua kỳ lương. Riêng bảo dưỡng thì shipment_id = NULL nên không cấn trừ
-- được, buộc phải đợi hết tháng — tài ứng tiền thật mà phải chờ rất lâu.
--
-- Đường thứ ba đi qua ĐÚNG luồng phiếu chi sẵn có (kế toán tạo → manager duyệt → kế toán
-- chi) để giữ nguyên chốt kiểm soát 2 người cho mọi khoản tiền ra khỏi quỹ.

ALTER TABLE payment_vouchers DROP CONSTRAINT IF EXISTS payment_vouchers_voucher_type_check;
ALTER TABLE payment_vouchers ADD CONSTRAINT payment_vouchers_voucher_type_check
    CHECK (voucher_type IN (
        'office','rent','utilities','equipment','entertainment',
        'compensation','prepaid_refund','driver_reimbursement','other'
    ));

-- Gắn phiếu chi với đúng khoản chi phí được hoàn. Thiếu liên kết này thì kế toán chi
-- tiền xong, expenses.reimbursement_status vẫn 'pending' và kỳ lương sẽ hoàn LẦN HAI.
ALTER TABLE payment_vouchers
    ADD COLUMN IF NOT EXISTS expense_id INT REFERENCES expenses(id) ON DELETE SET NULL;

COMMENT ON COLUMN payment_vouchers.expense_id IS
    'Khoản chi phí tài xế đã ứng mà phiếu này hoàn lại (chỉ dùng cho voucher_type = driver_reimbursement).';

-- Mỗi khoản chi phí chỉ được có MỘT phiếu hoàn ứng còn hiệu lực. Phiếu bị từ chối/huỷ
-- không tính, để kế toán lập lại được.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_live_reimbursement_voucher_per_expense
    ON payment_vouchers(expense_id)
    WHERE expense_id IS NOT NULL AND status IN ('pending', 'approved', 'paid');
