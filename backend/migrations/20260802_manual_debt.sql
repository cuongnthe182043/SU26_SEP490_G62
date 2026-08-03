-- =====================================================================
-- 20260802_manual_debt
-- Công nợ tạo thủ công — để kế toán khai các khoản nợ có từ TRƯỚC khi dùng phần mềm.
--
-- Vì sao cần: toàn bộ công nợ hiện nay chỉ sinh ra từ chuyến (insertDebtForShipment).
-- Nợ cũ của khách/tài xế/đối tác không có chuyến nào trong hệ thống nên không khai được,
-- dẫn tới màn Công nợ chỉ phản ánh phần phát sinh sau khi dùng phần mềm.
--
-- Ba thay đổi:
--
-- 1) event_type 'opening_balance' — nợ cũ phải có vế ghi Nợ trong sổ.
--    Nợ sinh từ chuyến KHÔNG ghi financial_transactions vì doanh thu đã ghi rồi
--    (shipment_revenue: Nợ 131 / Có 511). Nợ cũ không có vế đó, nên khi khách trả,
--    sổ sẽ ghi "Có 131" cho khoản chưa từng ghi Nợ → tài khoản 131 âm, xuất MISA lệch.
--
-- 2) debts.source / incurred_on / created_by — phân biệt nợ khai tay với nợ từ chuyến,
--    giữ ngày phát sinh gốc (để tính tuổi nợ đúng), và biết ai đã khai.
--
-- 3) company_info.driver_debt_monthly_cap_percent — trần khấu trừ nợ tài xế mỗi tháng.
--    Trước đây payroll trừ HẾT nợ tồn, không trần, mà net_salary là cột GENERATED
--    không chặn ở 0 → khai một khoản nợ cũ lớn là lương tháng đó ra số âm.
--
-- An toàn với dữ liệu cũ: chỉ THÊM cột (đều có DEFAULT) và nới CHECK. Nợ đang có được
-- gán source='shipment' đúng với bản chất của chúng. Chạy lại nhiều lần không sao.
-- =====================================================================

BEGIN;

-- 1) Nới CHECK của event_type để nhận thêm 'opening_balance'
ALTER TABLE financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_event_type_check;
ALTER TABLE financial_transactions ADD CONSTRAINT financial_transactions_event_type_check
    CHECK (event_type IN (
        'shipment_revenue', 'prepaid_received', 'prepaid_refunded',
        'cash_receipt', 'bank_receipt',
        'driver_debt_created', 'driver_debt_paid',
        'customer_debt_created', 'customer_payment',
        'pass_through_cost', 'expense_recorded',
        'payroll_paid', 'bonus_paid',
        'advance_disbursed', 'advance_recovered',
        'debt_transferred',
        'opening_balance'
    ));

-- 2) Đánh dấu nguồn gốc khoản nợ + ngày phát sinh thật + người khai
ALTER TABLE debts ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'shipment';
ALTER TABLE debts DROP CONSTRAINT IF EXISTS debts_source_check;
ALTER TABLE debts ADD CONSTRAINT debts_source_check CHECK (source IN ('shipment', 'manual'));

-- Ngày khoản nợ thật sự phát sinh. Nợ cũ có thể phát sinh từ nhiều tháng trước ngày
-- khai, dùng created_at để tính tuổi nợ sẽ ra sai.
ALTER TABLE debts ADD COLUMN IF NOT EXISTS incurred_on DATE;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS created_by INT REFERENCES profiles(id);

COMMENT ON COLUMN debts.source      IS 'shipment = sinh từ chuyến; manual = kế toán khai tay (thường là nợ cũ)';
COMMENT ON COLUMN debts.incurred_on IS 'Ngày khoản nợ thật sự phát sinh — dùng để tính tuổi nợ, khác created_at là ngày khai vào hệ thống';

CREATE INDEX IF NOT EXISTS idx_debts_source ON debts(source) WHERE source = 'manual';

-- 3) Trần khấu trừ nợ tài xế mỗi kỳ lương, tính trên số thực còn được nhận trong kỳ.
--    30% là mặc định an toàn: tài xế vẫn cầm về phần lớn lương, nợ vẫn giảm dần.
ALTER TABLE company_info
    ADD COLUMN IF NOT EXISTS driver_debt_monthly_cap_percent NUMERIC(5,2) NOT NULL DEFAULT 30;
ALTER TABLE company_info DROP CONSTRAINT IF EXISTS company_info_debt_cap_check;
ALTER TABLE company_info ADD CONSTRAINT company_info_debt_cap_check
    CHECK (driver_debt_monthly_cap_percent > 0 AND driver_debt_monthly_cap_percent <= 100);

COMMENT ON COLUMN company_info.driver_debt_monthly_cap_percent IS
    'Trần khấu trừ công nợ tài xế mỗi kỳ lương, tính theo % số còn được nhận sau BHXH/ứng/nghỉ. 100 = trừ hết một lần.';

INSERT INTO schema_migrations (filename)
VALUES ('20260802_manual_debt.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
