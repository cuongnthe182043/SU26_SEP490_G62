/**
 * Quy tắc "chi phí chuyến hàng hư hại do DOANH NGHIỆP chịu" — nguồn sự thật dùng chung
 * cho phiếu thu (coordinatorService), bút toán cấn trừ nợ tài xế (tripRepository),
 * hoàn chi phí qua lương (accountantPayrollRepository) và các báo cáo kế toán.
 *
 * Vì sao có file này: quy tắc bị áp ở nhiều tầng (JS + SQL). Lệch một chỗ là màn Doanh thu
 * hiện "khách còn nợ" một khoản mà phiếu thu không hề đòi, hoặc tài khoản 3388 (chi hộ —
 * phải thu lại của khách) ôm một số dư không bao giờ tất toán được.
 */
const assert = require('node:assert');
const {
    isCompanyBorneShipment,
    isCustomerBillableExpense,
    CUSTOMER_BILLABLE_EXPENSE_SQL,
} = require('../../constants/expenseConstants');

describe('Chi phí chuyến hàng hư hại → doanh nghiệp chịu', () => {
    it('chuyến hủy (hàng hư hại) và chuyến giao thất bại đều là chuyến DN chịu chi phí', () => {
        assert.strictEqual(isCompanyBorneShipment('cancelled'), true);
        assert.strictEqual(isCompanyBorneShipment('failed'), true);
        assert.strictEqual(isCompanyBorneShipment('CANCELLED'), true, 'không phân biệt hoa thường');
    });

    it('chuyến đang chạy / đã hoàn thành thì không phải DN chịu', () => {
        for (const status of ['completed', 'transit', 'arrived', 'returning', 'claimed', 'available']) {
            assert.strictEqual(isCompanyBorneShipment(status), false, status);
        }
        assert.strictEqual(isCompanyBorneShipment(null), false);
        assert.strictEqual(isCompanyBorneShipment(undefined), false);
    });

    it('chi hộ khách (toll/parking/etc) của chuyến GIAO ĐƯỢC vẫn tính vào tiền khách', () => {
        for (const type of ['toll', 'parking', 'etc']) {
            assert.strictEqual(isCustomerBillableExpense(type, 'completed'), true, type);
        }
    });

    it('chi hộ khách của chuyến HÀNG HƯ HẠI (đã hủy) KHÔNG được tính vào tiền khách', () => {
        for (const type of ['toll', 'parking', 'etc']) {
            assert.strictEqual(isCustomerBillableExpense(type, 'cancelled'), false, type);
            assert.strictEqual(isCustomerBillableExpense(type, 'failed'), false, type);
        }
    });

    it('chi phí công ty (fuel/repair) không bao giờ tính vào tiền khách, dù chuyến thế nào', () => {
        for (const status of ['completed', 'cancelled', 'failed']) {
            assert.strictEqual(isCustomerBillableExpense('fuel', status), false, status);
            assert.strictEqual(isCustomerBillableExpense('repair', status), false, status);
        }
    });

    it('chi phí không gắn chuyến nào (bảo dưỡng xe) giữ nguyên cách phân loại theo loại chi phí', () => {
        assert.strictEqual(isCustomerBillableExpense('toll', null), true);
        assert.strictEqual(isCustomerBillableExpense('fuel', null), false);
    });

    it('bản SQL của quy tắc phải nêu đủ CẢ HAI vế: loại chi hộ VÀ trạng thái chuyến', () => {
        const sql = CUSTOMER_BILLABLE_EXPENSE_SQL('e', 'os');
        assert.match(sql, /e\.expense_type IN \('toll','parking','etc'\)/);
        assert.match(sql, /os\.status NOT IN \('cancelled','failed'\)/);
        // Alias phải đi vào đúng vế — dùng nhầm alias là lỗi SQL im lặng ở runtime
        const aliased = CUSTOMER_BILLABLE_EXPENSE_SQL('exp', 'os4');
        assert.match(aliased, /exp\.expense_type/);
        assert.match(aliased, /os4\.status/);
    });
});
